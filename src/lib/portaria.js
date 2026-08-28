import { base44 } from '@/api/base44Client';

// Normalizações para comparação anti-duplicidade
const normDoc = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const normPlaca = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const normNome = (s) => (s || '').trim().toUpperCase();

export async function loadMotoristas() {
  try {
    const all = await base44.entities.Pessoa.list('-created_date', 500);
    return all.filter((p) => p.is_motorista);
  } catch {
    return [];
  }
}

export async function loadTransportadoras() {
  try {
    return await base44.entities.Transportadora.list('-created_date', 500);
  } catch {
    return [];
  }
}

export async function loadVeiculos() {
  try {
    return await base44.entities.Veiculo.list('-created_date', 500);
  } catch {
    return [];
  }
}

// Motorista → grava na entidade Pessoa (is_motorista = true).
// Valida duplicidade por documento (normalizado) ou nome antes de criar.
export async function registrarMotorista({ nome, documento, telefone, cidade, observacao }) {
  const list = await loadMotoristas();
  const docN = normDoc(documento);
  const nomeN = normNome(nome);
  const exist = list.find(
    (p) => (docN && normDoc(p.documento) === docN) || normNome(p.nome) === nomeN
  );
  if (exist) {
    if (!exist.is_motorista) {
      const upd = await base44.entities.Pessoa.update(exist.id, { is_motorista: true });
      return { action: 'reutilizado', record: { ...exist, ...upd } };
    }
    return { action: 'reutilizado', record: exist };
  }
  const record = await base44.entities.Pessoa.create({
    nome: nome.trim(),
    documento: (documento || '').trim(),
    telefone: (telefone || '').trim(),
    cidade: (cidade || '').trim(),
    observacao: observacao || '',
    is_motorista: true,
  });
  return { action: 'criado', record };
}

// Transportadora → grava na entidade Transportadora.
// Valida duplicidade por documento (normalizado) ou nome antes de criar.
export async function registrarTransportadora({ nome, documento, telefone, cidade, observacao }) {
  const list = await loadTransportadoras();
  const docN = normDoc(documento);
  const nomeN = normNome(nome);
  const exist = list.find(
    (t) => (docN && normDoc(t.documento) === docN) || normNome(t.nome) === nomeN
  );
  if (exist) return { action: 'reutilizado', record: exist };
  const record = await base44.entities.Transportadora.create({
    nome: nome.trim(),
    documento: (documento || '').trim(),
    telefone: (telefone || '').trim(),
    cidade: (cidade || '').trim(),
    observacao: observacao || '',
  });
  return { action: 'criado', record };
}

// Veículo (placa) → grava na entidade Veiculo.
// Valida duplicidade por placa (normalizada) antes de criar.
export async function registrarVeiculo({ placa, transportadora_id, motorista_id, observacao }) {
  const list = await loadVeiculos();
  const placaN = normPlaca(placa);
  const exist = list.find((v) => normPlaca(v.placa) === placaN);
  if (exist) {
    const patch = {};
    if (transportadora_id && !exist.transportadora_id) patch.transportadora_id = transportadora_id;
    if (motorista_id && !exist.motorista_id) patch.motorista_id = motorista_id;
    if (observacao && !exist.observacao) patch.observacao = observacao;
    if (Object.keys(patch).length) {
      const upd = await base44.entities.Veiculo.update(exist.id, patch);
      return { action: 'reutilizado', record: { ...exist, ...upd } };
    }
    return { action: 'reutilizado', record: exist };
  }
  const record = await base44.entities.Veiculo.create({
    placa: placaN,
    transportadora_id: transportadora_id || '',
    motorista_id: motorista_id || '',
    observacao: observacao || '',
  });
  return { action: 'criado', record };
}