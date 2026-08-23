/* ──────────────────────────────────────────────────────────
   FONTE DE DADOS
   Preços extraídos da Central de Ajuda (já com reajuste anual
   aplicado). Se a Central mudar, atualizar apenas este bloco.
   ────────────────────────────────────────────────────────── */
const PLANOS = {
  mesas: {
    label: "Mesas",
    descricao: "Mesas e comandas + retirada no local",
    precos: { mensal: 169.99, trimestral: 479.97, semestral: 899.94, anual: 1679.88 },
  },
  delivery: {
    label: "Delivery",
    descricao: "Delivery, retirada e consumo local com pagamento imediato",
    precos: { mensal: 209.99, trimestral: 599.97, semestral: 1139.94, anual: 2159.88 },
  },
  premium: {
    label: "Premium",
    descricao: "Mesas e comandas + delivery e retirada (operação completa)",
    precos: { mensal: 269.99, trimestral: 799.97, semestral: 1499.94, anual: 2879.88 },
  },
};

const RECORRENCIAS = [
  { key: "mensal", label: "Mensal", meses: 1 },
  { key: "trimestral", label: "Trimestral", meses: 3 },
  { key: "semestral", label: "Semestral", meses: 6 },
  { key: "anual", label: "Anual", meses: 12 },
];

/* Valor mensal dos módulos adicionais. A Central não informa
   tabela de desconto por recorrência para módulos — por isso,
   ao contratar separadamente, o valor do ciclo é "mensal × nº
   de meses do ciclo", SEM desconto de fidelidade. */
const MODULOS = [
  { key: "financeiro", label: "Gestão Financeira", mensal: 69.99 },
  { key: "fiscal", label: "Fiscal", mensal: 69.99 },
  { key: "entregas", label: "Gestão de Entregas", mensal: 54.99 },
  { key: "estoque", label: "Estoque Avançado", mensal: 29.99 },
  { key: "marketplaces", label: "Integração com Marketplaces", mensal: 29.99 },
  { key: "totem", label: "Totem", mensal: 99.99 },
];

const fmt = (v) =>
  (Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const mesesDe = (recKey) => RECORRENCIAS.find((r) => r.key === recKey).meses;

/* ──────────────────────────────────────────────────────────
   DATAS — utilidades para o cálculo de migração
   ────────────────────────────────────────────────────────── */
const parseDate = (str) => (str ? new Date(str + "T00:00:00") : null);

// fim do ciclo = início + N meses - 1 dia
const fimDoCiclo = (inicio, meses) => {
  if (!inicio) return null;
  const d = new Date(inicio);
  d.setMonth(d.getMonth() + meses);
  d.setDate(d.getDate() - 1);
  return d;
};

const diffDias = (a, b) => Math.round((a - b) / 86400000);

const fmtDataBR = (d) => (d ? d.toLocaleDateString("pt-BR") : "—");

/* ──────────────────────────────────────────────────────────
   ESTADO GLOBAL
   ────────────────────────────────────────────────────────── */
const state = {
  cotacao: {
    plano: "delivery",
    recorrencia: "mensal",
    modulos: [],
  },
  migracao: {
    planoAtual: "delivery",
    recAtual: "semestral",
    inicioCiclo: "",
    planoNovo: "mesas",
    recNova: "anual",
    dataMudanca: "",
  },
};

/* ──────────────────────────────────────────────────────────
   TABS
   ────────────────────────────────────────────────────────── */
function setTab(tab) {
  const isCotacao = tab === "cotacao";

  document.getElementById("panel-cotacao").style.display = isCotacao ? "" : "none";
  document.getElementById("panel-migracao").style.display = isCotacao ? "none" : "";

  document.getElementById("tab-cotacao").className = `cw-tab ${isCotacao ? "cw-tab-active" : "cw-tab-inactive"}`;
  document.getElementById("tab-migracao").className = `cw-tab ${!isCotacao ? "cw-tab-active" : "cw-tab-inactive"}`;
}

document.getElementById("tab-cotacao").addEventListener("click", () => setTab("cotacao"));
document.getElementById("tab-migracao").addEventListener("click", () => setTab("migracao"));

/* ──────────────────────────────────────────────────────────
   ABA 1 — COTAÇÃO SIMPLES
   ────────────────────────────────────────────────────────── */
function initCotacaoForm() {
  // Select de plano
  const selectPlano = document.getElementById("cot-plano");
  selectPlano.innerHTML = Object.entries(PLANOS)
    .map(([key, p]) => `<option value="${key}">${p.label}</option>`)
    .join("");
  selectPlano.value = state.cotacao.plano;
  selectPlano.addEventListener("change", (e) => {
    state.cotacao.plano = e.target.value;
    renderCotacao();
  });

  // Botões de recorrência
  const recWrap = document.getElementById("cot-recorrencia");
  recWrap.innerHTML = RECORRENCIAS.map(
    (r) => `<button type="button" class="cw-check recorrencia-btn" data-rec="${r.key}">${r.label}</button>`
  ).join("");
  recWrap.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.cotacao.recorrencia = btn.dataset.rec;
      renderCotacao();
    });
  });

  // Checkboxes de módulos
  const modWrap = document.getElementById("cot-modulos");
  modWrap.innerHTML = MODULOS.map(
    (m) => `
    <label class="cw-check" data-mod="${m.key}">
      <span class="modulo-left">
        <input type="checkbox" class="modulo-checkbox" data-mod-checkbox="${m.key}">
        <span class="modulo-label">${m.label}</span>
      </span>
      <span class="modulo-price">${fmt(m.mensal)}/mês</span>
    </label>`
  ).join("");
  modWrap.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const key = cb.dataset.modCheckbox;
      const idx = state.cotacao.modulos.indexOf(key);
      if (idx >= 0) state.cotacao.modulos.splice(idx, 1);
      else state.cotacao.modulos.push(key);
      renderCotacao();
    });
  });
}

