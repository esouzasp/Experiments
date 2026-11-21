# Chat Cifrado

Chat entre duas pessoas com criptografia ponta a ponta. O servidor só guarda mensagens cifradas, e só até o destinatário lê-las: ao decodificar, a mensagem é apagada do servidor e some da tela em 60 s. Não há histórico.

Tudo fica numa página só (`/`): o par de chaves é gerado dentro do chat, em *Configurar → 🔑 Ainda não tem chaves?*

## Como usar

1. Cada pessoa gera seu par de chaves **com senha** e envia a **chave pública** para a outra.
2. Os dois entram na **mesma sala** (escolham um nome difícil de adivinhar) e cada um cola a chave pública do outro.
3. **Enviar:** a cada mensagem você informa sua chave privada e senha, que servem para assinar a mensagem. A mensagem é cifrada só para o contato.
4. **Ler:** a cada mensagem você informa sua chave privada e senha. A mensagem é decodificada, apagada do servidor e some da tela em 60 s.

A chave privada e a senha nunca são salvas nem enviadas ao servidor.

## Criptografia

| Etapa | Algoritmo |
|---|---|
| Conteúdo | AES-256-GCM, chave e IV novos a cada mensagem |
| Chave da mensagem | RSA-OAEP / SHA-256 com a chave pública do destinatário |
| Autoria | Assinatura RSA-PSS / SHA-256 com a chave privada do remetente |
| Senha da chave privada | PBKDF2-SHA256 (310 mil iterações) → AES-256-GCM |

As chaves usam o formato PEM padrão (SPKI / PKCS#8).

## Servidor (`src/worker.js`)

Um **Durable Object por sala** guarda as mensagens pendentes.

| Rota | Faz |
|---|---|
| `GET /api/rooms/:sala/msgs` | Lista as mensagens ainda não lidas (só texto cifrado) |
| `POST /api/rooms/:sala/msgs` | Guarda uma mensagem. Rejeita se a assinatura do remetente não confere. |
| `DELETE /api/rooms/:sala/msgs/:id` | Destrói a mensagem. Exige assinatura feita com a chave privada do **destinatário**. |

Regras: no máximo 200 mensagens pendentes por sala, e as não lidas expiram em 24 h (alarme do Durable Object).

## Limites

- Quem lê sempre pode copiar ou fotografar a tela durante os 60 s.
- Qualquer pessoa que saiba o nome da sala consegue ver que existem mensagens pendentes (só texto cifrado e fingerprints). Não consegue lê-las, apagá-las nem se passar por você.
- Confira o fingerprint da chave do contato por outro canal (uma ligação, por exemplo) antes de confiar nela.

## Rodar localmente

```bash
npx wrangler@4 dev
# abra http://localhost:8787
```
