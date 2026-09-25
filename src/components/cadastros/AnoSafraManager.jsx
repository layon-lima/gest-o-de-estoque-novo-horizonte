import { useState } from 'react';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import {
  useEntidades,
  invalidateEntidade,
} from '@/lib/useEntidades';


export default function AnoSafraManager() {
  const [novo, setNovo] = useState('');
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();

  const { data } = useEntidades({
    AnoSafra: {
      sort: '-created_date',
      limit: 500,
    },
  });

  const anosSafra =
    data.AnoSafra || [];


  async function handleAdd(e) {
    e.preventDefault();

    const nome =
      novo.trim();

    if (!nome) {
      toast({
        variant: 'destructive',
        title: 'Informe o ano safra',
      });

      return;
    }

    const existe =
      anosSafra.some(
        (a) =>
          (a.nome || '')
            .trim()
            .toUpperCase()
          ===
          nome.toUpperCase()
      );

    if (existe) {
      toast({
        variant: 'destructive',
        title: 'Ano safra já cadastrado',
      });

      return;
    }

    setSaving(true);

    try {
      await base44.entities.AnoSafra.create({
        nome,
      });

      invalidateEntidade(
        'AnoSafra'
      );

      setNovo('');

      toast({
        title: 'Ano safra cadastrado',
        description: nome,
      });

    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar',
        description:
          String(
            err?.message || err
          ),
      });

    } finally {
      setSaving(false);
    }
  }


  async function handleDelete(ano) {
    try {
      await base44.entities.AnoSafra.delete(
        ano.id
      );

      invalidateEntidade(
        'AnoSafra'
      );

      toast({
        title: 'Ano safra removido',
      });

    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao remover',
        description:
          String(
            err?.message || err
          ),
      });
    }
  }


  return (
    <div className="cadastro-manager-grid">

      <Card className="cadastro-form-card">

        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="w-4 h-4 text-primary" />

          <h3 className="font-semibold">
            Novo Ano/Safra
          </h3>
        </div>

        <form
          onSubmit={handleAdd}
          className="space-y-3"
        >
          <Input
            value={novo}
            onChange={(e) =>
              setNovo(
                e.target.value
              )
            }
            placeholder="Ex.: 2026/2027"
          />

          <Button
            type="submit"
            disabled={saving}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />

            {saving
              ? 'Salvando...'
              : 'Adicionar'}
          </Button>

        </form>

      </Card>


      <div className="cadastro-list-panel">

        {anosSafra.length === 0 ? (

          <Card className="p-10 text-center">
            <CalendarDays className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />

            <p className="text-sm text-muted-foreground">
              Nenhum ano safra cadastrado.
            </p>
          </Card>

        ) : (

          <div className="space-y-2">

            {anosSafra.map((ano) => (

              <Card
                key={ano.id}
                className="cadastro-list-row"
              >
                <div className="flex items-center justify-between gap-3">

                  <Badge
                    variant="secondary"
                    className="font-mono text-sm"
                  >
                    {ano.nome}
                  </Badge>

                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() =>
                      handleDelete(ano)
                    }
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>

                </div>
              </Card>

            ))}

          </div>
        )}

      </div>

    </div>
  );
}
