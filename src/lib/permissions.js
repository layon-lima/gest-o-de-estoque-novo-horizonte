// Definição das páginas do app e helpers de controle de acesso por usuário.
export const PAGES = [
  { key: 'dashboard', label: 'Pesquisa', path: '/' },
  { key: 'movimentacoes', label: 'Entradas e Saídas', path: '/movimentacoes' },
  { key: 'abastecimento', label: 'Abastecimento', path: '/abastecimento' },
  { key: 'pesagem', label: 'Pesagem', path: '/pesagem' },
  { key: 'cadastros', label: 'Cadastros', path: '/cadastros' },
  { key: 'relatorios', label: 'Relatórios', path: '/relatorios' },
  { key: 'inventario', label: 'Inventário', path: '/inventario' },
];

export const USUARIOS_PATH = '/usuarios';

export const pageKeyForPath = (pathname) => {
  if (!pathname) return null;
  if (pathname === '/' || pathname === '') return 'dashboard';
  const found = PAGES.find((p) => p.path !== '/' && pathname.startsWith(p.path));
  return found ? found.key : null;
};

export const userCanAccess = (user, pageKey) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!pageKey) return true; // páginas não mapeadas são tratadas em outro lugar
  const allowed = user.paginas_permitidas;
  if (!Array.isArray(allowed)) return true; // não configurado = acesso total (compatibilidade)
  return allowed.includes(pageKey);
};

export const allowedPagesForUser = (user) => {
  if (!user) return [];
  if (user.role === 'admin') return PAGES;
  const allowed = user.paginas_permitidas;
  if (!Array.isArray(allowed)) return PAGES; // não configurado = tudo
  return PAGES.filter((p) => allowed.includes(p.key));
};

export const canAccessUsuarios = (user) => user?.role === 'admin';
export const canAccessBalanca = (user) => user?.role === 'admin';
export const podeDigitarPeso = (user) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return user.pode_digitar_peso === true;
};