(function () {
  'use strict';

  var ANNUAL_INDEX_RATES = {
    INCC: 0.06,
    IPCA: 0.045,
    INPC: 0.045,
    PRE: 0.05
  };

  var INDEX_LABELS = {
    INCC: 'INCC',
    IPCA: 'IPCA',
    INPC: 'INPC',
    PRE: 'Pré-fixado 5%'
  };

  var cardsContainer = document.getElementById('cardsContainer');
  var cardTemplate = document.getElementById('cardTemplate');
  var errorBox = document.getElementById('error');
  var btnAddCard = document.getElementById('btnAddCard');
  var btnLimpar = document.getElementById('btnLimpar');
  var btnCalcular = document.getElementById('btnCalcular');
  var btnCopiarResumo = document.getElementById('btnCopiarResumo');
  var copyFeedback = document.getElementById('copyFeedback');
  var agrupamentoParcelas = document.getElementById('agrupamentoParcelas');

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  var lastSummaryText = '';

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

    row.querySelector('.credito').addEventListener('input', function () {});
    attachCurrencyMask(row.querySelector('.credito'));
    attachCurrencyMask(row.querySelector('.entrada'));
    attachCurrencyMask(row.querySelector('.parcela'));
    attachPrazoMask(row.querySelector('.prazo'));

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
    lastSummaryText = '';
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
      var indice = row.querySelector('.reajuste-select').value;

      if (!credito || !parcela || !prazo || !indice) {
        invalid = true;
      }

      cards.push({ credito: credito, entrada: entrada, parcela: parcela, prazo: prazo, indice: indice });
    });

    if (invalid) return null;
    return cards;
  }

  function buildMonthlyPayments(card) {
    var rate = ANNUAL_INDEX_RATES[card.indice] || 0;
    var payments = [];
    for (var t = 1; t <= card.prazo; t++) {
      var yearsElapsed = Math.floor((t - 1) / 12);
      var value = card.parcela * Math.pow(1 + rate, yearsElapsed);
      payments.push(value);
    }
    return payments;
  }

  function solveMonthlyIRR(cf0, payments) {
    function npv(i) {
      var v = cf0;
      for (var t = 0; t < payments.length; t++) {
        v -= payments[t] / Math.pow(1 + i, t + 1);
      }
      return v;
    }

    var lo = -0.9, hi = 5;
    var nlo = npv(lo), nhi = npv(hi);

    if (!isFinite(nlo) || !isFinite(nhi) || nlo * nhi > 0) return null;

    for (var iter = 0; iter < 100; iter++) {
      var mid = (lo + hi) / 2;
      var nm = npv(mid);
      if (Math.abs(nm) < 1e-7) return mid;
      if ((nlo < 0) === (nm < 0)) { lo = mid; nlo = nm; } else { hi = mid; }
    }
    return (lo + hi) / 2;
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
      groups.push({ from: start + 1, to: i, value: value });
    }
    return groups;
  }

  function renderInstallmentGroups(groups) {
    if (!groups.length) {
      agrupamentoParcelas.innerHTML = '';
      return;
    }
    var html = '<h3>Evolução das parcelas (soma de todas as cartas)</h3><div class="installment-list">';
    groups.forEach(function (g) {
      var rangeLabel = g.from === g.to ? ('Mês ' + g.from) : ('Meses ' + g.from + '–' + g.to);
      html += '<div class="installment-group"><span class="range">' + rangeLabel + '</span>' +
        '<span class="value">' + formatBRL(g.value) + ' / mês</span></div>';
    });
    html += '</div>';
    agrupamentoParcelas.innerHTML = html;
  }

  function calcular() {
    hideError();
    var cards = readCards();

    if (!cards || !cards.length) {
      showError('Preencha crédito, parcela, prazo e índice de reajuste em todas as cartas antes de calcular.');
      resetResults();
      return;
    }

    var totalCredito = 0;
    var totalEntrada = 0;
    var totalSaldoDevedor = 0;
    var maxPrazo = 0;
    var perCardPayments = [];

    cards.forEach(function (card) {
      totalCredito += card.credito;
      totalEntrada += card.entrada;
      maxPrazo = Math.max(maxPrazo, card.prazo);
      var payments = buildMonthlyPayments(card);
      perCardPayments.push(payments);
      totalSaldoDevedor += payments.reduce(function (a, b) { return a + b; }, 0);
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
    var custoTotalPercent = totalCredito > 0 ? (custoTotalReais / totalCredito) * 100 : 0;

    var cf0 = totalCredito - totalEntrada;
    var cetMensal = solveMonthlyIRR(cf0, monthlyTotals);
    var cetAnual = cetMensal !== null ? Math.pow(1 + cetMensal, 12) - 1 : null;

    document.getElementById('creditoLiquido').textContent = formatBRL(creditoLiquido);
    document.getElementById('saldoDevedor').textContent = formatBRL(totalSaldoDevedor);
    document.getElementById('custoTotalReais').textContent = formatBRL(custoTotalReais);
    document.getElementById('custoTotalPercent').textContent = formatPercent(custoTotalPercent);
    document.getElementById('cetMensal').textContent = cetMensal !== null ? formatPercent(cetMensal * 100) : 'N/A';
    document.getElementById('cetAnual').textContent = cetAnual !== null ? formatPercent(cetAnual * 100) : 'N/A';

    var groups = groupPayments(monthlyTotals);
    renderInstallmentGroups(groups);

    lastSummaryText = buildSummaryText(cards, {
      creditoLiquido: creditoLiquido,
      totalSaldoDevedor: totalSaldoDevedor,
      custoTotalReais: custoTotalReais,
      custoTotalPercent: custoTotalPercent,
      cetMensal: cetMensal,
      cetAnual: cetAnual
    });
  }

  function buildSummaryText(cards, r) {
    var lines = [];
    lines.push('*Simulação contemplei – Custo da Carta Contemplada*');
    lines.push('');
    cards.forEach(function (card, i) {
      lines.push('Carta #' + (i + 1) + ': ' + formatBRL(card.credito) + ' | entrada ' + formatBRL(card.entrada) +
        ' | parcela ' + formatBRL(card.parcela) + ' x ' + card.prazo + ' meses (' + (INDEX_LABELS[card.indice] || card.indice) + ')');
    });
    lines.push('');
    lines.push('Crédito líquido total recebido: ' + formatBRL(r.creditoLiquido));
    lines.push('Saldo devedor total: ' + formatBRL(r.totalSaldoDevedor));
    lines.push('Custo total da operação: ' + formatBRL(r.custoTotalReais) + ' (' + formatPercent(r.custoTotalPercent) + ')');
    lines.push('CET mensal aproximado: ' + (r.cetMensal !== null ? formatPercent(r.cetMensal * 100) : 'N/A'));
    lines.push('CET anual aproximado: ' + (r.cetAnual !== null ? formatPercent(r.cetAnual * 100) : 'N/A'));
    lines.push('');
    lines.push('Simulação educativa – contemplei');
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

  addCard();
})();
