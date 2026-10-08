# QA — POC de rede 0.3.2 — rechecagem após reinício da aba — 2026-10-07

## Registro da execução

- TEST-ID: `QA-NETWORK-POC-032-RESTARTED-TAB`
- DATE: 2026-10-07 16:44 (America/Sao_Paulo)
- EXTENSION-VERSION: candidata `0.3.2`; adapter mostrado no popup fornecido pelo usuário: `0.3.2-network`
- SITE: ChatGPT Web, Chrome local, aba `Teste de rede`
- INPUT-TYPE: não enviado
- EXPECTED: sonda e bloqueador presentes na aba reiniciada antes de enviar o prompt sintético `OK-REDE-032`
- OBSERVED: após o usuário reiniciar a aba, a checagem da página retornou `network.probe.v1=false`, `prompt.block.v1=false` e engine de política ausente. Portanto, um envio agora não exercitaria a extensão.
- STATUS: `BLOCKED`

## Evidência e limites

- A aba local do Chrome foi localizada e observada após o reinício.
- Nenhum prompt foi enviado; nenhum conteúdo foi transmitido nesta execução.
- A permissão para `chatgpt.com` foi autorizada pelo usuário, mas a automação foi impedida pela política do navegador de acessar `chrome://extensions/`; a permissão ainda não foi aplicada.
- Sincronização da instalação, bloqueio, captura, diagnóstico de stream e persistência permanecem `NOT_TESTED`.

```text
QA REPORT

Version: 0.3.2 / 0.3.2-network (versão do popup fornecido)
Sites tested: ChatGPT Web (pré-condição após reinício)
Tests executed: 1 checagem de carregamento
PASS: 0
FAIL: 0
BLOCKED: 1
NOT_TESTED: teste funcional e persistência
POLICY_QUESTION: 0

Regression status: não executada
Recommendation: habilitar manualmente acesso restrito a chatgpt.com, recarregar a aba e solicitar novo reteste.
```
