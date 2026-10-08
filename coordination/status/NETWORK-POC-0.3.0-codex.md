BUG-ID: NETWORK-POC blocker integration and response-stream capture experiment
STATUS: READY_FOR_RETEST
VERSION: 0.3.0

ROOT-CAUSE:
- A POC de rede não carregava o bloqueador nem os módulos de política. A leitura do stream resumia metadados, sem reconstruir texto.
- O protocolo privado não é um contrato estável. O ensaio CDP de 2026-10-07 confirmou HTTP 200, `text/event-stream`, `[DONE]` e igualdade visual, mas não confirmou que a extensão estava ativa nem expôs formas suficientes para reconstrução.

CHANGE-SUMMARY:
- Integrei na POC o bloqueador, o engine/mensagens de política, diagnóstico de aba, vínculo da instalação e bloqueio de rede por permissão de uso único, reutilizando os módulos existentes sem alterar regras.
- Acrescentei reconstrução espelhada apenas para snapshots de texto de mensagem assistente com status terminal reconhecido e exatamente um `[DONE]`. O observador aceita o candidato somente quando coincide com a resposta DOM observada e a associação não está ambígua. Esse texto é usado no mesmo `POST /response` para o backend/SQLite local; em qualquer outra condição, persiste o texto DOM pela rota atual.
- O popup registra somente a comparação e a seleção do candidato (`matched_dom` ou fallback), sem conteúdo de resposta. Confirmação de persistência continua sendo o evento `response: confirmed:...`. O fluxo original não é retido ou alterado.

FILES-CHANGED:
- Extensão/extension-network-poc/manifest.json
- Extensão/extension-network-poc/README.md
- Extensão/extension-network-poc/src/background/service-worker.js
- Extensão/extension-network-poc/src/content/blocker-main.js
- Extensão/extension-network-poc/src/content/blocker-bridge.js
- Extensão/extension-network-poc/src/content/network-probe-main.js
- Extensão/extension-network-poc/src/content/network-bridge.js
- Extensão/extension-network-poc/src/content/observer.js
- Extensão/extension-network-poc/src/content/platform.js
- Extensão/extension-network-poc/src/content/files.js
- Extensão/extension-network-poc/src/content/policy-engine.js
- Extensão/extension-network-poc/src/content/policy-messages.js
- Extensão/extension-network-poc/src/popup/diagnostics.html
- Extensão/extension-network-poc/src/popup/diagnostics.js
- Extensão/extension-network-poc/src/popup/diagnostics.css
- Extensão/extension-network-poc/tests/blocker.test.js
- Extensão/extension-network-poc/tests/manifest.test.js
- Extensão/extension-network-poc/tests/network-probe.test.js
- Extensão/extension-network-poc/tests/observer.test.js
- coordination/status/NETWORK-POC-0.3.0-codex.md
- coordination/retests/NETWORK-POC-0.3.0-work.md

TESTS-ADDED:
- Bloqueio por rede e eventos, decisão de política e liberação de uso único.
- Reconstrução de snapshot textual final, recusa sem fim explícito, aceitação de `[DONE]` seguido por `AbortError`, validação da ponte sem logging do texto, igualdade estrita com DOM e fallback em divergência.
- Manifest confirma scripts MAIN/ISOLATED, permissões e versão segregada da POC.

AUTOMATED-TEST-RESULT: `npm.cmd test` em `Extensão/extension-network-poc`: 35 testes passaram, 0 falhas.

RISKS:
- O formato do stream continua privado e pode mudar. O ensaio de rede independente não comprovou que a extensão atual estava carregada; a versão `0.3.0` ainda requer QA com extensão confirmada.
- A relação stream→prompt é por tentativa ativa e não é prova causal para regeneração, ferramentas ou múltiplos streams; qualquer ambiguidade causa fallback DOM.
- Este modo não retém a requisição, não implementa Buffered Mode e não declara a versão aprovada.

RETEST-INSTRUCTIONS: Seguir `coordination/retests/NETWORK-POC-0.3.0-work.md`. Carregar somente a pasta POC, confirmar `0.3.0` e `adapter_version=0.3.0-network`, verificar bloqueio de evento/rede e executar prompt de resposta sintética. Conferir no backend local se a mesma interação recebeu apenas uma resposta e comparar o diagnóstico de espelho com o texto persistido. Resultado independente do Work em `qa/results/`.
