# Experiments

Coleção de aplicações experimentais. Cada aplicação vive na sua própria pasta em `apps/`, é independente das outras e é publicada como um **Cloudflare Worker** próprio.

## Aplicações

| App | O que é | Pasta |
|---|---|---|
| Chat Cifrado | Chat ponta a ponta entre duas pessoas, com chaves RSA. Mensagens são destruídas ao serem lidas. Inclui o gerador de chaves (Cofre de Chaves) em `/chaves/`. | [`apps/chat-cifrado`](apps/chat-cifrado) |

## Estrutura

```
experiments/
├── apps/
│   └── <nome-do-app>/        # um app = um Worker
│       ├── wrangler.toml     # configuração do Worker (name = URL <name>.<conta>.workers.dev)
│       ├── src/worker.js     # código do servidor (opcional para apps só estáticos)
│       ├── public/           # páginas e arquivos estáticos
│       └── README.md         # o que o app faz e como rodar
└── .github/workflows/
    └── deploy.yml            # publica no Cloudflare os apps alterados
```

## Publicação (Cloudflare Workers)

O workflow `Deploy apps` roda a cada push na `main` que altere algo em `apps/`, e publica **só os apps que mudaram**. Também dá para rodar manualmente em *Actions → Deploy apps → Run workflow* (deixe o campo vazio para publicar todos).

Configuração única, em *Settings → Secrets and variables → Actions* do repositório:

| Secret | Onde conseguir |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → *My Profile → API Tokens → Create Token* → modelo **Edit Cloudflare Workers** |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare → *Workers & Pages* → coluna da direita (**Account ID**) |

Depois do primeiro deploy, o app fica em `https://<name>.<seu-subdominio>.workers.dev`.

## Adicionar um novo app

1. Crie `apps/<nome>/` com um `wrangler.toml` (o `name` precisa ser único na sua conta Cloudflare).
2. Coloque as páginas em `public/` e, se precisar de servidor, o código em `src/worker.js`.
3. Escreva um `README.md` curto e adicione uma linha na tabela acima.
4. Faça push na `main`: o workflow publica só esse app.

## Rodar localmente

```bash
cd apps/<nome>
npx wrangler@4 dev
```
