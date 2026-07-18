/**
 * Auditoria automatizada da lógica do Visão Comercial
 * (espelha as regras de js/main.js sem DOM/Chart.js)
 */
import assert from "node:assert/strict";

// ----- Utils (mirrors main.js) -----
function round2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return NaN;
  return Math.round((x + Number.EPSILON) * 100) / 100;
}
function isPositiveInteger(n) {
  return Number.isFinite(n) && n >= 1 && Math.floor(n) === n;
}
function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseISODate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function isValidISODate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = parseISODate(str);
  if (Number.isNaN(d.getTime())) return false;
  return toISODate(d) === str;
}
function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + n);
  return d;
}
function daysInclusive(fromISO, toISO) {
  const a = parseISODate(fromISO);
  const b = parseISODate(toISO);
  return Math.round((b - a) / 86400000) + 1;
}
function getPreviousRange(fromISO, toISO) {
  const len = daysInclusive(fromISO, toISO);
  const prevTo = addDays(parseISODate(fromISO), -1);
  const prevFrom = addDays(prevTo, -(len - 1));
  return { from: toISODate(prevFrom), to: toISODate(prevTo) };
}
function sumBy(arr, fn) {
  return arr.reduce((acc, item) => acc + fn(item), 0);
}
function groupSum(arr, keyFn, valFn) {
  const map = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    map.set(k, round2((map.get(k) || 0) + Number(valFn(item) || 0)));
  }
  return map;
}
function sortEntriesDesc(map) {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
}
function computeMetrics(sales) {
  const revenue = round2(sumBy(sales, (s) => s.total));
  const count = sales.length;
  const ticket = count > 0 ? round2(revenue / count) : 0;
  const byProductQty = groupSum(sales, (s) => s.product, (s) => s.quantity);
  const byCategoryRev = groupSum(sales, (s) => s.category, (s) => s.total);
  const bySellerRev = groupSum(sales, (s) => s.seller, (s) => s.total);
  const byPaymentRev = groupSum(sales, (s) => s.paymentMethod, (s) => s.total);
  const byProductRev = groupSum(sales, (s) => s.product, (s) => s.total);
  return {
    revenue,
    count,
    ticket,
    topProduct: sortEntriesDesc(byProductQty)[0] || null,
    topCategory: sortEntriesDesc(byCategoryRev)[0] || null,
    topSeller: sortEntriesDesc(bySellerRev)[0] || null,
    byProductQty,
    byProductRev,
    byCategoryRev,
    bySellerRev,
    byPaymentRev,
  };
}
function deltaPercent(current, previous) {
  if (previous === 0) {
    if (current === 0) return 0;
    return Infinity;
  }
  return ((current - previous) / previous) * 100;
}
function parseBrazilianNumber(str) {
  const s = String(str).trim().replace(/R\$\s?/i, "").replace(/\s/g, "");
  if (!s) return NaN;
  if (s.includes(",") && s.includes(".")) {
    return Number(s.replace(/\./g, "").replace(",", "."));
  }
  if (s.includes(",")) return Number(s.replace(",", "."));
  return Number(s);
}
function parseFlexibleDate(str) {
  const s = String(str).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return isValidISODate(s) ? s : null;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    return toISODate(d);
  }
  return null;
}
function normalizeHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}
function detectSeparator(headerLine) {
  const commas = (headerLine.match(/,/g) || []).length;
  const semis = (headerLine.match(/;/g) || []).length;
  return semis > commas ? ";" : ",";
}
function parseCSVSmart(text) {
  text = text.replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/).find((l) => l.trim()) || "";
  const sep = detectSeparator(firstLine);
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === sep) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.trim());
      cell = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else if (ch !== "\r") cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

const CSV_HEADERS = [
  "data",
  "cliente",
  "produto",
  "categoria",
  "quantidade",
  "valor_unitario",
  "forma_pagamento",
  "vendedor",
];

