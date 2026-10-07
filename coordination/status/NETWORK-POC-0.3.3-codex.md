# Estado Codex — diagnóstico de injeção — 0.3.3

VERSION: 0.3.3
STATUS: READY_FOR_RETEST
ADAPTER: 0.3.2-network

## Causa encontrada

O popup da 0.3.2 convertia qualquer rejeição de `chrome.tabs.sendMessage` em `null`. A mensagem “Scripts ausentes” ocultava a resposta real do Chrome, impedindo distinguir receptor inexistente de outros erros.

O manifesto da POC já declara `content_scripts.matches` para `https://chatgpt.com/*`. Conforme a documentação oficial do Chrome, este campo autoriza a injeção estática. Não foi adicionada permissão ampla ou redundante em `host_permissions`.

Na aba dedicada observada em 2026-10-07, as sondas não estavam acessíveis. O estado de permissões/instalação da extensão no Chrome não pôde ser inspecionado pela automação, então a causa operacional final ainda precisa do novo erro exibido pelo popup.

## Alterações

- Popup agora conserva e mostra a mensagem de erro retornada pelo Chrome para cada sonda ausente.
- Popup identifica a origem da aba e a versão candidata 0.3.3.
- Versão do manifesto incrementada para 0.3.3; o adapter permanece `0.3.2-network` porque o protocolo de captura não mudou.

FILES-CHANGED:
- extension-network-poc/manifest.json
- extension-network-poc/src/popup/diagnostics.js
- extension-network-poc/tests/manifest.test.js
- extension-network-poc/README.md
- coordination/status/NETWORK-POC-0.3.3-codex.md
- coordination/retests/NETWORK-POC-0.3.3-work.md

TESTS-ADDED: Nenhum caso novo; suíte existente cobre manifesto e integração do adapter.
AUTOMATED-TEST-RESULT: `npm.cmd test`: 41 testes passaram, 0 falhas. `node --check src/popup/diagnostics.js` passou; `manifest.json` validado como JSON.
RISKS: O Chrome pode solicitar confirmação da permissão de acesso ao site após recarregar a extensão; a POC continua sem validação QA independente.

RETEST-INSTRUCTIONS: Abrir detalhes da extensão POC 0.3.3 no perfil Chrome dedicado, recarregar a extensão e recarregar a aba ChatGPT. Conferir a versão no popup. Se as sondas não responderem, registrar o texto exato após `Chrome:`; se responderem, executar o caso sintético aprovado em coordination/retests/NETWORK-POC-0.3.3-work.md e conferir a entrega local.
