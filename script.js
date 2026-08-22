(function () {
  'use strict';

  var INDEX_LABELS = {
    INCC: 'INCC',
    IPCA: 'IPCA',
    INPC: 'INPC',
    PRE: 'Pré-fixado 5%'
  };

  var SEGMENTO_LABELS = {
    IMOVEL: 'Imóvel',
    VEICULO: 'Veículo',
    SERVICO: 'Serviço'
  };

  // TODO: apontar para o Cloudflare Worker (ou outro serviço) responsável por
  // buscar a página da carta no servidor e devolver os campos extraídos.
  // Contrato esperado da resposta: { credito, entrada, parcela, prazoMeses }
  // (credito/entrada/parcela em reais, prazoMeses como inteiro).
  // Enquanto não estiver configurado, a leitura automática mostra um aviso
  // claro em vez de fingir que funcionou.
  var SCRAPE_ENDPOINT = '';

  var cardsContainer = document.getElementById('cardsContainer');
  var cardTemplate = document.getElementById('cardTemplate');
  var errorBox = document.getElementById('error');
  var btnAddCard = document.getElementById('btnAddCard');
  var btnLimpar = document.getElementById('btnLimpar');
  var btnCalcular = document.getElementById('btnCalcular');
  var btnCopiarResumo = document.getElementById('btnCopiarResumo');
  var copyFeedback = document.getElementById('copyFeedback');
  var btnCopiarAgrupamento = document.getElementById('btnCopiarAgrupamento');
  var copyAgrupamentoFeedback = document.getElementById('copyAgrupamentoFeedback');
  var agrupamentoSection = document.getElementById('agrupamentoSection');
  var agrupamentoParcelas = document.getElementById('agrupamentoParcelas');
  var btnCopiarEvolucao = document.getElementById('btnCopiarEvolucao');
  var copyEvolucaoFeedback = document.getElementById('copyEvolucaoFeedback');
  var evolucaoSection = document.getElementById('evolucaoSection');
  var evolucaoParcelas = document.getElementById('evolucaoParcelas');
  var segmentoSelect = document.getElementById('segmentoSelect');
  var indiceSelect = document.getElementById('indiceSelect');
  var administradoraInput = document.getElementById('administradoraInput');

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  var lastSummaryText = '';
  var lastAgrupamentoText = '';
  var lastEvolucaoText = '';

  function currencyToCents(str) {
    var digits = (str || '').replace(/\D/g, '');
    return digits ? parseInt(digits, 10) : 0;
  }

  function formatCurrencyFromCents(cents) {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatBRL(value) {
    return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatPercent(value) {
    return (value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  }

  function attachCurrencyMask(input) {
    input.addEventListener('input', function () {
      var cents = currencyToCents(input.value);
      input.value = cents ? formatCurrencyFromCents(cents) : '';
    });
  }

  function attachPrazoMask(input) {
    input.addEventListener('input', function () {
      var digits = input.value.replace(/\D/g, '');
      input.value = digits;
    });
    input.addEventListener('blur', function () {
      var digits = input.value.replace(/\D/g, '');
      input.value = digits ? digits + ' meses' : '';
    });
    input.addEventListener('focus', function () {
      input.value = input.value.replace(/\D/g, '');
    });
  }

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(null, args); }, wait);
    };
  }

  function isValidUrl(str) {
    try {
      var u = new URL(str);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  function setScrapeStatus(row, state, message) {
    var statusEl = row.querySelector('.scrape-status');
    if (!message) {
      statusEl.hidden = true;
      statusEl.innerHTML = '';
      statusEl.className = 'scrape-status';
      return;
    }
    statusEl.hidden = false;
    statusEl.className = 'scrape-status is-' + state;
    statusEl.innerHTML = (state === 'loading' ? '<span class="spinner"></span>' : '') +
      '<span>' + message + '</span>';
  }

  function fillCardFromScrapedData(row, data) {
    if (typeof data.credito === 'number') {
      row.querySelector('.credito').value = formatCurrencyFromCents(Math.round(data.credito * 100));
    }
    if (typeof data.entrada === 'number') {
      row.querySelector('.entrada').value = formatCurrencyFromCents(Math.round(data.entrada * 100));
    }
    if (typeof data.parcela === 'number') {
      row.querySelector('.parcela').value = formatCurrencyFromCents(Math.round(data.parcela * 100));
    }
    if (typeof data.prazoMeses === 'number') {
      row.querySelector('.prazo').value = String(data.prazoMeses);
    }
  }

  function maybeFillGlobalOptions(data) {
    if (!segmentoSelect.value && data.segmento && SEGMENTO_LABELS[data.segmento]) {
      segmentoSelect.value = data.segmento;
    }
    if (!administradoraInput.value.trim() && data.administradora) {
      administradoraInput.value = data.administradora;
    }
  }

  function scrapeCartaFromUrl(row, url) {
    if (!SCRAPE_ENDPOINT) {
      setScrapeStatus(row, 'error', 'Leitura automática ainda não configurada para este link. Preencha os campos manualmente por enquanto.');
      return;
    }

    setScrapeStatus(row, 'loading', 'Lendo dados da carta...');

    fetch(SCRAPE_ENDPOINT + '?url=' + encodeURIComponent(url))
      .then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data && data.error ? data.error : ('HTTP ' + res.status));
          return data;
        });
      })
      .then(function (data) {
        fillCardFromScrapedData(row, data);
        maybeFillGlobalOptions(data);
        setScrapeStatus(row, 'success', 'Dados preenchidos automaticamente. Confira antes de calcular.');
      })
      .catch(function (err) {
        setScrapeStatus(row, 'error', (err && err.message) || 'Não foi possível ler esse link automaticamente. Preencha os campos manualmente.');
      });
  }

  function attachUrlAutoRead(row) {
    var urlInput = row.querySelector('.carta-url');
    var trigger = debounce(function () {
      var value = urlInput.value.trim();
      if (!value) {
        setScrapeStatus(row, null, null);
        return;
      }
      if (!isValidUrl(value)) {
        setScrapeStatus(row, 'error', 'Link inválido.');
        return;
      }
      scrapeCartaFromUrl(row, value);
    }, 500);

    urlInput.addEventListener('input', trigger);
  }

  function renumberCards() {
    var rows = cardsContainer.querySelectorAll('.card-row');
    rows.forEach(function (row, i) {
      row.setAttribute('data-index', i + 1);
      row.querySelector('.card-number').textContent = i + 1;
      var removeBtn = row.querySelector('.btn-remove-card');
      removeBtn.style.display = rows.length > 1 ? '' : 'none';
    });
  }

  function addCard() {
    var fragment = cardTemplate.content.cloneNode(true);
    var row = fragment.querySelector('.card-row');

    attachCurrencyMask(row.querySelector('.credito'));
    attachCurrencyMask(row.querySelector('.entrada'));
    attachCurrencyMask(row.querySelector('.parcela'));
    attachPrazoMask(row.querySelector('.prazo'));
    attachUrlAutoRead(row);

    row.querySelector('.btn-remove-card').addEventListener('click', function () {
      row.remove();
      renumberCards();
    });

    cardsContainer.appendChild(row);
    renumberCards();
  }

  function clearFields() {
    cardsContainer.innerHTML = '';
    addCard();
    segmentoSelect.value = '';
    indiceSelect.value = '';
    administradoraInput.value = '';
    hideError();
    resetResults();
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.style.display = '';
  }

  function hideError() {
    errorBox.style.display = 'none';
  }

  function resetResults() {
    ['creditoLiquido', 'saldoDevedor', 'custoTotalReais', 'custoTotalPercent', 'cetMensal', 'cetAnual'].forEach(function (id) {
      document.getElementById(id).textContent = '–';
    });
    agrupamentoParcelas.innerHTML = '';
    agrupamentoSection.hidden = true;
    evolucaoParcelas.innerHTML = '';
    evolucaoSection.hidden = true;
    lastSummaryText = '';
    lastAgrupamentoText = '';
    lastEvolucaoText = '';
  }

  function readCards() {
    var rows = cardsContainer.querySelectorAll('.card-row');
    var cards = [];
    var invalid = false;

    rows.forEach(function (row) {
      var credito = currencyToCents(row.querySelector('.credito').value) / 100;
      var entrada = currencyToCents(row.querySelector('.entrada').value) / 100;
      var parcela = currencyToCents(row.querySelector('.parcela').value) / 100;
      var prazo = parseInt(row.querySelector('.prazo').value.replace(/\D/g, ''), 10) || 0;

      if (!credito || !parcela || !prazo) {
        invalid = true;
      }

      cards.push({ credito: credito, entrada: entrada, parcela: parcela, prazo: prazo });
    });

    if (!segmentoSelect.value || !indiceSelect.value) {
      invalid = true;
    }

    if (invalid) return null;
    return cards;
  }

  function buildMonthlyPayments(card) {
    var payments = [];
    for (var t = 1; t <= card.prazo; t++) {
      payments.push(card.parcela);
    }
    return payments;
  }

  function groupPayments(monthlyTotals) {
    var groups = [];
    var i = 0;
    while (i < monthlyTotals.length) {
      var start = i;
      var value = monthlyTotals[i];
      while (i < monthlyTotals.length && Math.abs(monthlyTotals[i] - value) < 0.005) {
        i++;
      }
      var count = i - start;
      groups.push({ from: start + 1, to: i, count: count, value: value, subtotal: value * count });
    }
    return groups;
  }

  function periodLabel(g) {
    return g.from === g.to ? ('Mês ' + g.from) : ('Mês ' + g.from + ' a ' + g.to);
  }

  function periodLabelEvolucao(g, index) {
    return (index + 1) + 'º período (' + periodLabel(g) + ')';
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function renderAgrupamento(groups) {
    if (!groups.length) {
      agrupamentoParcelas.innerHTML = '';
      agrupamentoSection.hidden = true;
      return;
    }
    var html = '<div class="installment-list">';
    groups.forEach(function (g) {
      html += '<div class="installment-group">' +
        '<span class="range">' + periodLabel(g) + '</span>' +
        '<span class="value">' + formatBRL(g.value) + '</span>' +
        '</div>';
    });
    html += '</div>';
    agrupamentoParcelas.innerHTML = html;
    agrupamentoSection.hidden = false;
  }

  function buildAgrupamentoText(groups) {
    var lines = [];
    lines.push('*Agrupamento das parcelas – contemplei*');
    lines.push('');
    groups.forEach(function (g) {
      lines.push(periodLabel(g) + ': ' + formatBRL(g.value));
    });
    return lines.join('\n');
  }

  function renderEvolucao(groups) {
    if (!groups.length) {
      evolucaoParcelas.innerHTML = '';
      evolucaoSection.hidden = true;
      return;
    }
    var html = '<div class="installment-list">';
    groups.forEach(function (g, index) {
      html += '<div class="installment-group">' +
        '<span class="range">' + periodLabelEvolucao(g, index) + '</span>' +
        '<span class="value">' + g.count + 'x ' + formatBRL(g.value) + ' <span class="subtotal">(subtotal ' + formatBRL(g.subtotal) + ')</span></span>' +
        '</div>';
    });
    html += '</div>';
    evolucaoParcelas.innerHTML = html;
    evolucaoSection.hidden = false;
  }

  function buildEvolucaoText(groups) {
    var lines = [];
    lines.push('*Evolução das Parcelas – contemplei*');
    lines.push('');
    groups.forEach(function (g, index) {
      lines.push(capitalize(periodLabelEvolucao(g, index)) + ': ' + g.count + 'x ' + formatBRL(g.value) + ' (subtotal ' + formatBRL(g.subtotal) + ')');
    });
    return lines.join('\n');
  }

  function calcular() {
    hideError();
    var cards = readCards();

    if (!cards || !cards.length) {
      showError('Preencha crédito, parcela e prazo em todas as cartas, e selecione o segmento e o índice de reajuste, antes de calcular.');
      resetResults();
      return;
    }

    var totalCredito = 0;
    var totalEntrada = 0;
    var totalSaldoDevedor = 0;
    var prazoPonderadoNumerador = 0;
    var maxPrazo = 0;
    var perCardPayments = [];

    cards.forEach(function (card) {
      totalCredito += card.credito;
      totalEntrada += card.entrada;
      maxPrazo = Math.max(maxPrazo, card.prazo);
      var payments = buildMonthlyPayments(card);
      perCardPayments.push(payments);
      var saldoCarta = card.parcela * card.prazo;
      totalSaldoDevedor += saldoCarta;
      prazoPonderadoNumerador += card.prazo * saldoCarta;
    });

    var monthlyTotals = [];
    for (var t = 0; t < maxPrazo; t++) {
      var sum = 0;
      perCardPayments.forEach(function (payments) {
        if (t < payments.length) sum += payments[t];
      });
      monthlyTotals.push(sum);
    }

    var creditoLiquido = totalCredito - totalEntrada;
    var custoTotalReais = (totalEntrada + totalSaldoDevedor) - totalCredito;
    var custoTotalPercent = creditoLiquido !== 0 ? (custoTotalReais / creditoLiquido) * 100 : null;
    var prazoPonderado = totalSaldoDevedor !== 0 ? prazoPonderadoNumerador / totalSaldoDevedor : 0;
    var cetMensal = (custoTotalPercent !== null && prazoPonderado) ? custoTotalPercent / prazoPonderado : null;
    var cetAnual = cetMensal !== null ? cetMensal * 12 : null;
    var indiceLabel = INDEX_LABELS[indiceSelect.value] || indiceSelect.value;

    document.getElementById('creditoLiquido').textContent = formatBRL(creditoLiquido);
    document.getElementById('saldoDevedor').textContent = formatBRL(totalSaldoDevedor);
    document.getElementById('custoTotalReais').textContent = formatBRL(custoTotalReais);
    document.getElementById('custoTotalPercent').textContent = custoTotalPercent !== null ? formatPercent(custoTotalPercent) : 'N/A';
    document.getElementById('cetMensal').textContent = cetMensal !== null ? formatPercent(cetMensal) : 'N/A';
    document.getElementById('cetAnual').textContent = cetAnual !== null ? (formatPercent(cetAnual) + ' + ' + indiceLabel) : 'N/A';

    var groups = groupPayments(monthlyTotals);
    renderAgrupamento(groups);
    renderEvolucao(groups);
    lastAgrupamentoText = buildAgrupamentoText(groups);
    lastEvolucaoText = buildEvolucaoText(groups);

    lastSummaryText = buildSummaryText(cards, groups, {
      totalCredito: totalCredito,
      totalEntrada: totalEntrada,
      totalSaldoDevedor: totalSaldoDevedor,
      cetMensal: cetMensal,
      cetAnual: cetAnual,
      indiceLabel: indiceLabel
    });
  }

  function buildSummaryText(cards, groups, r) {
    var segmentoLabel = SEGMENTO_LABELS[segmentoSelect.value] || segmentoSelect.value;
    var entradaPercent = r.totalCredito !== 0 ? (r.totalEntrada / r.totalCredito) * 100 : 0;
    var transferEstimate = r.totalCredito * 0.01;

    var lines = [];
    lines.push('📊 *Simulação Contemplei | Carta Contemplada – ' + segmentoLabel + '*');
    lines.push('');
    lines.push('→ Segmento: ' + segmentoLabel);
    if (administradoraInput.value.trim()) {
      lines.push('→ Administradora: ' + administradoraInput.value.trim());
    }
    lines.push('→ Índice de reajuste: ' + r.indiceLabel);
    lines.push('');
    cards.forEach(function (card, i) {
      lines.push('Carta #' + (i + 1) + ': ' + formatBRL(card.credito) + ' | entrada ' + formatBRL(card.entrada) +
        ' | parcela ' + formatBRL(card.parcela) + ' x ' + card.prazo + ' meses');
    });
    lines.push('');
    lines.push('💰 *Resumo financeiro*');
    lines.push('');
    lines.push('• *Crédito total (R$):* ' + formatBRL(r.totalCredito));
    lines.push('• *Entrada (R$):* ' + formatBRL(r.totalEntrada) + ' _(' + formatPercent(entradaPercent) + ')_');
    lines.push('• *Saldo devedor:* ' + formatBRL(r.totalSaldoDevedor));
    lines.push('• *CET aprox.:* ' + (r.cetMensal !== null ? formatPercent(r.cetMensal) : 'N/A') + ' a.m. | ' +
      (r.cetAnual !== null ? formatPercent(r.cetAnual) : 'N/A') + ' a.a. + ' + r.indiceLabel);
    lines.push('• *Estimativa Transferência:* ' + formatBRL(transferEstimate) + ' (1% Crédito)');

    if (groups.length) {
      lines.push('');
      lines.push('📆 *Fluxo das parcelas*');
      groups.forEach(function (g) {
        lines.push('→ ' + periodLabel(g) + ': ' + formatBRL(g.value));
      });
    }

    lines.push('');
    lines.push('🌐 Conheça a Contemplei:');
    lines.push('https://contemplei.app/');

    return lines.join('\n');
  }

  function copySummary() {
    if (!lastSummaryText) {
      showError('Calcule o custo efetivo antes de copiar o resumo.');
      return;
    }
    var done = function () {
      copyFeedback.classList.add('visible');
      setTimeout(function () { copyFeedback.classList.remove('visible'); }, 2500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lastSummaryText).then(done).catch(function () {
        fallbackCopy(lastSummaryText, done);
      });
    } else {
      fallbackCopy(lastSummaryText, done);
    }
  }

  function copyAgrupamento() {
    if (!lastAgrupamentoText) {
      showError('Calcule o custo efetivo antes de copiar o agrupamento das parcelas.');
      return;
    }
    var done = function () {
      copyAgrupamentoFeedback.classList.add('visible');
      setTimeout(function () { copyAgrupamentoFeedback.classList.remove('visible'); }, 2500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lastAgrupamentoText).then(done).catch(function () {
        fallbackCopy(lastAgrupamentoText, done);
      });
    } else {
      fallbackCopy(lastAgrupamentoText, done);
    }
  }

  function copyEvolucao() {
    if (!lastEvolucaoText) {
      showError('Calcule o custo efetivo antes de copiar a evolução das parcelas.');
      return;
    }
    var done = function () {
      copyEvolucaoFeedback.classList.add('visible');
      setTimeout(function () { copyEvolucaoFeedback.classList.remove('visible'); }, 2500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lastEvolucaoText).then(done).catch(function () {
        fallbackCopy(lastEvolucaoText, done);
      });
    } else {
      fallbackCopy(lastEvolucaoText, done);
    }
  }

  function fallbackCopy(text, done) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    document.body.removeChild(textarea);
  }

  btnAddCard.addEventListener('click', addCard);
  btnLimpar.addEventListener('click', clearFields);
  btnCalcular.addEventListener('click', calcular);
  btnCopiarResumo.addEventListener('click', copySummary);
  btnCopiarAgrupamento.addEventListener('click', copyAgrupamento);
  btnCopiarEvolucao.addEventListener('click', copyEvolucao);

  addCard();
})();
