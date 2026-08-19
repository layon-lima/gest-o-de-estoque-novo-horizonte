function getElements(parent, tag) {
  return Array.from(parent.getElementsByTagName('*')).filter((el) => el.localName === tag);
}

function getText(parent, tag) {
  const el = getElements(parent, tag)[0];
  return el ? el.textContent.trim() : '';
}

export function parseNfeXml(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');

  const parseError = doc.getElementsByTagName('parsererror')[0];
  if (parseError) {
    throw new Error('XML inválido ou mal formatado');
  }

  const detItems = getElements(doc, 'det');
  const items = [];

  for (const det of detItems) {
    const prod = getElements(det, 'prod')[0];
    if (!prod) continue;

    const cProd = getText(prod, 'cProd');
    const xProd = getText(prod, 'xProd');
    const qCom = parseFloat(getText(prod, 'qCom') || '0') || 0;
    const uCom = getText(prod, 'uCom');

    if (cProd || xProd) {
      items.push({ cProd, xProd, qCom, uCom });
    }
  }

  // Dados gerais da nota
  const ide = getElements(doc, 'ide')[0];
  const emit = getElements(doc, 'emit')[0];
  const nNF = ide ? getText(ide, 'nNF') : '';
  const dhEmi = ide ? getText(ide, 'dhEmi') : '';
  const emitente = emit ? getText(emit, 'xNome') : '';
  const infNFe = getElements(doc, 'infNFe')[0];
  const idAttr = infNFe?.getAttribute('Id') || '';
  const chave = idAttr.startsWith('NFe') ? idAttr.slice(3) : idAttr;

  return { nNF, dhEmi, emitente, chave, items };
}

export function matchNfeItem(item, produtos) {
  if (!produtos || produtos.length === 0) return null;

  // 1. Match por código interno
  if (item.cProd) {
    const byCodigo = produtos.find(
      (p) => p.codigo === item.cProd || p.codigo_referencia === item.cProd
    );
    if (byCodigo) return byCodigo;
  }

  // 2. Match por nome (case insensitive, normalizado)
  if (item.xProd) {
    const norm = (s) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
    const itemNorm = norm(item.xProd);
    const byNome = produtos.find((p) => p.nome && norm(p.nome) === itemNorm);
    if (byNome) return byNome;

    // Match parcial: produto cujo nome contém o nome do item da NF-e
    const byContains = produtos.find((p) => p.nome && norm(p.nome).includes(itemNorm));
    if (byContains) return byNome || byContains;
  }

  return null;
}