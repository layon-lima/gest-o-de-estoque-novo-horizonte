import { useEffect, useState } from 'react';
import { Globe2, Loader2, Search } from 'lucide-react';

import { api } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

function sourceHost(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export default function ProdutoImagemWebSearch({
  defaultQuery = '',
  onSelect,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [importingUrl, setImportingUrl] = useState('');
  const { toast } = useToast();

  async function search(term = query) {
    const normalized = String(term || '').trim();

    if (normalized.length < 2) {
      toast({
        variant: 'destructive',
        title: 'Informe o produto',
        description: 'Digite pelo menos 2 caracteres para pesquisar.',
      });
      return;
    }

    setSearching(true);

    try {
      const data = await api.integrations.Core.SearchProductImages({
        query: normalized,
      });

      setResults(Array.isArray(data?.results) ? data.results : []);

      if (!data?.results?.length) {
        toast({
          title: 'Nenhuma imagem encontrada',
          description: 'Tente mudar o nome, marca ou código pesquisado.',
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro na busca',
        description: err?.message || 'Não foi possível pesquisar imagens.',
      });
    } finally {
      setSearching(false);
    }
  }

  async function choose(item) {
    if (!item?.image_url) return;

    setImportingUrl(item.image_url);

    try {
      const data = await api.integrations.Core.ImportImageFromUrl({
        url: item.image_url,
        source_url: item.source_url,
      });

      onSelect?.(data.file_url);
      setOpen(false);

      toast({
        title: 'Imagem adicionada',
        description: 'Uma cópia foi salva no sistema e vinculada ao produto.',
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Não foi possível usar esta imagem',
        description: err?.message || 'Escolha outra imagem.',
      });
    } finally {
      setImportingUrl('');
    }
  }

  useEffect(() => {
    if (!open) return;

    const initial = String(defaultQuery || '').trim();
    setQuery(initial);
    setResults([]);

    if (initial.length >= 2) {
      search(initial);
    }
    // A busca inicial deve ocorrer somente ao abrir o modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 w-fit gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Globe2 className="h-3.5 w-3.5" />
        Buscar na internet
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-5xl">
          <DialogHeader>
            <DialogTitle>Buscar imagem do produto</DialogTitle>
            <DialogDescription>
              Pesquise pelo nome, marca ou código. Ao escolher, o sistema salva uma cópia da imagem no servidor.
            </DialogDescription>
          </DialogHeader>

          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              search();
            }}
          >
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-9"
                placeholder="Ex.: Filtro Donaldson P550020"
              />
            </div>

            <Button type="submit" disabled={searching || query.trim().length < 2}>
              {searching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Buscar
            </Button>
          </form>

          <div className="min-h-[280px]">
            {searching ? (
              <div className="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Pesquisando imagens…
              </div>
            ) : results.length ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {results.map((item, index) => {
                  const busy = importingUrl === item.image_url;
                  const host = sourceHost(item.source_url);

                  return (
                    <div
                      key={`${item.image_url}-${index}`}
                      className="overflow-hidden rounded-xl border bg-card"
                    >
                      <div className="aspect-square bg-muted/30">
                        <img
                          src={item.thumbnail_url || item.image_url}
                          alt={item.title || `Resultado ${index + 1}`}
                          className="h-full w-full object-contain"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      <div className="space-y-2 p-2.5">
                        <div className="min-h-[36px]">
                          <p className="line-clamp-2 text-xs font-medium">
                            {item.title || 'Imagem encontrada'}
                          </p>
                          {host ? (
                            <p className="mt-1 truncate text-[10px] text-muted-foreground">
                              {host}
                            </p>
                          ) : null}
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          className="h-8 w-full"
                          disabled={!!importingUrl}
                          onClick={() => choose(item)}
                        >
                          {busy ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          Usar esta imagem
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed text-center">
                <Globe2 className="mb-3 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-medium">Pesquise uma imagem para o produto</p>
                <p className="mt-1 max-w-md text-xs text-muted-foreground">
                  Para peças e insumos, incluir marca ou código costuma trazer resultados mais precisos.
                </p>
              </div>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            A busca mostra imagens públicas da web. Confirme a origem e se você pode usar a imagem escolhida.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
