BUG-ID: NETWORK-POC-0.3.0-LIVE — resposta não persistida; discrepância no estado de bloqueio manual
STATUS: READY_FOR_RETEST
VERSION: 0.3.2

ROOT-CAUSE:
- A tentativa real na aba mostrou mensagem de bloqueio manual em três envios sintéticos, inclusive depois de 11 s. A UI interna de extensões não estava acessível; não foi possível confirmar versão/cópia carregada nem comparar popup com o content script.
- O código tinha uma falha demonstrável: `blocker-bridge.js` inicializava `manualBlocked=true` e restaurava esse valor em desconexões. O aviso `MANUAL` podia ser emitido antes de chegar a configuração persistida.
- A resposta inicial a `block_status` também aguardava a consulta live de atribuição da instalação, com timeout da API de até 10 s. Isso atrasava a configuração manual e misturava dois estados independentes.

CHANGE-SUMMARY:
- O envio permanece bloqueado enquanto a política está sem sincronização, mas agora o motivo exibido é `SYNC`, sem afirmar que o bloqueio manual está ligado.
- O worker envia primeiro o estado manual persistido e mantém a atribuição da instalação fechada; depois consulta a atribuição e envia o estado completo. O valor manual é relido antes da segunda resposta.
- Os diagnósticos do popup podem distinguir `manual=syncing` de `manual=on/off`.
- Versão incrementada para `0.3.2`; adapter `0.3.2-network`.
- A 0.3.2 permanece candidata. O reteste anterior não enviou prompt algum e não comprovou captura/persistência.

FILES-CHANGED:
- Extensão/extension-network-poc/manifest.json
- Extensão/extension-network-poc/README.md
- Extensão/extension-network-poc/src/background/service-worker.js
- Extensão/extension-network-poc/src/content/blocker-bridge.js
- Extensão/extension-network-poc/src/content/observer.js
- Extensão/extension-network-poc/src/content/policy-messages.js
- Extensão/extension-network-poc/src/popup/diagnostics.js
- Extensão/extension-network-poc/tests/blocker.test.js
- Extensão/extension-network-poc/tests/manifest.test.js
- Extensão/extension-network-poc/tests/observer.test.js
- docs/POC_REDE_CHATGPT.md
- coordination/status/NETWORK-POC-0.3.2-codex.md
- coordination/retests/NETWORK-POC-0.3.2-work.md

TESTS-ADDED:
- Estado desconhecido continua bloqueando, mas não é classificado como MANUAL.
- A desconexão do port volta a bloquear com motivo de sincronização, sem reportar manual ligado.
- A versão do manifesto e adapter é identificável.

AUTOMATED-TEST-RESULT: `npm.cmd test` em `Extensão/extension-network-poc`: 41 testes passaram, 0 falhas. `node --check` passou nos arquivos alterados; `manifest.json` validado como JSON.

RISKS:
- A tentativa ao vivo sugere estado antigo/stale ou cópia conflitante, mas não permite confirmar a instância carregada.
- Uma atribuição ausente continua bloqueando por `MACHINE`, independentemente da opção manual. A política não foi alterada.
- Só o Work pode aprovar a captura/persistência real.

RETEST-INSTRUCTIONS: Seguir `coordination/retests/NETWORK-POC-0.3.2-work.md`. Remover/desativar cópias antigas, carregar a pasta 0.3.2, confirmar no popup `0.3.2`, adapter `0.3.2-network` e bloqueio manual desligado. Aguardar política/atribuição sincronizar. Executar um prompt sintético e confirmar resposta e evento no SQLite.

LIVE-RETEST-ATTEMPT-0.3.1: `BLOCKED`; três tentativas foram impedidas com mensagem MANUAL, e a resposta não foi testada. Ver a investigação em `coordination/status/NETWORK-POC-0.3.1-codex.md`.

IMPLEMENTER-LIVE-CHECK-0.3.2: `PASS` técnico em 2026-10-07, não substitui QA independente. Recarreguei a aba existente do ChatGPT, enviei `Responda apenas OK-REDE-032.` e observei a resposta concluída `OK-REDE-032.`. No SQLite local, a interaction `fcf086b7-7431-4bc2-93b5-78007aba2c48` tem `adapter_version=0.3.2-network`, status `complete`, exatamente uma resposta (`capture_status=complete`, adapter `0.3.2-network`, texto `OK-REDE-032.`) e exatamente um evento `response: complete`. Isso também confirma que a aba estava executando a build 0.3.2. A 0.3.2 segue `READY_FOR_RETEST`; o Work deve executar e registrar QA independente.
