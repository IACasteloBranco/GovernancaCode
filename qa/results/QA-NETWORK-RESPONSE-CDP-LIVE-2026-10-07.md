# QA — análise de resposta via rede — 2026-10-07

## Registro da execução

- TEST-ID: `QA-NETWORK-RESPONSE-CDP-LIVE`
- DATE: 2026-10-07 15:02 (America/Sao_Paulo)
- SITE: ChatGPT Web (`https://chatgpt.com/`)
- EXTENSION-VERSION: não confirmada na aba; artefatos locais disponíveis: sonda `0.2.4`, extensão integrada `0.6.13`
- INPUT-TYPE: prompt sintético de resposta exata; conteúdo omitido desta evidência
- EXPECTED: a resposta visível corresponde à resposta transportada no stream da requisição `conversation`; stream termina com marcador de protocolo
- OBSERVED: UI exibiu o marcador sintético solicitado. A requisição `POST /backend-api/f/conversation` retornou HTTP `200`, MIME `text/event-stream`; o corpo foi concluído (`Network.loadingFinished`, 5.735 bytes codificados), com `[DONE]` e o marcador esperado presente no corpo. A resposta visível e o conteúdo verificado na resposta de rede coincidiram.
- STATUS: `PASS` para análise CDP da resposta; `NOT_TESTED` para captura pela extensão

## Evidência e limites

- Browser: aba do ChatGPT Web recarregada, sessão autenticada.
- Método: eventos CDP de rede e leitura transitória do corpo da resposta; o conteúdo bruto não foi salvo neste relatório.
- A inspeção confirmou `networkProbe=false` e ausência do marcador do observador de prompt na página. Assim, o teste confirma o stream do site por análise de rede, não a injeção, captura ou registro da extensão.
- Não foram inspecionados cookies, headers de autenticação, corpo da requisição, nem dados além do marcador sintético esperado.
- Sem evidência de versão carregada, popup, service worker ou persistência no SQLite.

## Resultado da rodada

```text
QA REPORT

Version: extensão não confirmada; referência local: sonda 0.2.4 / integrada 0.6.13
Sites tested: ChatGPT Web
Tests executed: 1 ensaio manual de resposta via CDP
PASS: 1 (análise do stream via CDP)
FAIL: 0
BLOCKED: 0
NOT_TESTED: 1 (captura da resposta pela extensão)
POLICY_QUESTION: 0

Open CRITICAL: não avaliados
Open HIGH: não avaliados
Open MEDIUM: não avaliados
Open LOW: não avaliados

Regression status: não executada nesta rodada
Top risks: a extensão e sua versão não puderam ser confirmadas nesta aba; CDP não comprova a captura pela sonda, correlação de interação nem persistência local.
Recommendation: validação independente da extensão permanece NOT_TESTED; este resultado não aprova release nem rollout.
```
