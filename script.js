/* ──────────────────────────────────────────────────────────
   FONTE DE DADOS
   Preços extraídos da Central de Ajuda (já com reajuste anual
   aplicado). Se a Central mudar, atualizar apenas este bloco.
   ────────────────────────────────────────────────────────── */
const PLANOS = {
  mesas2025: {
    label: "[2025] Mesas",
    descricao: "Mesas com valor de 2025",
    precos: { mensal: 175.99, trimestral: 495.0, semestral: 957.0, anual: 1782.0 },
  },
  delivery2025: {
    label: "[2025] Delivery",
    descricao: "Delivery com valor de 2025",
    precos: { mensal: 197.99, trimestral: 544.5, semestral: 1023.0, anual: 1914.0 },
  },
  premium2025: {
    label: "[2025] Premium",
    descricao: "Premium com valor de 2025",
    precos: { mensal: 241.99, trimestral: 676.5, semestral: 1287.0, anual: 2442.0 },
  },
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

// Plano sem preço em algum ciclo: desabilita esses ciclos em `wrap`
// (select ou grupo de botões) e devolve uma recorrência válida.
function syncRecorrencias(plano, rec, wrap) {
  const precos = PLANOS[plano].precos;
  const valida = rec in precos ? rec : Object.keys(precos)[0];
  wrap.querySelectorAll("option, button").forEach((el) => {
    el.disabled = !((el.value || el.dataset.rec) in precos);
  });
  if (wrap.tagName === "SELECT") wrap.value = valida;
  return valida;
}

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
  { key: "tefpos", label: "TEF POS", mensal: 59.99 },
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
    descontos: { ativo: false, plano: "", modulos: {} }, // percentuais digitados, por key de módulo
  },
  migracao: {
    planoAtual: "delivery",
    recAtual: "semestral",
    inicioCiclo: "",
    planoNovo: "mesas",
    recNova: "anual",
    dataMudanca: "",
    modulosAtuais: [], // keys dos módulos na mesma fatura do plano atual
    modulosNovos: [],
  },
  migracaoPersonalizada: {
    nomeAtual: "",
    totalAtual: "", // valor total pago no ciclo atual (não mensal)
    recAtual: "mensal",
    inicioCiclo: "",
    novoPersonalizado: false,
    planoNovo: "mesas",
    recNova: "anual",
    nomeNovo: "",
    mensalNovo: "",
    recNovaCustom: "mensal",
    dataMudanca: "",
    modulosAtuais: [], // keys dos módulos que o cliente já usa
    valoresModulosAtuais: {}, // key → valor pago no ciclo (vazio = tabela)
    modulosExtras: [], // { id, nome, valor } — módulos antigos fora do catálogo atual
    modulosNovos: [], // keys, sempre com valor da tabela
  },
};

let moduloExtraSeq = 0;

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

function setMigSubtab(subtab) {
  const isPadrao = subtab === "padrao";

  document.getElementById("mig-view-padrao").style.display = isPadrao ? "" : "none";
  document.getElementById("mig-view-personalizado").style.display = isPadrao ? "none" : "";

  document.getElementById("subtab-padrao").className = `cw-subtab ${isPadrao ? "cw-subtab-active" : "cw-subtab-inactive"}`;
  document.getElementById("subtab-personalizado").className = `cw-subtab ${!isPadrao ? "cw-subtab-active" : "cw-subtab-inactive"}`;
}

document.getElementById("subtab-padrao").addEventListener("click", () => setMigSubtab("padrao"));
document.getElementById("subtab-personalizado").addEventListener("click", () => setMigSubtab("personalizado"));

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
  initModuloChecks("cot-modulos", state.cotacao.modulos, () => {
    renderDescontosModulos();
    renderCotacao();
  });

  // Descontos (opcional)
  const desc = state.cotacao.descontos;
  document.getElementById("cot-desc-toggle").addEventListener("change", (e) => {
    desc.ativo = e.target.checked;
    document.getElementById("cot-descontos").style.display = desc.ativo ? "" : "none";
    renderCotacao();
  });
  document.getElementById("cot-desc-plano").addEventListener("input", (e) => {
    desc.plano = e.target.value;
    renderCotacao();
  });
  renderDescontosModulos();
}

