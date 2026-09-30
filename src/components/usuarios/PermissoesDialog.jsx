import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowRightLeft,
  Loader2,
  Lock,
  PackageMinus,
  Smartphone,
  Warehouse,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { PAGES } from '@/lib/permissions';

export default function PermissoesDialog({ user, onClose, onSaved }) {
  const open = !!user;

  const [selecionados, setSelecionados] = useState([]);
  const [setores, setSetores] = useState([]);
  const [setoresSel, setSetoresSel] = useState([]);
  const [podeDigitarPeso, setPodeDigitarPeso] = useState(false);
  const [acoesMobile, setAcoesMobile] = useState([]);
  const [loadingSetores, setLoadingSetores] = useState(false);
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();

  const nomeUsuario = user?.display_name || user?.username || 'Usuário';

  useEffect(() => {
    setSelecionados(
      Array.isArray(user?.paginas_permitidas)
        ? user.paginas_permitidas
        : []
    );

    setSetoresSel(
      Array.isArray(user?.setores_permitidos)
        ? user.setores_permitidos
        : []
    );

    setPodeDigitarPeso(user?.pode_digitar_peso === true);

    setAcoesMobile([
      user?.pode_baixar_mobile ? 'baixar' : null,
      user?.pode_mudar_gaveta_mobile ? 'mudar_gaveta' : null,
      user?.pode_mudar_deposito_mobile ? 'mudar_deposito' : null,
    ].filter(Boolean));
  }, [user]);

  useEffect(() => {
    if (!open) return;

    let ativo = true;

    const carregarSetores = async () => {
      setLoadingSetores(true);

      try {
        const lista = await base44.entities.Setor.list();

        if (!ativo) return;

        const ordenados = [...(lista || [])].sort((a, b) =>
          String(a.nome || '').localeCompare(
            String(b.nome || ''),
            'pt-BR',
            { sensitivity: 'base' }
          )
        );

        setSetores(ordenados);
      } catch {
        if (ativo) setSetores([]);
      } finally {
        if (ativo) setLoadingSetores(false);
      }
    };

    carregarSetores();

    return () => {
      ativo = false;
    };
  }, [open]);

  const setoresSelecionadosValidos = useMemo(() => {
    const idsExistentes = new Set(setores.map((setor) => setor.id));
    return setoresSel.filter((id) => idsExistentes.has(id));
  }, [setores, setoresSel]);

  const toggle = (key) => {
    setSelecionados((prev) =>
      prev.includes(key)
        ? prev.filter((item) => item !== key)
        : [...prev, key]
    );
  };

  const toggleSetor = (id) => {
    setSetoresSel((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  };

  const toggleAcaoMobile = (key) => {
    setAcoesMobile((prev) =>
      prev.includes(key)
        ? prev.filter((item) => item !== key)
        : [...prev, key]
    );
  };

  const selecionarTodosSetores = () => {
    setSetoresSel(setores.map((setor) => setor.id));
  };

  const limparSetores = () => {
    setSetoresSel([]);
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      await base44.entities.User.update(user.id, {
        paginas_permitidas: selecionados,
        setores_permitidos: setoresSelecionadosValidos,
        pode_digitar_peso: podeDigitarPeso,
        pode_baixar_mobile: acoesMobile.includes('baixar'),
        pode_mudar_gaveta_mobile: acoesMobile.includes('mudar_gaveta'),
        pode_mudar_deposito_mobile: acoesMobile.includes('mudar_deposito'),
      });

      toast({
        title: 'Permissões atualizadas',
        description: `Os acessos de ${nomeUsuario} foram atualizados.`,
      });

      onSaved?.();
      onClose?.();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: err?.message || 'Não foi possível atualizar as permissões.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(aberto) => !aberto && onClose?.()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Permissões de Acesso
          </DialogTitle>

          <DialogDescription>
            Defina o que <b>{nomeUsuario}</b> pode acessar no computador e no celular.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <p className="text-sm font-semibold">Páginas do sistema</p>
            <p className="text-xs text-muted-foreground">
              Controla as áreas do sistema que este usuário pode acessar.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {PAGES.map((pagina) => (
              <label
                key={pagina.key}
                className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/40"
              >
                <Checkbox
                  checked={selecionados.includes(pagina.key)}
                  onCheckedChange={() => toggle(pagina.key)}
                />
                <span className="text-sm font-medium">{pagina.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-semibold">Pesagem</p>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/40">
            <Checkbox
              checked={podeDigitarPeso}
              onCheckedChange={setPodeDigitarPeso}
            />

            <div>
              <span className="text-sm font-medium">
                Digitar peso manualmente
              </span>
              <p className="text-xs text-muted-foreground">
                Permite digitar o peso nos tickets em vez de usar apenas a balança.
              </p>
            </div>
          </label>
        </div>

        <div className="space-y-3 border-t pt-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Smartphone className="h-4 w-4 text-primary" />
              Ações no produto pelo celular
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Define quais opções aparecem ao apertar e segurar um produto.
            </p>
          </div>

          <div className="grid gap-2">
            {[
              {
                key: 'baixar',
                label: 'Dar baixa',
                description: 'Realizar uma saída real do saldo selecionado.',
                icon: PackageMinus,
              },
              {
                key: 'mudar_gaveta',
                label: 'Mudar gaveta',
                description: 'Mover saldo entre gavetas do mesmo depósito.',
                icon: ArrowRightLeft,
              },
              {
                key: 'mudar_deposito',
                label: 'Mudar depósito',
                description: 'Mover saldo para outro depósito e outra gaveta.',
                icon: Warehouse,
              },
            ].map((acao) => {
              const Icon = acao.icon;

              return (
                <label
                  key={acao.key}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/40"
                >
                  <Checkbox
                    checked={acoesMobile.includes(acao.key)}
                    onCheckedChange={() => toggleAcaoMobile(acao.key)}
                  />
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <span className="text-sm font-medium">{acao.label}</span>
                    <p className="text-xs text-muted-foreground">
                      {acao.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 border-t pt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Smartphone className="h-4 w-4 text-primary" />
                Setores liberados no celular
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Marque os setores que devem aparecer na Home e na barra inferior
                do mobile deste usuário.
              </p>
            </div>

            {!loadingSetores && setores.length > 0 ? (
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
                {setoresSelecionadosValidos.length}/{setores.length}
              </span>
            ) : null}
          </div>

          {loadingSetores ? (
            <div className="flex items-center justify-center rounded-lg border py-6 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando setores...
            </div>
          ) : setores.length === 0 ? (
            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
              Nenhum setor cadastrado no sistema.
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selecionarTodosSetores}
                >
                  Marcar todos
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={limparSetores}
                >
                  Limpar
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {setores.map((setor) => (
                  <label
                    key={setor.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={setoresSel.includes(setor.id)}
                      onCheckedChange={() => toggleSetor(setor.id)}
                    />

                    <div
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{
                        backgroundColor: setor.cor || '#16a34a',
                      }}
                    />

                    <span className="min-w-0 truncate text-sm font-medium">
                      {setor.nome}
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Para usuários padrão, somente os setores marcados acima aparecem no
          mobile. Administradores continuam com acesso total aos setores.
        </p>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </Button>

          <Button
            onClick={handleSave}
            disabled={saving || loadingSetores}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Salvar Permissões'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
