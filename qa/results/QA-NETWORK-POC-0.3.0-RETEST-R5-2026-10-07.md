# QA — reteste da POC de rede 0.3.0 — nova aba — 2026-10-07

## Registro da execução

- TEST-ID: `QA-NETWORK-POC-030-LIVE-RETEST-R5`
- DATE: 2026-10-07 15:34 (America/Sao_Paulo)
- EXTENSION-VERSION: candidata local `0.3.0`; versão carregada na aba atual não confirmada
- SITE: ChatGPT Web (`https://chatgpt.com/`), Codex In-app Browser
- INPUT-TYPE: nenhum
- EXPECTED: sonda, bloqueador e engine de política ativos antes do teste funcional
- OBSERVED: na aba atual, recém-listada pelo navegador, `network.probe.v1=false`, `prompt.block.v1=false` e `GovernancaPromptPolicy.version=null`.
- STATUS: `BLOCKED`

## Limites

- Foi feita apenas verificação somente leitura. Nenhum prompt foi enviado nem configuração alterada.
- Bloqueio, espelhamento, fallback e persistência permanecem `NOT_TESTED` porque a extensão não está presente na aba controlável.

```text
QA REPORT

Version: 0.3.0 local; versão ativa não confirmada
Sites tested: ChatGPT Web (pré-condição)
Tests executed: 1 checagem de carregamento
PASS: 0
FAIL: 0
BLOCKED: 1
NOT_TESTED: testes funcionais e persistência
POLICY_QUESTION: 0
Recommendation: reteste inconclusivo; sem aprovação.
```
