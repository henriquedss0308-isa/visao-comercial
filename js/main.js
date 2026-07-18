/**
 * Visão Comercial — dashboard de vendas (cliente puro)
 * Dados fictícios, persistidos apenas em localStorage.
 */
(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Constants & catalogs
  // ---------------------------------------------------------------------------
  const STORAGE_KEY = "visao-comercial:v1";
  const PAGE_SIZE = 10;

  const PAYMENTS = ["PIX", "Cartão de Crédito", "Cartão de Débito", "Dinheiro", "Boleto"];
  const SELLERS = ["Loja Física", "Instagram", "WhatsApp", "Site", "Marketplace"];
  const CATEGORIES = ["Eletrônicos", "Vestuário", "Casa & Decoração", "Alimentos", "Beleza"];

  const PRODUCTS = [
    { name: "Fone Bluetooth Pro", category: "Eletrônicos", price: 189.9 },
    { name: "Mouse Wireless", category: "Eletrônicos", price: 79.9 },
    { name: "Teclado Mecânico", category: "Eletrônicos", price: 349.0 },
    { name: "Carregador USB-C", category: "Eletrônicos", price: 59.9 },
    { name: "Camiseta Premium", category: "Vestuário", price: 89.9 },
    { name: "Calça Jeans Slim", category: "Vestuário", price: 159.9 },
    { name: "Tênis Esportivo", category: "Vestuário", price: 249.9 },
    { name: "Jaqueta Corta-Vento", category: "Vestuário", price: 199.9 },
    { name: "Luminária LED", category: "Casa & Decoração", price: 129.9 },
    { name: "Jogo de Panelas", category: "Casa & Decoração", price: 289.0 },
    { name: "Organizador Multiuso", category: "Casa & Decoração", price: 49.9 },
    { name: "Café Especial 500g", category: "Alimentos", price: 42.9 },
    { name: "Kit Chocolates", category: "Alimentos", price: 64.9 },
    { name: "Cesta Café da Manhã", category: "Alimentos", price: 119.9 },
    { name: "Kit Skincare", category: "Beleza", price: 159.0 },
    { name: "Perfume Floral 50ml", category: "Beleza", price: 189.0 },
  ];

  const CLIENTS = [
    "Ana Souza", "Bruno Lima", "Carla Mendes", "Diego Alves", "Elena Costa",
    "Felipe Rocha", "Gabriela Nunes", "Henrique Dias", "Isabela Freitas", "João Pedro",
    "Karina Lopes", "Lucas Martins", "Mariana Pires", "Nicolas Barbosa", "Olivia Santos",
    "Paulo Henrique", "Quezia Ramos", "Rafael Vieira", "Sofia Carvalho", "Thiago Moreira",
    "Úrsula Prado", "Victor Hugo", "Wanda Ribeiro", "Yasmin Teixeira", "Zeca Oliveira",
  ];

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

  const CHART_COLORS = [
    "#0f766e", "#1d4ed8", "#b45309", "#be185d", "#6d28d9",
    "#0369a1", "#15803d", "#c2410c", "#4f46e5", "#0e7490",
  ];

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  /** @type {{ sales: Sale[], monthlyGoal: number }} */
  let state = {
    sales: [],
    monthlyGoal: 25000,
  };

  const filters = {
    preset: "30d",
    dateFrom: null,
    dateTo: null,
    product: "",
    category: "",
    payment: "",
    seller: "",
  };

  const tableState = {
    search: "",
    sortKey: "date",
    sortDir: "desc",
    page: 1,
  };

  /** @type {Record<string, import('chart.js').Chart | null>} */
  const charts = {
    daily: null,
    compare: null,
    product: null,
    category: null,
    payment: null,
    seller: null,
  };

  let pendingImportSales = null;
  let confirmCallback = null;
  let lastFocusEl = null;

  // ---------------------------------------------------------------------------
  // Types (JSDoc)
  // ---------------------------------------------------------------------------
  /**
   * @typedef {Object} Sale
   * @property {string} id
   * @property {string} date - YYYY-MM-DD
   * @property {string} client
   * @property {string} product
   * @property {string} category
   * @property {number} quantity
   * @property {number} unitPrice
   * @property {number} total
   * @property {string} paymentMethod
   * @property {string} seller
   */

  // ---------------------------------------------------------------------------
  // Utils
  // ---------------------------------------------------------------------------
  function uid() {
    return "s_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function todayISO() {
    return toISODate(new Date());
  }

  function toISODate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseISODate(str) {
    // Parse as local date (avoid UTC shift)
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(date, n) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() + n);
    return d;
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  function formatBRL(value) {
    return Number(value || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("pt-BR");
  }

  function formatDateBR(iso) {
    if (!iso) return "—";
    const d = parseISODate(iso);
    return d.toLocaleDateString("pt-BR");
  }

  function formatPercent(value, digits = 1) {
    if (!Number.isFinite(value)) return "—";
    const sign = value > 0 ? "+" : "";
    return sign + value.toFixed(digits).replace(".", ",") + "%";
  }

  /** Money-safe 2-decimal rounding (avoids binary float drift on sums). */
  function round2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return NaN;
    return Math.round((x + Number.EPSILON) * 100) / 100;
  }

  function isPositiveInteger(n) {
    return Number.isFinite(n) && n >= 1 && Math.floor(n) === n;
  }

  function isValidISODate(str) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
    const d = parseISODate(str);
    if (Number.isNaN(d.getTime())) return false;
    // Reject calendar rollover (e.g. 2026-02-31 → 2026-03-03)
    return toISODate(d) === str;
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function daysInclusive(fromISO, toISO) {
    const a = parseISODate(fromISO);
    const b = parseISODate(toISO);
    return Math.round((b - a) / 86400000) + 1;
  }

  function sumBy(arr, fn) {
    return arr.reduce((acc, item) => acc + fn(item), 0);
  }

  function groupSum(arr, keyFn, valFn) {
    /** @type {Map<string, number>} */
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

  // ---------------------------------------------------------------------------
  // Demo data
  // ---------------------------------------------------------------------------
  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pick(arr) {
    return arr[randomInt(0, arr.length - 1)];
  }

  function createDemoSales() {
    /** @type {Sale[]} */
    const sales = [];
    const today = new Date();
    // ~90 days of history for period comparison
    const daysBack = 90;
    const totalSales = 118;

    for (let i = 0; i < totalSales; i++) {
      const dayOffset = randomInt(0, daysBack);
      const date = addDays(today, -dayOffset);
      // Slight weekday bias toward weekdays
      const dow = date.getDay();
      if ((dow === 0 || dow === 6) && Math.random() < 0.35) {
        date.setDate(date.getDate() - randomInt(1, 2));
      }

      const product = pick(PRODUCTS);
      const qty = randomInt(1, product.price > 200 ? 2 : 4);
      // Small price variation for realism
      const priceFactor = 1 + (Math.random() * 0.06 - 0.03);
      const unitPrice = round2(product.price * priceFactor);

      // Weighted payment / channel
      const payment =
        Math.random() < 0.42 ? "PIX" :
        Math.random() < 0.55 ? pick(["Cartão de Crédito", "Cartão de Débito"]) :
        pick(PAYMENTS);

      const seller =
        Math.random() < 0.3 ? "Loja Física" :
        Math.random() < 0.4 ? pick(["Instagram", "WhatsApp"]) :
        pick(SELLERS);

      sales.push({
        id: uid(),
        date: toISODate(date),
        client: pick(CLIENTS),
        product: product.name,
        category: product.category,
        quantity: qty,
        unitPrice,
        total: round2(qty * unitPrice),
        paymentMethod: payment,
        seller,
      });
    }

    // Ensure a few sales "today" and recent for demos
    for (let i = 0; i < 4; i++) {
      const product = PRODUCTS[i % PRODUCTS.length];
      const qty = randomInt(1, 3);
      sales.push({
        id: uid(),
        date: todayISO(),
        client: CLIENTS[i],
        product: product.name,
        category: product.category,
        quantity: qty,
        unitPrice: product.price,
        total: round2(qty * product.price),
        paymentMethod: PAYMENTS[i % PAYMENTS.length],
        seller: SELLERS[i % SELLERS.length],
      });
    }

    return sales.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }

  function defaultState() {
    return {
      sales: createDemoSales(),
      monthlyGoal: 25000,
    };
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.sales)) return defaultState();

      const sales = parsed.sales
        .map(normalizeSale)
        .filter(Boolean);

      return {
        sales,
        monthlyGoal: Number(parsed.monthlyGoal) > 0 ? Number(parsed.monthlyGoal) : 25000,
      };
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          sales: state.sales,
          monthlyGoal: state.monthlyGoal,
        })
      );
    } catch {
      toast("Não foi possível salvar no navegador (armazenamento cheio ou bloqueado).", "error");
      return false;
    }
    updateStorageInfo();
    return true;
  }

  /**
   * @param {any} raw
   * @returns {Sale | null}
   */
  function normalizeSale(raw) {
    if (!raw || typeof raw !== "object") return null;
    const date = String(raw.date || "").trim();
    if (!isValidISODate(date)) return null;
    const quantity = Number(raw.quantity);
    const unitPrice = Number(raw.unitPrice);
    if (!isPositiveInteger(quantity)) return null;
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return null;

    const client = String(raw.client || "").trim();
    const product = String(raw.product || "").trim();
    const category = String(raw.category || "").trim();
    const paymentMethod = String(raw.paymentMethod || "").trim();
    const seller = String(raw.seller || "").trim();
    if (!client || !product || !category || !paymentMethod || !seller) return null;

    const qty = Math.floor(quantity);
    const price = round2(unitPrice);
    return {
      id: String(raw.id || uid()),
      date,
      client,
      product,
      category,
      quantity: qty,
      unitPrice: price,
      // Always recompute total — never trust stale stored total
      total: round2(qty * price),
      paymentMethod,
      seller,
    };
  }

  // ---------------------------------------------------------------------------
  // Date range / filters
  // ---------------------------------------------------------------------------
  function getPresetRange(preset, customFrom, customTo) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (preset) {
      case "today":
        return { from: toISODate(today), to: toISODate(today) };
      case "7d":
        return { from: toISODate(addDays(today, -6)), to: toISODate(today) };
      case "30d":
        return { from: toISODate(addDays(today, -29)), to: toISODate(today) };
      case "month":
        return { from: toISODate(startOfMonth(today)), to: toISODate(today) };
      case "custom": {
        let from = customFrom || toISODate(addDays(today, -29));
        let to = customTo || toISODate(today);
        // Guard invalid / incomplete date inputs
        if (from && !isValidISODate(from)) from = toISODate(addDays(today, -29));
        if (to && !isValidISODate(to)) to = toISODate(today);
        if (from > to) {
          const tmp = from;
          from = to;
          to = tmp;
        }
        return { from, to };
      }
      default:
        return { from: toISODate(addDays(today, -29)), to: toISODate(today) };
    }
  }

  function getActiveRange() {
    return getPresetRange(filters.preset, filters.dateFrom, filters.dateTo);
  }

  /** Previous period of same length, ending the day before current range starts */
  function getPreviousRange(fromISO, toISO) {
    const len = daysInclusive(fromISO, toISO);
    const prevTo = addDays(parseISODate(fromISO), -1);
    const prevFrom = addDays(prevTo, -(len - 1));
    return { from: toISODate(prevFrom), to: toISODate(prevTo) };
  }

  function saleInDateRange(sale, from, to) {
    return sale.date >= from && sale.date <= to;
  }

  /**
   * Single source of truth for cards, charts, table totals and CSV export.
   * Applies period + dimension filters only (never the table search box).
   */
  function getBaseFilteredSales() {
    const { from, to } = getActiveRange();
    return state.sales.filter((s) => {
      if (!saleInDateRange(s, from, to)) return false;
      if (filters.product && s.product !== filters.product) return false;
      if (filters.category && s.category !== filters.category) return false;
      if (filters.payment && s.paymentMethod !== filters.payment) return false;
      if (filters.seller && s.seller !== filters.seller) return false;
      return true;
    });
  }

  /**
   * @param {{ ignoreSearch?: boolean }} [opts]
   * ignoreSearch=true (default for metrics) → base filters only.
   * ignoreSearch=false → base filters + table search (row navigation only).
   */
  function getFilteredSales(opts = {}) {
    let list = getBaseFilteredSales();

    if (!opts.ignoreSearch && tableState.search.trim()) {
      const q = tableState.search.trim().toLowerCase();
      list = list.filter((s) => {
        return (
          s.client.toLowerCase().includes(q) ||
          s.product.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.paymentMethod.toLowerCase().includes(q) ||
          s.seller.toLowerCase().includes(q) ||
          s.date.includes(q) ||
          formatDateBR(s.date).includes(q)
        );
      });
    }

    return list;
  }

  function matchesDimensionFilters(s) {
    if (filters.product && s.product !== filters.product) return false;
    if (filters.category && s.category !== filters.category) return false;
    if (filters.payment && s.paymentMethod !== filters.payment) return false;
    if (filters.seller && s.seller !== filters.seller) return false;
    return true;
  }

  function getPreviousPeriodSales() {
    const { from, to } = getActiveRange();
    const prev = getPreviousRange(from, to);
    return state.sales.filter((s) => saleInDateRange(s, prev.from, prev.to) && matchesDimensionFilters(s));
  }

  // ---------------------------------------------------------------------------
  // Metrics (shared for cards + charts)
  // ---------------------------------------------------------------------------
  function computeMetrics(sales) {
    const revenue = round2(sumBy(sales, (s) => s.total));
    const count = sales.length;
    const ticket = count > 0 ? round2(revenue / count) : 0;

    const byProductQty = groupSum(sales, (s) => s.product, (s) => s.quantity);
    const byCategoryRev = groupSum(sales, (s) => s.category, (s) => s.total);
    const bySellerRev = groupSum(sales, (s) => s.seller, (s) => s.total);
    const byPaymentRev = groupSum(sales, (s) => s.paymentMethod, (s) => s.total);
    const byProductRev = groupSum(sales, (s) => s.product, (s) => s.total);

    const topProduct = sortEntriesDesc(byProductQty)[0] || null;
    const topCategory = sortEntriesDesc(byCategoryRev)[0] || null;
    const topSeller = sortEntriesDesc(bySellerRev)[0] || null;

    return {
      revenue,
      count,
      ticket,
      topProduct,
      topCategory,
      topSeller,
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
      return Infinity; // special: new activity
    }
    return ((current - previous) / previous) * 100;
  }

  // ---------------------------------------------------------------------------
  // UI: toasts, modals, navigation
  // ---------------------------------------------------------------------------
  function toast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const el = document.createElement("div");
    el.className = `toast is-${type}`;
    el.setAttribute("role", "status");
    el.innerHTML = `<span>${escapeHtml(message)}</span><button type="button" class="toast__close" aria-label="Fechar notificação">×</button>`;
    const close = () => el.remove();
    el.querySelector(".toast__close").addEventListener("click", close);
    container.appendChild(el);
    setTimeout(close, 4200);
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    lastFocusEl = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    const focusable = modal.querySelector(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable) focusable.focus();
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.hidden = true;
    if (!document.querySelector(".modal:not([hidden])")) {
      document.body.style.overflow = "";
    }
    if (lastFocusEl && typeof lastFocusEl.focus === "function") {
      lastFocusEl.focus();
    }
  }

  function confirmDialog(title, message, onConfirm, danger = true) {
    document.getElementById("confirm-title").textContent = title;
    document.getElementById("confirm-message").textContent = message;
    const ok = document.getElementById("confirm-ok");
    ok.className = danger ? "btn btn--danger" : "btn btn--primary";
    confirmCallback = onConfirm;
    openModal("confirm-modal");
  }

  function setSection(name) {
    const sections = ["dashboard", "sales", "import", "settings"];
    const titles = {
      dashboard: "Visão geral",
      sales: "Vendas",
      import: "Importar / Exportar",
      settings: "Dados e meta",
    };

    sections.forEach((s) => {
      const el = document.getElementById(`section-${s}`);
      if (el) el.hidden = s !== name;
    });

    document.querySelectorAll(".nav-item").forEach((btn) => {
      const active = btn.dataset.section === name;
      btn.classList.toggle("is-active", active);
      if (active) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });

    document.getElementById("page-title").textContent = titles[name] || "Visão Comercial";

    // Filters useful on dashboard + sales
    const filtersPanel = document.getElementById("filters-panel");
    if (filtersPanel) {
      filtersPanel.hidden = name === "import" || name === "settings";
    }

    closeSidebarMobile();

    // Charts rendered while hidden get zero size — resize when dashboard is shown
    if (name === "dashboard") {
      requestAnimationFrame(() => {
        resizeCharts();
        requestAnimationFrame(resizeCharts);
      });
    }
  }

  function openSidebarMobile() {
    document.getElementById("sidebar").classList.add("is-open");
    const overlay = document.getElementById("sidebar-overlay");
    overlay.hidden = false;
    document.getElementById("menu-toggle").setAttribute("aria-expanded", "true");
  }

  function closeSidebarMobile() {
    document.getElementById("sidebar").classList.remove("is-open");
    document.getElementById("sidebar-overlay").hidden = true;
    document.getElementById("menu-toggle").setAttribute("aria-expanded", "false");
  }

  // ---------------------------------------------------------------------------
  // Populate selects / datalists
  // ---------------------------------------------------------------------------
  function uniqueSorted(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  /**
   * Rebuild select options and keep desired value when still valid.
   * @returns {string} applied value ("" if cleared)
   */
  function fillSelect(select, values, placeholder, desiredValue) {
    const wanted = desiredValue !== undefined ? desiredValue : select.value;
    select.innerHTML = `<option value="">${placeholder}</option>`;
    values.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    });
    if (wanted && values.includes(wanted)) {
      select.value = wanted;
      return wanted;
    }
    select.value = "";
    return "";
  }

  function fillDatalist(id, values) {
    const list = document.getElementById(id);
    if (!list) return;
    list.innerHTML = values.map((v) => `<option value="${escapeHtml(v)}"></option>`).join("");
  }

  function refreshCatalogs() {
    const products = uniqueSorted([
      ...PRODUCTS.map((p) => p.name),
      ...state.sales.map((s) => s.product),
    ]);
    const categories = uniqueSorted([
      ...CATEGORIES,
      ...state.sales.map((s) => s.category),
    ]);
    const payments = uniqueSorted([...PAYMENTS, ...state.sales.map((s) => s.paymentMethod)]);
    const sellers = uniqueSorted([...SELLERS, ...state.sales.map((s) => s.seller)]);

    // Keep filters.* as source of truth; drop stale values that no longer exist
    filters.product = fillSelect(
      document.getElementById("filter-product"),
      products,
      "Todos",
      filters.product
    );
    filters.category = fillSelect(
      document.getElementById("filter-category"),
      categories,
      "Todas",
      filters.category
    );
    filters.payment = fillSelect(
      document.getElementById("filter-payment"),
      payments,
      "Todas",
      filters.payment
    );
    filters.seller = fillSelect(
      document.getElementById("filter-seller"),
      sellers,
      "Todos",
      filters.seller
    );

    // Sale form payment select (preserve value while modal is open)
    const salePay = document.getElementById("sale-payment");
    const curPay = salePay.value;
    salePay.innerHTML = `<option value="">Selecione…</option>`;
    payments.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p;
      salePay.appendChild(opt);
    });
    if (payments.includes(curPay)) salePay.value = curPay;

    fillDatalist("product-list", products);
    fillDatalist("category-list", categories);
    fillDatalist("seller-list", sellers);
  }

  // ---------------------------------------------------------------------------
  // Render: period labels, KPIs
  // ---------------------------------------------------------------------------
  function updatePeriodLabels() {
    const { from, to } = getActiveRange();
    const prev = getPreviousRange(from, to);
    const label = document.getElementById("period-label");
    label.textContent = `Período: ${formatDateBR(from)} — ${formatDateBR(to)} · Comparado a ${formatDateBR(prev.from)} — ${formatDateBR(prev.to)}`;

    const summary = document.getElementById("filter-summary");
    const sales = getBaseFilteredSales();
    const parts = [`${sales.length} venda(s) no período`];
    if (filters.product) parts.push(`produto: ${filters.product}`);
    if (filters.category) parts.push(`categoria: ${filters.category}`);
    if (filters.payment) parts.push(`pagamento: ${filters.payment}`);
    if (filters.seller) parts.push(`canal: ${filters.seller}`);
    summary.textContent = parts.join(" · ");

    const badge = document.getElementById("chart-daily-badge");
    if (badge) badge.textContent = `${formatDateBR(from)} — ${formatDateBR(to)}`;
  }

  function renderDelta(el, current, previous, isCurrency = false) {
    if (!el) return;
    const d = deltaPercent(current, previous);
    el.classList.remove("is-up", "is-down", "is-flat");

    if (!Number.isFinite(d)) {
      if (current > 0 && previous === 0) {
        el.textContent = "Novo no período · sem base anterior";
        el.classList.add("is-up");
      } else {
        el.textContent = "Sem variação mensurável";
        el.classList.add("is-flat");
      }
      return;
    }

    const abs = Math.abs(d);
    if (abs < 0.05) {
      el.textContent = "Estável vs. período anterior";
      el.classList.add("is-flat");
      return;
    }

    const arrow = d > 0 ? "▲" : "▼";
    const cls = d > 0 ? "is-up" : "is-down";
    const prevLabel = isCurrency ? formatBRL(previous) : formatNumber(previous);
    el.textContent = `${arrow} ${formatPercent(d)} vs. período anterior (${prevLabel})`;
    el.classList.add(cls);
  }

  function renderKPIs() {
    // Same base filtered set as charts and table totals
    const sales = getBaseFilteredSales();
    const prevSales = getPreviousPeriodSales();
    const m = computeMetrics(sales);
    const pm = computeMetrics(prevSales);

    document.getElementById("kpi-revenue").textContent = formatBRL(m.revenue);
    document.getElementById("kpi-sales-count").textContent = formatNumber(m.count);
    document.getElementById("kpi-ticket").textContent = m.count ? formatBRL(m.ticket) : "—";

    renderDelta(document.getElementById("kpi-revenue-delta"), m.revenue, pm.revenue, true);
    renderDelta(document.getElementById("kpi-sales-delta"), m.count, pm.count, false);
    renderDelta(document.getElementById("kpi-ticket-delta"), m.ticket, pm.ticket, true);

    // Top product (by quantity sold)
    if (m.topProduct) {
      document.getElementById("kpi-top-product").textContent = m.topProduct[0];
      document.getElementById("kpi-top-product-hint").textContent =
        `${formatNumber(m.topProduct[1])} un. · ${formatBRL(m.byProductRev.get(m.topProduct[0]) || 0)}`;
    } else {
      document.getElementById("kpi-top-product").textContent = "—";
      document.getElementById("kpi-top-product-hint").textContent = "Sem vendas no período";
    }

    // Top category (by revenue = mais rentável)
    if (m.topCategory) {
      document.getElementById("kpi-top-category").textContent = m.topCategory[0];
      document.getElementById("kpi-top-category-hint").textContent = formatBRL(m.topCategory[1]);
    } else {
      document.getElementById("kpi-top-category").textContent = "—";
      document.getElementById("kpi-top-category-hint").textContent = "Sem vendas no período";
    }

    // Top seller / channel (by revenue)
    if (m.topSeller) {
      document.getElementById("kpi-top-seller").textContent = m.topSeller[0];
      document.getElementById("kpi-top-seller-hint").textContent = formatBRL(m.topSeller[1]);
    } else {
      document.getElementById("kpi-top-seller").textContent = "—";
      document.getElementById("kpi-top-seller-hint").textContent = "Sem vendas no período";
    }

    // Meta mensal: mês civil atual + mesmos filtros de dimensão (produto/categoria/etc.)
    // O recorte de data dos filtros NÃO altera a meta (sempre mês corrente).
    const today = new Date();
    const monthFrom = toISODate(startOfMonth(today));
    const monthTo = toISODate(today);
    const monthSales = state.sales.filter(
      (s) => saleInDateRange(s, monthFrom, monthTo) && matchesDimensionFilters(s)
    );
    const monthRevenue = round2(sumBy(monthSales, (s) => s.total));
    const goal = state.monthlyGoal || 0;
    const pct = goal > 0 ? (monthRevenue / goal) * 100 : 0;
    const pctLabel = (Number.isFinite(pct) ? pct : 0).toFixed(1).replace(".", ",");

    document.getElementById("kpi-goal").textContent = formatBRL(goal);
    document.getElementById("kpi-goal-pct").textContent = `${pctLabel}% atingida`;
    document.getElementById("kpi-goal-hint").textContent =
      `Faturamento do mês atual (com filtros de dimensão): ${formatBRL(monthRevenue)} · ${formatDateBR(monthFrom)} — ${formatDateBR(monthTo)}`;

    const bar = document.getElementById("goal-progress-bar");
    const progress = document.getElementById("goal-progress");
    const width = clamp(pct, 0, 100);
    bar.style.width = `${width}%`;
    bar.classList.toggle("is-over", pct >= 100);
    progress.setAttribute("aria-valuenow", String(Math.round(width)));
    progress.setAttribute(
      "aria-valuetext",
      `${pctLabel}% da meta: ${formatBRL(monthRevenue)} de ${formatBRL(goal)}`
    );
  }

  // ---------------------------------------------------------------------------
  // Charts
  // ---------------------------------------------------------------------------
  function destroyChart(key) {
    if (charts[key]) {
      charts[key].destroy();
      charts[key] = null;
    }
  }

  function setChartEmpty(canvasId, emptyId, isEmpty) {
    const canvas = document.getElementById(canvasId);
    const empty = document.getElementById(emptyId);
    if (canvas) canvas.style.display = isEmpty ? "none" : "block";
    if (empty) empty.hidden = !isEmpty;
  }

  function baseTooltip() {
    return {
      backgroundColor: "#0f172a",
      titleFont: { size: 12, weight: "600" },
      bodyFont: { size: 12 },
      padding: 10,
      cornerRadius: 8,
      displayColors: true,
    };
  }

  function currencyTick(value) {
    if (Math.abs(value) >= 1000) {
      return "R$ " + (value / 1000).toFixed(value % 1000 === 0 ? 0 : 1).replace(".", ",") + " mil";
    }
    return formatBRL(value);
  }

  function resizeCharts() {
    Object.keys(charts).forEach((key) => {
      if (charts[key]) {
        try {
          charts[key].resize();
        } catch {
          /* ignore */
        }
      }
    });
  }

  function renderCharts() {
    if (typeof Chart === "undefined") {
      console.warn("Chart.js não carregado");
      return;
    }

    const sales = getBaseFilteredSales();
    const prevSales = getPreviousPeriodSales();
    const m = computeMetrics(sales);
    const pm = computeMetrics(prevSales);
    const { from, to } = getActiveRange();

    // --- Daily revenue ---
    destroyChart("daily");
    const dayMap = new Map();
    // Fill all days in range with 0 for continuous line
    let cursor = parseISODate(from);
    const end = parseISODate(to);
    while (cursor <= end) {
      dayMap.set(toISODate(cursor), 0);
      cursor = addDays(cursor, 1);
    }
    for (const s of sales) {
      if (dayMap.has(s.date)) dayMap.set(s.date, round2(dayMap.get(s.date) + s.total));
    }
    const dayLabels = [...dayMap.keys()].map((d) => formatDateBR(d));
    const dayValues = [...dayMap.values()];
    const dailyEmpty = sales.length === 0;
    setChartEmpty("chart-daily", "empty-chart-daily", dailyEmpty);
    if (!dailyEmpty) {
      charts.daily = new Chart(document.getElementById("chart-daily"), {
        type: "line",
        data: {
          labels: dayLabels,
          datasets: [
            {
              label: "Faturamento",
              data: dayValues,
              borderColor: "#0f766e",
              backgroundColor: "rgba(15, 118, 110, 0.12)",
              fill: true,
              tension: 0.25,
              pointRadius: dayLabels.length > 45 ? 0 : 3,
              pointHoverRadius: 5,
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              ...baseTooltip(),
              callbacks: {
                label: (ctx) => ` ${formatBRL(ctx.parsed.y)}`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: {
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 8,
                color: "#64748b",
                font: { size: 11 },
              },
            },
            y: {
              beginAtZero: true,
              ticks: {
                callback: currencyTick,
                color: "#64748b",
                font: { size: 11 },
              },
              grid: { color: "rgba(148, 163, 184, 0.2)" },
            },
          },
        },
      });
    }

    // --- Comparison: faturamento (same unit) + stats for count/ticket ---
    destroyChart("compare");
    const compareEmpty = sales.length === 0 && prevSales.length === 0;
    setChartEmpty("chart-compare", "empty-chart-compare", compareEmpty);
    const compareStats = document.getElementById("compare-stats");
    if (compareStats) compareStats.hidden = compareEmpty;

    if (!compareEmpty) {
      const revDelta = deltaPercent(m.revenue, pm.revenue);
      const countDelta = deltaPercent(m.count, pm.count);
      const ticketDelta = deltaPercent(m.ticket, pm.ticket);
      const fmtDelta = (d) => (!Number.isFinite(d) ? "n/d" : formatPercent(d));

      document.getElementById("compare-sales-cur").textContent = formatNumber(m.count);
      document.getElementById("compare-sales-prev").textContent =
        `Anterior: ${formatNumber(pm.count)} (${fmtDelta(countDelta)})`;
      document.getElementById("compare-ticket-cur").textContent = m.count ? formatBRL(m.ticket) : "—";
      document.getElementById("compare-ticket-prev").textContent =
        `Anterior: ${pm.count ? formatBRL(pm.ticket) : "—"} (${fmtDelta(ticketDelta)})`;

      charts.compare = new Chart(document.getElementById("chart-compare"), {
        type: "bar",
        data: {
          labels: ["Faturamento"],
          datasets: [
            {
              label: "Período atual",
              data: [m.revenue],
              backgroundColor: "#0f766e",
              borderRadius: 8,
              maxBarThickness: 72,
            },
            {
              label: "Período anterior",
              data: [pm.revenue],
              backgroundColor: "#94a3b8",
              borderRadius: 8,
              maxBarThickness: 72,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: { boxWidth: 12, usePointStyle: true, pointStyle: "rectRounded" },
            },
            tooltip: {
              ...baseTooltip(),
              callbacks: {
                label: (ctx) => ` ${ctx.dataset.label}: ${formatBRL(ctx.parsed.y)}`,
                afterBody: () => [` Variação: ${fmtDelta(revDelta)}`],
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: "#64748b", font: { size: 11 } },
            },
            y: {
              beginAtZero: true,
              ticks: {
                callback: currencyTick,
                color: "#64748b",
                font: { size: 11 },
              },
              grid: { color: "rgba(148, 163, 184, 0.2)" },
            },
          },
        },
      });
    }

    // --- Products (top 8 by revenue) ---
    destroyChart("product");
    const productEntries = sortEntriesDesc(m.byProductRev).slice(0, 8);
    setChartEmpty("chart-product", "empty-chart-product", productEntries.length === 0);
    if (productEntries.length) {
      charts.product = new Chart(document.getElementById("chart-product"), {
        type: "bar",
        data: {
          labels: productEntries.map(([k]) => k),
          datasets: [
            {
              label: "Faturamento",
              data: productEntries.map(([, v]) => v),
              backgroundColor: productEntries.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
              borderRadius: 6,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              ...baseTooltip(),
              callbacks: {
                label: (ctx) => ` ${formatBRL(ctx.parsed.x)}`,
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: { callback: currencyTick, color: "#64748b", font: { size: 11 } },
              grid: { color: "rgba(148, 163, 184, 0.2)" },
            },
            y: {
              grid: { display: false },
              ticks: { color: "#64748b", font: { size: 11 } },
            },
          },
        },
      });
    }

    // --- Category doughnut ---
    destroyChart("category");
    const catEntries = sortEntriesDesc(m.byCategoryRev);
    setChartEmpty("chart-category", "empty-chart-category", catEntries.length === 0);
    if (catEntries.length) {
      charts.category = new Chart(document.getElementById("chart-category"), {
        type: "doughnut",
        data: {
          labels: catEntries.map(([k]) => k),
          datasets: [
            {
              data: catEntries.map(([, v]) => v),
              backgroundColor: catEntries.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
              borderWidth: 2,
              borderColor: "#fff",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: { boxWidth: 12, usePointStyle: true, pointStyle: "circle", font: { size: 11 } },
            },
            tooltip: {
              ...baseTooltip(),
              callbacks: {
                label: (ctx) => {
                  const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                  const pct = total ? ((ctx.parsed / total) * 100).toFixed(1).replace(".", ",") : "0";
                  return ` ${ctx.label}: ${formatBRL(ctx.parsed)} (${pct}%)`;
                },
              },
            },
          },
        },
      });
    }

    // --- Payment doughnut ---
    destroyChart("payment");
    const payEntries = sortEntriesDesc(m.byPaymentRev);
    setChartEmpty("chart-payment", "empty-chart-payment", payEntries.length === 0);
    if (payEntries.length) {
      charts.payment = new Chart(document.getElementById("chart-payment"), {
        type: "doughnut",
        data: {
          labels: payEntries.map(([k]) => k),
          datasets: [
            {
              data: payEntries.map(([, v]) => v),
              backgroundColor: payEntries.map((_, i) => CHART_COLORS[(i + 3) % CHART_COLORS.length]),
              borderWidth: 2,
              borderColor: "#fff",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: { boxWidth: 12, usePointStyle: true, pointStyle: "circle", font: { size: 11 } },
            },
            tooltip: {
              ...baseTooltip(),
              callbacks: {
                label: (ctx) => {
                  const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                  const pct = total ? ((ctx.parsed / total) * 100).toFixed(1).replace(".", ",") : "0";
                  return ` ${ctx.label}: ${formatBRL(ctx.parsed)} (${pct}%)`;
                },
              },
            },
          },
        },
      });
    }

    // --- Seller bar ---
    destroyChart("seller");
    const sellerEntries = sortEntriesDesc(m.bySellerRev);
    setChartEmpty("chart-seller", "empty-chart-seller", sellerEntries.length === 0);
    if (sellerEntries.length) {
      charts.seller = new Chart(document.getElementById("chart-seller"), {
        type: "bar",
        data: {
          labels: sellerEntries.map(([k]) => k),
          datasets: [
            {
              label: "Faturamento",
              data: sellerEntries.map(([, v]) => v),
              backgroundColor: "#1d4ed8",
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              ...baseTooltip(),
              callbacks: {
                label: (ctx) => ` ${formatBRL(ctx.parsed.y)}`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: "#64748b", font: { size: 11 } },
            },
            y: {
              beginAtZero: true,
              ticks: { callback: currencyTick, color: "#64748b", font: { size: 11 } },
              grid: { color: "rgba(148, 163, 184, 0.2)" },
            },
          },
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Table
  // ---------------------------------------------------------------------------
  function sortSales(list) {
    const key = tableState.sortKey;
    const dir = tableState.sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      let av = a[key];
      let bv = b[key];
      if (key === "quantity" || key === "unitPrice" || key === "total") {
        return (av - bv) * dir;
      }
      av = String(av || "").toLowerCase();
      bv = String(bv || "").toLowerCase();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }

  function renderTable() {
    // Base set = same as KPIs/charts; search only narrows visible rows
    const base = getBaseFilteredSales();
    const baseRevenue = round2(sumBy(base, (s) => s.total));
    const hasSearch = Boolean(tableState.search.trim());
    const visible = getFilteredSales({ ignoreSearch: false });
    const sorted = sortSales(visible);
    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    if (tableState.page > totalPages) tableState.page = totalPages;
    if (tableState.page < 1) tableState.page = 1;

    const start = (tableState.page - 1) * PAGE_SIZE;
    const pageItems = sorted.slice(start, start + PAGE_SIZE);

    const tbody = document.getElementById("sales-tbody");
    const empty = document.getElementById("sales-empty");
    const tableScroll = document.querySelector(".table-scroll");
    const pagination = document.getElementById("pagination");

    // Totals always mirror KPI / charts (base filters), never search-only subset
    document.getElementById("sales-count-label").textContent =
      `${formatNumber(base.length)} venda(s)`;
    document.getElementById("sales-total-label").textContent = base.length
      ? `Total filtrado: ${formatBRL(baseRevenue)}${
          hasSearch
            ? ` · pesquisa: ${formatNumber(visible.length)} de ${formatNumber(base.length)}`
            : ""
        }`
      : "";

    // Sort indicators
    document.querySelectorAll(".th-sort").forEach((btn) => {
      const active = btn.dataset.sort === tableState.sortKey;
      btn.classList.toggle("is-active", active);
      const ind = btn.querySelector(".sort-ind");
      if (active) {
        ind.textContent = tableState.sortDir === "asc" ? "↑" : "↓";
        btn.setAttribute("aria-sort", tableState.sortDir === "asc" ? "ascending" : "descending");
      } else {
        ind.textContent = "";
        btn.removeAttribute("aria-sort");
      }
    });

    if (pageItems.length === 0) {
      tbody.innerHTML = "";
      empty.hidden = false;
      const emptyTitle = empty.querySelector("h3");
      const emptyText = empty.querySelector("p");
      if (base.length === 0) {
        if (emptyTitle) emptyTitle.textContent = "Nenhuma venda encontrada";
        if (emptyText) {
          emptyText.textContent = "Ajuste os filtros ou cadastre uma nova venda para começar.";
        }
      } else {
        if (emptyTitle) emptyTitle.textContent = "Nenhum resultado na pesquisa";
        if (emptyText) {
          emptyText.textContent =
            `Há ${formatNumber(base.length)} venda(s) no filtro atual, mas nenhuma corresponde à pesquisa.`;
        }
      }
      if (tableScroll) tableScroll.hidden = true;
      pagination.hidden = true;
      return;
    }

    empty.hidden = true;
    if (tableScroll) tableScroll.hidden = false;
    pagination.hidden = false;

    tbody.innerHTML = pageItems
      .map(
        (s) => `
      <tr data-id="${escapeHtml(s.id)}">
        <td>${escapeHtml(formatDateBR(s.date))}</td>
        <td>${escapeHtml(s.client)}</td>
        <td>${escapeHtml(s.product)}</td>
        <td><span class="badge">${escapeHtml(s.category)}</span></td>
        <td class="num">${formatNumber(s.quantity)}</td>
        <td class="num">${formatBRL(s.unitPrice)}</td>
        <td class="num"><strong>${formatBRL(s.total)}</strong></td>
        <td>${escapeHtml(s.paymentMethod)}</td>
        <td>${escapeHtml(s.seller)}</td>
        <td class="actions-col">
          <div class="row-actions">
            <button type="button" class="icon-btn" data-action="edit" data-id="${escapeHtml(s.id)}" title="Editar venda" aria-label="Editar venda de ${escapeHtml(s.client)}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button type="button" class="icon-btn icon-btn--danger" data-action="delete" data-id="${escapeHtml(s.id)}" title="Excluir venda" aria-label="Excluir venda de ${escapeHtml(s.client)}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
            </button>
          </div>
        </td>
      </tr>`
      )
      .join("");

    document.getElementById("page-info").textContent =
      `Página ${tableState.page} de ${totalPages}`;
    document.getElementById("page-prev").disabled = tableState.page <= 1;
    document.getElementById("page-next").disabled = tableState.page >= totalPages;
  }

  // ---------------------------------------------------------------------------
  // Full refresh (single pipeline)
  // ---------------------------------------------------------------------------
  function refreshAll() {
    refreshCatalogs();
    updatePeriodLabels();
    renderKPIs();
    renderCharts();
    renderTable();
    updateStorageInfo();

    // Goal field
    const goalInput = document.getElementById("monthly-goal");
    if (goalInput && document.activeElement !== goalInput) {
      goalInput.value = String(state.monthlyGoal);
    }
  }

  function updateStorageInfo() {
    const el = document.getElementById("storage-info");
    if (!el) return;
    el.textContent = `${formatNumber(state.sales.length)} venda(s) salvas neste navegador.`;
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------
  function openSaleModal(sale = null) {
    const form = document.getElementById("sale-form");
    form.reset();
    clearFormErrors();

    document.getElementById("sale-modal-title").textContent = sale ? "Editar venda" : "Nova venda";
    document.getElementById("sale-submit").textContent = sale ? "Salvar alterações" : "Cadastrar venda";
    document.getElementById("sale-id").value = sale ? sale.id : "";

    document.getElementById("sale-date").value = sale ? sale.date : todayISO();
    document.getElementById("sale-client").value = sale ? sale.client : "";
    document.getElementById("sale-product").value = sale ? sale.product : "";
    document.getElementById("sale-category").value = sale ? sale.category : "";
    document.getElementById("sale-quantity").value = sale ? String(sale.quantity) : "1";
    // Keep two decimal places for money fields when editing
    document.getElementById("sale-unit-price").value = sale
      ? String(round2(sale.unitPrice))
      : "";
    document.getElementById("sale-payment").value = sale ? sale.paymentMethod : "";
    document.getElementById("sale-seller").value = sale ? sale.seller : "";
    updateSaleTotalDisplay();

    openModal("sale-modal");
  }

  function clearFormErrors() {
    document.querySelectorAll(".field-error").forEach((el) => {
      el.textContent = "";
    });
  }

  function setFieldError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
  }

  function updateSaleTotalDisplay() {
    const qtyRaw = document.getElementById("sale-quantity").value;
    const priceRaw = document.getElementById("sale-unit-price").value;
    const qty = Number(qtyRaw);
    const price = Number(String(priceRaw).replace(",", "."));
    const total =
      Number.isFinite(qty) && Number.isFinite(price) ? round2(qty * price) : 0;
    document.getElementById("sale-total-display").value = formatBRL(total);
  }

  function validateSaleForm() {
    clearFormErrors();
    let ok = true;

    const date = document.getElementById("sale-date").value;
    const client = document.getElementById("sale-client").value.trim();
    const product = document.getElementById("sale-product").value.trim();
    const category = document.getElementById("sale-category").value.trim();
    const quantity = Number(document.getElementById("sale-quantity").value);
    const unitPrice = Number(
      String(document.getElementById("sale-unit-price").value).replace(",", ".")
    );
    const payment = document.getElementById("sale-payment").value;
    const seller = document.getElementById("sale-seller").value.trim();

    if (!date || !isValidISODate(date)) {
      setFieldError("err-sale-date", "Informe uma data válida.");
      ok = false;
    }
    if (!client) {
      setFieldError("err-sale-client", "Informe o cliente.");
      ok = false;
    }
    if (!product) {
      setFieldError("err-sale-product", "Informe o produto.");
      ok = false;
    }
    if (!category) {
      setFieldError("err-sale-category", "Informe a categoria.");
      ok = false;
    }
    if (!isPositiveInteger(quantity)) {
      setFieldError("err-sale-quantity", "Quantidade deve ser um inteiro ≥ 1.");
      ok = false;
    }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      setFieldError("err-sale-unit-price", "Valor unitário deve ser maior que zero.");
      ok = false;
    } else if (round2(unitPrice) <= 0) {
      setFieldError("err-sale-unit-price", "Valor unitário deve ser maior que zero.");
      ok = false;
    }
    if (!payment) {
      setFieldError("err-sale-payment", "Selecione a forma de pagamento.");
      ok = false;
    }
    if (!seller) {
      setFieldError("err-sale-seller", "Informe o vendedor ou canal.");
      ok = false;
    }

    if (!ok) return null;

    const price = round2(unitPrice);
    return {
      date,
      client,
      product,
      category,
      quantity,
      unitPrice: price,
      total: round2(quantity * price),
      paymentMethod: payment,
      seller,
    };
  }

  function saveSaleFromForm(e) {
    e.preventDefault();
    const data = validateSaleForm();
    if (!data) {
      toast("Corrija os campos destacados.", "error");
      return;
    }

    const id = document.getElementById("sale-id").value;
    if (id) {
      const idx = state.sales.findIndex((s) => s.id === id);
      if (idx === -1) {
        toast("Venda não encontrada.", "error");
        return;
      }
      state.sales[idx] = { ...state.sales[idx], ...data, id };
      toast("Venda atualizada com sucesso.", "success");
    } else {
      state.sales.push({ ...data, id: uid() });
      toast("Venda cadastrada com sucesso.", "success");
    }

    saveState();
    closeModal("sale-modal");
    refreshAll();
  }

  function deleteSale(id) {
    const sale = state.sales.find((s) => s.id === id);
    if (!sale) return;
    confirmDialog(
      "Excluir venda",
      `Excluir a venda de ${sale.client} (${sale.product}) em ${formatDateBR(sale.date)}? Esta ação não pode ser desfeita.`,
      () => {
        state.sales = state.sales.filter((s) => s.id !== id);
        saveState();
        refreshAll();
        toast("Venda excluída.", "success");
      }
    );
  }

  // ---------------------------------------------------------------------------
  // CSV
  // ---------------------------------------------------------------------------
  function parseCSV(text) {
    // Robust enough for quoted fields with commas
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
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cell += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === "," || ch === ";") {
          // Support both comma and semicolon separators
          row.push(cell.trim());
          cell = "";
          // Remember separator consistency? accept mixed carefully — use first sep
        } else if (ch === "\n") {
          row.push(cell.trim());
          cell = "";
          if (row.some((c) => c !== "")) rows.push(row);
          row = [];
        } else if (ch === "\r") {
          // skip
        } else {
          cell += ch;
        }
      }
    }
    row.push(cell.trim());
    if (row.some((c) => c !== "")) rows.push(row);

    return rows;
  }

  function detectSeparator(headerLine) {
    const commas = (headerLine.match(/,/g) || []).length;
    const semis = (headerLine.match(/;/g) || []).length;
    return semis > commas ? ";" : ",";
  }

  function parseCSVSmart(text) {
    // Normalize BOM
    text = text.replace(/^\uFEFF/, "");
    const firstLine = text.split(/\r?\n/).find((l) => l.trim()) || "";
    const sep = detectSeparator(firstLine);

    // Re-parse with known separator only
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
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cell += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === sep) {
        row.push(cell.trim());
        cell = "";
      } else if (ch === "\n") {
        row.push(cell.trim());
        cell = "";
        if (row.some((c) => c !== "")) rows.push(row);
        row = [];
      } else if (ch !== "\r") {
        cell += ch;
      }
    }
    row.push(cell.trim());
    if (row.some((c) => c !== "")) rows.push(row);
    return rows;
  }

  function parseBrazilianNumber(str) {
    const s = String(str).trim().replace(/R\$\s?/i, "").replace(/\s/g, "");
    if (!s) return NaN;
    // 1.234,56 or 1234.56 or 1234,56
    if (s.includes(",") && s.includes(".")) {
      // assume . thousands and , decimal
      return Number(s.replace(/\./g, "").replace(",", "."));
    }
    if (s.includes(",")) {
      return Number(s.replace(",", "."));
    }
    return Number(s);
  }

  function parseFlexibleDate(str) {
    const s = String(str).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return isValidISODate(s) ? s : null;
    }
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

  /**
   * Validate entire CSV; return either all sales or list of errors (no partial import).
   */
  function validateCSVImport(text) {
    const rows = parseCSVSmart(text);
    if (rows.length < 2) {
      return { ok: false, errors: ["O arquivo precisa ter um cabeçalho e ao menos uma linha de dados."] };
    }

    const headers = rows[0].map(normalizeHeader);
    const required = CSV_HEADERS.map(normalizeHeader);
    const missing = required.filter((h) => !headers.includes(h));
    if (missing.length) {
      return {
        ok: false,
        errors: [
          `Cabeçalhos obrigatórios ausentes: ${missing.join(", ")}.`,
          `Esperado: ${CSV_HEADERS.join(", ")}.`,
          `Encontrado: ${rows[0].join(", ") || "(vazio)"}.`,
        ],
      };
    }

    const idx = Object.fromEntries(required.map((h) => [h, headers.indexOf(h)]));
    /** @type {Sale[]} */
    const sales = [];
    /** @type {string[]} */
    const errors = [];

    for (let r = 1; r < rows.length; r++) {
      const line = rows[r];
      const lineNo = r + 1;

      // Skip fully empty lines
      if (line.every((c) => !String(c || "").trim())) continue;

      const get = (key) => String(line[idx[key]] ?? "").trim();

      const dateRaw = get("data");
      const client = get("cliente");
      const product = get("produto");
      const category = get("categoria");
      const qtyRaw = get("quantidade");
      const priceRaw = get("valor_unitario");
      const payment = get("forma_pagamento");
      const seller = get("vendedor");

      const date = parseFlexibleDate(dateRaw);
      if (!date) {
        errors.push(`Linha ${lineNo}: data inválida ("${dateRaw}"). Use AAAA-MM-DD ou DD/MM/AAAA.`);
      }
      if (!client) errors.push(`Linha ${lineNo}: cliente obrigatório.`);
      if (!product) errors.push(`Linha ${lineNo}: produto obrigatório.`);
      if (!category) errors.push(`Linha ${lineNo}: categoria obrigatória.`);
      if (!payment) errors.push(`Linha ${lineNo}: forma_pagamento obrigatória.`);
      if (!seller) errors.push(`Linha ${lineNo}: vendedor obrigatório.`);

      const quantity = Number(String(qtyRaw).replace(",", "."));
      if (!isPositiveInteger(quantity)) {
        errors.push(`Linha ${lineNo}: quantidade inválida ("${qtyRaw}"). Use inteiro ≥ 1.`);
      }

      const unitPrice = parseBrazilianNumber(priceRaw);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0 || round2(unitPrice) <= 0) {
        errors.push(`Linha ${lineNo}: valor_unitario inválido ("${priceRaw}").`);
      }

      // All-or-nothing: collect every error first; never return partial success
      const lineOk =
        Boolean(date) &&
        Boolean(client) &&
        Boolean(product) &&
        Boolean(category) &&
        Boolean(payment) &&
        Boolean(seller) &&
        isPositiveInteger(quantity) &&
        Number.isFinite(unitPrice) &&
        unitPrice > 0 &&
        round2(unitPrice) > 0;

      if (lineOk) {
        const price = round2(unitPrice);
        sales.push({
          id: uid(),
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

      if (errors.length >= 40) {
        errors.push("… muitos erros. Corrija o arquivo e tente novamente.");
        break;
      }
    }

    // Hard gate: any validation error blocks the entire import
    if (errors.length) {
      return { ok: false, errors };
    }

    if (!sales.length) {
      return { ok: false, errors: ["Nenhuma linha de dados válida encontrada."] };
    }

    return { ok: true, sales };
  }

  function csvEscape(value) {
    const s = String(value ?? "");
    if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function salesToCSV(sales) {
    const lines = [CSV_HEADERS.join(",")];
    for (const s of sales) {
      lines.push(
        [
          s.date,
          s.client,
          s.product,
          s.category,
          s.quantity,
          s.unitPrice.toFixed(2),
          s.paymentMethod,
          s.seller,
        ]
          .map(csvEscape)
          .join(",")
      );
    }
    return lines.join("\r\n");
  }

  function downloadText(filename, text, mime = "text/csv;charset=utf-8") {
    const bom = "\uFEFF";
    const blob = new Blob([bom + text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadSampleCSV() {
    const sample = [
      {
        id: "sample1",
        date: todayISO(),
        client: "Cliente Exemplo",
        product: "Fone Bluetooth Pro",
        category: "Eletrônicos",
        quantity: 2,
        unitPrice: 189.9,
        total: 379.8,
        paymentMethod: "PIX",
        seller: "Instagram",
      },
      {
        id: "sample2",
        date: toISODate(addDays(new Date(), -1)),
        client: "Maria Demo",
        product: "Camiseta Premium",
        category: "Vestuário",
        quantity: 1,
        unitPrice: 89.9,
        total: 89.9,
        paymentMethod: "Cartão de Crédito",
        seller: "Loja Física",
      },
      {
        id: "sample3",
        date: toISODate(addDays(new Date(), -3)),
        client: "José Exemplo",
        product: "Café Especial 500g",
        category: "Alimentos",
        quantity: 3,
        unitPrice: 42.9,
        total: 128.7,
        paymentMethod: "Dinheiro",
        seller: "WhatsApp",
      },
    ];
    downloadText("visao-comercial-exemplo.csv", salesToCSV(sample));
    toast("CSV de exemplo baixado.", "success");
  }

  function exportFilteredCSV() {
    const sales = sortSales(getBaseFilteredSales());
    if (!sales.length) {
      toast("Não há vendas no filtro atual para exportar.", "error");
      return;
    }
    const { from, to } = getActiveRange();
    downloadText(`visao-comercial-vendas_${from}_${to}.csv`, salesToCSV(sales));
    toast(`${sales.length} venda(s) exportada(s).`, "success");
  }

  function handleImportFile(file) {
    const resultEl = document.getElementById("import-result");
    const confirmBtn = document.getElementById("btn-import-confirm");
    pendingImportSales = null;
    confirmBtn.disabled = true;
    resultEl.hidden = true;
    resultEl.className = "import-result";
    resultEl.innerHTML = "";

    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type && !file.type.includes("csv") && !file.type.includes("text")) {
      resultEl.hidden = false;
      resultEl.classList.add("is-error");
      resultEl.innerHTML = "<strong>Arquivo inválido.</strong> Selecione um arquivo .csv.";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const result = validateCSVImport(text);
      resultEl.hidden = false;

      if (!result.ok) {
        resultEl.classList.add("is-error");
        resultEl.innerHTML =
          `<strong>Importação bloqueada</strong> — nenhuma venda foi importada.<ul>` +
          result.errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("") +
          `</ul>`;
        toast("CSV com erros. Nada foi importado.", "error");
        return;
      }

      pendingImportSales = result.sales;
      confirmBtn.disabled = false;
      resultEl.classList.add("is-success");
      resultEl.innerHTML =
        `<strong>Arquivo válido.</strong> ${result.sales.length} venda(s) pronta(s) para importar. ` +
        `Clique em <em>Validar e importar</em> para adicioná-las aos dados atuais.`;
    };
    reader.onerror = () => {
      resultEl.hidden = false;
      resultEl.classList.add("is-error");
      resultEl.innerHTML = "<strong>Não foi possível ler o arquivo.</strong>";
    };
    reader.readAsText(file, "UTF-8");
  }

  function confirmImport() {
    if (!pendingImportSales || !pendingImportSales.length) {
      toast("Nenhum arquivo válido para importar.", "error");
      return;
    }
    const n = pendingImportSales.length;
    confirmDialog(
      "Confirmar importação",
      `Adicionar ${n} venda(s) aos dados atuais? A importação não substitui vendas existentes.`,
      () => {
        state.sales = state.sales.concat(pendingImportSales);
        pendingImportSales = null;
        document.getElementById("btn-import-confirm").disabled = true;
        document.getElementById("import-file").value = "";
        document.getElementById("import-result").hidden = true;
        saveState();
        refreshAll();
        toast(`${n} venda(s) importada(s) com sucesso.`, "success");
        setSection("sales");
      },
      false
    );
  }

  // ---------------------------------------------------------------------------
  // Filters UI
  // ---------------------------------------------------------------------------
  function applyPreset(preset) {
    filters.preset = preset;
    document.querySelectorAll(".chip[data-preset]").forEach((chip) => {
      const active = chip.dataset.preset === preset;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", active ? "true" : "false");
    });

    const isCustom = preset === "custom";
    document.getElementById("custom-range").hidden = !isCustom;
    document.getElementById("custom-range-to").hidden = !isCustom;

    if (isCustom) {
      const range = getPresetRange("30d");
      if (!filters.dateFrom) {
        filters.dateFrom = range.from;
        document.getElementById("filter-date-from").value = range.from;
      }
      if (!filters.dateTo) {
        filters.dateTo = range.to;
        document.getElementById("filter-date-to").value = range.to;
      }
    }

    tableState.page = 1;
    refreshAll();
  }

  function clearFilters() {
    filters.product = "";
    filters.category = "";
    filters.payment = "";
    filters.seller = "";
    filters.dateFrom = null;
    filters.dateTo = null;
    document.getElementById("filter-product").value = "";
    document.getElementById("filter-category").value = "";
    document.getElementById("filter-payment").value = "";
    document.getElementById("filter-seller").value = "";
    document.getElementById("filter-date-from").value = "";
    document.getElementById("filter-date-to").value = "";
    tableState.search = "";
    document.getElementById("sales-search").value = "";
    applyPreset("30d");
  }

  // ---------------------------------------------------------------------------
  // Product → category autofill
  // ---------------------------------------------------------------------------
  function maybeAutofillCategory() {
    const productName = document.getElementById("sale-product").value.trim();
    const catInput = document.getElementById("sale-category");
    const known = PRODUCTS.find((p) => p.name.toLowerCase() === productName.toLowerCase());
    if (known && !catInput.value) {
      catInput.value = known.category;
    }
    if (known && !document.getElementById("sale-unit-price").value) {
      document.getElementById("sale-unit-price").value = String(known.price);
      updateSaleTotalDisplay();
    }
  }

  // ---------------------------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------------------------
  function bindEvents() {
    // Navigation
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => setSection(btn.dataset.section));
    });

    document.getElementById("menu-toggle").addEventListener("click", () => {
      const open = document.getElementById("sidebar").classList.contains("is-open");
      if (open) closeSidebarMobile();
      else openSidebarMobile();
    });
    document.getElementById("sidebar-overlay").addEventListener("click", closeSidebarMobile);

    // Presets
    document.querySelectorAll(".chip[data-preset]").forEach((chip) => {
      chip.addEventListener("click", () => applyPreset(chip.dataset.preset));
    });

    document.getElementById("btn-clear-filters").addEventListener("click", clearFilters);

    document.getElementById("filter-date-from").addEventListener("change", (e) => {
      filters.dateFrom = e.target.value || null;
      filters.preset = "custom";
      applyPreset("custom");
      // Sync inputs if range was swapped / normalized
      const range = getActiveRange();
      filters.dateFrom = range.from;
      filters.dateTo = range.to;
      document.getElementById("filter-date-from").value = range.from;
      document.getElementById("filter-date-to").value = range.to;
    });
    document.getElementById("filter-date-to").addEventListener("change", (e) => {
      filters.dateTo = e.target.value || null;
      filters.preset = "custom";
      applyPreset("custom");
      const range = getActiveRange();
      filters.dateFrom = range.from;
      filters.dateTo = range.to;
      document.getElementById("filter-date-from").value = range.from;
      document.getElementById("filter-date-to").value = range.to;
    });

    ["filter-product", "filter-category", "filter-payment", "filter-seller"].forEach((id) => {
      document.getElementById(id).addEventListener("change", (e) => {
        const map = {
          "filter-product": "product",
          "filter-category": "category",
          "filter-payment": "payment",
          "filter-seller": "seller",
        };
        filters[map[id]] = e.target.value;
        tableState.page = 1;
        refreshAll();
      });
    });

    // New sale buttons
    ["btn-new-sale", "btn-new-sale-table", "btn-empty-new-sale"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("click", () => openSaleModal());
    });

    document.getElementById("sale-form").addEventListener("submit", saveSaleFromForm);
    document.getElementById("sale-quantity").addEventListener("input", updateSaleTotalDisplay);
    document.getElementById("sale-unit-price").addEventListener("input", updateSaleTotalDisplay);
    document.getElementById("sale-product").addEventListener("change", maybeAutofillCategory);
    document.getElementById("sale-product").addEventListener("blur", maybeAutofillCategory);

    document.querySelectorAll("[data-close-modal]").forEach((el) => {
      el.addEventListener("click", () => closeModal("sale-modal"));
    });
    document.querySelectorAll("[data-close-confirm]").forEach((el) => {
      el.addEventListener("click", () => {
        confirmCallback = null;
        closeModal("confirm-modal");
      });
    });
    document.getElementById("confirm-ok").addEventListener("click", () => {
      const cb = confirmCallback;
      confirmCallback = null;
      closeModal("confirm-modal");
      if (cb) cb();
    });

    // Escape closes top modal
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (!document.getElementById("confirm-modal").hidden) {
          confirmCallback = null;
          closeModal("confirm-modal");
        } else if (!document.getElementById("sale-modal").hidden) {
          closeModal("sale-modal");
        } else if (document.getElementById("sidebar").classList.contains("is-open")) {
          closeSidebarMobile();
        }
      }
    });

    // Table actions
    document.getElementById("sales-tbody").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.action === "edit") {
        const sale = state.sales.find((s) => s.id === id);
        if (sale) openSaleModal(sale);
      } else if (btn.dataset.action === "delete") {
        deleteSale(id);
      }
    });

    document.querySelectorAll(".th-sort").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.sort;
        if (tableState.sortKey === key) {
          tableState.sortDir = tableState.sortDir === "asc" ? "desc" : "asc";
        } else {
          tableState.sortKey = key;
          tableState.sortDir = key === "date" || key === "total" ? "desc" : "asc";
        }
        renderTable();
      });
    });

    let searchTimer;
    document.getElementById("sales-search").addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        tableState.search = e.target.value;
        tableState.page = 1;
        renderTable();
      }, 180);
    });

    document.getElementById("page-prev").addEventListener("click", () => {
      tableState.page -= 1;
      renderTable();
    });
    document.getElementById("page-next").addEventListener("click", () => {
      tableState.page += 1;
      renderTable();
    });

    // CSV
    document.getElementById("btn-download-sample").addEventListener("click", downloadSampleCSV);
    document.getElementById("btn-export-csv").addEventListener("click", exportFilteredCSV);
    document.getElementById("btn-export-header").addEventListener("click", exportFilteredCSV);
    document.getElementById("btn-import-confirm").addEventListener("click", confirmImport);

    const fileInput = document.getElementById("import-file");
    const dropzone = document.getElementById("import-dropzone");

    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fileInput.click();
      }
    });
    // Avoid double-open when the hidden input itself receives the click
    fileInput.addEventListener("click", (e) => e.stopPropagation());
    fileInput.addEventListener("change", () => {
      if (fileInput.files[0]) handleImportFile(fileInput.files[0]);
    });

    ["dragenter", "dragover"].forEach((ev) => {
      dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropzone.classList.add("is-dragover");
      });
    });
    ["dragleave", "drop"].forEach((ev) => {
      dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropzone.classList.remove("is-dragover");
      });
    });
    dropzone.addEventListener("drop", (e) => {
      const file = e.dataTransfer.files[0];
      if (file) handleImportFile(file);
    });

    // Settings
    document.getElementById("btn-save-goal").addEventListener("click", () => {
      const val = Number(document.getElementById("monthly-goal").value);
      if (!Number.isFinite(val) || val <= 0) {
        toast("Informe uma meta maior que zero.", "error");
        return;
      }
      state.monthlyGoal = round2(val);
      saveState();
      refreshAll();
      toast("Meta mensal salva.", "success");
    });

    document.getElementById("btn-restore-demo").addEventListener("click", () => {
      confirmDialog(
        "Restaurar demonstração",
        "Isso substitui todos os dados atuais pelos registros fictícios de demonstração. Continuar?",
        () => {
          state = defaultState();
          saveState();
          clearFilters();
          toast("Dados de demonstração restaurados.", "success");
        }
      );
    });

    document.getElementById("btn-clear-all").addEventListener("click", () => {
      confirmDialog(
        "Apagar todos os dados",
        "Tem certeza? Todas as vendas e a meta serão removidas deste navegador. Esta ação não pode ser desfeita.",
        () => {
          state = { sales: [], monthlyGoal: 25000 };
          saveState();
          // Reset filters so empty state is not masked by a stale dimension filter
          filters.product = "";
          filters.category = "";
          filters.payment = "";
          filters.seller = "";
          tableState.search = "";
          tableState.page = 1;
          const searchEl = document.getElementById("sales-search");
          if (searchEl) searchEl.value = "";
          refreshAll();
          toast("Todos os dados foram apagados.", "success");
        }
      );
    });

    // Focus trap lite for modals
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.addEventListener("keydown", (e) => {
        if (e.key !== "Tab" || modal.hidden) return;
        const focusables = [
          ...modal.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          ),
        ].filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      });
    });

    // Keep charts legible after viewport changes (mobile rotate, sidebar, etc.)
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resizeCharts, 150);
    });
  }

  // ---------------------------------------------------------------------------
  // Integrity check (dev-friendly self-test of metric coherence)
  // ---------------------------------------------------------------------------
  function assertCoherence() {
    const sales = getBaseFilteredSales();
    const m = computeMetrics(sales);
    const revenueFromRows = round2(sumBy(sales, (s) => s.total));
    const count = sales.length;
    const ticket = count ? round2(revenueFromRows / count) : 0;

    const dailySum = (() => {
      const { from, to } = getActiveRange();
      let sum = 0;
      let cursor = parseISODate(from);
      const end = parseISODate(to);
      const dayMap = new Map();
      while (cursor <= end) {
        dayMap.set(toISODate(cursor), 0);
        cursor = addDays(cursor, 1);
      }
      for (const s of sales) {
        if (dayMap.has(s.date)) dayMap.set(s.date, round2(dayMap.get(s.date) + s.total));
      }
      for (const v of dayMap.values()) sum = round2(sum + v);
      return sum;
    })();

    const catSum = round2(sumBy([...m.byCategoryRev.values()], (v) => v));
    const paySum = round2(sumBy([...m.byPaymentRev.values()], (v) => v));
    const sellerSum = round2(sumBy([...m.bySellerRev.values()], (v) => v));
    const productSum = round2(sumBy([...m.byProductRev.values()], (v) => v));
    const productQtyTop = m.topProduct;
    const productQtyCheck =
      !productQtyTop ||
      productQtyTop[1] === sumBy(
        sales.filter((s) => s.product === productQtyTop[0]),
        (s) => s.quantity
      );

    const prev = getPreviousPeriodSales();
    const { from, to } = getActiveRange();
    const prevRange = getPreviousRange(from, to);
    const prevLenOk = daysInclusive(prevRange.from, prevRange.to) === daysInclusive(from, to);

    const checks = [
      ["KPI revenue === sum(sales.total)", m.revenue === revenueFromRows],
      ["KPI count === sales.length", m.count === count],
      ["KPI ticket === revenue/count", m.ticket === ticket],
      ["Daily chart sum === revenue", dailySum === m.revenue],
      ["Category chart sum === revenue", catSum === m.revenue],
      ["Payment chart sum === revenue", paySum === m.revenue],
      ["Seller chart sum === revenue", sellerSum === m.revenue],
      ["Product chart sum === revenue", productSum === m.revenue],
      ["Each sale.total === qty * unitPrice", sales.every((s) => s.total === round2(s.quantity * s.unitPrice))],
      ["Top product qty matches rows", productQtyCheck],
      ["Previous period same length", prevLenOk],
      ["Previous period ends before current", prevRange.to < from || count + prev.length >= 0],
    ];

    const failed = checks.filter(([, ok]) => !ok);
    if (failed.length) {
      console.error(
        "[Visão Comercial] Falha de coerência:",
        failed.map(([n]) => n),
        { revenue: m.revenue, dailySum, catSum, paySum, sellerSum, productSum, ticket }
      );
    } else {
      console.info(
        `[Visão Comercial] Coerência OK · ${count} vendas · faturamento ${formatBRL(m.revenue)} · ticket ${formatBRL(m.ticket)}`
      );
    }
    return failed.length === 0;
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  function init() {
    state = loadState();
    // Persist (or re-persist) so totals always match qty × unitPrice after normalize
    saveState();

    bindEvents();
    applyPreset("30d");
    setSection("dashboard");
    assertCoherence();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