function validateCSVImport(text) {
  const rows = parseCSVSmart(text);
  if (rows.length < 2) {
    return { ok: false, errors: ["header+data required"] };
  }
  const headers = rows[0].map(normalizeHeader);
  const required = CSV_HEADERS.map(normalizeHeader);
  const missing = required.filter((h) => !headers.includes(h));
  if (missing.length) return { ok: false, errors: [`missing: ${missing.join(",")}`] };

  const idx = Object.fromEntries(required.map((h) => [h, headers.indexOf(h)]));
  const sales = [];
  const errors = [];

  for (let r = 1; r < rows.length; r++) {
    const line = rows[r];
    const lineNo = r + 1;
    if (line.every((c) => !String(c || "").trim())) continue;
    const get = (key) => String(line[idx[key]] ?? "").trim();
    const date = parseFlexibleDate(get("data"));
    const client = get("cliente");
    const product = get("produto");
    const category = get("categoria");
    const qtyRaw = get("quantidade");
    const priceRaw = get("valor_unitario");
    const payment = get("forma_pagamento");
    const seller = get("vendedor");

    if (!date) errors.push(`L${lineNo} data`);
    if (!client) errors.push(`L${lineNo} cliente`);
    if (!product) errors.push(`L${lineNo} produto`);
    if (!category) errors.push(`L${lineNo} categoria`);
    if (!payment) errors.push(`L${lineNo} pagamento`);
    if (!seller) errors.push(`L${lineNo} vendedor`);

    const quantity = Number(String(qtyRaw).replace(",", "."));
    if (!isPositiveInteger(quantity)) errors.push(`L${lineNo} qtd`);
    const unitPrice = parseBrazilianNumber(priceRaw);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0 || round2(unitPrice) <= 0) {
      errors.push(`L${lineNo} preço`);
    }

    const lineOk =
      date &&
      client &&
      product &&
      category &&
      payment &&
      seller &&
      isPositiveInteger(quantity) &&
      Number.isFinite(unitPrice) &&
      unitPrice > 0 &&
      round2(unitPrice) > 0;

    if (lineOk) {
      const price = round2(unitPrice);
      sales.push({
        date,
        client,
        product,
        category,
        quantity,
        unitPrice: price,
        total: round2(quantity * price),
        paymentMethod: payment,
        seller,
      });
    }
  }

  if (errors.length) return { ok: false, errors };
  if (!sales.length) return { ok: false, errors: ["empty"] };
  return { ok: true, sales };
}

function filterSales(sales, { from, to, product = "", category = "", payment = "", seller = "" }) {
  return sales.filter((s) => {
    if (s.date < from || s.date > to) return false;
    if (product && s.product !== product) return false;
    if (category && s.category !== category) return false;
    if (payment && s.paymentMethod !== payment) return false;
    if (seller && s.seller !== seller) return false;
    return true;
  });
}

function dailySum(sales, from, to) {
  const dayMap = new Map();
  let cursor = parseISODate(from);
  const end = parseISODate(to);
  while (cursor <= end) {
    dayMap.set(toISODate(cursor), 0);
    cursor = addDays(cursor, 1);
  }
  for (const s of sales) {
    if (dayMap.has(s.date)) dayMap.set(s.date, round2(dayMap.get(s.date) + s.total));
  }
  let sum = 0;
  for (const v of dayMap.values()) sum = round2(sum + v);
  return sum;
}

// ----- Fixtures -----
const sales = [
  { date: "2026-07-18", product: "Fone", category: "Eletrônicos", paymentMethod: "PIX", seller: "Loja Física", quantity: 2, unitPrice: 189.9, total: round2(2 * 189.9), client: "Ana" },
  { date: "2026-07-17", product: "Fone", category: "Eletrônicos", paymentMethod: "PIX", seller: "Instagram", quantity: 1, unitPrice: 189.9, total: round2(189.9), client: "Bruno" },
  { date: "2026-07-15", product: "Camiseta", category: "Vestuário", paymentMethod: "Dinheiro", seller: "Loja Física", quantity: 3, unitPrice: 89.9, total: round2(3 * 89.9), client: "Carla" },
  { date: "2026-07-10", product: "Café", category: "Alimentos", paymentMethod: "Cartão de Crédito", seller: "WhatsApp", quantity: 1, unitPrice: 42.9, total: 42.9, client: "Diego" },
  { date: "2026-07-01", product: "Camiseta", category: "Vestuário", paymentMethod: "PIX", seller: "Site", quantity: 1, unitPrice: 89.9, total: 89.9, client: "Elena" },
  { date: "2026-06-20", product: "Fone", category: "Eletrônicos", paymentMethod: "PIX", seller: "Loja Física", quantity: 1, unitPrice: 189.9, total: 189.9, client: "Felipe" },
  { date: "2026-06-18", product: "Café", category: "Alimentos", paymentMethod: "Boleto", seller: "Marketplace", quantity: 4, unitPrice: 42.9, total: round2(4 * 42.9), client: "Gabi" },
];

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    process.exitCode = 1;
  }
}

console.log("\n=== Auditoria Visão Comercial ===\n");

