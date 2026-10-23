# Autenticação do painel de analytics

## Escopo

Fase 1 do [plano do painel](../docs/plans/PLANO_FRONTEND_ANALYTICS.md). O backend ganha um fluxo OAuth próprio para o painel, separado do login da extensão. A página e a implantação no Google Cloud continuam fora desta fase.

## Resultado

- `GET /v1/auth/dashboard/start` inicia OAuth com `state`, `nonce` e PKCE.
- `GET /v1/auth/dashboard/callback` valida o retorno Google, o domínio Workspace e o `sub` do operador configurado.
- A sessão fica em cookie `HttpOnly`, `Secure` e `SameSite=Lax`, com validade limitada pela expiração do ID token.
- `GET /v1/auth/dashboard/session` retorna apenas estado, e-mail e expiração.
- O cookie do painel autoriza o resumo agregado. As rotas de conteúdo bruto continuam sem aceitar esse cookie.
- O resumo e os endpoints de sessão usam `Cache-Control: no-store`.
- O fluxo fica desativado até `GOOGLE_ANALYTICS_REDIRECT_URI`, `GOOGLE_OPERATOR_SUB` e `PILOT_DEPARTMENT_CODE` estarem configurados.

## Verificação

| Caso | Resultado | Evidência |
|---|---|---|
| Fluxo OAuth, PKCE e cookie de sessão | PASS | Testes sintéticos em `backend/tests/test_google_auth.py`. |
| Estado incorreto, nonce incorreto e domínio não autorizado | PASS | Testes sintéticos de callback. |
| Conta fora do operador autorizado | PASS | Callback retorna `403` no teste sintético. |
| Sessão expirada | PASS | Consulta de sessão retorna `401`. |
| Cookie do painel acessa analytics, mas não detalhe bruto | PASS | O resumo retorna `200` e a rota de interação retorna `401`. |
| Suíte do backend | PASS | `backend/.venv/Scripts/python.exe -m pytest tests -q -p no:cacheprovider`: 37 testes passaram. Um aviso de depreciação do `TestClient` permanece. |
| Graphify | PASS | `graphify update .` gerou 1.209 nós e 2.032 arestas. Alguns diretórios temporários antigos não puderam ser lidos. |
| Login Google real e HTTPS no laboratório | NOT_TESTED | Dependem de registrar e configurar a URI HTTPS do painel no cliente OAuth. |

## Próximo passo

Criar a página funcional em `analytics/` na Fase 2 e servi-la no mesmo host da API. Aplicar a referência visual depois que o responsável a fornecer.
