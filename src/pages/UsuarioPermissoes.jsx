import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRightLeft,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  LockKeyhole,
  Monitor,
  MonitorSmartphone,
  PackageMinus,
  Save,
  Smartphone,
  UserRound,
  Warehouse,
} from 'lucide-react';

import { api } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { PAGES } from '@/lib/permissions';

const MOBILE_ACTIONS = [
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
];

function PermissionItem({ checked, onChange, icon: Icon, title, description }) {
  return (
    <label className="flex min-h-[68px] cursor-pointer items-start gap-3 rounded-xl border bg-background p-3.5 transition-colors hover:border-primary/30 hover:bg-primary/[0.025]">
      <Checkbox checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      {Icon ? (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
      ) : null}
      <span className="min-w-0">
        <strong className="block text-sm font-semibold">{title}</strong>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

function PermissionSection({ icon: Icon, eyebrow, title, description, badge, children }) {
  return (
    <Card className="overflow-hidden rounded-2xl border shadow-none">
      <div className="flex items-start justify-between gap-4 border-b bg-muted/20 px-5 py-4">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">
              {eyebrow}
            </p>
            <h2 className="mt-0.5 text-base font-semibold">{title}</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
        {badge ? (
          <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

export default function UsuarioPermissoes() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState(null);
  const [setores, setSetores] = useState([]);
  const [paginas, setPaginas] = useState([]);
  const [setoresSel, setSetoresSel] = useState([]);
  const [acoesMobile, setAcoesMobile] = useState([]);
  const [podeDigitarPeso, setPodeDigitarPeso] = useState(false);
  const [podeConfirmarAbastecimento, setPodeConfirmarAbastecimento] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const voltar = () => navigate('/cadastros?tab=usuarios');

  useEffect(() => {
    let active = true;

    const carregarUsuario = async () => {
      if (typeof api.entities.User.get === 'function') {
        try {
          return await api.entities.User.get(userId);
        } catch {
          // Compatibilidade com o backend que ainda pode estar executando a
          // versão anterior, sem a rota de consulta individual.
        }
      }

      const usuarios = await api.entities.User.list();
      const encontrado = usuarios.find((item) => item.id === userId);

      if (!encontrado) {
        throw new Error('Usuário não encontrado.');
      }

      return encontrado;
    };

    Promise.all([
      carregarUsuario(),
      api.entities.Setor.list(),
    ])
      .then(([usuario, listaSetores]) => {
        if (!active) return;

        const ordenados = [...(listaSetores || [])].sort((a, b) =>
          String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', {
            sensitivity: 'base',
          })
        );

        setUser(usuario);
        setSetores(ordenados);
        setPaginas(Array.isArray(usuario.paginas_permitidas) ? usuario.paginas_permitidas : []);
        setSetoresSel(Array.isArray(usuario.setores_permitidos) ? usuario.setores_permitidos : []);
        setPodeDigitarPeso(usuario.pode_digitar_peso === true);
        setPodeConfirmarAbastecimento(usuario.pode_confirmar_abastecimento === true);
        setAcoesMobile([
          usuario.pode_baixar_mobile ? 'baixar' : null,
          usuario.pode_mudar_gaveta_mobile ? 'mudar_gaveta' : null,
          usuario.pode_mudar_deposito_mobile ? 'mudar_deposito' : null,
        ].filter(Boolean));
      })
      .catch((error) => {
        if (!active) return;
        toast({
          variant: 'destructive',
          title: 'Não foi possível abrir as permissões',
          description: error?.message,
        });
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [toast, userId]);

  const setoresValidos = useMemo(() => {
    const ids = new Set(setores.map((setor) => setor.id));
    return setoresSel.filter((id) => ids.has(id));
  }, [setores, setoresSel]);

  const toggleList = (setter, key) => {
    setter((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    );
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      await api.entities.User.update(user.id, {
        paginas_permitidas: paginas,
        setores_permitidos: setoresValidos,
        pode_digitar_peso: podeDigitarPeso,
        pode_confirmar_abastecimento: podeConfirmarAbastecimento,
        pode_baixar_mobile: acoesMobile.includes('baixar'),
        pode_mudar_gaveta_mobile: acoesMobile.includes('mudar_gaveta'),
        pode_mudar_deposito_mobile: acoesMobile.includes('mudar_deposito'),
      });

      toast({
        title: 'Permissões atualizadas',
        description: `Os acessos de ${user.display_name || user.username} foram salvos.`,
      });
      voltar();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: error?.message || 'Não foi possível atualizar as permissões.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl py-20 text-center">
        <h1 className="text-xl font-semibold">Usuário não encontrado</h1>
        <Button variant="outline" className="mt-4" onClick={voltar}>Voltar aos usuários</Button>
      </div>
    );
  }

  const nome = user.display_name || user.username || 'Usuário';

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-5 lg:px-6">
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Button variant="outline" size="icon" onClick={voltar} title="Voltar aos usuários">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UserRound className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Controle de acesso</p>
            <h1 className="truncate text-xl font-semibold">Permissões de {nome}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {user.username} · As alterações valem no computador e no celular conforme cada grupo.
            </p>
          </div>
        </div>
        <div className="flex gap-2 sm:shrink-0">
          <Button variant="outline" onClick={voltar} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar permissões
          </Button>
        </div>
      </div>

      <PermissionSection
        icon={MonitorSmartphone}
        eyebrow="Computador e celular"
        title="Áreas do sistema"
        description="Define quais módulos este usuário pode abrir, independentemente do dispositivo usado."
        badge={`${paginas.length}/${PAGES.length}`}
      >
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {PAGES.map((pagina) => (
            <PermissionItem
              key={pagina.key}
              checked={paginas.includes(pagina.key)}
              onChange={() => toggleList(setPaginas, pagina.key)}
              title={pagina.label}
              description="Acesso ao módulo"
            />
          ))}
        </div>
      </PermissionSection>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <PermissionSection
          icon={Monitor}
          eyebrow="Somente computador"
          title="Recursos da operação no PC"
          description="Permissões específicas para rotinas administrativas executadas no computador."
        >
          <div className="grid gap-2.5">
            <PermissionItem
              checked={podeDigitarPeso}
              onChange={setPodeDigitarPeso}
              icon={ClipboardCheck}
              title="Digitar peso manualmente"
              description="Permite informar o peso dos tickets sem usar apenas a balança."
            />
            <PermissionItem
              checked={podeConfirmarAbastecimento}
              onChange={setPodeConfirmarAbastecimento}
              icon={CheckCircle2}
              title="Confirmar abastecimentos"
              description="Permite conferir a foto e confirmar a baixa do abastecimento."
            />
          </div>
        </PermissionSection>

        <PermissionSection
          icon={Smartphone}
          eyebrow="Somente celular"
          title="Ações ao segurar um produto"
          description="Controla as opções disponíveis no menu de ações rápidas do mobile."
          badge={`${acoesMobile.length}/${MOBILE_ACTIONS.length}`}
        >
          <div className="grid gap-2.5">
            {MOBILE_ACTIONS.map((action) => (
              <PermissionItem
                key={action.key}
                checked={acoesMobile.includes(action.key)}
                onChange={() => toggleList(setAcoesMobile, action.key)}
                icon={action.icon}
                title={action.label}
                description={action.description}
              />
            ))}
          </div>
        </PermissionSection>
      </div>

      <PermissionSection
        icon={Warehouse}
        eyebrow="Somente celular"
        title="Setores exibidos no mobile"
        description="Escolha os setores que aparecem na página inicial e na barra inferior do celular."
        badge={`${setoresValidos.length}/${setores.length}`}
      >
        <div className="mb-4 flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setSetoresSel(setores.map((setor) => setor.id))}>
            Marcar todos
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSetoresSel([])}>
            Limpar seleção
          </Button>
        </div>
        {setores.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum setor cadastrado.
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {setores.map((setor) => (
              <label key={setor.id} className="flex cursor-pointer items-center gap-3 rounded-xl border bg-background p-3.5 hover:border-primary/30">
                <Checkbox checked={setoresSel.includes(setor.id)} onCheckedChange={() => toggleList(setSetoresSel, setor.id)} />
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: setor.cor || '#16a34a' }} />
                <strong className="min-w-0 truncate text-sm font-medium">{setor.nome}</strong>
              </label>
            ))}
          </div>
        )}
      </PermissionSection>

      <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-2"><LockKeyhole className="h-4 w-4" /> Administradores continuam com acesso total aos setores.</span>
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}