console.log("1) Datas e decimais");
test("rejeita 2026-02-31", () => assert.equal(isValidISODate("2026-02-31"), false));
test("aceita 2026-07-18", () => assert.equal(isValidISODate("2026-07-18"), true));
test("parseFlexibleDate BR", () => assert.equal(parseFlexibleDate("15/07/2026"), "2026-07-15"));
test("parseFlexibleDate inválida", () => assert.equal(parseFlexibleDate("31/02/2026"), null));
test("round2 2*189.9", () => assert.equal(round2(2 * 189.9), 379.8));
test("round2 3*89.9", () => assert.equal(round2(3 * 89.9), 269.7));
test("parseBrazilianNumber 1.234,56", () => assert.equal(parseBrazilianNumber("1.234,56"), 1234.56));
test("parseBrazilianNumber 189.90", () => assert.equal(parseBrazilianNumber("189.90"), 189.9));
test("total sempre qty*price", () => {
  for (const s of sales) {
    assert.equal(s.total, round2(s.quantity * s.unitPrice));
  }
});

console.log("\n2) Filtros individuais e combinados");
test("filtro período 30d-like", () => {
  const f = filterSales(sales, { from: "2026-07-01", to: "2026-07-18" });
  assert.equal(f.length, 5);
  assert.equal(computeMetrics(f).revenue, round2(379.8 + 189.9 + 269.7 + 42.9 + 89.9));
});
test("filtro produto", () => {
  const f = filterSales(sales, { from: "2026-06-01", to: "2026-07-18", product: "Fone" });
  assert.equal(f.length, 3);
  assert.equal(computeMetrics(f).revenue, round2(379.8 + 189.9 + 189.9));
});
test("filtro categoria", () => {
  const f = filterSales(sales, { from: "2026-06-01", to: "2026-07-18", category: "Vestuário" });
  assert.equal(f.length, 2);
});
test("filtro pagamento", () => {
  const f = filterSales(sales, { from: "2026-06-01", to: "2026-07-18", payment: "PIX" });
  assert.equal(f.every((s) => s.paymentMethod === "PIX"), true);
});
test("filtro vendedor", () => {
  const f = filterSales(sales, { from: "2026-06-01", to: "2026-07-18", seller: "Loja Física" });
  assert.equal(f.length, 3);
});
test("filtros combinados", () => {
  const f = filterSales(sales, {
    from: "2026-06-01",
    to: "2026-07-18",
    category: "Eletrônicos",
    payment: "PIX",
    seller: "Loja Física",
  });
  assert.equal(f.length, 2);
  assert.equal(computeMetrics(f).revenue, round2(379.8 + 189.9));
});

console.log("\n3) Coerência cards/gráficos/tabela");
test("somas de gráficos = faturamento", () => {
  const from = "2026-07-01";
  const to = "2026-07-18";
  const f = filterSales(sales, { from, to });
  const m = computeMetrics(f);
  assert.equal(dailySum(f, from, to), m.revenue);
  assert.equal(round2(sumBy([...m.byCategoryRev.values()], (v) => v)), m.revenue);
  assert.equal(round2(sumBy([...m.byPaymentRev.values()], (v) => v)), m.revenue);
  assert.equal(round2(sumBy([...m.bySellerRev.values()], (v) => v)), m.revenue);
  assert.equal(round2(sumBy([...m.byProductRev.values()], (v) => v)), m.revenue);
  assert.equal(m.count, f.length);
  assert.equal(m.ticket, round2(m.revenue / m.count));
});

console.log("\n4) Comparação período anterior");
test("mesmo comprimento e contíguo", () => {
  const from = "2026-07-01";
  const to = "2026-07-18";
  const prev = getPreviousRange(from, to);
  assert.equal(daysInclusive(prev.from, prev.to), daysInclusive(from, to));
  assert.equal(prev.to, "2026-06-30");
  assert.ok(prev.to < from);
  const cur = filterSales(sales, { from, to });
  const prevSales = filterSales(sales, { from: prev.from, to: prev.to });
  const m = computeMetrics(cur);
  const pm = computeMetrics(prevSales);
  const d = deltaPercent(m.revenue, pm.revenue);
  assert.ok(Number.isFinite(d) || d === Infinity);
  // previous has June sales in range
  assert.ok(prevSales.length >= 1);
});

console.log("\n5) Produto mais vendido e categoria rentável");
test("top product by qty / category by revenue", () => {
  const f = filterSales(sales, { from: "2026-07-01", to: "2026-07-18" });
  const m = computeMetrics(f);
  // Fone qty = 2+1=3, Camiseta qty = 3+1=4 → Camiseta
  assert.equal(m.topProduct[0], "Camiseta");
  assert.equal(m.topProduct[1], 4);
  // Eletrônicos rev = 379.8+189.9 = 569.7; Vestuário = 269.7+89.9 = 359.6; Alimentos = 42.9
  assert.equal(m.topCategory[0], "Eletrônicos");
  assert.equal(m.topCategory[1], round2(379.8 + 189.9));
});

