// Parser de XML de NF-e focado na extração de dados para vínculo com tickets de pesagem.
// Estende o parser base (nfeParser.js) com campos de transporte e informações complementares.

function getElements(parent, tag) {
  return Array.from(parent.getElementsByTagName('*')).filter((el) => el.localName === tag);
}

function getText(parent, tag) {
  const el = getElements(parent, tag)[0];
  return el ? el.textContent.trim() : '';
}

// Extrai o número do ticket (formato PES-000001) do texto de informações complementares.
export function extrairNumeroTicketDoInfCpl(infCpl) {
  if (!infCpl) return null;
  const match = infCpl.match(/PES[-\s]?0*\d+/i);
  if (match) {
    // Normaliza para o padrão PES-000001
    const raw = match[0].replace(/[\s]/g, '');
    const num = raw.replace(/^PES[-]?/i, '');
    const digits = num.replace(/^0+/, '') || '0';
    return `PES-${digits.padStart(6, '0')}`;
  }
  return null;
}

// Normaliza nome para comparação (remove acentos, lowercase, espaços extras).
function normalizeNome(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Faz o parse completo de um XML de NF-e, extraindo todos os dados
 * necessários para o matching com tickets de pesagem de venda.
 */
export function parseNfeVendaXml(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');

  const parseError = doc.getElementsByTagName('parsererror')[0];
  if (parseError) {
    throw new Error('XML inválido ou mal formatado');
  }

  const infNFe = getElements(doc, 'infNFe')[0];
  const idAttr = infNFe?.getAttribute('Id') || '';
  const chave = idAttr.startsWith('NFe') ? idAttr.slice(3) : idAttr;

  const ide = getElements(doc, 'ide')[0];
  const nNF = ide ? getText(ide, 'nNF') : '';
  const dhEmi = ide ? getText(ide, 'dhEmi') : '';

  // Produto: pega o primeiro item da nota
  const detItems = getElements(doc, 'det');
  const primeiroDet = detItems[0];
  const produto = primeiroDet ? getText(primeiroDet, 'xProd') : '';
  const qCom = primeiroDet ? parseFloat(getText(primeiroDet, 'qCom') || '0') || 0 : 0;

  // Peso líquido: soma dos pesos dos volumes (vol/pesoL), ou fallback para qCom do primeiro item
  const volItems = getElements(doc, 'vol');
  let pesoLiquido = 0;
  for (const vol of volItems) {
    const pesoL = parseFloat(getText(vol, 'pesoL') || '0') || 0;
    pesoLiquido += pesoL;
  }
  if (!pesoLiquido && qCom) {
    pesoLiquido = qCom;
  }

  // Transporte: placa do veículo e nome do transportador
  const transp = getElements(doc, 'transp')[0];
  const veicTransp = transp ? getElements(transp, 'veicTransp')[0] : null;
  const placa = veicTransp ? getText(veicTransp, 'placa') : '';
  const transporta = transp ? getElements(transp, 'transporta')[0] : null;
  const motorista = transporta ? getText(transporta, 'xNome') : '';

  // Informações complementares: onde o usuário escreve o número do ticket, motorista, placa
  const infAdic = getElements(doc, 'infAdic')[0];
  const infCpl = infAdic ? getText(infAdic, 'infCpl') : '';

  // Tenta extrair o número do ticket das informações complementares
  const numeroTicket = extrairNumeroTicketDoInfCpl(infCpl);

  return {
    chave,
    nNF,
    dhEmi,
    produto,
    pesoLiquido,
    placa,
    motorista,
    infCpl,
    numeroTicket,
  };
}

export { normalizeNome };