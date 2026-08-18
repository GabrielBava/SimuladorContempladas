(function () {
  'use strict';

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  var state = {
    nomeCliente: '',
    nomePlanejador: '',
    dataReuniao: '',
    tipo: 'PF',
    observacoes: '',
    arquivoNome: '',
    transcricao: '',
    mode: 'interno'
  };

  var stepIndicators = document.querySelectorAll('.wizard-step-indicator');
  var stepSections = {
    1: document.getElementById('stepIdentificacao'),
    2: document.getElementById('stepUpload'),
    3: document.getElementById('stepProcessing'),
    4: document.getElementById('stepResult')
  };

  function goToStep(n) {
    Object.keys(stepSections).forEach(function (key) {
      stepSections[key].hidden = Number(key) !== n;
    });
    stepIndicators.forEach(function (li) {
      var step = Number(li.getAttribute('data-step'));
      li.classList.toggle('active', step === n);
      li.classList.toggle('completed', step < n);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Step 1: Identificação ----------

  var inputNomeCliente = document.getElementById('inputNomeCliente');
  var inputNomePlanejador = document.getElementById('inputNomePlanejador');
  var inputDataReuniao = document.getElementById('inputDataReuniao');
  var inputTipo = document.getElementById('inputTipo');
  var inputObservacoes = document.getElementById('inputObservacoes');

  document.getElementById('btnStep1Continuar').addEventListener('click', function () {
    state.nomeCliente = inputNomeCliente.value.trim();
    state.nomePlanejador = inputNomePlanejador.value.trim();
    state.dataReuniao = inputDataReuniao.value;
    state.tipo = inputTipo.value;
    state.observacoes = inputObservacoes.value.trim();
    goToStep(2);
  });

  // ---------- Step 2: Upload ----------

  var dropzone = document.getElementById('dropzone');
  var dropzoneFile = document.getElementById('dropzoneFile');
  var fileInput = document.getElementById('fileInput');
  var inputTranscricao = document.getElementById('inputTranscricao');
  var uploadError = document.getElementById('uploadError');

  function showUploadError(message) {
    uploadError.textContent = message;
    uploadError.style.display = '';
  }

  function hideUploadError() {
    uploadError.style.display = 'none';
  }

  function setFile(file) {
    if (!file) return;
    state.arquivoNome = file.name;
    dropzoneFile.textContent = '📎 ' + file.name;
    dropzoneFile.hidden = false;
    hideUploadError();
  }

  dropzone.addEventListener('click', function () { fileInput.click(); });
  dropzone.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });

  fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files[0]) setFile(fileInput.files[0]);
  });

  ['dragenter', 'dragover'].forEach(function (evt) {
    dropzone.addEventListener(evt, function (e) {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(function (evt) {
    dropzone.addEventListener(evt, function (e) {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', function (e) {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  });

  document.getElementById('btnStep2Voltar').addEventListener('click', function () { goToStep(1); });

  var processingTimers = [];

  document.getElementById('btnGerarDiagnostico').addEventListener('click', function () {
    state.transcricao = inputTranscricao.value.trim();

    if (!state.arquivoNome && !state.transcricao) {
      showUploadError('Anexe um arquivo de transcrição ou cole o texto da reunião antes de gerar o diagnóstico.');
      return;
    }
    hideUploadError();
    goToStep(3);
    runProcessingAnimation();
  });

  function runProcessingAnimation() {
    var flowItems = document.querySelectorAll('#processingFlow li');
    flowItems.forEach(function (li) { li.classList.remove('active', 'done'); });
    processingTimers.forEach(function (t) { clearTimeout(t); });
    processingTimers = [];

    flowItems.forEach(function (li, i) {
      var t = setTimeout(function () {
        flowItems.forEach(function (other, j) {
          if (j < i) other.classList.add('done');
          other.classList.toggle('active', j === i);
        });
      }, i * 420);
      processingTimers.push(t);
    });

    var finalTimer = setTimeout(function () {
      flowItems.forEach(function (li) { li.classList.remove('active'); li.classList.add('done'); });
      renderDiagnostico(buildMockDiagnostico(state));
      goToStep(4);
    }, flowItems.length * 420 + 500);
    processingTimers.push(finalTimer);
  }

  // ---------- Step 4: Resultado ----------

  function buildMockDiagnostico(s) {
    var nome = s.nomeCliente || (s.tipo === 'PJ' ? 'a empresa' : 'o cliente');
    var pronome = s.tipo === 'PJ' ? 'A empresa' : (s.nomeCliente || 'O cliente');

    return {
      resumoExecutivo: pronome + ' apresenta uma situação financeira estável, com renda ativa consistente e capacidade de poupança acima da média, ' +
        'mas com concentração patrimonial relevante em poucos ativos e ausência de reserva de emergência formalizada. ' +
        'Há espaço claro para reorganização de dívidas de curto prazo e para estruturar uma estratégia de investimentos alinhada aos objetivos de médio e longo prazo declarados na reunião.',
      perfilCliente: (s.tipo === 'PJ'
        ? 'Pessoa jurídica com estrutura societária ainda não detalhada na reunião. '
        : 'Pessoa física, casado(a), com dependentes mencionados de forma indireta na conversa. ') +
        'Atua profissionalmente com renda variável e demonstra familiaridade intermediária com produtos financeiros. ' +
        (s.observacoes ? 'Observações do planejador: ' + s.observacoes : 'Nenhuma observação adicional registrada pelo planejador.'),
      objetivos: {
        curto: ['Montar reserva de emergência equivalente a 6 meses de despesas', 'Reorganizar dívidas com juros mais altos'],
        medio: ['Planejar aquisição de imóvel ou troca de veículo', 'Aumentar aporte mensal em investimentos'],
        longo: ['Independência financeira / aposentadoria', 'Sucessão patrimonial e planejamento tributário']
      },
      raioX: [
        { label: 'Renda mensal estimada', value: 'R$ 28.000,00' },
        { label: 'Despesas mensais estimadas', value: 'R$ 16.500,00' },
        { label: 'Capacidade de poupança', value: 'R$ 11.500,00 (41%)' },
        { label: 'Investimentos atuais', value: 'R$ 340.000,00' },
        { label: 'Imóveis', value: 'R$ 1.200.000,00' },
        { label: 'Empresas / participações', value: 'Não informado' },
        { label: 'Dívidas em aberto', value: 'R$ 62.000,00' },
        { label: 'Patrimônio líquido estimado', value: 'R$ 1.478.000,00' }
      ],
      diagnostico: {
        pontosFortes: ['Boa capacidade de poupança mensal', 'Renda consistente e diversificada', 'Abertura para planejamento de longo prazo'],
        pontosAtencao: ['Ausência de reserva de emergência formal', 'Concentração patrimonial em imóveis', 'Dívidas com taxas não otimizadas'],
        oportunidades: ['Consolidar dívidas em linha de crédito mais barata', 'Diversificar investimentos entre renda fixa e variável', 'Estruturar previdência privada para eficiência tributária']
      },
      prioridades: {
        alta: ['Formalizar reserva de emergência', 'Revisar e renegociar dívidas em aberto'],
        media: ['Diversificar carteira de investimentos', 'Rever proteção patrimonial (seguros)'],
        baixa: ['Planejamento sucessório', 'Revisão de estrutura societária']
      },
      pendencias: [
        'Extrato consolidado de investimentos dos últimos 12 meses',
        'Detalhamento de dívidas (taxas, prazos e instituições)',
        'Composição familiar completa (dependentes)',
        s.tipo === 'PJ' ? 'Balanço patrimonial da empresa' : 'Declaração de Imposto de Renda mais recente'
      ],
      proximosPassos: [
        'Enviar checklist de documentos pendentes para ' + nome,
        'Agendar R2 para aprofundar objetivos de médio e longo prazo',
        'Apresentar proposta inicial de reorganização de dívidas',
        'Estruturar plano de investimentos alinhado ao perfil de risco'
      ],
      interno: {
        gaps: ['Perfil de risco não coletado formalmente', 'Sucessão/testamento não mencionado', 'Proteção (seguros) não abordada na reunião'],
        perguntasR2: ['Qual a tolerância real a risco em cenários de queda?', 'Há intenção de aquisição de novos imóveis nos próximos 24 meses?', 'Existe patrimônio ou dívida não mencionada na reunião?'],
        riscosOportunidadesComerciais: ['Oportunidade de consolidar todos os investimentos sob assessoria única', 'Risco de perda de mandato caso reserva de emergência não seja endereçada rapidamente', 'Espaço para oferta de seguro de vida/patrimonial']
      }
    };
  }

  function el(tag, className, html) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function renderList(container, items) {
    container.innerHTML = '';
    var ul = document.createElement('ul');
    items.forEach(function (item) {
      var li = document.createElement('li');
      li.textContent = item;
      ul.appendChild(li);
    });
    container.appendChild(ul);
  }

  var currentDiagnostico = null;

  function renderDiagnostico(d) {
    currentDiagnostico = d;

    document.getElementById('blocoResumoExecutivo').textContent = d.resumoExecutivo;
    document.getElementById('blocoPerfilCliente').textContent = d.perfilCliente;

    var objetivosEl = document.getElementById('blocoObjetivos');
    objetivosEl.innerHTML = '';
    [['Curto prazo', d.objetivos.curto], ['Médio prazo', d.objetivos.medio], ['Longo prazo', d.objetivos.longo]].forEach(function (pair) {
      var item = el('div', 'objetivo-item');
      item.appendChild(el('div', 'objetivo-label', pair[0]));
      var ul = document.createElement('ul');
      pair[1].forEach(function (o) { var li = document.createElement('li'); li.textContent = o; ul.appendChild(li); });
      item.appendChild(ul);
      objetivosEl.appendChild(item);
    });

    var raioXEl = document.getElementById('blocoRaioX');
    raioXEl.innerHTML = '';
    d.raioX.forEach(function (item) {
      var box = el('div', 'result-item');
      box.appendChild(el('div', 'result-label', item.label));
      box.appendChild(el('div', 'result-value', item.value));
      raioXEl.appendChild(box);
    });

    var diagCols = document.getElementById('blocoDiagnostico');
    diagCols.innerHTML = '';
    [['Pontos fortes', d.diagnostico.pontosFortes], ['Pontos de atenção', d.diagnostico.pontosAtencao], ['Oportunidades', d.diagnostico.oportunidades]].forEach(function (pair) {
      var col = el('div', 'diag-col');
      col.appendChild(el('h4', null, pair[0]));
      var ul = document.createElement('ul');
      pair[1].forEach(function (o) { var li = document.createElement('li'); li.textContent = o; ul.appendChild(li); });
      col.appendChild(ul);
      diagCols.appendChild(col);
    });

    var prioridadesEl = document.getElementById('blocoPrioridades');
    prioridadesEl.innerHTML = '';
    [['alta', 'Alta prioridade', d.prioridades.alta], ['media', 'Média prioridade', d.prioridades.media], ['baixa', 'Baixa prioridade', d.prioridades.baixa]].forEach(function (triple) {
      var col = el('div', 'prioridade-col ' + triple[0]);
      col.appendChild(el('div', 'prioridade-label', triple[1]));
      var ul = document.createElement('ul');
      triple[2].forEach(function (o) { var li = document.createElement('li'); li.textContent = o; ul.appendChild(li); });
      col.appendChild(ul);
      prioridadesEl.appendChild(col);
    });

    var pendEl = document.getElementById('blocoPendencias');
    pendEl.innerHTML = '';
    d.pendencias.forEach(function (p) { var li = document.createElement('li'); li.textContent = p; pendEl.appendChild(li); });

    var passosEl = document.getElementById('blocoProximosPassos');
    passosEl.innerHTML = '';
    d.proximosPassos.forEach(function (p) { var li = document.createElement('li'); li.textContent = p; passosEl.appendChild(li); });

    var internoContent = document.getElementById('blocoInternoContent');
    internoContent.innerHTML = '';
    [['Gaps de informação', d.interno.gaps], ['Perguntas para a R2', d.interno.perguntasR2], ['Riscos / oportunidades comerciais', d.interno.riscosOportunidadesComerciais]].forEach(function (pair) {
      var col = el('div', 'diag-col');
      col.appendChild(el('h4', null, pair[0]));
      var ul = document.createElement('ul');
      pair[1].forEach(function (o) { var li = document.createElement('li'); li.textContent = o; ul.appendChild(li); });
      col.appendChild(ul);
      internoContent.appendChild(col);
    });

    renderHeader();
  }

  function renderHeader() {
    var nome = state.nomeCliente || 'Cliente';
    var titleName = document.getElementById('resultTitleName');
    var titleSub = document.getElementById('resultTitleSub');
    var meta = document.getElementById('resultMeta');
    var internoBlock = document.getElementById('blocoInterno');

    if (state.mode === 'cliente') {
      titleName.textContent = 'Diagnóstico Financeiro | ' + nome;
      titleSub.textContent = 'Uma visão integrada do seu momento financeiro, patrimônio e objetivos.';
      internoBlock.hidden = true;
    } else {
      titleName.textContent = 'Diagnóstico Financeiro — ' + nome;
      titleSub.textContent = 'Visão técnica para o planejador, com gaps, riscos e direcionamentos comerciais.';
      internoBlock.hidden = false;
    }

    var metaParts = [];
    if (state.nomePlanejador) metaParts.push('<strong>Planejador:</strong> ' + state.nomePlanejador);
    if (state.dataReuniao) metaParts.push('<strong>Reunião:</strong> ' + formatDate(state.dataReuniao));
    metaParts.push('<strong>Tipo:</strong> ' + (state.tipo === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'));
    meta.innerHTML = metaParts.map(function (p) { return '<span>' + p + '</span>'; }).join('');
  }

  function formatDate(iso) {
    var parts = iso.split('-');
    if (parts.length !== 3) return iso;
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  function setMode(mode) {
    state.mode = mode;
    document.getElementById('btnModoInterno').classList.toggle('active', mode === 'interno');
    document.getElementById('btnModoInterno').setAttribute('aria-selected', mode === 'interno');
    document.getElementById('btnModoCliente').classList.toggle('active', mode === 'cliente');
    document.getElementById('btnModoCliente').setAttribute('aria-selected', mode === 'cliente');
    renderHeader();
  }

  document.getElementById('btnModoInterno').addEventListener('click', function () { setMode('interno'); });
  document.getElementById('btnModoCliente').addEventListener('click', function () { setMode('cliente'); });
  document.getElementById('btnGerarVersaoCliente').addEventListener('click', function () { setMode('cliente'); });

  document.getElementById('btnEditar').addEventListener('click', function () { goToStep(1); });

  document.getElementById('btnExportarPdf').addEventListener('click', function () { window.print(); });
})();
