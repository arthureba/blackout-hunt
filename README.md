# 🏴 BLACKOUT HUNT

Sistema web gamificado de caça ao tesouro com QR codes. Usuários escaneiam 4 QR codes físicos, registram dados a cada scan e competem em um ranking ao vivo baseado em tempo acumulado.

**Domínio de produção:** [blackouthunt.com.br](https://blackouthunt.com.br)

---

## 📁 Estrutura de Pastas

```
blackout-hunt/
├── README.md
├── schema.sql
├── docker-compose.yml
├── Dockerfile
├── railway.json
├── render.yaml
├── .gitignore
├── frontend/
│   ├── index.html           ← página principal (jogador + ranking + admin)
│   └── qr-generator.html   ← gerador dos 4 QR codes
└── backend/
    ├── package.json
    ├── .env.example
    ├── server.js
    ├── db/
    │   └── index.js
    └── routes/
        ├── scan.js
        ├── ranking.js
        └── admin.js
```

---

## 🐳 Rodar Local com Docker (recomendado)

```bash
# Clone o projeto
git clone <repo-url>
cd blackout-hunt

# Suba tudo com um comando
docker-compose up --build
```

Acesse em: http://localhost:3000  
Painel admin: http://localhost:3000/?admin=1  
Admin secret padrão (dev): `dev-secret-change-me`

---

## 💻 Rodar Local sem Docker

### Pré-requisitos
- Node.js 20+
- PostgreSQL 14+

### Passos

```bash
# 1. Crie o banco
createdb blackout_hunt

# 2. Execute o schema
psql blackout_hunt -f schema.sql

# 3. Configure variáveis de ambiente
cd backend
cp .env.example .env
# edite .env com suas credenciais

# 4. Instale dependências
npm install

# 5. Inicie o servidor
npm run dev
```

Acesse em: http://localhost:3000

---

## 🔌 Referência da API

### `GET /health`
```bash
curl http://localhost:3000/health
# → {"ok":true}
```

### `POST /scan` — Registrar checkpoint
```bash
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -d '{
    "step": 1,
    "name": "João Silva",
    "email": "joao@email.com",
    "phone": "+5511999999999",
    "instagram": "@joaosilva"
  }'
```

**Resposta de sucesso:**
```json
{
  "ok": true,
  "duplicate": false,
  "winnerStatus": null,
  "user": {
    "id": "uuid",
    "name": "João Silva",
    "instagram": "@joaosilva",
    "total_qr": 1,
    "total_time_ms": 12345,
    "total_time_formatted": "00:12.34",
    "progress": { "qr1": true, "qr2": false, "qr3": false, "qr4": false },
    "completedCount": 1,
    "qr_times": { "qr1": "00:12.34", "qr2": null, "qr3": null, "qr4": null }
  },
  "thisStep": { "step": 1, "time_ms": 12345, "time_formatted": "00:12.34" }
}
```

**Erros possíveis:**
- `400` — campos inválidos ou step fora de range
- `403` — QR não está ativo
- `422` — ordem sequencial violada (precisa completar etapa anterior)

### `GET /ranking` — Ranking ao vivo
```bash
curl http://localhost:3000/ranking
```

### `POST /admin/activate` — Ativar QR
```bash
curl -X POST http://localhost:3000/admin/activate \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: dev-secret-change-me" \
  -d '{"step": 1}'
```

### `POST /admin/deactivate` — Desativar QR
```bash
curl -X POST http://localhost:3000/admin/deactivate \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: dev-secret-change-me" \
  -d '{"step": 1}'
```

### `GET /admin/status` — Status dos QRs
```bash
curl http://localhost:3000/admin/status \
  -H "x-admin-secret: dev-secret-change-me"
```

### `POST /admin/reset-winner` — Resetar vencedor
```bash
curl -X POST http://localhost:3000/admin/reset-winner \
  -H "x-admin-secret: dev-secret-change-me"
```

---

## ⚙️ Painel Admin

Acesse `/?admin=1` para abrir o painel admin. Você precisará do `ADMIN_SECRET` configurado no servidor.

**Funcionalidades:**
- Ver status dos 4 QR codes (ativo/inativo + horário de ativação)
- Ativar/desativar cada QR individualmente
- Ver total de participantes e vencedor atual
- Resetar o vencedor para re-runs

---

## 🔳 Gerar QR Codes

Acesse `/qr-generator.html`. A página já vem pré-preenchida com `https://blackouthunt.com.br`.

- Altere o domínio se necessário e clique em **Gerar QRs**
- Cada card exibe o QR e a URL correspondente
- Clique em **Imprimir QR** para imprimir individualmente
- Use `Ctrl+P` / `Cmd+P` para imprimir todos

---

## 🚀 Deploy no Railway

1. Crie uma conta em [railway.app](https://railway.app)
2. Crie um novo projeto e selecione **Deploy from GitHub repo**
3. Adicione um serviço **PostgreSQL** ao projeto
4. Configure as variáveis de ambiente:
   ```
   DATABASE_URL=<gerado automaticamente pelo Railway ao linkar o Postgres>
   ADMIN_SECRET=seu-secret-seguro-aqui
   NODE_ENV=production
   ```
5. O Railway detectará o `Dockerfile` automaticamente via `railway.json`
6. Após o deploy, vá em **Settings → Domains** e adicione `blackouthunt.com.br`

---

## 🚀 Deploy no Render

1. Crie uma conta em [render.com](https://render.com)
2. No dashboard, clique em **New → Blueprint**
3. Aponte para o repositório — o Render lê o `render.yaml` automaticamente
4. Um banco PostgreSQL (plano free) e o serviço web serão criados juntos
5. Após o deploy, vá em **Settings → Custom Domains** e adicione `blackouthunt.com.br`

---

## 🌐 Configurar DNS no Registro.br

### Opção A — Apontar direto para IP (registro A)

No painel do [registro.br](https://registro.br), adicione:
```
Tipo: A
Nome: @  (ou deixe em branco para o domínio raiz)
Valor: <IP fornecido pelo Railway ou Render>
TTL: 3600
```

### Opção B — CNAME (subdomínio www)
```
Tipo: CNAME
Nome: www
Valor: <seu-app>.railway.app  (ou <seu-app>.onrender.com)
TTL: 3600
```

> **Nota:** O Registro.br não permite CNAME no domínio raiz (@). Para apontar `blackouthunt.com.br` sem o `www`, use um registro A ou o recurso de "ALIAS/ANAME" se disponível.

---

## 🔒 HTTPS

Tanto o Railway quanto o Render provisionam certificados **Let's Encrypt automaticamente** após você configurar o domínio customizado. Nenhuma configuração adicional é necessária.

---

## 🎮 Mecânica do Jogo — Resumo

1. Admin ativa QR1 → cronômetro começa para essa etapa
2. Jogador escaneia QR1 → tempo = `agora - ativado_em`
3. Admin ativa QR2 quando quiser → jogador escaneia QR2 (precisa ter feito QR1)
4. Repete para QR3 e QR4
5. Primeiro a escanear QR4 é o **VENCEDOR**
6. Ranking ordena por: mais etapas completas → menor tempo total

---

## 🔧 Variáveis de Ambiente

| Variável | Descrição | Padrão |
|---|---|---|
| `PORT` | Porta do servidor | `3000` |
| `DATABASE_URL` | Connection string do PostgreSQL | — |
| `ADMIN_SECRET` | Senha do painel admin | — |
| `NODE_ENV` | Ambiente (`development`/`production`) | `development` |
