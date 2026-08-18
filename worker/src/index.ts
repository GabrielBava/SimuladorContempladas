import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

export interface Env {
  ANTHROPIC_API_KEY: string;
  ALLOWED_ORIGIN: string;
}

const PontoSchema = z.object({
  topico: z.string().describe('Título curto e executivo do ponto identificado.'),
  diagnostico: z.string().describe('Descrição breve e objetiva da situação identificada.'),
  motivo: z.string().describe('Por que este tema foi selecionado, com evidência da transcrição.'),
});

const AreaOtimizacaoSchema = z.object({
  topico: z.string().describe('Título curto, positivo e executivo da prática identificada.'),
  descricao: z.string().describe('O que o cliente já faz bem + oportunidade objetiva de potencialização.'),
  motivo: z.string().describe('Evidência concreta da transcrição que justifica a escolha.'),
});

const OportunidadeSchema = z.object({
  topico: z.string().describe('Título curto, executivo e orientado à ação.'),
  oportunidade: z.string().describe('O que possui espaço para evolução e por que é relevante.'),
  comoAtuar: z.string().describe('Como o planejamento financeiro pode apoiar o cliente nesse tema.'),
  impacto: z.string().describe('Benefício esperado para a saúde financeira e objetivos do cliente.'),
});

const PrioridadeSchema = z.object({
  nome: z.string().describe('Nome curto do tema prioritário.'),
  severidade: z.enum(['critica', 'alta', 'moderada']),
  diagnostico: z.string().describe('Situação identificada em 1-2 frases.'),
  porque: z.string().describe('Principal risco, gap ou oportunidade que torna este tema prioritário.'),
  impacto: z.string().describe('O que pode acontecer ou deixar de ser alcançado se o tema não for estruturado.'),
  papel: z.string().describe('Como um planejamento estruturado pode ajudar nesta área.'),
});

