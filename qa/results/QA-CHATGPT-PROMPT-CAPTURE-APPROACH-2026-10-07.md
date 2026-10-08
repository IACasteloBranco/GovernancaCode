# QA — abordagem de captura do prompt/sonda de rede — 2026-10-07

## Objetivo e escopo

Iniciar a validação dirigida à abordagem experimental de captura por stream descrita em `coordination/requests/CDP-EXPLORATION-next-steps.md` e `Extensão/extension-network-poc/README.md`.

O material chama a POC de sonda do fluxo de resposta do ChatGPT. Ela observa metadados de transporte e resume a estrutura do stream `conversation`; ainda não reconstrói o texto da resposta pela rede. A captura de prompt continua sendo feita pelo observador existente. Portanto, os testes de prompt por Enter/submit abaixo são regressão automatizada do observador, não evidência de um novo mecanismo de captura de prompt.

## Ambiente

- Data: 2026-10-07
- Site disponível: ChatGPT Web (`https://chatgpt.com/`)
- Estado observado da aba: sessão autenticada, composer `#prompt-textarea` presente.
- Extensão integrada no repositório: `0.6.13` (`Extensão/extension-prompt-block-poc/manifest.json`).
- Sonda experimental no repositório: `0.2.4` (`Extensão/extension-network-poc/manifest.json`), restrita a `chatgpt.com`.
- Checagem da aba: `window[Symbol.for('governanca.ai.network.probe.v1')]` retornou `false`; sonda experimental não está injetada nesta aba.
- O ambiente expõe somente o navegador embutido, sem interface `chrome://extensions` para carregar a cópia local.
- Massa transmitida ao site nesta rodada: nenhuma; o envio sintético foi bloqueado antes da transmissão e o composer foi limpo.

## Execução automatizada

| Suíte | Resultado | Observação |
|---|---:|---|
| `Extensão/extension-network-poc` | 25 passaram, 0 falharam | Inclui clone do stream sem consumir/alterar o corpo da aplicação, resumo sem texto da resposta, metadados sem credenciais, validação da ponte e captura do prompt por Enter/submit no fixture. |
| `Extensão/extension-prompt-block-poc` | 71 passaram, 0 falharam | Regressão da extensão integrada, incluindo Enter/submit, bloqueio, associação de resposta, Artifact e serialização Markdown. |

Ambas as suítes terminaram com código de saída 0. Estes resultados cobrem fixtures automatizadas; não provam comportamento em sessão real, captura completa do corpo de rede nem persistência correta no SQLite.

## Casos da rodada

### QA-CAPTURE-PROMPT-AUTO-ENTER

- TEST-ID: `QA-CAPTURE-PROMPT-AUTO-ENTER`
- DATE: 2026-10-07
- EXTENSION-VERSION: sonda `0.2.4`; regressão integrada `0.6.13`
- SITE: fixture automatizada para ChatGPT
- INPUT-TYPE: prompt sintético no fixture
- EXPECTED: observador captura prompt quando Enter ocorre mesmo sem o seletor antigo.
- OBSERVED: fixture passou em ambas as suítes.
- STATUS: `PASS` (somente automatizado)
- EVIDENCE: saída das suítes registrada nesta rodada: 25/25 e 71/71.
- NOTES: não equivale a validação em navegador real.

### QA-CAPTURE-PROMPT-AUTO-SUBMIT

- TEST-ID: `QA-CAPTURE-PROMPT-AUTO-SUBMIT`
- DATE: 2026-10-07
- EXTENSION-VERSION: sonda `0.2.4`; regressão integrada `0.6.13`
- SITE: fixture automatizada para ChatGPT
- INPUT-TYPE: envio sintético via evento `submit`
- EXPECTED: captura quando o evento de tecla não chega.
- OBSERVED: fixture passou em ambas as suítes.
- STATUS: `PASS` (somente automatizado)
- EVIDENCE: saída das suítes registrada nesta rodada: 25/25 e 71/71.
- NOTES: confirma o observador existente, não um método novo.