function renderCotacao() {
  const { plano, recorrencia, modulos } = state.cotacao;
  const meses = mesesDe(recorrencia);
  const valorPlano = PLANOS[plano].precos[recorrencia];

  // Descrição do plano
  document.getElementById("cot-plano-desc").textContent = PLANOS[plano].descricao;

  // Estado visual dos botões de recorrência
  document.querySelectorAll("#cot-recorrencia button").forEach((btn) => {
    btn.classList.toggle("cw-check-on", btn.dataset.rec === recorrencia);
  });

  // Estado visual dos módulos
  document.querySelectorAll("#cot-modulos label").forEach((label) => {
    const key = label.dataset.mod;
    const ativo = modulos.includes(key);
    label.classList.toggle("cw-check-on", ativo);
    label.querySelector("input").checked = ativo;
  });

  const modulosCalculados = MODULOS.map((m) => ({
    ...m,
    valorCiclo: m.mensal * meses,
    ativo: modulos.includes(m.key),
  }));

  const totalModulos = modulosCalculados
    .filter((m) => m.ativo)
    .reduce((acc, m) => acc + m.valorCiclo, 0);

  const total = valorPlano + totalModulos;

  const recLabel = RECORRENCIAS.find((r) => r.key === recorrencia).label;

  let rowsHtml = `
    <div class="cw-row">
      <span class="cw-row-label">Plano ${PLANOS[plano].label} · ${recLabel}</span>
      <span class="cw-row-value">${fmt(valorPlano)}</span>
    </div>`;

  const ativos = modulosCalculados.filter((m) => m.ativo);

  if (ativos.length === 0) {
    rowsHtml += `
    <div class="cw-row">
      <span class="cw-row-label">Nenhum módulo adicional selecionado</span>
      <span class="cw-row-value">—</span>
    </div>`;
  } else {
    ativos.forEach((m) => {
      rowsHtml += `
    <div class="cw-row">
      <span class="cw-row-label">Módulo ${m.label} (${meses}× ${fmt(m.mensal)})</span>
      <span class="cw-row-value">${fmt(m.valorCiclo)}</span>
    </div>`;
    });
  }

  rowsHtml += `
    <div class="cw-total-row">
      <span class="cw-total-label">Total do ciclo</span>
      <span class="cw-total-value">${fmt(total)}</span>
    </div>`;

  document.getElementById("cot-ticket").innerHTML = rowsHtml;
}

/* ──────────────────────────────────────────────────────────
   ABA 2 — MIGRAÇÃO DE PLANO (ajuste proporcional)
   Fórmula: valor_a_pagar = (valor_novo - valor_atual) × (dias_restantes / dias_totais)
   dias_totais     = fim_do_ciclo - inicio_do_ciclo
   dias_restantes  = (fim_do_ciclo - data_da_mudanca) + 1
   ────────────────────────────────────────────────────────── */
function initMigracaoForm() {
  const selectPlanoAtual = document.getElementById("mig-plano-atual");
  const selectRecAtual = document.getElementById("mig-rec-atual");
  const selectPlanoNovo = document.getElementById("mig-plano-novo");
  const selectRecNova = document.getElementById("mig-rec-nova");
  const inputInicio = document.getElementById("mig-inicio");
  const inputMudanca = document.getElementById("mig-mudanca");

  const planoOptions = Object.entries(PLANOS)
    .map(([key, p]) => `<option value="${key}">${p.label}</option>`)
    .join("");
  const recOptions = RECORRENCIAS.map((r) => `<option value="${r.key}">${r.label}</option>`).join("");

  selectPlanoAtual.innerHTML = planoOptions;
  selectPlanoAtual.value = state.migracao.planoAtual;
  selectRecAtual.innerHTML = recOptions;
  selectRecAtual.value = state.migracao.recAtual;
  selectPlanoNovo.innerHTML = planoOptions;
  selectPlanoNovo.value = state.migracao.planoNovo;
  selectRecNova.innerHTML = recOptions;
  selectRecNova.value = state.migracao.recNova;

  selectPlanoAtual.addEventListener("change", (e) => {
    state.migracao.planoAtual = e.target.value;
    renderMigracao();
  });
  selectRecAtual.addEventListener("change", (e) => {
    state.migracao.recAtual = e.target.value;
    renderMigracao();
  });
  selectPlanoNovo.addEventListener("change", (e) => {
    state.migracao.planoNovo = e.target.value;
    renderMigracao();
  });
  selectRecNova.addEventListener("change", (e) => {
    state.migracao.recNova = e.target.value;
    renderMigracao();
  });
  inputInicio.addEventListener("change", (e) => {
    state.migracao.inicioCiclo = e.target.value;
    renderMigracao();
  });
  inputMudanca.addEventListener("change", (e) => {
    state.migracao.dataMudanca = e.target.value;
    renderMigracao();
  });
}

