# Evidências da Fase 2 do painel de analytics

## Escopo

Foi criada a página `analytics/index.html`, servida pelo backend em `/analytics/`. A página usa a sessão HttpOnly já implementada e consulta somente `GET /v1/admin/analytics/summary`. Ela mostra totais, atividade por departamento e por colaborador, filtro de período e mensagens para carregamento, ausência de dados, sessão expirada e falha da API. A interface permanece neutra para deixar a referência visual recebida para a Fase 3.

## Verificações

- `backend/.venv/Scripts/python.exe -m pytest -q tests`: **PASS**, 39 testes passaram. O pytest reportou um aviso de depreciação do `TestClient` do Starlette com `httpx`.
- `node --check` no bloco JavaScript extraído da página: **PASS**.
- TestClient para `GET /analytics/`: **PASS**, retornou HTML e `Cache-Control: no-store`.
- Navegador com fixture local sintética: **PASS** para sessão ativa, totais, tabelas, filtro de datas, lista vazia, sessão expirada, erro de API e logout. A fixture retornou `12` interações e o servidor temporário foi encerrado após a validação.
- Autenticação do backend: **PASS** nos testes sintéticos existentes e direcionados. A identidade do operador autorizada consulta o resumo; uma identidade diferente é recusada.
- `graphify update .`: **PASS**, atualizou o grafo para 1.223 nós e 2.053 relações. O Graphify não conseguiu ler diretórios temporários já existentes e bloqueados no workspace e seguiu com extração sequencial.

## Limites

- Login com Google real e callback HTTPS: **NOT_TESTED**. Requer `GOOGLE_ANALYTICS_REDIRECT_URI` e cliente OAuth configurados no ambiente `lab`.
- Implantação, TLS público, rede, custo e pacote Google Cloud não foram verificados nesta fase.
- A fixture de navegador foi um servidor temporário de teste; não substitui a validação posterior no ambiente `lab`.
- Um smoke test adicional usou `TestClient` sem substituir `DATABASE_PATH`, que apontou para `backend/data/lab.sqlite3`. O startup do app chama `clean_expired`; não consultei registros nem tenho uma contagem anterior para afirmar se havia linhas expiradas. O arquivo estava com horário de modificação 2026-10-18 09:35:32 ao verificar às 09:41:39, portanto não consigo atribuir esse horário ao teste ou a uma operação anterior. As suítes automatizadas e o servidor de navegador usaram bancos ou respostas sintéticas.

## Resultado

Fase 2 implementada e verificada com identidades e respostas sintéticas. O login real permanece separado desta validação. A inicialização de um smoke test adicional pode ter executado a limpeza por retenção no banco local; não foi possível confirmar se havia registros expirados nem se algo foi removido. A Fase 3 pode aplicar o padrão visual do PDF sem alterar o contrato da API nem os controles de autenticação.
