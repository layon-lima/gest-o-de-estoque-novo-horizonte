# Estoque Novo Horizonte

Aplicação particular composta por frontend React/Vite, backend FastAPI e banco PostgreSQL.

## Produção

O frontend é compilado para `dist/` e servido diretamente pelo FastAPI. O domínio público existente encaminha para o backend em `127.0.0.1:8000` por meio do Cloudflare Tunnel já instalado no computador.

```powershell
npm install
npm run build
$env:APP_HOST='127.0.0.1'
.\.venv\Scripts\python.exe backend\run_production.py
```

O FastAPI também serve `/api` e `/uploads` no mesmo domínio.

## Banco

As configurações locais ficam em `backend/.env`. Nunca publique esse arquivo ou suas credenciais. Para aplicar migrations aditivas:

```powershell
Set-Location backend
..\.venv\Scripts\python.exe -m alembic upgrade head
```

Não execute scripts de limpeza ou reset contra o banco real.

## Verificações

```powershell
npm run build
npm run lint
npm run typecheck
```
