# Paridade do backend da VM — 2026-10-19

## Resultado

Atualizei a VM `governanca-lab-auth-01` para alinhar o backend da porta 8000 ao código local e publiquei o HTML atual do dashboard nos dois diretórios servidos. A porta 8001 já usava os módulos Python locais correspondentes, então não foi reiniciada.

## Arquivos atualizados

- `governanca-backend-lab/app/main.py`
- `governanca-backend-lab/app/security.py`
- `governanca-backend-lab/app/settings.py`
- `governanca-backend-lab/app/analytics.py`
- `governanca-backend-lab/analytics/index.html`
- `analytics-lab/analytics/index.html`

Os cinco arquivos do pacote tinham SHA-256 validado antes da extração. Após a cópia, os hashes dos quatro módulos Python e dos dois HTMLs conferiram com o workspace local. O HTML dos dois diretórios ficou idêntico.

## Execução e evidências

- Pacote de implantação verificado na VM: SHA-256 `74964e4f8fbda993b4c922634dacbdee4985c1af56f1bd71e8a806881acbe98f`.
- Backup prévio dos arquivos-alvo: `/tmp/backend-parity-backup-20261019/`.
- Extração temporária: `/tmp/backend-parity-stage-20261019/`.
- Reiniciei somente Uvicorn da porta 8000, preservando diretório de trabalho, ambiente virtual, comando e porta. Processo novo observado: PID 77464.
- `GET /health` local nas portas 8000 e 8001: HTTP 200, `schema_version=0.8`.
- Os dois processos `cloudflared` permaneceram ativos; não foram reiniciados.
- Recarreguei o dashboard no quick tunnel. A autenticação do operador foi validada e o dashboard voltou a exibir os agregados: 2 interações, 2 respostas, 5 capturas de interação e 4 metadados de arquivo.

## Integridade e limites

- `.env`, banco SQLite, ambientes virtuais, dependências e processos do dashboard não foram substituídos.
- A contagem pós-deploy no SQLite não foi confirmada: `sqlite3` não está instalado na VM e a sessão SSH encerrou após a tentativa. Não li conteúdo de prompt nem executei testes automatizados.
- O log anterior da extensão mostrou `network_gate_blocked=true`. A análise do fluxo indica que esse bloqueio é decidido no handshake/preflight da extensão; o deploy corrige a diferença conhecida do backend, mas ainda não prova que resolveu esse bloqueio. Se ele persistir, coletar um novo `blocker_health` e o resultado do preflight da extensão é o próximo diagnóstico necessário.

## Recuperação

Se a porta 8000 apresentar regressão, restaurar os arquivos Python a partir de `/tmp/backend-parity-backup-20261019/` e reiniciar o Uvicorn da porta 8000 no diretório `governanca-backend-lab`. O banco e os arquivos `.env` não fazem parte do backup porque não foram alterados.
