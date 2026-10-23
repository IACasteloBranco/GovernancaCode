# Autenticação para o piloto do Contábil — 16/10/2026

## Escopo e fonte

Implementação técnica do login Google Workspace individual na extensão e na API, vínculo da conta à instalação assinada e leitura limitada ao setor piloto. O código oficial do Contábil é `FgXMby6awkvcKxQjk04Yr4sAz2mSdMTZ`, conforme a linha 8 da [planilha de departamentos](https://docs.google.com/spreadsheets/d/1i06KE4iG0AYKDll_vZETnJNwHp5fPrrfCX4eTAalQsk/edit). Nenhum cadastro de funcionários foi importado.

## Evidências

| Critério | Resultado | Evidência |
|---|---|---|
| Token Google válido, domínio corporativo, `sub` da instalação, assinatura e revogação no backend | PASS | `backend/.venv/Scripts/python.exe -m pytest -q tests --basetemp=.auth-final-pytest`: 23 testes sintéticos passaram; 1 aviso de depreciação do Starlette. |
| Leitura apenas pelo operador configurado e limitada ao departamento piloto | PASS | Testes sintéticos do detalhe e das duas listagens no backend. |
| Login OAuth com PKCE, `state`, `nonce` e fechamento da extensão em sessão inválida | PASS | `node --test --test-isolation=none (Get-ChildItem extension/tests/*.test.mjs).FullName`: 62 testes passaram. |
| Integração com conta Google real e endpoint HTTPS da nuvem | NOT_TESTED | Faltam cliente OAuth, segredo, URI de redirecionamento estável e URL da API fornecidos pela TI. |
| Identificação individual por `contabil@...` compartilhado | POLICY_QUESTION | A conta representa várias pessoas; é preciso definir contas individuais antes de atribuir instalações a colaboradores do setor. |
| Autorização de leitura do texto bruto pelo operador | POLICY_QUESTION | O endpoint de detalhe inclui prompt e resposta; a pessoa responsável deve aprovar esse nível de acesso. |

`git diff --check -- backend extension docs/PLANO_INFRAESTRUTURA_MVP_GCP.md` terminou sem erro de whitespace; o Git emitiu avisos de permissão em diretórios temporários antigos e de LF/CRLF. `graphify update .` atualizou o grafo e avisou que não conseguiu ler alguns diretórios temporários antigos.

## Configuração ainda necessária

1. A TI cria o cliente OAuth do tipo Aplicativo da Web para o ID estável da extensão, registra o redirecionamento exato e informa client ID, segredo e URL HTTPS da API.
2. O operador faz login individual e fornece seu `sub` exibido no popup por canal interno. Configure `GOOGLE_OPERATOR_SUB` no servidor.
3. Configure `PILOT_DEPARTMENT_CODE` com o código acima. Cadastre instalações somente após conferir `sub`, funcionário, departamento e impressão digital da chave com a fonte corporativa aprovada.
4. Configure a origem HTTPS exata em `config.js` e `host_permissions`; execute um ensaio ponta a ponta com dados sintéticos antes de solicitar aceite do piloto.

O backend recusa imediatamente uma instalação revogada. Uma aba já aberta pode manter a indicação local anterior até a próxima consulta à API; o primeiro envio após a revogação será recusado pelo backend e poderá não ser registrado. A API de consulta aceita o ID token do operador, mas ainda não há uma interface dedicada para ele consultar registros; o fluxo operacional precisa ser validado com a TI. A trilha persistente de consultas administrativas não foi incluída nesta mudança de autenticação. Estas limitações e o uso de dados reais exigem decisão do responsável; este relatório não aprova o rollout.
