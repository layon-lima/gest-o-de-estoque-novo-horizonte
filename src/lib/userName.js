// Retorna o nome de exibição do usuário, priorizando o display_name (personalizado)
// sobre o full_name (built-in, só-leitura). Cai para o e-mail se ambos estiverem vazios.
export function getDisplayName(user) {
  if (!user) return '';
  return (user.display_name && user.display_name.trim()) || user.full_name || user.email || '';
}

export function getDisplayInitial(user) {
  const name = getDisplayName(user);
  return (name || '?').charAt(0).toUpperCase();
}