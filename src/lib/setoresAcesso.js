// Retorna os setores visíveis para o usuário no mobile (tem_aba_mobile + setores_permitidos).
// O admin também respeita setores_permitidos (igual aos usuários comuns).
export function setoresAcessiveis(setores, user) {
  if (!user) return [];
  const permitidos = Array.isArray(user.setores_permitidos) ? user.setores_permitidos : [];
  return (setores || [])
    .filter((s) => s.tem_aba_mobile === true)
    .filter((s) => permitidos.includes(s.id));
}