### QA-NETWORK-PROBE-STREAM-SAFE

- TEST-ID: `QA-NETWORK-PROBE-STREAM-SAFE`
- DATE: 2026-10-07
- EXTENSION-VERSION: sonda `0.2.4`
- SITE: fixture automatizada para ChatGPT Web
- INPUT-TYPE: resposta sintética de stream
- EXPECTED: a sonda não consome nem altera o corpo da aplicação e não publica texto da resposta ou credenciais nos eventos.
- OBSERVED: fixtures correspondentes passaram.
- STATUS: `PASS` (somente automatizado)
- EVIDENCE: suíte da sonda, 25 testes aprovados.
- NOTES: não valida reconstrução integral nem associação causal da resposta.

### QA-NETWORK-PROBE-LIVE

- TEST-ID: `QA-NETWORK-PROBE-LIVE`
- DATE: 2026-10-07
- EXTENSION-VERSION: não confirmada no navegador; artefato local da sonda é `0.2.4`
- SITE: ChatGPT Web
- INPUT-TYPE: prompt sintético
- EXPECTED: confirmar extensão e versão ativas, gerar interação nova e observar eventos locais sem persistir conteúdo bruto.
- OBSERVED: sessão autenticada, marcador `networkProbe=false`; ao tentar o envio sintético, a interface exibiu `Envio bloqueado: O bloqueio manual de todos os envios está ligado no popup.` O texto não foi enviado e foi removido do composer.
- STATUS: `BLOCKED`
- EVIDENCE: estado de acessibilidade mostrou `#prompt-textarea`, o aviso de bloqueio manual e o composer após sua limpeza; consulta somente leitura retornou `networkProbe=false`.
- NOTES: extensão integrada bloqueou o envio por configuração manual atualmente ativa; a sonda de rede não está injetada. Não tentei alterar o bloqueio porque isso reduz uma proteção de segurança e requer autorização específica para esta rodada.

## Resumo

```text
QA REPORT

Version: sonda experimental 0.2.4; extensão integrada 0.6.13
Sites tested: ChatGPT Web (inspeção de estado e presença da sonda); fixtures automatizadas
Tests executed: 96 testes automatizados; 1 tentativa de envio sintético bloqueada antes da transmissão
PASS: 3 casos automatizados
FAIL: 0
BLOCKED: 1 caso de navegador real
NOT_TESTED: reconstrução integral de stream, correlação em conversa independente/regeneração, três Stops, CSV/PDF pela extensão, verificação de novos registros no SQLite
POLICY_QUESTION: 0

Open CRITICAL: não avaliado nesta rodada
Open HIGH: não avaliado nesta rodada
Open MEDIUM: não avaliado nesta rodada
Open LOW: não avaliado nesta rodada

Regression status: suítes automatizadas verdes (25/25 e 71/71)
Top risks: sonda não injetada na aba real; bloqueio manual ligado; a nova POC não reconstrói resposta; não há prova de correlação nem de SQLite nesta rodada.
Recommendation: BLOCKED para validação funcional em navegador; sem aprovação da implementação ou da versão.
```

## Próximo passo de QA

Carregar a pasta local `Extensão/extension-network-poc/` em um Chrome com suporte à página de extensões, desativando a cópia integrada durante o experimento para evitar entregas duplicadas; recarregar `chatgpt.com` e confirmar a sonda ativa. Então executar uma interação sintética nova, inspecionar os eventos locais e consultar somente o registro novo no SQLite. Depois prosseguir com conversa independente, formatos, associação/regeneração, pelo menos três Stops e CSV/PDF gerados pela extensão, mantendo ChatGPT e Claude como escopos separados. Não persistir prompt, resposta, corpo bruto, headers, cookies, tokens, URLs assinadas ou bytes de arquivos nas evidências.
