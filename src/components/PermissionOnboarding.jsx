import { useState, useEffect, useCallback } from 'react';
import { Camera, Bell, CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PERM_KEY = 'perm_onboarding_v1';
const REQUIRED = ['camera', 'notifications'];

/**
 * Consulta o status atual de uma permissão via Permissions API,
 * com fallback para Notifications (Notification.permission) quando o navegador
 * não suporta query para o nome.
 */
async function getStatus(name) {
  try {
    const status = await navigator.permissions.query({ name });
    return status.state; // granted | denied | prompt
  } catch {
    if (name === 'notifications' && 'Notification' in window) {
      return Notification.permission; // granted | denied | default
    }
    return 'prompt';
  }
}

/** Solicita a permissão de câmera abrindo e fechando o stream. */
async function requestCamera() {
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    stream.getTracks().forEach((t) => t.stop());
    return 'granted';
  } catch {
    return 'denied';
  }
}

/** Solicita a permissão de notificações. */
async function requestNotifications() {
  if (!('Notification' in window)) return 'unsupported';
  const result = await Notification.requestPermission();
  return result; // granted | denied | default
}

const REQUESTERS = {
  camera: requestCamera,
  notifications: requestNotifications,
};

const PERMISSION_META = {
  camera: {
    icon: Camera,
    title: 'Câmera',
    description: 'Necessária para tirar fotos do painel do abastecedor e fotos de referência dos produtos.',
  },
  notifications: {
    icon: Bell,
    title: 'Notificações',
    description: 'Para alertar sobre estoque baixo, pagamentos pendentes e abastecimentos aguardando confirmação.',
  },
};

function normalize(state) {
  // 'default' (notifications) equivale a 'prompt'
  return state === 'default' ? 'prompt' : state;
}

/**
 * Decide se o onboarding deve ser exibido:
 * - Primeira abertura (sem registro)
 * - Alguma permissão que estava concedida passou a não estar mais
 */
function shouldShow(current) {
  try {
    const stored = JSON.parse(localStorage.getItem(PERM_KEY) || 'null');
    if (!stored) return true;
    const prev = stored.states || {};
    for (const k of REQUIRED) {
      if (prev[k] === 'granted' && normalize(current[k]) !== 'granted') return true;
    }
    return false;
  } catch {
    return true;
  }
}

function markDone(current) {
  const states = {};
  for (const k of REQUIRED) states[k] = normalize(current[k]);
  localStorage.setItem(PERM_KEY, JSON.stringify({ v: 1, states }));
}

export default function PermissionOnboarding() {
  const [visible, setVisible] = useState(false);
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState({});
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const result = {};
    await Promise.all(
      REQUIRED.map(async (name) => {
        result[name] = normalize(await getStatus(name));
      })
    );
    return result;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const current = await refresh();
      if (cancelled) return;
      setStatuses(current);
      if (shouldShow(current)) setVisible(true);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function handleRequest(name) {
    setLoading((s) => ({ ...s, [name]: true }));
    try {
      await REQUESTERS[name]();
      const current = await refresh();
      setStatuses(current);
    } finally {
      setLoading((s) => ({ ...s, [name]: false }));
    }
  }

  function handleDone() {
    markDone(statuses);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="w-full sm:max-w-md glass-clear rounded-t-2xl sm:rounded-2xl border shadow-xl max-h-[92dvh] overflow-y-auto">
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Permissões do App</h2>
              <p className="text-xs text-muted-foreground">Para funcionar por completo</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-3 mb-4">
            O Controle de Estoque Novo Horizonte precisa destas permissões para oferecer todos os recursos no campo.
          </p>

          <div className="space-y-3">
            {REQUIRED.map((name) => {
              const meta = PERMISSION_META[name];
              const Icon = meta.icon;
              const state = statuses[name] || 'prompt';
              const granted = state === 'granted';
              const denied = state === 'denied';
              const unsupported = state === 'unsupported';
              return (
                <div
                  key={name}
                  className={`rounded-xl border p-3.5 flex gap-3 items-start ${
                    granted ? 'bg-primary/5 border-primary/30' : 'glass-tinted'
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${granted ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{meta.title}</p>
                      {granted && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3" /> Ativada
                        </span>
                      )}
                      {denied && (
                        <span className="text-[10px] font-bold uppercase text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">
                          Negada
                        </span>
                      )}
                      {unsupported && (
                        <span className="text-[10px] font-bold uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          Indisponível
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                    {!granted && !unsupported && (
                      <Button
                        type="button"
                        size="sm"
                        variant={denied ? 'outline' : 'default'}
                        className="mt-2 h-8"
                        disabled={loading[name]}
                        onClick={() => handleRequest(name)}
                      >
                        {loading[name] ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Aguarde…</>
                        ) : denied ? (
                          'Abrir configurações'
                        ) : (
                          'Permitir'
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 mt-5">
            <Button type="button" className="flex-1" onClick={handleDone}>
              Concluir
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            Você pode usar o app mesmo sem conceder todas as permissões.
          </p>
        </div>
      </div>
    </div>
  );
}