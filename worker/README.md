# avel-diagnostico-worker

Backend serverless (Cloudflare Worker) que recebe a transcrição/dados coletados
do front-end (`avel/diagnostico.html`) e chama a API da Claude (`claude-opus-5`)
para gerar o Diagnóstico Financeiro Inteligente com saída estruturada (JSON),
mantendo a `ANTHROPIC_API_KEY` fora do navegador.

## Por que isso existe

O front-end em `avel/` é um site estático (GitHub Pages). Chamar a API da
Claude diretamente do navegador exigiria embutir a API key no JavaScript
público — qualquer visitante poderia extraí-la. Este Worker resolve isso:
a chave fica guardada como *secret* no Cloudflare, nunca chega ao cliente.

## Deploy (uma vez)

```bash
cd worker
npm install
npx wrangler login                    # autentica com sua conta Cloudflare
npx wrangler secret put ANTHROPIC_API_KEY   # cole sua API key da Anthropic quando solicitado
npm run deploy
```

Ao final do deploy, o Wrangler imprime a URL do Worker
(algo como `https://avel-diagnostico-worker.<seu-subdominio>.workers.dev`).

## Conectar ao front-end

Abra `avel/script.js` e defina a constante `API_ENDPOINT` no topo do arquivo
com a URL impressa acima, por exemplo:

```js
var API_ENDPOINT = 'https://avel-diagnostico-worker.<seu-subdominio>.workers.dev';
```

Com `API_ENDPOINT` vazio (padrão), o site continua funcionando em modo
demonstração, com dados de exemplo — não é necessário deployar o Worker
para usar o protótipo.

## Restringir CORS (recomendado antes de ir para produção)

Por padrão `wrangler.toml` permite qualquer origem (`ALLOWED_ORIGIN = "*"`).
Troque para o domínio real onde o site é publicado:

```toml
[vars]
ALLOWED_ORIGIN = "https://seu-dominio.com"
```

## Desenvolvimento local

```bash
cp .dev.vars.example .dev.vars   # e cole sua API key real ali (nunca comitar esse arquivo)
npm run dev
```

## Limitações desta primeira versão

- Só o **texto** da transcrição (colado ou de um arquivo `.txt`) é enviado
  para análise. PDFs/DOCX anexados nos blocos "Essenciais"/"Extras" ainda
  não são extraídos automaticamente — a extração de texto de PDF/DOCX é um
  próximo passo natural (ex.: usando a Files API da Anthropic, que aceita
  PDF diretamente).
- Custo: cada diagnóstico gerado é uma chamada à API da Claude (`claude-opus-5`,
  cobrado por token). Monitore o uso pelo console da Anthropic.
