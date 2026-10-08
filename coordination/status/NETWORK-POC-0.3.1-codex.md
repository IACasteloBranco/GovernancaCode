BUG-ID: NETWORK-POC-0.3.0-LIVE — resposta concluída não persistida
STATUS: READY_FOR_RETEST
VERSION: 0.3.1

ROOT-CAUSE:
- A evidência do QA comprova captura do prompt e ausência de resposta no banco, mas não inclui eventos do observer/sonda; portanto, não determina qual estágio do fluxo falhou naquela execução.
- Foi encontrado um defeito confirmado no fluxo de finalização: o registro auxiliar `network_capture_result` era aguardado antes do POST `/response`; uma falha nesse diagnóstico abortava toda a entrega. O diagnóstico agora é best-effort e não bloqueia o POST.
- Também faltava reconhecer `data-conversation-role` quando o atributo está no próprio nó da mensagem. A leitura do papel foi corrigida e ganhou teste de regressão.

CHANGE-SUMMARY:
- Resposta final de stream só pode antecipar a finalização se `[DONE]` e candidato de rede coincidirem exatamente com o DOM associado, sem ambiguidade; candidatos que chegam antes da resposta assíncrona de status ficam em cache curto, limitado a dois IDs.
- Erros transitórios de comunicação na entrega da resposta são repetidos até três tentativas, reutilizando a mesma mensagem/idempotency key do evento.
- Adicionados estágios de diagnóstico local sem texto de conteúdo: `started`, `answer_found`, `finalizing` e `delivery_error`. Isso permite ao Work separar ausência de associação, ausência de finalização e falha de entrega no popup.
- A versão 0.3.0 permanece reprovada; 0.3.1 é somente candidata para novo reteste.

FILES-CHANGED:
- Extensão/extension-network-poc/manifest.json
- Extensão/extension-network-poc/README.md
- Extensão/extension-network-poc/src/background/service-worker.js
- Extensão/extension-network-poc/src/content/observer.js
- Extensão/extension-network-poc/src/popup/diagnostics.js
- Extensão/extension-network-poc/tests/manifest.test.js
- Extensão/extension-network-poc/tests/observer.test.js
- docs/POC_REDE_CHATGPT.md
- coordination/status/NETWORK-POC-0.3.1-codex.md
- coordination/retests/NETWORK-POC-0.3.1-work.md

TESTS-ADDED:
- Falha no diagnóstico comparativo não interrompe o POST de resposta.
- `[DONE]` mais igualdade DOM finaliza resposta curta sem que o poll tenha observado o botão de streaming.
- Candidato que chega antes da resposta assíncrona de status é associado ao envio ativo.
- Papel da mensagem encontrado em `data-conversation-role` no próprio elemento.
- Versão do manifest e versões de adapter verificadas.

AUTOMATED-TEST-RESULT: `npm.cmd test` em `Extensão/extension-network-poc`: 41 testes passaram, 0 falhas. `node --check` passou em observer, service worker e diagnostics; `manifest.json` validado como JSON.

RISKS:
- Não foi possível reproduzir o estado do navegador real com o relatório disponível. As correções cobrem defeitos de fluxo identificados e acrescentam diagnóstico; só reteste real pode confirmar a captura/persistência.
- O protocolo do stream e a associação causal continuam experimentais. Só candidato de texto igual ao DOM é selecionado. Nenhuma política foi alterada.

RETEST-INSTRUCTIONS: Seguir `coordination/retests/NETWORK-POC-0.3.1-work.md`. Confirmar versão carregada, conferir os quatro estágios do observer no popup, evento `response: confirmed:...` e uma resposta persistida para a interaction nova. Se não houver `answer_found`, registrar estado `NOT_TESTED`/`FAIL` com as etapas observadas; não inferir aprovação.

LIVE-RETEST-ATTEMPT: 2026-10-07 — `BLOCKED` para captura de resposta. Na aba Chrome `Teste de rede`, tentei enviar somente o prompt sintético `Responda apenas OK-REDE-031.`. Em três tentativas (imediata, após 2 s e após 11 s), a extensão impediu o envio e mostrou: “Envio bloqueado: O bloqueio manual de todos os envios está ligado no popup.” O prompt não foi enviado e o rascunho foi removido. A interface interna `chrome://extensions` não ficou acessível pelo controle da aba, então não confirmei a versão nem qual cópia está ativa. Resultado da persistência: `NOT_TESTED`.

CONFIG-DISCREPANCY-INVESTIGATION:
- O popup lê `blockPrompts` de `chrome.storage.local`; “Aplicar bloqueio manual” grava esse valor e o worker o transmite às abas pelo port `prompt-block-policy`.
- O `blocker-bridge.js` inicializa `manualBlocked = true` e também volta a `true` após qualquer desconexão do port. Até receber `block_policy`, qualquer tentativa é bloqueada e descrita como `MANUAL`, mesmo se a configuração persistida estiver desligada.
- O worker só responde a `block_status` depois de `loadMachineAssignment()`, que consulta a API com timeout de 10 s. Isso cria uma janela fail-closed e pode prolongá-la se a consulta ou o port não concluir.
- O aviso observado é produzido pela decisão do bridge. `blocker-main.js` também fecha a barreira de rede sem concessão, mas mostra um aviso diferente (`não havia uma decisão válida`); portanto, a mensagem não prova que a configuração persistida está ligada.
- Como o mesmo aviso persistiu após 11 s, uma corrida curta de inicialização isolada não explica tudo. A evidência é compatível com worker/port sem sincronização, content script antigo ainda ativo ou outra cópia da extensão interceptando. Sem acesso à página interna de extensões ou aos diagnósticos do popup, não é possível distinguir essas hipóteses nem confirmar o valor salvo naquela instância.
- Não desliguei controles nem alterei configuração para contornar o bloqueio. A captura de resposta segue `NOT_TESTED`.
