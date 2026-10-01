# AGENTS.md

## Project Context

Este é um sistema particular. Não vincule, autentique, publique ou crie recursos em Base44 ou em qualquer plataforma externa.

Arquitetura real:

- frontend React/Vite em `src/`;
- backend FastAPI em `backend/app/`;
- PostgreSQL real configurado exclusivamente por `backend/.env`;
- frontend de produção em `dist/`, servido pelo próprio FastAPI;
- API e uploads relativos em `/api` e `/uploads`;
- backend de produção em `127.0.0.1:8000`;
- domínio público existente via Cloudflare Tunnel.

## Regras

- Trabalhe prioritariamente nesta pasta.
- Nunca exponha ou altere credenciais sem solicitação explícita.
- Não crie banco de desenvolvimento nem use a porta 8001.
- Não altere saldo diretamente; use o motor oficial de estoque.
- Migrations devem ser aditivas e não destrutivas.
- Preserve autenticação, JWT, uploads, permissões e regras de negócio.
- Execute os checks relevantes de `package.json` e testes do backend antes de concluir.
