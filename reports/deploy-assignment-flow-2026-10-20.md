# Deploy do fluxo de solicitações de instalação — 2026-10-20

## Escopo

Aplicação do fluxo de solicitação de atribuição de máquina no backend e da caixa de solicitações pendentes no painel. O pacote local permanece em `output/assignment-flow-2026-10-20.zip`.

## Arquivos implantados na VM

- `app/analytics.py`
- `app/db.py`
- `app/machine_identity.py`
- `app/main.py`
- `app/security.py`
- `app/settings.py`
- `assign_machine.py`
- `analytics/index.html`

Destino: `~/governanca-backend-lab`. Backup dos oito arquivos anteriores: `.backup/assignment-flow-2026-10-20-deploy1/`. `.env` e `data/` foram preservados.

## Verificações

- `python -m compileall -q app assign_machine.py`: passou.
- Import da aplicação: schema `0.9`, 22 rotas.
- `GET /health`: `{"status":"ok","schema_version":"0.9"}`.
- `GET /v1/admin/machines/assignment-requests` sem autenticação: HTTP `401` (rota protegida).
- `GET /analytics/`: HTML atualizado contém a seção de solicitações pendentes.
- Inspeção SQLite somente de metadados: migração `0.9` registrada; tabela `machines` contém `requested_employee_id` e `requested_at`.
- Processo ativo: Uvicorn PID `114850`, ouvindo em `127.0.0.1:8000`.

## Limitações

O painel exibiu a etapa de autenticação após o reinício; o fluxo com sessão autenticada e as ações de aprovar/rejeitar não foram exercitados na VM. A extensão oficial não foi publicada; use o ZIP para importar/mesclar. O endereço Cloudflare continua temporário.

Não foram lidos dados de funcionários nem o conteúdo de `.env`.
