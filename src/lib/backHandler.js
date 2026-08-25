// Coordena a interceptação do botão/gesto de voltar do sistema (mobile) para
// recolher overlays passo a passo em vez de navegar/sair da rota.
// Pilha LIFO global com um único listener de popstate.

const entries = []; // { onBack, consumed }
let listening = false;
let ignoreNextPop = false;

function onPop() {
  if (ignoreNextPop) {
    ignoreNextPop = false;
    return;
  }
  const top = entries[entries.length - 1];
  if (top && !top.consumed) {
    top.consumed = true;
    entries.pop();
    try { top.onBack(); } catch (e) { /* noop */ }
  }
  // Sem handler no topo: deixa o voltar natural navegar.
}

function ensureListener() {
  if (listening) return;
  listening = true;
  window.addEventListener('popstate', onPop);
}

// Empurra uma entrada de history para capturar o próximo "voltar".
// Retorna função de limpeza: chamada quando o overlay fecha via botão in-app
// (remove a entrada fantasma do history para evitar "voltar duas vezes").
export function pushBackEntry(onBack) {
  ensureListener();
  const entry = { onBack, consumed: false };
  entries.push(entry);
  window.history.pushState({ __backHandler: true }, '');
  return function unregister() {
    const idx = entries.indexOf(entry);
    if (idx >= 0) {
      entries.splice(idx, 1);
      ignoreNextPop = true;
      window.history.back();
    }
    // se já foi consumido pelo popstate, nada a fazer.
  };
}