console.log("\n6) Ticket médio e meta");
test("ticket e meta %", () => {
  const f = filterSales(sales, { from: "2026-07-01", to: "2026-07-18" });
  const m = computeMetrics(f);
  assert.equal(m.ticket, round2(m.revenue / m.count));
  const goal = 25000;
  const pct = (m.revenue / goal) * 100;
  assert.ok(pct > 0 && pct < 100);
  // empty
  const empty = computeMetrics([]);
  assert.equal(empty.ticket, 0);
  assert.equal(empty.revenue, 0);
});

console.log("\n7) CRUD coerência (simulado)");
test("add/edit/delete recalcula", () => {
  let data = sales.map((s) => ({ ...s }));
  const neu = {
    date: "2026-07-18",
    product: "Mouse",
    category: "Eletrônicos",
    paymentMethod: "PIX",
    seller: "Site",
    quantity: 1,
    unitPrice: 79.9,
    total: 79.9,
    client: "Nova",
  };
  data.push(neu);
  let f = filterSales(data, { from: "2026-07-18", to: "2026-07-18" });
  let before = computeMetrics(f).revenue;
  // edit
  const idx = data.length - 1;
  data[idx] = { ...data[idx], quantity: 2, total: round2(2 * 79.9) };
  f = filterSales(data, { from: "2026-07-18", to: "2026-07-18" });
  assert.equal(computeMetrics(f).revenue, round2(before - 79.9 + 159.8));
  // delete
  data = data.filter((_, i) => i !== idx);
  f = filterSales(data, { from: "2026-07-18", to: "2026-07-18" });
  assert.equal(computeMetrics(f).revenue, round2(before - 79.9));
});

console.log("\n8) CSV válido / inválido / sem parcial");
test("CSV válido importa tudo", () => {
  const csv = [
    "data,cliente,produto,categoria,quantidade,valor_unitario,forma_pagamento,vendedor",
    "2026-07-18,Ana,Fone,Eletrônicos,2,189.90,PIX,Instagram",
    "15/07/2026,Bruno,Camiseta,Vestuário,1,\"89,90\",Dinheiro,Loja Física",
  ].join("\n");
  const r = validateCSVImport(csv);
  assert.equal(r.ok, true);
  assert.equal(r.sales.length, 2);
  assert.equal(r.sales[0].total, 379.8);
  assert.equal(r.sales[1].unitPrice, 89.9);
});
test("CSV inválido bloqueia tudo (sem parcial)", () => {
  const csv = [
    "data,cliente,produto,categoria,quantidade,valor_unitario,forma_pagamento,vendedor",
    "2026-07-18,Ana,Fone,Eletrônicos,2,189.90,PIX,Instagram",
    "2026-02-31,Bruno,X,Y,1,10,PIX,Site", // data inválida
  ].join("\n");
  const r = validateCSVImport(csv);
  assert.equal(r.ok, false);
  assert.ok(r.errors.length >= 1);
});
test("CSV cabeçalho errado", () => {
  const csv = "foo,bar\n1,2\n";
  const r = validateCSVImport(csv);
  assert.equal(r.ok, false);
});
test("CSV uma linha boa + uma má = fail total", () => {
  const csv = [
    "data,cliente,produto,categoria,quantidade,valor_unitario,forma_pagamento,vendedor",
    "2026-07-18,Ana,Fone,Eletrônicos,2,189.90,PIX,Instagram",
    "2026-07-18,,Fone,Eletrônicos,1,10,PIX,Site",
  ].join("\n");
  const r = validateCSVImport(csv);
  assert.equal(r.ok, false);
});

console.log("\n9) Dados vazios");
test("métricas vazias", () => {
  const m = computeMetrics([]);
  assert.equal(m.revenue, 0);
  assert.equal(m.count, 0);
  assert.equal(m.ticket, 0);
  assert.equal(m.topProduct, null);
  assert.equal(dailySum([], "2026-07-01", "2026-07-07"), 0);
});

console.log("\n10) Pesquisa não deve alterar total base");
test("search subset ≠ base, mas base bate KPI", () => {
  const from = "2026-07-01";
  const to = "2026-07-18";
  const base = filterSales(sales, { from, to });
  const search = base.filter((s) => s.client.toLowerCase().includes("ana"));
  const baseM = computeMetrics(base);
  const searchM = computeMetrics(search);
  assert.notEqual(baseM.revenue, searchM.revenue);
  // UI rule: KPI/table total use base
  assert.equal(baseM.revenue, dailySum(base, from, to));
});

console.log(`\n=== Resultado: ${passed} testes passaram ===\n`);
if (process.exitCode) {
  console.error("Auditoria FALHOU");
  process.exit(1);
} else {
  console.log("Auditoria OK");
}
