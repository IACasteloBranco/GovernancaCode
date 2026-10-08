# QA — reteste da POC de rede 0.3.0 — 2026-10-07

## Registro da execução

- TEST-ID: `QA-NETWORK-POC-030-LIVE-RETEST`
- DATE: 2026-10-07 15:24 (America/Sao_Paulo)
- EXTENSION-VERSION: candidata local `0.3.0`; versão carregada no navegador não confirmada
- SITE: ChatGPT Web (`https://chatgpt.com/`)
- INPUT-TYPE: não enviado; a pré-condição de extensão ativa não foi satisfeita
- EXPECTED: confirmar extensão `0.3.0` ativa (`adapter_version=0.3.0-network`) antes de testar bloqueio, espelhamento e persistência
- OBSERVED: a única superfície de navegador disponível foi Codex In-app Browser. A aba ChatGPT estava aberta, mas os marcadores MAIN da POC não estavam presentes (`governanca.ai.network.probe.v1=false`; `governanca.ai.prompt.block.v1=false`). Não há acesso a `chrome://extensions` nem ao popup da extensão nesta superfície. O manifesto do artefato local declara `0.3.0`, mas isso não prova que a versão esteja carregada.
- STATUS: `BLOCKED`

## Evidência e limites

- A checagem foi somente leitura; nenhum prompt foi enviado e nenhuma configuração da extensão foi alterada.
- Artefato consultado: `Extensão/extension-network-poc/manifest.json` declara versão `0.3.0`; o código define os marcadores de instalação da sonda e do bloqueador.
- Não foi possível consultar popup, `adapter_version` de uma interação, backend/SQLite, eventos de diagnóstico ou número de respostas persistidas.
- Portanto, bloqueio de política, captura de rede, seleção `matched_dom`/fallback, unicidade da resposta e persistência permanecem `NOT_TESTED`.

## Resultado da rodada

```text
QA REPORT

Version: candidata local 0.3.0; versão ativa não confirmada
Sites tested: ChatGPT Web (verificação de pré-condição)
Tests executed: 1 verificação de disponibilidade da extensão
PASS: 0
FAIL: 0
BLOCKED: 1 (extensão 0.3.0 não carregada/acessível no navegador disponível)
NOT_TESTED: bloqueio, espelhamento, fallback, correlação e persistência
POLICY_QUESTION: 0

Open CRITICAL: não avaliados
Open HIGH: não avaliados
Open MEDIUM: não avaliados
Open LOW: não avaliados

Regression status: não executada
Top risks: sem confirmar a versão ativa, o comportamento da candidata não pode ser atribuído à extensão testada.
Recommendation: reteste independente inconclusivo; não aprovar a candidata com base nesta rodada.
```
