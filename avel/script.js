(function () {
  'use strict';

  // Preencha com a URL do Worker após deployar (veja worker/README.md).
  // Vazio = modo demonstração, com diagnóstico mockado.
  var API_ENDPOINT = '';

  var state = {
    nomeCliente: '',
    nomePlanejador: '',
    dataReuniao: '',
    tipo: 'PF',
    observacoes: '',
    arquivoNome: '',
    transcricao: '',
    docs: {},
    extratoTipico: '',
    mode: 'interno'
  };

  var stepNodes = document.querySelectorAll('#stepper .step-node');
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
    stepNodes.forEach(function (li) {
      var step = Number(li.getAttribute('data-step'));
      li.classList.toggle('active', step === n);
      li.classList.toggle('done', step < n);
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
  var selectExtratoTipico = document.getElementById('selectExtratoTipico');

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
    dropzoneFile.textContent = file.name;
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

  if (selectExtratoTipico) {
    selectExtratoTipico.addEventListener('change', function () {
      state.extratoTipico = selectExtratoTipico.value;
    });
  }

  // Generic handling for the "Essenciais / Extras" document rows
  document.querySelectorAll('.doc-row[data-doc]').forEach(function (row) {
    var key = row.getAttribute('data-doc');
    var input = row.querySelector('input[type="file"]');
    var badge = row.querySelector('.doc-file-badge');
    var btn = row.querySelector('.doc-attach-btn');

    function setDocFile(file) {
      if (!file) return;
      state.docs[key] = file.name;
      badge.textContent = file.name;
      badge.hidden = false;
      row.classList.add('attached');
    }

    btn.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      if (input.files && input.files[0]) setDocFile(input.files[0]);
    });

    ['dragenter', 'dragover'].forEach(function (evt) {
      row.addEventListener(evt, function (e) { e.preventDefault(); row.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(function (evt) {
      row.addEventListener(evt, function (e) { e.preventDefault(); row.classList.remove('dragover'); });
    });
    row.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) setDocFile(e.dataTransfer.files[0]);
    });
  });

  document.getElementById('btnStep2Voltar').addEventListener('click', function () { goToStep(1); });

  var processingTimers = [];

  document.getElementById('btnGerarDiagnostico').addEventListener('click', function () {
    state.transcricao = inputTranscricao.value.trim();

    if (!state.arquivoNome && !state.transcricao) {
      showUploadError('Anexe a transcrição da reunião (arquivo ou texto colado) antes de gerar o diagnóstico — ela é essencial para a base do diagnóstico.');
      return;
    }
    hideUploadError();
    goToStep(3);
    runProcessingAnimation();
  });

  function readFileAsText(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(new Error('Não foi possível ler o arquivo.')); };
      reader.readAsText(file);
    });
  }

  function resolveTranscricaoTexto() {
    if (state.transcricao) return Promise.resolve(state.transcricao);
    var file = fileInput.files && fileInput.files[0];
    if (file && /\.(txt|vtt|srt)$/i.test(file.name)) return readFileAsText(file);
    return Promise.resolve('');
  }

  function callDiagnosticoAPI(texto) {
    return fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identificacao: {
          nomeCliente: state.nomeCliente,
          nomePlanejador: state.nomePlanejador,
          dataReuniao: state.dataReuniao,
          tipo: state.tipo,
          observacoes: state.observacoes
        },
        transcricao: texto,
        documentosPresentes: Object.keys(state.docs).map(function (k) { return state.docs[k]; })
      })
    }).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (err) {
          throw new Error(err.error || ('Erro HTTP ' + res.status));
        });
      }
      return res.json();
    });
  }

  function showApiWarning(message) {
    var box = document.getElementById('apiWarning');
    box.textContent = message;
    box.style.display = '';
  }

  function hideApiWarning() {
    document.getElementById('apiWarning').style.display = 'none';
  }

  function runProcessingAnimation() {
    var flowItems = document.querySelectorAll('#processingFlow .pnode');
    flowItems.forEach(function (li) { li.classList.remove('active', 'done'); });
    processingTimers.forEach(function (t) { clearTimeout(t); });
    processingTimers = [];

    flowItems.forEach(function (li, i) {
      var t = setTimeout(function () {
        flowItems.forEach(function (other, j) {
          if (j < i) other.classList.add('done');
          other.classList.toggle('active', j === i);
        });
      }, i * 380);
      processingTimers.push(t);
    });

    var minDelay = new Promise(function (resolve) {
      var t = setTimeout(resolve, flowItems.length * 380 + 450);
      processingTimers.push(t);
    });

    var apiWarningMessage = null;
    var dataPromise;

    if (API_ENDPOINT) {
      dataPromise = resolveTranscricaoTexto().then(function (texto) {
        if (!texto) {
          throw new Error('Não foi possível ler o texto automaticamente (nesta versão, apenas .txt/.vtt/.srt ou texto colado são enviados à IA). Exibindo diagnóstico de demonstração.');
        }
        return callDiagnosticoAPI(texto);
      }).catch(function (err) {
        apiWarningMessage = (err && err.message) || 'Não foi possível conectar à IA. Exibindo diagnóstico de demonstração.';
        return buildMockDiagnostico(state);
      });
    } else {
      dataPromise = Promise.resolve(buildMockDiagnostico(state));
    }

    Promise.all([minDelay, dataPromise]).then(function (results) {
      flowItems.forEach(function (li) { li.classList.remove('active'); li.classList.add('done'); });
      renderDiagnostico(results[1]);
      if (apiWarningMessage) showApiWarning(apiWarningMessage); else hideApiWarning();
      goToStep(4);
    });
  }

  // ---------- Step 4: Resultado ----------

  function buildMockDiagnostico(s) {
    var nome = s.nomeCliente || (s.tipo === 'PJ' ? 'a empresa' : 'o cliente');
    var pronome = s.tipo === 'PJ' ? 'A empresa' : (s.nomeCliente || 'O cliente');
    var temExtratos = !!(s.docs.extrato || s.docs.cartao || s.docs.ir || s.docs.financiamento);

    var renda = 28000;
    var despesas = 16500;
    var sobra = renda - despesas;

    var composicao = [
      { label: 'Imóveis', value: 1200000, color: 'var(--accent)' },
      { label: 'Investimentos', value: 340000, color: 'var(--info)' },
      { label: 'Empresas / participações', value: 0, color: 'var(--text-mute)' }
    ].filter(function (c) { return c.value > 0; });

    return {
      resumoExecutivo: pronome + ' é ' + (s.tipo === 'PJ' ? 'uma empresa em fase de consolidação' : 'profissional com renda ativa consistente') +
        ', atualmente com patrimônio líquido estimado em torno de R$ 1.478.000,00 e capacidade de poupança acima da média (~41% da renda). ' +
        'Seus objetivos declarados combinam curto prazo (reserva de emergência, organização de dívidas) com metas estruturais de médio e longo prazo (aquisição patrimonial, independência financeira, sucessão). ' +
        'No comportamento demonstrado na reunião, ' + (s.nomeCliente || 'o cliente') + ' apresenta perfil analítico e decisório, buscando entender a lógica por trás das recomendações antes de agir — o que sugere maior aderência a um plano bem fundamentado do que a indicações genéricas.',

      perfilCliente: (s.tipo === 'PJ'
        ? 'Pessoa jurídica com estrutura societária ainda não detalhada na reunião. '
        : 'Pessoa física, casado(a), com dependentes mencionados de forma indireta na conversa. ') +
        'Atua profissionalmente com renda variável e demonstra familiaridade intermediária com produtos financeiros. ' +
        (s.observacoes ? 'Observações do planejador: ' + s.observacoes : 'Nenhuma observação adicional registrada pelo planejador.'),

      diagnosticoInicial: [
        {
          topico: 'Reserva de Emergência',
          diagnostico: 'Não há reserva de emergência formalizada. Os recursos de curto prazo estão distribuídos entre conta corrente e investimentos de médio prazo, sem um colchão dedicado e líquido.',
          motivo: 'O tema surgiu diretamente na fala do cliente ao mencionar desconforto em "mexer nos investimentos" em uma eventual necessidade — um risco de liquidez relevante diante do padrão de despesas atual.'
        },
        {
          topico: 'Concentração Patrimonial',
          diagnostico: 'Mais de 80% do patrimônio está concentrado em imóveis, com baixa liquidez proporcional em relação ao patrimônio total.',
          motivo: 'Identificado pela composição patrimonial relatada na reunião e reforçado pelo comentário do cliente sobre dificuldade em "acessar capital rapidamente" caso necessário.'
        },
        {
          topico: 'Endividamento com Taxas Não Otimizadas',
          diagnostico: 'Existem dívidas em aberto cujas condições (taxa e prazo) não foram renegociadas nos últimos anos, gerando custo financeiro acima do necessário.',
          motivo: 'O cliente citou o valor aproximado da dívida e demonstrou incerteza sobre as condições contratadas, indicando falta de acompanhamento ativo desse passivo.'
        }
      ],

      areasOtimizacao: [
        {
          topico: 'Disciplina de Poupança Consistente',
          descricao: 'O cliente já mantém uma capacidade de poupança mensal elevada e recorrente. O próximo passo é direcionar esse excedente com um propósito e prazo definidos, em vez de acumulá-lo sem estratégia.',
          motivo: 'Na transcrição, o cliente relatou poupar "uma parte boa" do salário todo mês, mesmo sem um plano formal — evidência direta de disciplina financeira já estabelecida.'
        },
        {
          topico: 'Capacidade de Geração Patrimonial',
          descricao: 'A trajetória de aquisição de imóveis demonstra histórico de decisões patrimoniais bem-sucedidas. Esse mesmo critério de análise pode ser replicado para diversificar em outras classes de ativos.',
          motivo: 'O cliente descreveu com segurança o histórico de compra dos imóveis atuais, incluindo racional de decisão, o que evidencia maturidade para investimentos de maior porte.'
        },
        {
          topico: 'Abertura para Planejamento de Longo Prazo',
          descricao: 'Há disposição clara para pensar em aposentadoria e sucessão, ainda que sem estrutura formal — uma base comportamental favorável para adesão ao acompanhamento contínuo.',
          motivo: 'O cliente iniciou espontaneamente o assunto de aposentadoria durante a reunião, sinalizando que o tema já está no radar antes mesmo da proposta do planejador.'
        }
      ],

      oportunidades: [
        {
          topico: 'Estruturar Reserva de Emergência',
          oportunidade: 'Formalizar um valor-alvo e uma classe de ativo líquida e segura para a reserva, hoje inexistente.',
          comoAtuar: 'Definir junto ao cliente o valor-alvo (meses de despesas), a fonte dos recursos e o veículo de investimento adequado, com acompanhamento até a formação completa da reserva.',
          impacto: 'Reduz o risco de descapitalização forçada de investimentos de médio/longo prazo em uma eventualidade, trazendo mais segurança para o restante do planejamento.'
        },
        {
          topico: 'Revisão e Renegociação de Dívidas',
          oportunidade: 'Reavaliar as condições da dívida em aberto frente a alternativas de crédito mais baratas disponíveis hoje.',
          comoAtuar: 'Levantar as condições contratuais atuais, simular alternativas de portabilidade ou renegociação e acompanhar a execução junto às instituições envolvidas.',
          impacto: 'Redução do custo financeiro mensal, liberando parte do fluxo de caixa para direcionamento aos objetivos declarados pelo cliente.'
        },
        {
          topico: 'Diversificação Patrimonial',
          oportunidade: 'Reduzir a concentração em imóveis ampliando a exposição a ativos financeiros líquidos e diversificados.',
          comoAtuar: 'Estruturar uma política de investimentos alinhada ao perfil e objetivos do cliente, com aportes recorrentes a partir da capacidade de poupança já identificada.',
          impacto: 'Maior liquidez e resiliência do patrimônio total, com potencial de melhor relação risco-retorno no longo prazo.'
        }
      ],

      objetivos: {
        curto: ['Montar reserva de emergência equivalente a 6 meses de despesas', 'Reorganizar dívidas com juros mais altos'],
        medio: ['Planejar aquisição de imóvel ou troca de veículo', 'Aumentar aporte mensal em investimentos'],
        longo: ['Independência financeira / aposentadoria', 'Sucessão patrimonial e planejamento tributário']
      },

      raioX: {
        resumo: [
          { label: 'Renda mensal', value: 'R$ 28.000,00' },
          { label: 'Despesas mensais', value: 'R$ 16.500,00' },
          { label: 'Saldo mensal', value: 'R$ 11.500,00' },
          { label: 'Taxa de poupança', value: '41%' },
          { label: 'Patrimônio bruto', value: 'R$ 1.540.000,00' },
          { label: 'Patrimônio líquido', value: 'R$ 1.478.000,00' },
          { label: 'Endividamento', value: 'R$ 62.000,00' },
          { label: 'Meses de reserva', value: '0 meses' }
        ],
        fluxo: { renda: renda, despesas: despesas, sobra: sobra },
        composicao: composicao,
        liquidez: 'Não há reserva de emergência líquida formalizada — os meses de reserva atuais são efetivamente zero, apesar da alta capacidade de poupança mensal. O endividamento em aberto (R$ 62.000,00) representa cerca de 4% do patrimônio bruto, um nível controlável, mas com custo financeiro que pode ser otimizado via renegociação.',
        investimentos: 'Os investimentos atuais (R$ 340.000,00) representam aproximadamente 22% do patrimônio total, concentrados majoritariamente em produtos de médio prazo. Não há evidência de diversificação estruturada entre classes de ativos, e a liquidez dos investimentos declarados não foi detalhada na reunião — recomenda-se levantamento mais aprofundado.',
        positivos: ['Alta capacidade de poupança mensal (41% da renda)', 'Patrimônio líquido consolidado e histórico de geração patrimonial', 'Endividamento controlado em relação ao patrimônio total'],
        atencao: ['Ausência total de reserva de emergência líquida', 'Concentração patrimonial elevada em imóveis (baixa liquidez)', temExtratos ? 'Fluxo de caixa detalhado pendente de confirmação nos extratos anexados' : 'Extratos bancários e de cartão não anexados — leitura de fluxo de caixa ainda incompleta'],
        conclusao: 'O cenário financeiro atual é sólido em geração de renda e patrimônio, mas desprotegido em liquidez de curto prazo. A prioridade imediata é a formação de reserva; na sequência, revisão de dívidas e diversificação patrimonial merecem aprofundamento com os documentos extras ainda pendentes.'
      },

      pendencias: [
        'Extrato consolidado de investimentos dos últimos 12 meses',
        'Detalhamento de dívidas (taxas, prazos e instituições)',
        'Composição familiar completa (dependentes)',
        s.tipo === 'PJ' ? 'Balanço patrimonial da empresa' : 'Declaração de Imposto de Renda mais recente',
        s.extratoTipico === 'nao' ? 'Novo extrato bancário representativo (período informado como atípico)' : null
      ].filter(Boolean),

      proximosPassos: [
        'Enviar checklist de documentos extras pendentes para ' + nome,
        'Agendar R2 para aprofundar objetivos de médio e longo prazo',
        'Apresentar proposta inicial de reorganização de dívidas',
        'Estruturar plano de investimentos alinhado ao perfil de risco'
      ],

      prioridadesAtuacao: [
        {
          nome: 'Reserva de Emergência',
          severidade: 'critica',
          diagnostico: 'Inexistência de reserva líquida apesar de alta capacidade de poupança mensal.',
          porque: 'Maior risco de curto prazo identificado — qualquer imprevisto forçaria a liquidação de ativos de médio/longo prazo ou uso de crédito caro.',
          impacto: 'Sem reserva, o cliente pode comprometer investimentos de longo prazo ou recorrer a dívida cara diante de um imprevisto, atrasando os demais objetivos.',
          papel: 'Estruturar valor-alvo, prazo e veículo de investimento da reserva, com acompanhamento mensal até a formação completa.'
        },
        {
          nome: 'Endividamento com Taxas Não Otimizadas',
          severidade: 'alta',
          diagnostico: 'Dívida em aberto (~R$ 62.000,00) sem renegociação recente das condições contratadas.',
          porque: 'Custo financeiro evitável reduzindo diretamente a capacidade de poupança e a velocidade de formação de patrimônio.',
          impacto: 'Manter a condição atual significa pagar mais caro do que o necessário todos os meses, com efeito cumulativo relevante no médio prazo.',
          papel: 'Levantar contrato vigente, simular alternativas de portabilidade/renegociação e acompanhar a execução.'
        },
        {
          nome: 'Concentração Patrimonial em Imóveis',
          severidade: 'moderada',
          diagnostico: 'Mais de 80% do patrimônio líquido concentrado em ativos ilíquidos.',
          porque: 'Reduz a flexibilidade do cliente para aproveitar oportunidades ou reagir a imprevistos sem comprometer o patrimônio principal.',
          impacto: 'Baixa liquidez pode limitar decisões futuras (sucessão, novos aportes, mudanças de planos) e concentra o risco em uma única classe de ativo.',
          papel: 'Desenhar política de diversificação gradual, direcionando parte da capacidade de poupança para ativos financeiros líquidos.'
        }
      ],

      leituraEstrategica: 'A reserva de emergência é o tema com maior potencial de demonstrar valor imediato ao cliente — é urgente, concreto e fácil de mensurar. O endividamento reforça o racional financeiro do plano com ganho tangível de curto prazo, enquanto a diversificação patrimonial sustenta a conversa de longo prazo e a continuidade do relacionamento após o fechamento.',

      dores: {
        principais: ['Ausência de controle sobre a real liquidez disponível em uma emergência', 'Incerteza sobre as condições atuais da dívida em aberto', 'Sensação de patrimônio "preso" em imóveis'],
        preocupacoes: ['Medo de precisar liquidar investimentos de forma desorganizada em um imprevisto', 'Insegurança sobre estar pagando juros acima do necessário', 'Receio de não estar avançando o suficiente rumo à aposentadoria'],
        desejos: ['Ter clareza e organização sobre a situação financeira completa', 'Fazer o patrimônio "trabalhar melhor" do que hoje', 'Construir um caminho estruturado até a independência financeira'],
        gatilhos: ['Mencionou explicitamente querer "dormir tranquilo" quanto a imprevistos financeiros', 'Comentou sobre uma situação recente em que precisou recorrer a crédito por falta de reserva', 'Demonstrou interesse em revisar a dívida ao ouvir sobre taxas de mercado atuais'],
        objecoes: ['Pode alegar já ter "algum controle" via planilha própria', 'Possível necessidade de alinhar a decisão com o cônjuge antes de avançar', 'Baixa urgência percebida por não ter enfrentado ainda um imprevisto real'],
        argumentos: ['O plano parte exatamente do que preocupa o cliente: falta de liquidez e dívida não otimizada — não é um discurso genérico', 'Já existe disciplina de poupança comprovada; falta apenas direção e estrutura, que é o papel do planejamento', 'O ganho da renegociação de dívida é tangível e mensurável em poucos meses, reforçando o valor do acompanhamento'],
        abordagem: 'Cliente analítico e decisório: conduzir o fechamento mostrando primeiro os números concretos (custo da dívida, ausência de reserva) e conectando cada um diretamente às falas do próprio cliente na reunião, antes de apresentar a proposta de acompanhamento.'
      },

      interno: {
        gaps: ['Perfil de risco não coletado formalmente', 'Sucessão/testamento não mencionado', 'Proteção (seguros) não abordada na reunião'],
        perguntasR2: ['Qual a tolerância real a risco em cenários de queda?', 'Há intenção de aquisição de novos imóveis nos próximos 24 meses?', 'Existe patrimônio ou dívida não mencionada na reunião?'],
        riscosOportunidadesComerciais: ['Oportunidade de consolidar todos os investimentos sob assessoria única', 'Risco de perda de mandato caso reserva de emergência não seja endereçada rapidamente', 'Espaço para oferta de seguro de vida/patrimonial']
      },

      contextoAnalitico: {
        grupo: 'Grupo C — Investidor Desconexo/Poupador',
        classificacaoRacional: 'Alta capacidade de geração e concentração patrimonial relevante (risco/acumulação), combinadas com ausência de reserva líquida e nenhuma estrutura formal de proteção — desalinhamento entre apetite de risco assumido e segurança de curto prazo.',
        inferencias: [
          'O cliente parece priorizar acumulação patrimonial em detrimento da segurança de curto prazo por não perceber, na prática, o risco de liquidez embutido no seu padrão de despesas atual.',
          'A ausência de reserva formal sugere que a poupança mensal vem sendo tratada como um fim em si (guardar/investir), sem uma lógica explícita de "para quê" cada parte do dinheiro serve.'
        ],
        conclusoes: 'O cliente precisa de uma reorganização da carteira por caixinhas de objetivos (P1 a P4), com redirecionamento inicial de parte da capacidade de poupança e de eventuais valores extraordinários (bônus, 13º) para fechar a reserva antes de acelerar aportes em ativos de menor liquidez.',
        caixinhasObjetivos: [
          { prioridade: 'P1', nome: 'Liquidez Imediata', objetivo: 'Fechar a reserva de emergência (hoje inexistente) até atingir ao menos 6 meses de despesas em ativo líquido.' },
          { prioridade: 'P2', nome: 'Objetivos de Curto/Médio Prazo', objetivo: 'Reorganizar/renegociar a dívida em aberto e planejar a próxima aquisição relevante (imóvel ou veículo).' },
          { prioridade: 'P3', nome: 'Construção Patrimonial', objetivo: 'Diversificar os investimentos atuais, hoje concentrados, com aportes recorrentes estruturados.' },
          { prioridade: 'P4', nome: 'Legado / Sucessão', objetivo: 'Iniciar planejamento sucessório básico, ainda não abordado pelo cliente.' }
        ],
        dadosFaltantesAnalise: ['Perfil de risco formal (questionário de suitability)', 'Detalhamento de prazos e liquidez dos investimentos atuais', 'Intenção declarada de horizonte para a independência financeira'],
        pontosValidacao: ['Confirmar com o cliente o nível de aceitação para pausar temporariamente novos aportes de risco até a reserva estar completa', 'Validar se o valor de dívida mencionado é o saldo total ou apenas a parcela mensal']
      }
    };
  }

  function el(tag, className, html) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function ulFrom(items) {
    var ul = document.createElement('ul');
    items.forEach(function (o) { var li = document.createElement('li'); li.textContent = o; ul.appendChild(li); });
    return ul;
  }

  function fillListEl(listEl, items) {
    listEl.innerHTML = '';
    items.forEach(function (o) {
      var li = document.createElement('li');
      var isCheck = listEl.classList.contains('check-list');
      var isX = listEl.classList.contains('x-list');
      var ico = el('span', 'ico', isCheck ? '✓' : (isX ? '!' : '•'));
      var txt = document.createElement('span');
      txt.textContent = o;
      li.appendChild(ico);
      li.appendChild(txt);
      listEl.appendChild(li);
    });
  }

  function diagCol(title, items, listClass) {
    var col = el('div', 'diag-col');
    col.appendChild(el('h4', null, title));
    var list = document.createElement('ul');
    list.className = listClass;
    fillListEl(list, items);
    col.appendChild(list);
    return col;
  }

  function pointCard(numLabel, title, fields) {
    var card = el('div', 'point-card');
    var head = el('div', 'point-num');
    head.appendChild(el('span', 'n', numLabel));
    head.appendChild(el('span', 't', title));
    card.appendChild(head);
    fields.forEach(function (f) {
      var field = el('div', 'point-field');
      field.appendChild(el('div', 'k', f[0]));
      field.appendChild(el('div', 'v', f[1]));
      card.appendChild(field);
    });
    return card;
  }

  function renderPointList(containerEl, items, fieldDefs) {
    containerEl.innerHTML = '';
    items.forEach(function (item, i) {
      var num = String(i + 1).padStart(2, '0');
      var fields = fieldDefs.map(function (fd) { return [fd[0], item[fd[1]]]; });
      containerEl.appendChild(pointCard(num, item.topico, fields));
    });
  }

  function formatBRL(n) {
    return (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function renderFlowChart(containerEl, fluxo) {
    containerEl.innerHTML = '';
    var total = fluxo.renda || 1;
    var pctDespesas = Math.max(0, Math.min(100, (fluxo.despesas / total) * 100));
    var pctSobra = Math.max(0, 100 - pctDespesas);

    var track = el('div', 'flow-bar-track');
    var segDespesas = el('div', 'flow-bar-seg despesas', pctDespesas > 12 ? (pctDespesas.toFixed(0) + '%') : '');
    segDespesas.style.width = pctDespesas + '%';
    var segSobra = el('div', 'flow-bar-seg sobra', pctSobra > 12 ? (pctSobra.toFixed(0) + '%') : '');
    segSobra.style.width = pctSobra + '%';
    track.appendChild(segDespesas);
    track.appendChild(segSobra);
    containerEl.appendChild(track);

    var legend = el('div', 'flow-legend');
    legend.innerHTML =
      '<span class="item"><span class="swatch despesas"></span>Despesas — ' + formatBRL(fluxo.despesas) + '</span>' +
      '<span class="item"><span class="swatch sobra"></span>Sobra mensal — ' + formatBRL(fluxo.sobra) + '</span>' +
      '<span class="item">Renda total — ' + formatBRL(fluxo.renda) + '</span>';
    containerEl.appendChild(legend);
  }

  var DONUT_COLORS = ['#1DC077', '#0A84FF', '#FFD60A', 'rgba(235,235,245,0.38)'];

  function renderDonutChart(containerEl, composicao) {
    containerEl.innerHTML = '';
    if (!composicao.length) {
      containerEl.appendChild(el('p', null, 'Sem dados suficientes para compor o gráfico patrimonial.'));
      return;
    }
    var total = composicao.reduce(function (sum, c) { return sum + c.value; }, 0) || 1;
    var r = 52, cx = 60, cy = 60, circumference = 2 * Math.PI * r;
    var offset = 0;

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '120');
    svg.setAttribute('height', '120');
    svg.setAttribute('viewBox', '0 0 120 120');

    var bg = document.createElementNS(svgNS, 'circle');
    bg.setAttribute('cx', cx); bg.setAttribute('cy', cy); bg.setAttribute('r', r);
    bg.setAttribute('fill', 'none');
    bg.setAttribute('stroke', 'rgba(255,255,255,0.06)');
    bg.setAttribute('stroke-width', '16');
    svg.appendChild(bg);

    composicao.forEach(function (c, i) {
      var pct = c.value / total;
      var len = pct * circumference;
      var circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', cx); circle.setAttribute('cy', cy); circle.setAttribute('r', r);
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', DONUT_COLORS[i % DONUT_COLORS.length]);
      circle.setAttribute('stroke-width', '16');
      circle.setAttribute('stroke-dasharray', len + ' ' + (circumference - len));
      circle.setAttribute('stroke-dashoffset', (-offset).toFixed(2));
      circle.setAttribute('transform', 'rotate(-90 ' + cx + ' ' + cy + ')');
      svg.appendChild(circle);
      offset += len;
    });

    containerEl.appendChild(svg);

    var legend = el('div', 'donut-legend');
    composicao.forEach(function (c, i) {
      var pct = ((c.value / total) * 100).toFixed(0);
      var row = el('div', 'item');
      row.innerHTML = '<span class="name"><span class="swatch" style="background:' + DONUT_COLORS[i % DONUT_COLORS.length] + '"></span>' + c.label + ' (' + pct + '%)</span><span class="value">' + formatBRL(c.value) + '</span>';
      legend.appendChild(row);
    });
    containerEl.appendChild(legend);
  }

  function renderPriorityCards(containerEl, items) {
    containerEl.innerHTML = '';
    var labels = { critica: '🔴 Crítica', alta: '🟠 Alta', moderada: '🟡 Moderada' };
    items.forEach(function (item, i) {
      var card = el('div', 'priority-card ' + item.severidade);
      var head = el('div', 'priority-head');
      head.appendChild(el('span', 'title', 'Prioridade #' + (i + 1) + ' — ' + item.nome));
      head.appendChild(el('span', 'severity-badge ' + item.severidade, labels[item.severidade] || item.severidade));
      card.appendChild(head);
      [['Diagnóstico', item.diagnostico], ['Por que é prioridade', item.porque], ['Impacto para o cliente', item.impacto], ['Papel do Planejamento Financeiro', item.papel]].forEach(function (f) {
        var field = el('div', 'point-field');
        field.appendChild(el('div', 'k', f[0]));
        field.appendChild(el('div', 'v', f[1]));
        card.appendChild(field);
      });
      containerEl.appendChild(card);
    });
  }

  function renderDiagnostico(d) {
    document.getElementById('blocoResumoExecutivo').textContent = d.resumoExecutivo;
    document.getElementById('blocoPerfilCliente').textContent = d.perfilCliente;

    renderPointList(document.getElementById('blocoDiagnosticoInicial'), d.diagnosticoInicial, [['Diagnóstico', 'diagnostico'], ['Motivo da escolha', 'motivo']]);
    renderPointList(document.getElementById('blocoAreasOtimizacao'), d.areasOtimizacao, [['Descrição', 'descricao'], ['Motivo da escolha', 'motivo']]);
    renderPointList(document.getElementById('blocoOportunidades'), d.oportunidades, [['Oportunidade identificada', 'oportunidade'], ['Como podemos atuar juntos', 'comoAtuar'], ['Impacto esperado', 'impacto']]);

    var objetivosEl = document.getElementById('blocoObjetivos');
    objetivosEl.innerHTML = '';
    [['Curto prazo', d.objetivos.curto], ['Médio prazo', d.objetivos.medio], ['Longo prazo', d.objetivos.longo]].forEach(function (pair) {
      var item = el('div', 'objetivo-card');
      item.appendChild(el('span', 'tag accent', pair[0]));
      item.appendChild(ulFrom(pair[1]));
      objetivosEl.appendChild(item);
    });

    var raioXResumoEl = document.getElementById('blocoRaioXResumo');
    raioXResumoEl.innerHTML = '';
    d.raioX.resumo.forEach(function (item) {
      var box = el('div', 'stat-card');
      box.appendChild(el('div', 'stat-label', item.label));
      box.appendChild(el('div', 'stat-value', item.value));
      raioXResumoEl.appendChild(box);
    });

    renderFlowChart(document.getElementById('blocoRaioXFluxo'), d.raioX.fluxo);
    renderDonutChart(document.getElementById('blocoRaioXComposicao'), d.raioX.composicao);

    document.getElementById('blocoRaioXLiquidez').textContent = d.raioX.liquidez;
    document.getElementById('blocoRaioXInvestimentos').textContent = d.raioX.investimentos;
    fillListEl(document.getElementById('blocoRaioXPositivos'), d.raioX.positivos);
    fillListEl(document.getElementById('blocoRaioXAtencao'), d.raioX.atencao);
    document.getElementById('blocoRaioXConclusao').textContent = d.raioX.conclusao;

    var pendEl = document.getElementById('blocoPendencias');
    pendEl.innerHTML = '';
    d.pendencias.forEach(function (p) { var li = document.createElement('li'); li.textContent = p; pendEl.appendChild(li); });

    var passosEl = document.getElementById('blocoProximosPassos');
    passosEl.innerHTML = '';
    passosEl.style.gridTemplateColumns = 'repeat(' + d.proximosPassos.length + ', 1fr)';
    d.proximosPassos.forEach(function (p) {
      var node = el('li', 'ns-node');
      node.appendChild(el('span', 'dot'));
      node.appendChild(el('span', 'txt', p));
      passosEl.appendChild(node);
    });

    renderPriorityCards(document.getElementById('blocoPrioridadesAtuacao'), d.prioridadesAtuacao);
    document.getElementById('blocoLeituraEstrategica').textContent = d.leituraEstrategica;

    fillListEl(document.getElementById('blocoDores'), d.dores.principais);
    fillListEl(document.getElementById('blocoPreocupacoes'), d.dores.preocupacoes);
    fillListEl(document.getElementById('blocoDesejos'), d.dores.desejos);
    fillListEl(document.getElementById('blocoGatilhos'), d.dores.gatilhos);
    fillListEl(document.getElementById('blocoObjecoes'), d.dores.objecoes);
    fillListEl(document.getElementById('blocoArgumentos'), d.dores.argumentos);
    document.getElementById('blocoAbordagem').textContent = d.dores.abordagem;

    var internoContent = document.getElementById('blocoInternoContent');
    internoContent.innerHTML = '';
    internoContent.appendChild(diagCol('Gaps de informação', d.interno.gaps, 'x-list'));
    internoContent.appendChild(diagCol('Perguntas para a R2', d.interno.perguntasR2, 'bullet-list'));
    internoContent.appendChild(diagCol('Riscos / oportunidades comerciais', d.interno.riscosOportunidadesComerciais, 'check-list'));

    var ctx = d.contextoAnalitico;
    document.getElementById('blocoGrupoBadge').textContent = ctx.grupo;
    document.getElementById('blocoGrupoRacional').textContent = ctx.classificacaoRacional;
    fillListEl(document.getElementById('blocoInferencias'), ctx.inferencias);
    document.getElementById('blocoConclusoes').textContent = ctx.conclusoes;

    var caixinhasEl = document.getElementById('blocoCaixinhas');
    caixinhasEl.innerHTML = '';
    ctx.caixinhasObjetivos.forEach(function (c) {
      var card = el('div', 'caixinha-card');
      card.appendChild(el('div', 'p-label', c.prioridade));
      card.appendChild(el('div', 'p-nome', c.nome));
      card.appendChild(el('div', 'p-objetivo', c.objetivo));
      caixinhasEl.appendChild(card);
    });

    fillListEl(document.getElementById('blocoDadosFaltantesAnalise'), ctx.dadosFaltantesAnalise);

    var validacaoEl = document.getElementById('blocoPontosValidacao');
    validacaoEl.innerHTML = '';
    ctx.pontosValidacao.forEach(function (p) { var li = document.createElement('li'); li.textContent = p; validacaoEl.appendChild(li); });

    renderHeader();
  }

  function renderHeader() {
    var nome = state.nomeCliente || 'Cliente';
    var titleName = document.getElementById('resultTitleName');
    var titleSub = document.getElementById('resultTitleSub');
    var meta = document.getElementById('resultMeta');
    var internoBlocks = document.querySelectorAll('.interno-block');

    if (state.mode === 'cliente') {
      titleName.textContent = 'Diagnóstico Financeiro | ' + nome;
      titleSub.textContent = 'Uma visão integrada do seu momento financeiro, patrimônio e objetivos.';
      internoBlocks.forEach(function (b) { b.hidden = true; });
    } else {
      titleName.textContent = 'Diagnóstico Financeiro — ' + nome;
      titleSub.textContent = 'Visão técnica para o planejador, com prioridades, gatilhos e direcionamentos comerciais.';
      internoBlocks.forEach(function (b) { b.hidden = false; });
    }

    var metaParts = [];
    if (state.nomePlanejador) metaParts.push('<strong>Planejador</strong> ' + state.nomePlanejador);
    if (state.dataReuniao) metaParts.push('<strong>Reunião</strong> ' + formatDate(state.dataReuniao));
    metaParts.push('<strong>Tipo</strong> ' + (state.tipo === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'));
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

  // ---------- Exportar PDF ----------

  var btnExportarPdf = document.getElementById('btnExportarPdf');
  var pdfOriginalLabel = btnExportarPdf.innerHTML;

  btnExportarPdf.addEventListener('click', function () {
    if (typeof html2canvas === 'undefined' || !window.jspdf) {
      window.print();
      return;
    }

    var target = document.getElementById('stepResult');
    btnExportarPdf.disabled = true;
    btnExportarPdf.innerHTML = 'Gerando PDF...';

    html2canvas(target, {
      backgroundColor: '#000000',
      scale: 2,
      useCORS: true,
      ignoreElements: function (el) {
        return el.classList && (el.classList.contains('mode-toggle') || el.classList.contains('result-actions'));
      }
    }).then(function (canvas) {
      var jsPDF = window.jspdf.jsPDF;
      var pageWidth = 210;
      var pageHeight = 297;
      var imgWidth = pageWidth;
      var imgHeight = (canvas.height * imgWidth) / canvas.width;

      var pdf = new jsPDF('p', 'mm', 'a4');
      var heightLeft = imgHeight;
      var position = 0;
      var imgData = canvas.toDataURL('image/jpeg', 0.92);

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      var nomeArquivo = 'Diagnostico-' + (state.nomeCliente ? state.nomeCliente.replace(/[^\w\-]+/g, '-') : 'Cliente') + '-' + (state.mode === 'cliente' ? 'Cliente' : 'Interno') + '.pdf';
      pdf.save(nomeArquivo);
    }).catch(function () {
      window.print();
    }).finally(function () {
      btnExportarPdf.disabled = false;
      btnExportarPdf.innerHTML = pdfOriginalLabel;
    });
  });
})();