function calcularMigracao() {
  const { planoAtual, recAtual, inicioCiclo, planoNovo, recNova, dataMudanca } = state.migracao;

  const inicio = parseDate(inicioCiclo);
  const mudanca = parseDate(dataMudanca);
  if (!inicio || !mudanca) return null;

  const fim = fimDoCiclo(inicio, mesesDe(recAtual));
  const diasTotais = diffDias(fim, inicio);
  const diasRestantes = diffDias(fim, mudanca) + 1;

  const valorAtual = PLANOS[planoAtual].precos[recAtual];
  const valorNovo = PLANOS[planoNovo].precos[recNova];

  const fora = mudanca < inicio || mudanca > fim;
  const fracao = diasTotais > 0 ? diasRestantes / diasTotais : 0;

  const credito = valorAtual * fracao;
  const debito = valorNovo * fracao;
  const valorAPagar = debito - credito;

  return { fim, diasTotais, diasRestantes, valorAtual, valorNovo, fracao, credito, debito, valorAPagar, fora, inicio };
}

function renderMigracao() {
  const { planoAtual, recAtual, planoNovo, recNova } = state.migracao;
  const calc = calcularMigracao();

  // Info do fim do ciclo
  const fimInfo = document.getElementById("mig-fim-info");
  if (calc) {
    fimInfo.innerHTML = `Fim do ciclo atual: <strong>${fmtDataBR(calc.fim)}</strong> (${calc.diasTotais} dias no ciclo)`;
  } else {
    fimInfo.textContent = "";
  }

  // Aviso de data fora do ciclo
  const warnBox = document.getElementById("mig-warn");
  const warnText = document.getElementById("mig-warn-text");
  if (calc && calc.fora) {
    warnBox.style.display = "flex";
    warnText.textContent = `A data da mudança está fora do ciclo atual (entre ${fmtDataBR(calc.inicio)} e ${fmtDataBR(calc.fim)}). Confira as datas — o resultado abaixo não é confiável.`;
  } else {
    warnBox.style.display = "none";
  }

  const emptyBox = document.getElementById("mig-empty");
  const ticket = document.getElementById("mig-ticket");

  if (!calc) {
    emptyBox.style.display = "flex";
    ticket.style.display = "none";
    return;
  }

  emptyBox.style.display = "none";
  ticket.style.display = "";

  const recAtualLabel = RECORRENCIAS.find((r) => r.key === recAtual).label;
  const recNovaLabel = RECORRENCIAS.find((r) => r.key === recNova).label;

  const totalLabel = calc.valorAPagar >= 0 ? "Valor a pagar" : "Valor a favor do cliente";
  const totalColor = calc.valorAPagar >= 0 ? "#A543FA" : "#1DB954";

  ticket.innerHTML = `
    <div class="cw-row">
      <span class="cw-row-label">Plano atual (${PLANOS[planoAtual].label} · ${recAtualLabel})</span>
      <span class="cw-row-value">${fmt(calc.valorAtual)}</span>
    </div>
    <div class="cw-row">
      <span class="cw-row-label">Plano novo (${PLANOS[planoNovo].label} · ${recNovaLabel})</span>
      <span class="cw-row-value">${fmt(calc.valorNovo)}</span>
    </div>
    <div class="cw-row">
      <span class="cw-row-label">Dias restantes / dias do ciclo</span>
      <span class="cw-row-value">${calc.diasRestantes} / ${calc.diasTotais}</span>
    </div>
    <div class="cw-row">
      <span class="cw-row-label">Crédito proporcional (plano atual)</span>
      <span class="cw-row-value" style="color:#1DB954;">− ${fmt(calc.credito)}</span>
    </div>
    <div class="cw-row">
      <span class="cw-row-label">Débito proporcional (plano novo)</span>
      <span class="cw-row-value">${fmt(calc.debito)}</span>
    </div>
    <div class="cw-total-row">
      <span class="cw-total-label">${totalLabel}</span>
      <span class="cw-total-value" style="color:${totalColor};">${fmt(Math.abs(calc.valorAPagar))}</span>
    </div>`;
}

/* ──────────────────────────────────────────────────────────
   INICIALIZAÇÃO
   ────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  initCotacaoForm();
  renderCotacao();

  initMigracaoForm();
  renderMigracao();

  if (window.lucide) {
    lucide.createIcons();
  }
});