// Lista de módulos com checkbox; `selecionados` é o array de keys do estado, alterado no lugar
function initModuloChecks(wrapId, selecionados, onChange) {
  const wrap = document.getElementById(wrapId);
  wrap.innerHTML = MODULOS.map(
    (m) => `
    <label class="cw-check" data-mod="${m.key}">
      <span class="modulo-left">
        <input type="checkbox" class="modulo-checkbox" data-mod-checkbox="${m.key}">
        <span class="modulo-label">${m.label}</span>
      </span>
      <span class="modulo-price">${fmt(m.mensal)}/mês</span>
    </label>`
  ).join("");
  wrap.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      const idx = selecionados.indexOf(cb.dataset.modCheckbox);
      if (idx >= 0) selecionados.splice(idx, 1);
      else selecionados.push(cb.dataset.modCheckbox);
      cb.closest("label").classList.toggle("cw-check-on", cb.checked);
      onChange();
    });
  });
}

// Percentual digitado → número entre 0 e 100 (vazio ou inválido = 0)
const pct = (str) => Math.min(100, Math.max(0, parseFloat(str) || 0));

// Um campo de desconto por módulo selecionado. Só re-renderiza quando a
// seleção muda, para não perder o foco enquanto o usuário digita.
function renderDescontosModulos() {
  const { modulos, descontos } = state.cotacao;
  const wrap = document.getElementById("cot-desc-modulos");

  if (modulos.length === 0) {
    wrap.innerHTML = `<p class="hint">Selecione um módulo acima para dar desconto nele.</p>`;
    return;
  }

  wrap.innerHTML = MODULOS.filter((m) => modulos.includes(m.key))
    .map(
      (m) => `
    <div class="desc-row">
      <label class="modulo-label" for="cot-desc-mod-${m.key}">${m.label}</label>
      <input id="cot-desc-mod-${m.key}" class="cw-input" type="number" min="0" max="100" step="0.01"
        placeholder="0" data-desc-mod="${m.key}" value="${escapeHtml(descontos.modulos[m.key] ?? "")}">
    </div>`
    )
    .join("");

  wrap.querySelectorAll("input[data-desc-mod]").forEach((input) => {
    input.addEventListener("input", () => {
      descontos.modulos[input.dataset.descMod] = input.value;
      renderCotacao();
    });
  });
}

