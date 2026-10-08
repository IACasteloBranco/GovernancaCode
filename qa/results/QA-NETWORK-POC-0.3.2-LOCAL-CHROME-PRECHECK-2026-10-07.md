# QA — POC de rede 0.3.2 — pré-checagem no Chrome local — 2026-10-07

## Registro da execução

- TEST-ID: `QA-NETWORK-POC-032-LOCAL-CHROME-PRECHECK`
- DATE: 2026-10-07 16:42 (America/Sao_Paulo)
- EXTENSION-VERSION: popup fornecido pelo usuário mostra `0.3.2`, adapter `0.3.2-network`
- SITE: ChatGPT Web, Chrome local, aba `Teste de rede`
- INPUT-TYPE: nenhum prompt novo
- EXPECTED: extensão injetada na aba antes do teste de bloqueio e captura
- OBSERVED: a aba do Chrome local foi localizada. Após recarga anterior, a checagem atual ainda retorna `network.probe.v1=false`, `prompt.block.v1=false` e engine de política ausente. O usuário autorizou acesso limitado a `chatgpt.com`, mas a configuração não pôde ser aplicada pela automação: a página interna `chrome://extensions/` não pode ser acessada segundo a política do navegador. A imagem fornecida também mostra scripts ausentes na aba.
- STATUS: `BLOCKED`

## Evidência e limites

- Versão e adapter identificados pela captura do popup; manifest local também declara `0.3.2`.
- Verificação somente leitura na aba web confirma que os scripts não estão injetados.
- Nenhum prompt foi enviado nesta execução e nenhuma configuração foi alterada.
- Bloqueio de política, captura do stream, sincronização de instalação, resposta persistida, unicidade e comparação seguem `NOT_TESTED`.

```text
QA REPORT

Version: 0.3.2 / 0.3.2-network, conforme popup
Sites tested: ChatGPT Web (pré-condição de injeção)
Tests executed: 1 verificação de injeção
PASS: 0
FAIL: 0
BLOCKED: 1 (acesso do site continua sem aplicação; configuração interna do Chrome bloqueada pela política do navegador)
NOT_TESTED: fluxo funcional e persistência
POLICY_QUESTION: 0

Regression status: não executada
Recommendation: aplicação manual do acesso restrito a chatgpt.com é necessária antes do reteste funcional; esta rodada não aprova a candidata.
```

### Complemento de evidência visual

A captura posterior do Chrome mostra a permissão geral de acesso a sites ligada, mas a linha https://chatgpt.com/* desligada. A linha http://127.0.0.1/* também aparece desligada. Os dados de conta e instalação da captura não foram copiados para o relatório.
