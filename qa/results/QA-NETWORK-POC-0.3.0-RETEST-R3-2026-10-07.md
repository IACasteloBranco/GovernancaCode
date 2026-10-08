# QA — reteste da POC de rede 0.3.0 — após recarga — 2026-10-07

## Registro da execução

- TEST-ID: `QA-NETWORK-POC-030-LIVE-RETEST-R3`
- DATE: 2026-10-07 15:30 (America/Sao_Paulo)
- EXTENSION-VERSION: popup fornecido pelo usuário mostra candidata `0.3.0` e adapter `0.3.0-network`; versão injetada na aba controlável não confirmada
- SITE: ChatGPT Web (`https://chatgpt.com/`)
- INPUT-TYPE: nenhum; nenhum prompt foi enviado
- EXPECTED: após recarregar a aba, os scripts MAIN da candidata ficam presentes e o popup deixa de indicar scripts ausentes
- OBSERVED: a imagem fornecida mostra o popup reportando `Scripts ausentes na aba`. Recarreguei a aba ChatGPT disponível no Codex In-app Browser. Depois da recarga, os marcadores `governanca.ai.network.probe.v1` e `governanca.ai.prompt.block.v1` continuaram ausentes; o marcador da política também não estava disponível. A superfície controlável continua sendo o Codex In-app Browser, sem acesso ao popup dessa mesma aba ou a `chrome://extensions`.
- STATUS: `BLOCKED`

## Evidência e limites

- Evidência fornecida pelo usuário: popup mostra versão candidata e adapter configurados, com scripts ausentes na aba antes da recarga. Dados de instalação visíveis na imagem foram omitidos deste relatório.
- Evidência após ação: recarga executada na aba acessível; verificação somente leitura confirmou os dois marcadores MAIN como ausentes.
- Nenhum prompt foi transmitido; nenhuma configuração da extensão foi alterada.
- Bloqueador, política, stream, seleção `matched_dom`/fallback, entrega única e persistência permanecem `NOT_TESTED` porque a candidata não foi confirmada na aba sob controle.

## Resumo

```text
QA REPORT

Version: popup reportado pelo usuário: 0.3.0 / 0.3.0-network; injeção na aba controlável não confirmada
Sites tested: ChatGPT Web (injeção após recarga)
Tests executed: 1 checagem de carregamento e recarga
PASS: 0
FAIL: 0
BLOCKED: 1
NOT_TESTED: fluxo de bloqueio/captura e persistência
POLICY_QUESTION: 0

Regression status: não executada
Recommendation: sem validação funcional independente; candidata não aprovada por esta rodada.
```
