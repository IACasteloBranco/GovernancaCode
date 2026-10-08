# QA — POC de rede 0.3.0 — acesso do site no Chrome local — 2026-10-07

## Registro da execução

- TEST-ID: `QA-NETWORK-POC-030-LOCAL-CHROME-PRECHECK`
- DATE: 2026-10-07 16:39 (America/Sao_Paulo)
- EXTENSION-VERSION: popup fornecido pelo usuário: `0.3.0`, adapter `0.3.0-network`
- SITE: ChatGPT Web, Chrome local, aba `Teste de rede`
- INPUT-TYPE: nenhum prompt novo foi enviado
- EXPECTED: sonda e bloqueador injetados na aba após recarga
- OBSERVED: a aba existe no Chrome local. Após recarregar, os marcadores da sonda e do bloqueador continuaram ausentes. A aba `chrome://extensions/` está aberta, mas o controle de navegador desta sessão não permite reivindicar/operar páginas internas do Chrome. O usuário autorizou acesso restrito a `chatgpt.com`; a alteração ainda não foi aplicada.
- STATUS: `BLOCKED`

## Evidência e limites

- Versão e adapter confirmados apenas pela captura do popup fornecida pelo usuário.
- Checagem da página após recarga: `network.probe.v1=false`, `prompt.block.v1=false`.
- Nenhuma configuração foi alterada e nenhum prompt foi enviado nesta execução.
- A checagem funcional (bloqueio, espelhamento, fallback, unicidade e persistência) permanece `NOT_TESTED`.

```text
QA REPORT

Version: 0.3.0 / 0.3.0-network, conforme popup
Sites tested: ChatGPT Web (pré-condição de injeção)
Tests executed: 1 verificação de carregamento após recarga
PASS: 0
FAIL: 0
BLOCKED: 1 (acesso do site ainda não habilitado; UI interna do Chrome inacessível à automação)
NOT_TESTED: fluxo funcional e persistência
POLICY_QUESTION: 0

Regression status: não executada
Recommendation: aguardar a permissão específica de site ser aplicada e repetir o reteste; não aprovar nesta rodada.
```