const DiagnosticoSchema = z.object({
  resumoExecutivo: z.string().describe(
    'Perfil executivo do lead: quem é, momento financeiro/patrimonial, objetivos e prioridades, perfil comportamental e de tomada de decisão.'
  ),
  perfilCliente: z.string().describe('Contexto familiar, profissional e financeiro do cliente.'),
  diagnosticoInicial: z.array(PontoSchema).length(3).describe(
    'Os 3 pontos financeiros mais relevantes que merecem atenção, priorizados por impacto, urgência, risco e relevância.'
  ),
  areasOtimizacao: z.array(AreaOtimizacaoSchema).max(3).describe(
    'Até 3 pontos que já são conduzidos de forma positiva pelo cliente, com potencial de aperfeiçoamento. Se não houver evidências suficientes, retorne menos itens em vez de inventar.'
  ),
  oportunidades: z.array(OportunidadeSchema).length(3).describe(
    'Os 3 principais pontos de atuação conjunta entre planejador e cliente, ligando Diagnóstico → Ação → Impacto.'
  ),
  objetivos: z.object({
    curto: z.array(z.string()),
    medio: z.array(z.string()),
    longo: z.array(z.string()),
  }),
  raioX: z.object({
    resumo: z.array(z.object({ label: z.string(), value: z.string() })).describe(
      'Indicadores-chave (renda, despesas, saldo mensal, taxa de poupança, patrimônio bruto/líquido, endividamento, meses de reserva) — use "Dados insuficientes" quando não houver base.'
    ),
    fluxo: z.object({ renda: z.number(), despesas: z.number(), sobra: z.number() }),
    composicao: z.array(z.object({ label: z.string(), value: z.number() })).describe('Distribuição do patrimônio por classe de ativo.'),
    liquidez: z.string().describe('Análise da reserva, dívidas e capacidade financeira.'),
    investimentos: z.string().describe('Concentração, diversificação, liquidez e aderência aos objetivos.'),
    positivos: z.array(z.string()).max(3),
    atencao: z.array(z.string()).max(3),
    conclusao: z.string().describe('Síntese curta do cenário financeiro e principais pontos a aprofundar.'),
  }),
  pendencias: z.array(z.string()).describe('Dados que não apareceram na reunião/documentos e precisam ser levantados.'),
  proximosPassos: z.array(z.string()).describe('Direcionamento prático para a R2 / reunião seguinte.'),
  prioridadesAtuacao: z.array(PrioridadeSchema).min(3).max(5).describe('Uso interno do planejador — técnico, direto e estratégico.'),
  leituraEstrategica: z.string().describe('2-3 frases: quais temas têm maior potencial de demonstrar valor ao cliente.'),
  dores: z.object({
    principais: z.array(z.string()).max(3),
    preocupacoes: z.array(z.string()).max(3),
    desejos: z.array(z.string()),
    gatilhos: z.array(z.string()),
    objecoes: z.array(z.string()),
    argumentos: z.array(z.string()).min(2).max(4),
    abordagem: z.string().describe('Como conduzir o fechamento, considerando o perfil e comportamento do cliente.'),
  }),
  interno: z.object({
    gaps: z.array(z.string()).describe('Informações que ficaram em aberto (perfil de risco, sucessão, proteção etc.).'),
    perguntasR2: z.array(z.string()),
    riscosOportunidadesComerciais: z.array(z.string()),
  }),
  // Camada analítica inspirada no processo que a Ável já usa no Gemini
  // (framework de Grupo/caixinhas inferido — ver comentário no SYSTEM_PROMPT).
  contextoAnalitico: z.object({
    grupo: z.string().describe(
      'Classificação comportamental do cliente no formato "Grupo X — Nome do arquétipo" (ex.: "Grupo C — Investidor Desconexo/Poupador").'
    ),
    classificacaoRacional: z.string().describe('Por que o cliente se encaixa nesse grupo, com base em evidências da transcrição.'),
    inferencias: z.array(z.string()).describe(
      'Leituras comportamentais que explicam o "porquê" por trás das escolhas do cliente (ex.: prioriza acumulação por desconhecer o risco de liquidez envolvido) — sempre como hipótese fundamentada, nunca como fato assumido.'
    ),
    conclusoes: z.string().describe('Síntese estrutural: o que o cliente precisa em termos de organização financeira (ex.: reorganização por caixinhas de objetivos, redirecionamento de remuneração variável).'),
    caixinhasObjetivos: z.array(z.object({
      prioridade: z.enum(['P1', 'P2', 'P3', 'P4']),
      nome: z.string().describe('Nome curto da caixinha (ex.: Liquidez Imediata, Objetivos de Curto/Médio Prazo, Construção Patrimonial, Legado/Sucessão).'),
      objetivo: z.string().describe('O que essa caixinha deve conter/resolver para este cliente especificamente.'),
    })).length(4).describe('As 4 caixinhas de objetivos (P1 = mais urgente/líquida a P4 = mais longo prazo), adaptadas ao caso do cliente.'),
    dadosFaltantesAnalise: z.array(z.string()).describe('Lacunas analíticas que limitam a precisão do diagnóstico (diferente de documentos pendentes — são leituras que a IA não conseguiu fechar com segurança).'),
    pontosValidacao: z.array(z.string()).describe('Decisões ou inferências específicas que precisam de confirmação explícita do planejador ou do cliente antes de virarem recomendação.'),
  }),
});

