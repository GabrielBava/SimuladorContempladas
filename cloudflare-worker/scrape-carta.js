// Cloudflare Worker: busca uma página de carta contemplada em contemplei.app
// no servidor e devolve os dados extraídos do bloco JSON-LD da página
// (<script type="application/ld+json" data-testid="carta-jsonld">), evitando
// o bloqueio de CORS que impede o navegador de ler o HTML de outro domínio
// diretamente.
//
// Deploy (gratuito, ~2 minutos, sem cartão):
//   1. workers.cloudflare.com -> criar conta -> "Create Worker"
//   2. Cole o conteúdo deste arquivo no editor e clique em "Deploy"
//   3. Copie a URL gerada (ex: https://scrape-carta.SEU-SUBDOMINIO.workers.dev)
//   4. Cole essa URL na constante SCRAPE_ENDPOINT em script.js

const ALLOWED_HOSTNAME = 'contemplei.app';

export default {
  async fetch(request) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const requestUrl = new URL(request.url);
    const targetUrl = requestUrl.searchParams.get('url');

    if (!targetUrl) {
      return jsonResponse({ error: 'Parâmetro "url" é obrigatório.' }, 400, corsHeaders);
    }

    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (e) {
      return jsonResponse({ error: 'Link inválido.' }, 400, corsHeaders);
    }

    if (parsed.hostname !== ALLOWED_HOSTNAME && !parsed.hostname.endsWith('.' + ALLOWED_HOSTNAME)) {
      return jsonResponse({ error: 'Somente links de ' + ALLOWED_HOSTNAME + ' são suportados.' }, 400, corsHeaders);
    }

    let pageResponse;
    try {
      pageResponse = await fetch(parsed.toString(), {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ContempleiSimuladorBot/1.0)' },
      });
    } catch (e) {
      return jsonResponse({ error: 'Não foi possível acessar esse link.' }, 502, corsHeaders);
    }

    if (!pageResponse.ok) {
      return jsonResponse({ error: 'A página retornou erro (' + pageResponse.status + ').' }, 502, corsHeaders);
    }

    const html = await pageResponse.text();
    const match = html.match(/<script type="application\/ld\+json" data-testid="carta-jsonld">([\s\S]*?)<\/script>/);

    if (!match) {
      return jsonResponse({ error: 'Não foi possível encontrar os dados da carta nessa página.' }, 422, corsHeaders);
    }

    let jsonLd;
    try {
      jsonLd = JSON.parse(match[1]);
    } catch (e) {
      return jsonResponse({ error: 'Dados da carta em formato inesperado.' }, 422, corsHeaders);
    }

    const graph = jsonLd['@graph'] || [];
    const product = graph.find((node) => node['@type'] === 'Product');

    if (!product) {
      return jsonResponse({ error: 'Não foi possível encontrar os dados da carta nessa página.' }, 422, corsHeaders);
    }

    const props = {};
    (product.additionalProperty || []).forEach((p) => { props[p.name] = p.value; });

    const credito = parseCurrencyBRL(props['Crédito']);
    const parcela = parseCurrencyBRL(props['Parcela mensal']);
    const prazoMeses = parseIntFromString(props['Prazo restante']);
    const saldoDevedor = parseCurrencyBRL(props['Saldo devedor']);
    const entrada = (product.offers && typeof product.offers.price === 'number')
      ? product.offers.price
      : parseCurrencyBRL(props['Entrada']);

    const administradora = props['Administradora'] || (product.brand && product.brand.name) || null;
    const segmento = mapSegmento(props['Segmento']);

    return jsonResponse({
      credito,
      entrada,
      parcela,
      prazoMeses,
      saldoDevedor,
      administradora,
      segmento,
    }, 200, corsHeaders);
  },
};

function parseCurrencyBRL(str) {
  if (!str) return null;
  const cleaned = str.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
}

function parseIntFromString(str) {
  if (!str) return null;
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function mapSegmento(str) {
  if (!str) return null;
  const normalized = str.toLowerCase();
  if (normalized.indexOf('imóv') === 0 || normalized.indexOf('imov') === 0) return 'IMOVEL';
  if (normalized.indexOf('veíc') === 0 || normalized.indexOf('veic') === 0) return 'VEICULO';
  if (normalized.indexOf('serv') === 0) return 'SERVICO';
  return null;
}

function jsonResponse(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}
