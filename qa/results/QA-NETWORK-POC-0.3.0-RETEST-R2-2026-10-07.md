# QA — reteste da POC de rede 0.3.0 — nova tentativa — 2026-10-07

## Registro da execução

- TEST-ID: `QA-NETWORK-POC-030-LIVE-RETEST-R2`
- DATE: 2026-10-07 15:27 (America/Sao_Paulo)
- EXTENSION-VERSION: candidata local `0.3.0`; versão ativa não confirmada
- SITE: ChatGPT Web (`https://chatgpt.com/`), aba do Codex In-app Browser
- INPUT-TYPE: nenhum; não houve envio de prompt
- EXPECTED: confirmar a sonda e o bloqueador da candidata na página antes do teste funcional
- OBSERVED: `window[Symbol.for('governanca.ai.network.probe.v1')]` retornou `false`; `window[Symbol.for('governanca.ai.prompt.block.v1')]` retornou `false`; `GovernancaPromptPolicy.version` não estava disponível. Só o navegador embutido do Codex está acessível; popup e `chrome://extensions` não estão disponíveis.
- STATUS: `BLOCKED`

## Evidência e limites

- Checagem somente leitura na aba `https://chatgpt.com/` aberta nesta tentativa.
- Nenhum prompt sintético foi transmitido; nenhuma configuração ou arquivo da extensão foi alterado.
- A versão local declarada no manifesto não comprova a versão carregada.
- Bloqueador, avaliação de política, captura do stream, `matched_dom`/fallback, entrega única e persistência seguem `NOT_TESTED`.

## Resumo

```text
QA REPORT

Version: candidata local 0.3.0; carregada não confirmada
Sites tested: ChatGPT Web (pré-condição de extensão)
Tests executed: 1 verificação de carregamento
PASS: 0
FAIL: 0
BLOCKED: 1
NOT_TESTED: fluxo funcional completo e persistência
POLICY_QUESTION: 0

Regression status: não executada
Recommendation: reteste continua inconclusivo; sem aprovação da candidata.
```