const SYSTEM_PROMPT = `Você atua como Planejador Financeiro sênior da Ável Planejamento, responsável por transformar a transcrição de uma reunião (R1) e os dados coletados do cliente em um diagnóstico financeiro estruturado.

Regra absoluta: não invente informações, valores, comportamentos ou necessidades que não estejam sustentados pela transcrição ou pelos dados fornecidos. Quando uma informação não estiver disponível, declare explicitamente que não há dados suficientes — nunca preencha lacunas com suposições. Não recomende produtos financeiros específicos.

Preencha cada campo do schema seguindo estritamente estas diretrizes:

RESUMO EXECUTIVO: perfil executivo do lead — quem é, momento financeiro/patrimonial atual, principais objetivos e prioridades, perfil comportamental e de tomada de decisão. Deve permitir compreender rapidamente o cenário geral.

DIAGNÓSTICO INICIAL (exatamente 3 pontos): os pontos financeiros mais relevantes que merecem atenção, priorizados por impacto financeiro, urgência, risco e relevância para os objetivos do cliente. Considere: riscos financeiros, problemas que exigem ação imediata, impacto sobre patrimônio e fluxo de caixa, objetivos, proteção pessoal/familiar/patrimonial, endividamento, investimentos, aposentadoria, planejamento tributário/sucessório. Linguagem executiva, clara, consultiva — adequada para apresentar ao próprio cliente. Cada ponto deve estar diretamente conectado ao contexto específico da reunião, nunca genérico.

ÁREAS PARA OTIMIZAÇÃO (até 3 pontos): o que o cliente já conduz bem, mas com potencial de aperfeiçoamento. Valorize primeiro o que já funciona. Não trate como problemas ou falhas. Evite elogios genéricos. Se não houver evidências suficientes para 3 pontos, retorne menos — nunca invente. Mensagem central: "você já construiu uma boa base; o planejamento não começa do zero, potencializa o que já funciona".

OPORTUNIDADES PARA POTENCIAIS (exatamente 3 pontos): transforma o diagnóstico em direcionamento prático de atuação conjunta planejador-cliente. Conecte Diagnóstico → Ação → Impacto. Não prometa rentabilidade ou resultados garantidos. Evite tom comercial excessivo — o valor deve ficar evidente pela qualidade e aplicabilidade das ações.

OBJETIVOS: curto, médio e longo prazo, conforme declarado pelo cliente.

RAIO-X FINANCEIRO: leitura integrada dos dados (ex.: alta renda com baixa poupança, patrimônio elevado com baixa liquidez). Calcule os indicadores possíveis com os dados disponíveis (saldo mensal, taxa de poupança, comprometimento de renda, patrimônio bruto/líquido, endividamento, meses de reserva, concentração patrimonial). Linguagem simples e consultiva. Sem dados suficientes, declare a insuficiência em vez de estimar.

PRIORIDADES DE ATUAÇÃO (uso interno, 3 a 5 temas): severidade crítica/alta/moderada considerando severidade, urgência, impacto financeiro e pessoal, gap identificado, objetivos do cliente e interdependência. Não invente problemas para justificar a contratação. Diferencie risco real de oportunidade de otimização. Sem alarmismo.

DORES, PREOCUPAÇÕES E GATILHOS (uso interno): baseie-se no que o próprio cliente verbalizou ou demonstrou. Recupere, quando possível, palavras ou expressões usadas por ele, sem distorcer o contexto. Não invente dores nem use pressão artificial. Argumentos para o close devem conectar diretamente às dores/preocupações/objetivos identificados, nunca genéricos.

NOTAS INTERNAS (gaps, perguntas para R2, riscos/oportunidades comerciais): técnico e direto, para uso exclusivo do planejador.

CONTEXTO ANALÍTICO (uso interno — camada de raciocínio, inspirada no processo que a Ável já usa em outra ferramenta de IA):
- GRUPO: classifique o cliente no formato "Grupo X — Nome do arquétipo", cruzando duas dimensões — apetite a risco (alto/baixo) e alinhamento/organização financeira (alto/baixo). Como referência de nomenclatura (ajuste o nome do arquétipo ao caso, mas mantenha a lógica das duas dimensões):
  · Grupo A — Investidor Estruturado: risco alto + boa organização (equilibra risco e liquidez).
  · Grupo B — Guardião Conservador: risco baixo + boa organização (prioriza segurança, já estruturado).
  · Grupo C — Investidor Desconexo/Poupador: risco alto + baixa organização (acumula em ativos de risco sem estrutura de liquidez/proteção — ex.: alta exposição a renda variável/cripto com reserva de emergência insuficiente para o custo de vida).
  · Grupo D — Iniciante/Desorganizado: risco baixo ou indefinido + baixa organização (ainda não estruturou poupança nem investimentos).
  Use isso como diretriz de raciocínio, não como categoria rígida — se a transcrição sugerir um perfil que não se encaixa bem, descreva o arquétipo mais fiel à evidência.
- INFERÊNCIAS: hipóteses comportamentais sobre o "porquê" das escolhas do cliente (ex.: prioriza acumulação por desconhecer o risco de liquidez do próprio padrão de gasto). Sempre marcadas como leitura da IA, nunca como fato — e sempre ancoradas em algo dito ou demonstrado na transcrição.
- CONCLUSÕES: síntese de que tipo de organização estrutural o cliente precisa (ex.: reorganizar a carteira por caixinhas de objetivos, redirecionar bônus/remuneração variável).
- CAIXINHAS DE OBJETIVOS (P1 a P4): estrutura de 4 baldes por prioridade/horizonte, adaptada ao cliente. Referência de sentido geral (adapte nomes e conteúdo ao caso, mantendo a ordem de prioridade):
  · P1 — Liquidez Imediata (reserva de emergência / segurança de curtíssimo prazo)
  · P2 — Objetivos de Curto/Médio Prazo (metas específicas em 1-3 anos)
  · P3 — Construção Patrimonial de Longo Prazo (aposentadoria, investimentos estruturados)
  · P4 — Legado/Sucessão (planejamento sucessório e patrimonial de muito longo prazo)
- DADOS FALTANTES (ANÁLISE): lacunas que limitam a precisão do diagnóstico — diferente da lista de documentos pendentes, aqui é sobre o que a leitura analítica não conseguiu fechar com segurança.
- PONTOS EXIGINDO VALIDAÇÃO: inferências ou decisões específicas que precisam de confirmação explícita do planejador/cliente antes de virarem recomendação (ex.: nível de aceitação do cliente para pausar temporariamente aportes em cripto até completar a reserva).

Nota: o framework de Grupos e caixinhas acima é uma referência de raciocínio fornecida pela Ável a partir de um único exemplo — aplique com bom senso e sempre subordinado à evidência real da transcrição, nunca forçando o caso a se encaixar na categoria.

Responda exclusivamente em português do Brasil, com tom executivo, consultivo e profissional em todos os campos.`;

function corsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

interface RequestBody {
  identificacao?: {
    nomeCliente?: string;
    nomePlanejador?: string;
    dataReuniao?: string;
    tipo?: 'PF' | 'PJ';
    observacoes?: string;
  };
  transcricao?: string;
  documentosPresentes?: string[];
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = corsHeaders(env.ALLOWED_ORIGIN || '*');

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    let body: RequestBody;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'JSON inválido' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const transcricao = (body.transcricao || '').trim();
    if (!transcricao) {
      return new Response(JSON.stringify({ error: 'Transcrição da reunião é obrigatória.' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const id = body.identificacao || {};
    const documentos = body.documentosPresentes && body.documentosPresentes.length
      ? body.documentosPresentes.join(', ')
      : 'nenhum documento extra anexado';

    const userPrompt = `## Identificação
Nome do cliente: ${id.nomeCliente || 'não informado'}
Tipo: ${id.tipo === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}
Data da reunião: ${id.dataReuniao || 'não informada'}
Observações do planejador: ${id.observacoes || 'nenhuma'}
Documentos extras anexados: ${documentos}

## Transcrição da reunião (Google Meet) e/ou dados coletados (Intra)
"""
${transcricao}
"""

Gere o diagnóstico financeiro completo conforme o schema e as diretrizes do sistema.`;

    try {
      const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

      const response = await client.beta.messages.parse({
        model: 'claude-opus-5',
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
        output_format: betaZodOutputFormat(DiagnosticoSchema),
      });

      if (!response.parsed_output) {
        return new Response(JSON.stringify({ error: 'Falha ao estruturar a resposta da IA.' }), {
          status: 502,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(response.parsed_output), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    } catch (error: unknown) {
      let status = 502;
      let message = 'Erro ao chamar a API da Claude.';

      if (error instanceof Anthropic.AuthenticationError) {
        status = 500;
        message = 'ANTHROPIC_API_KEY inválida ou não configurada no Worker.';
      } else if (error instanceof Anthropic.RateLimitError) {
        status = 429;
        message = 'Limite de requisições da API da Claude atingido — tente novamente em instantes.';
      } else if (error instanceof Anthropic.BadRequestError) {
        status = 400;
        message = 'Requisição inválida para a API da Claude: ' + error.message;
      } else if (error instanceof Anthropic.APIError) {
        message = `Erro da API da Claude (${error.status}): ${error.message}`;
      }

      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }
  },
};