function renderCotacao() {
  state.cotacao.recorrencia = syncRecorrencias(
    state.cotacao.plano, state.cotacao.recorrencia, document.getElementById("cot-recorrencia"));
  const { plano, recorrencia, modulos } = state.cotacao;
  const meses = mesesDe(recorrencia);
  const valorPlano = PLANOS[plano].precos[recorrencia];

  // Descrição do plano
  document.getElementById("cot-plano-desc").textContent = PLANOS[plano].descricao;

  // Estado visual dos botões de recorrência
  document.querySelectorAll("#cot-recorrencia button").forEach((btn) => {
    btn.classList.toggle("cw-check-on", btn.dataset.rec === recorrencia);
  });

  const { descontos } = state.cotacao;
  const descPlanoPct = descontos.ativo ? pct(descontos.plano) : 0;
  const descPlano = valorPlano * (descPlanoPct / 100);

  const modulosCalculados = MODULOS.map((m) => {
    const valorCiclo = m.mensal * meses;
    const descPct = descontos.ativo ? pct(descontos.modulos[m.key]) : 0;
    return { ...m, valorCiclo, descPct, desc: valorCiclo * (descPct / 100), ativo: modulos.includes(m.key) };
  });

  const totalModulos = modulosCalculados
    .filter((m) => m.ativo)
    .reduce((acc, m) => acc + m.valorCiclo - m.desc, 0);

  const total = valorPlano - descPlano + totalModulos;

  const recLabel = RECORRENCIAS.find((r) => r.key === recorrencia).label;

  const rowDesconto = (label, descPct, valor) =>
    descPct > 0
      ? `
    <div class="cw-row">
      <span class="cw-row-label">Desconto ${label} (${descPct.toLocaleString("pt-BR")}%)</span>
      <span class="cw-row-value" style="color:var(--credit);">− ${fmt(valor)}</span>
    </div>`
      : "";

  let rowsHtml = `
    <div class="cw-row">
      <span class="cw-row-label">Plano ${PLANOS[plano].label} (${recLabel})</span>
      <span class="cw-row-value">${fmt(valorPlano)}</span>
    </div>` + rowDesconto("no plano", descPlanoPct, descPlano);

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
    </div>` + rowDesconto(m.label, m.descPct, m.desc);
    });
  }

  rowsHtml += `
    <div class="cw-total-row">
      <span class="cw-total-label">Total do ciclo</span>
      <span class="cw-total-value">${fmt(total)}</span>
    </div>`;

  if (meses > 1) {
    rowsHtml += `
    <div class="cw-row">
      <span class="cw-row-label">Parcelado em ${meses}×</span>
      <span class="cw-row-value">${fmt(total / meses)}/mês</span>
    </div>`;
  }

  document.getElementById("cot-ticket").innerHTML = rowsHtml;
}

/* ──────────────────────────────────────────────────────────
   ABA 2 — MIGRAÇÃO DE PLANO
   A mudança abre um novo período a partir da data da mudança, e
   o que foi pago e não usado do ciclo atual vira crédito:
   credito         = valor_atual × (dias_restantes / dias_totais)
   valor_a_pagar   = valor_novo (ciclo cheio) - credito
   Módulos da mesma fatura seguem a mesma regra: os atuais geram
   crédito (mensal × meses do ciclo atual × fração) e os do novo
   plano são cobrados cheios (mensal × meses do novo ciclo).
   parcela         = valor_a_pagar / nº de meses do novo ciclo
   dias_totais     = (fim_do_ciclo - inicio_do_ciclo) + 1
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

  initModuloChecks("mig-modulos-atual", state.migracao.modulosAtuais, renderMigracao);
  initModuloChecks("mig-modulos-novo", state.migracao.modulosNovos, renderMigracao);
}

function calcularMigracao() {
  const { planoAtual, recAtual, inicioCiclo, planoNovo, recNova, dataMudanca } = state.migracao;

  const inicio = parseDate(inicioCiclo);
  const mudanca = parseDate(dataMudanca);
  if (!inicio || !mudanca) return null;

  const fim = fimDoCiclo(inicio, mesesDe(recAtual));
  const diasTotais = diffDias(fim, inicio) + 1;
  const diasRestantes = diffDias(fim, mudanca) + 1;

  const valorAtual = PLANOS[planoAtual].precos[recAtual];
  const valorNovo = PLANOS[planoNovo].precos[recNova];
  const mesesNovo = mesesDe(recNova);
  const fimNovo = fimDoCiclo(mudanca, mesesNovo);

  const fora = mudanca < inicio || mudanca > fim;
  const fracao = diasTotais > 0 ? diasRestantes / diasTotais : 0;

  const mesesAtual = mesesDe(recAtual);
  const modulosAtuais = MODULOS.filter((m) => state.migracao.modulosAtuais.includes(m.key))
    .map((m) => ({ ...m, credito: m.mensal * mesesAtual * fracao }));
  const modulosNovos = MODULOS.filter((m) => state.migracao.modulosNovos.includes(m.key))
    .map((m) => ({ ...m, valorCiclo: m.mensal * mesesNovo }));

  const credito = valorAtual * fracao;
  const creditoModulos = modulosAtuais.reduce((acc, m) => acc + m.credito, 0);
  const valorModulosNovos = modulosNovos.reduce((acc, m) => acc + m.valorCiclo, 0);
  const valorAPagar = valorNovo + valorModulosNovos - credito - creditoModulos;

  return { fim, diasTotais, diasRestantes, valorAtual, valorNovo, fracao, credito, valorAPagar, fora, inicio, mudanca, fimNovo, mesesNovo, modulosAtuais, modulosNovos };
}

function renderMigracao() {
  const m = state.migracao;
  m.recAtual = syncRecorrencias(m.planoAtual, m.recAtual, document.getElementById("mig-rec-atual"));
  m.recNova = syncRecorrencias(m.planoNovo, m.recNova, document.getElementById("mig-rec-nova"));
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

  ticket.innerHTML =
    rowsCicloAtual(`Plano atual (${PLANOS[planoAtual].label}, ${recAtualLabel})`, calc.valorAtual, calc) +
    rowsCreditos(calc.credito, calc.modulosAtuais) +
    rowsNovoPeriodo(`Plano novo (${PLANOS[planoNovo].label}, ${recNovaLabel})`, calc.valorNovo, calc) +
    rowsModulosNovos(calc.modulosNovos, calc.mesesNovo) +
    rowsTotalMigracao(calc.valorAPagar, calc.mesesNovo);
}

function rowsCreditos(creditoPlano, modulosAtuais) {
  const row = (label, valor) => `
    <div class="cw-row">
      <span class="cw-row-label">${label}</span>
      <span class="cw-row-value" style="color:var(--credit);">− ${fmt(valor)}</span>
    </div>`;
  return row("Crédito não utilizado", creditoPlano) +
    modulosAtuais.map((m) => row(`Crédito não utilizado, módulo ${escapeHtml(m.label)}`, m.credito)).join("");
}

function rowsModulosNovos(modulosNovos, meses) {
  return modulosNovos.map((m) => `
    <div class="cw-row">
      <span class="cw-row-label">Módulo ${m.label} (${meses}× ${fmt(m.mensal)})</span>
      <span class="cw-row-value">${fmt(m.valorCiclo)}</span>
    </div>`).join("");
}

/* Blocos do resumo compartilhados pelas duas sub-abas de migração */
function rowsCicloAtual(label, valor, calc) {
  return `
    <div class="cw-ticket-head">Plano atual</div>
    <div class="cw-row">
      <span class="cw-row-label">${escapeHtml(label)}</span>
      <span class="cw-row-value">${fmt(valor)}</span>
    </div>
    <div class="cw-row">
      <span class="cw-row-label">Ciclo atual</span>
      <span class="cw-row-value">${fmtDataBR(calc.inicio)} a ${fmtDataBR(calc.fim)}</span>
    </div>
    <div class="cw-row">
      <span class="cw-row-label">Dias não utilizados</span>
      <span class="cw-row-value">${calc.diasRestantes} de ${calc.diasTotais}</span>
    </div>`;
}

function rowsNovoPeriodo(label, valor, calc) {
  return `
    <div class="cw-ticket-head cw-ticket-head-novo">Novo plano</div>
    <div class="cw-row">
      <span class="cw-row-label">Novo período</span>
      <span class="cw-row-value">${fmtDataBR(calc.mudanca)} a ${fmtDataBR(calc.fimNovo)}</span>
    </div>
    <div class="cw-row">
      <span class="cw-row-label">${escapeHtml(label)}</span>
      <span class="cw-row-value">${fmt(valor)}</span>
    </div>`;
}

function rowsTotalMigracao(valorAPagar, mesesNovo) {
  const aPagar = valorAPagar >= 0;
  let html = `
    <div class="cw-total-row">
      <span class="cw-total-label">${aPagar ? "Valor a pagar" : "Saldo a favor do cliente"}</span>
      <span class="cw-total-value" style="color:${aPagar ? "var(--brand-ink)" : "var(--credit)"};">${fmt(Math.abs(valorAPagar))}</span>
    </div>`;
  if (aPagar && mesesNovo > 1) {
    html += `
    <div class="cw-row">
      <span class="cw-row-label">Parcelado em ${mesesNovo}×</span>
      <span class="cw-row-value">${fmt(valorAPagar / mesesNovo)}/mês</span>
    </div>`;
  }
  return html;
}

/* ──────────────────────────────────────────────────────────
   ABA 2.2 — MIGRAÇÃO COM VALORES PERSONALIZADOS
   Mesmo princípio da migração padrão (crédito do que não foi usado
   + novo período cheio), mas o valor do plano atual (e,
   opcionalmente, do plano novo) é digitado manualmente — usado
   quando o cliente está numa tabela antiga/negociada.
   Módulos atuais: o valor pago no ciclo é digitado (vazio = tabela)
   e gera crédito pelos dias restantes. Módulos novos: sempre com o
   valor da tabela, cobrados cheios no novo período.
   ────────────────────────────────────────────────────────── */
const escapeHtml = (str) =>
  String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

function initMigracaoPersonalizadaForm() {
  const s = state.migracaoPersonalizada;
  const recOptions = RECORRENCIAS.map((r) => `<option value="${r.key}">${r.label}</option>`).join("");
  const planoOptions = Object.entries(PLANOS)
    .map(([key, p]) => `<option value="${key}">${p.label}</option>`)
    .join("");

  document.getElementById("migp-rec-atual").innerHTML = recOptions;
  document.getElementById("migp-rec-atual").value = s.recAtual;
  document.getElementById("migp-rec-nova-custom").innerHTML = recOptions;
  document.getElementById("migp-rec-nova-custom").value = s.recNovaCustom;
  document.getElementById("migp-plano-novo").innerHTML = planoOptions;
  document.getElementById("migp-plano-novo").value = s.planoNovo;
  document.getElementById("migp-rec-nova").innerHTML = recOptions;
  document.getElementById("migp-rec-nova").value = s.recNova;

  document.getElementById("migp-nome-atual").addEventListener("input", (e) => {
    s.nomeAtual = e.target.value;
  });
  document.getElementById("migp-total-atual").addEventListener("input", (e) => {
    s.totalAtual = e.target.value;
    renderMigracaoPersonalizada();
  });
  document.getElementById("migp-rec-atual").addEventListener("change", (e) => {
    s.recAtual = e.target.value;
    renderValoresModulosAtuais(); // o valor de tabela sugerido depende da recorrência
    renderMigracaoPersonalizada();
  });
  document.getElementById("migp-inicio").addEventListener("change", (e) => {
    s.inicioCiclo = e.target.value;
    renderMigracaoPersonalizada();
  });

  document.getElementById("migp-novo-personalizado").addEventListener("change", (e) => {
    s.novoPersonalizado = e.target.checked;
    document.getElementById("migp-novo-tabela").style.display = s.novoPersonalizado ? "none" : "";
    document.getElementById("migp-novo-custom").style.display = s.novoPersonalizado ? "" : "none";
    renderMigracaoPersonalizada();
  });
  document.getElementById("migp-plano-novo").addEventListener("change", (e) => {
    s.planoNovo = e.target.value;
    renderMigracaoPersonalizada();
  });
  document.getElementById("migp-rec-nova").addEventListener("change", (e) => {
    s.recNova = e.target.value;
    renderMigracaoPersonalizada();
  });
  document.getElementById("migp-nome-novo").addEventListener("input", (e) => {
    s.nomeNovo = e.target.value;
  });
  document.getElementById("migp-mensal-novo").addEventListener("input", (e) => {
    s.mensalNovo = e.target.value;
    renderMigracaoPersonalizada();
  });
  document.getElementById("migp-rec-nova-custom").addEventListener("change", (e) => {
    s.recNovaCustom = e.target.value;
    renderMigracaoPersonalizada();
  });
  document.getElementById("migp-mudanca").addEventListener("change", (e) => {
    s.dataMudanca = e.target.value;
    renderMigracaoPersonalizada();
  });

  initModuloChecks("migp-modulos-atual", s.modulosAtuais, () => {
    renderValoresModulosAtuais();
    renderMigracaoPersonalizada();
  });
  initModuloChecks("migp-modulos-novo", s.modulosNovos, renderMigracaoPersonalizada);

  document.getElementById("migp-add-extra").addEventListener("click", () => {
    s.modulosExtras.push({ id: ++moduloExtraSeq, nome: "", valor: "" });
    renderModulosExtras();
    renderMigracaoPersonalizada();
  });
}

// Linhas livres (nome + valor pago no ciclo) para módulos antigos que não
// existem mais no catálogo. Só re-renderiza ao adicionar/remover.
function renderModulosExtras() {
  const s = state.migracaoPersonalizada;
  const wrap = document.getElementById("migp-modulos-extras");

  wrap.innerHTML = s.modulosExtras
    .map(
      (m) => `
    <div class="extra-row" data-extra-id="${m.id}">
      <input class="cw-input" type="text" placeholder="Nome do módulo antigo" aria-label="Nome do módulo antigo"
        data-campo="nome" value="${escapeHtml(m.nome)}">
      <input class="cw-input" type="number" min="0" step="0.01" placeholder="Valor no ciclo"
        aria-label="Valor pago no ciclo (R$)" data-campo="valor" value="${escapeHtml(m.valor)}">
      <button type="button" class="remove-extra-btn" aria-label="Remover módulo">×</button>
    </div>`
    )
    .join("");

  wrap.querySelectorAll(".extra-row").forEach((row) => {
    const extra = s.modulosExtras.find((m) => m.id === Number(row.dataset.extraId));
    row.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", () => {
        extra[input.dataset.campo] = input.value;
        renderMigracaoPersonalizada();
      });
    });
    row.querySelector(".remove-extra-btn").addEventListener("click", () => {
      s.modulosExtras = s.modulosExtras.filter((m) => m !== extra);
      renderModulosExtras();
      renderMigracaoPersonalizada();
    });
  });
}

// Um campo "valor pago no ciclo" por módulo atual marcado. Só re-renderiza
// quando a seleção ou a recorrência mudam, para não perder o foco ao digitar.
function renderValoresModulosAtuais() {
  const s = state.migracaoPersonalizada;
  const box = document.getElementById("migp-valores-modulos-box");
  const wrap = document.getElementById("migp-valores-modulos");
  const meses = mesesDe(s.recAtual);

  box.style.display = s.modulosAtuais.length ? "" : "none";
  wrap.innerHTML = MODULOS.filter((m) => s.modulosAtuais.includes(m.key))
    .map(
      (m) => `
    <div class="desc-row">
      <label class="modulo-label" for="migp-valor-mod-${m.key}">${m.label}</label>
      <input id="migp-valor-mod-${m.key}" class="cw-input" type="number" min="0" step="0.01"
        placeholder="${(m.mensal * meses).toFixed(2)}" data-valor-mod="${m.key}"
        value="${escapeHtml(s.valoresModulosAtuais[m.key] ?? "")}">
    </div>`
    )
    .join("");

  wrap.querySelectorAll("input[data-valor-mod]").forEach((input) => {
    input.addEventListener("input", () => {
      s.valoresModulosAtuais[input.dataset.valorMod] = input.value;
      renderMigracaoPersonalizada();
    });
  });
}

function calcularMigracaoPersonalizada() {
  const s = state.migracaoPersonalizada;

  const inicio = parseDate(s.inicioCiclo);
  const mudanca = parseDate(s.dataMudanca);
  const valorAtualCiclo = parseFloat(s.totalAtual);

  if (!inicio || !mudanca || !Number.isFinite(valorAtualCiclo)) return null;

  const mesesAtual = mesesDe(s.recAtual);
  const fim = fimDoCiclo(inicio, mesesAtual);
  const diasTotais = diffDias(fim, inicio) + 1;
  const diasRestantes = diffDias(fim, mudanca) + 1;
  const fora = mudanca < inicio || mudanca > fim;
  const fracao = diasTotais > 0 ? diasRestantes / diasTotais : 0;

  const recAtualLabel = RECORRENCIAS.find((r) => r.key === s.recAtual).label;
  const nomeAtual = `${s.nomeAtual.trim() || "Plano personalizado"} (${recAtualLabel})`;

  let valorNovoCiclo, nomeNovo, recNovaLabel, mesesNovo;
  if (s.novoPersonalizado) {
    const mensalNovo = parseFloat(s.mensalNovo);
    mesesNovo = mesesDe(s.recNovaCustom);
    valorNovoCiclo = Number.isFinite(mensalNovo) ? mensalNovo * mesesNovo : 0;
    nomeNovo = s.nomeNovo.trim() || "Plano novo (personalizado)";
    recNovaLabel = RECORRENCIAS.find((r) => r.key === s.recNovaCustom).label;
  } else {
    mesesNovo = mesesDe(s.recNova);
    valorNovoCiclo = PLANOS[s.planoNovo].precos[s.recNova];
    nomeNovo = PLANOS[s.planoNovo].label;
    recNovaLabel = RECORRENCIAS.find((r) => r.key === s.recNova).label;
  }

  const fimNovo = fimDoCiclo(mudanca, mesesNovo);
  const creditoPlano = valorAtualCiclo * fracao;
  const diffPlano = valorNovoCiclo - creditoPlano;

  const modulosAtuais = MODULOS.filter((m) => s.modulosAtuais.includes(m.key)).map((m) => {
    const digitado = parseFloat(s.valoresModulosAtuais[m.key]);
    const valorPago = Number.isFinite(digitado) ? digitado : m.mensal * mesesAtual;
    return { ...m, credito: valorPago * fracao };
  });
  s.modulosExtras.forEach((m) => {
    const valorPago = parseFloat(m.valor);
    if (Number.isFinite(valorPago)) {
      modulosAtuais.push({ label: m.nome.trim() || "antigo", credito: valorPago * fracao });
    }
  });
  const modulosNovos = MODULOS.filter((m) => s.modulosNovos.includes(m.key))
    .map((m) => ({ ...m, valorCiclo: m.mensal * mesesNovo }));

  const creditoModulos = modulosAtuais.reduce((acc, m) => acc + m.credito, 0);
  const valorModulosNovos = modulosNovos.reduce((acc, m) => acc + m.valorCiclo, 0);
  const totalGeral = diffPlano + valorModulosNovos - creditoModulos;

  return {
    fim, diasTotais, diasRestantes, fora,
    valorAtualCiclo, nomeAtual,
    valorNovoCiclo, nomeNovo, recNovaLabel,
    creditoPlano, diffPlano,
    modulosAtuais, modulosNovos, totalGeral,
    inicio, mudanca, fimNovo, mesesNovo,
  };
}

function renderMigracaoPersonalizada() {
  const s = state.migracaoPersonalizada;
  s.recNova = syncRecorrencias(s.planoNovo, s.recNova, document.getElementById("migp-rec-nova"));
  const calc = calcularMigracaoPersonalizada();

  const fimInfo = document.getElementById("migp-fim-info");
  if (calc) {
    fimInfo.innerHTML = `Fim do ciclo atual: <strong>${fmtDataBR(calc.fim)}</strong> (${calc.diasTotais} dias no ciclo)`;
  } else {
    fimInfo.textContent = "";
  }

  const warnBox = document.getElementById("migp-warn");
  const warnText = document.getElementById("migp-warn-text");
  if (calc && calc.fora) {
    warnBox.style.display = "flex";
    warnText.textContent = `A data da mudança está fora do ciclo atual (entre ${fmtDataBR(calc.inicio)} e ${fmtDataBR(calc.fim)}). Confira as datas — o resultado abaixo não é confiável.`;
  } else {
    warnBox.style.display = "none";
  }

  const emptyBox = document.getElementById("migp-empty");
  const ticket = document.getElementById("migp-ticket");

  if (!calc) {
    emptyBox.style.display = "flex";
    ticket.style.display = "none";
    return;
  }

  emptyBox.style.display = "none";
  ticket.style.display = "";

  ticket.innerHTML =
    rowsCicloAtual(calc.nomeAtual, calc.valorAtualCiclo, calc) +
    rowsCreditos(calc.creditoPlano, calc.modulosAtuais) +
    rowsNovoPeriodo(`${calc.nomeNovo} (${calc.recNovaLabel})`, calc.valorNovoCiclo, calc) +
    rowsModulosNovos(calc.modulosNovos, calc.mesesNovo) +
    rowsTotalMigracao(calc.totalGeral, calc.mesesNovo);
}

/* ──────────────────────────────────────────────────────────
   INICIALIZAÇÃO
   ────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  initCotacaoForm();
  renderCotacao();

  initMigracaoForm();
  renderMigracao();

  initMigracaoPersonalizadaForm();
  renderValoresModulosAtuais();
  renderMigracaoPersonalizada();

  if (window.lucide) {
    lucide.createIcons();
  }
});
