BUG-ID: BUG-CLAUDE-20261006-001
STATUS: READY_FOR_RETEST
VERSION: 0.6.10
ROOT-CAUSE: O reteste anterior observou 0.6.9, então não confirmou que o runtime carregava a sanitização atualizada. A causa da contaminação no DOM real permanece por confirmar; o novo número de versão identifica sem ambiguidade o próximo runtime.
CHANGE-SUMMARY: Incrementada a versão pública para 0.6.10 no manifest, popup de diagnóstico e nos dois registros adapter_version (service worker e observer). Mantida a extração específica Claude que prioriza `.font-claude-response` e remove controles/elementos de interface da cópia. Adicionada asserção automatizada para consistência dos identificadores da versão.
FILES-CHANGED:
- Extensão/extension-prompt-block-poc/manifest.json
- Extensão/extension-prompt-block-poc/src/background/service-worker.js
- Extensão/extension-prompt-block-poc/src/content/observer.js
- Extensão/extension-prompt-block-poc/src/popup/diagnostics.js
- Extensão/extension-prompt-block-poc/tests/manifest.test.js
- Extensão/extension-prompt-block-poc/tests/platform.test.js
- Extensão/extension-prompt-block-poc/tests/files-browser.html
- Extensão/extension-prompt-block-poc/README.md
- docs/CLAUDE_E_ARQUIVOS_2026-10-05.md
- coordination/status/BUG-CLAUDE-20261006-001-codex.md
- coordination/retests/BUG-CLAUDE-20261006-001-0.6.10.md
TESTS-ADDED: Asserções garantem manifest, diagnóstico, service worker e observer em 0.6.10; teste unitário cobre remoção de rótulo acessível, ícones, botão e horário com preservação de parágrafos Markdown; fixture HTML cobre texto fiel, Markdown e resposta vazia com material.
AUTOMATED-TEST-RESULT: `npm.cmd test` executado em `Extensão/extension-prompt-block-poc`: 55 testes passaram, 0 falhas.
RETEST-INSTRUCTIONS:
1. No Chrome, abra `chrome://extensions` e remova a entrada antiga da POC integrada para evitar manter uma cópia 0.6.9 ativa.
2. Ative o modo do desenvolvedor, selecione **Carregar sem compactação** e escolha `C:\Users\eduardo.pires\Repos\Governanca_Code\Extensão\extension-prompt-block-poc`.
3. Confirme `0.6.10` na ficha da extensão. Abra o popup e confirme `Extensão: 0.6.10` no diagnóstico. Se algum ponto indicar 0.6.9, não execute o teste; corrija qual pasta/entrada está carregada.
4. Recarregue a aba do Claude depois de carregar a extensão. Execute o caso original por botão e depois por Enter usando `Responda exatamente com: QA-CLAUDE-BASE-01`.
5. Para cada envio, confira no SQLite/API `platform=claude_web`, `adapter_version=0.6.10`, estado da resposta e se `responses[].text` é exatamente `QA-CLAUDE-BASE-01`.
6. Se qualquer registro confirmar 0.6.10 e ainda tiver contaminação, preserve DOM/evidência sintética suficiente para investigação do contêiner real e registre FAIL; não marque o bug aprovado. Se falhar antes por versão 0.6.9, registre BLOCKED por build antiga carregada.
7. Registre resultado em `qa/results/`. A questão de CPF continua separada como `POLICY_QUESTION`.
