# Codex status — captura pareada de prompt e resposta na POC de stream

**WORK-ID:** PROMPT-RESPONSE-STREAM-0.1.13  
**DATA:** 2026-10-08  
**STATUS:** READY_FOR_RETEST

## CHANGE-SUMMARY

Portado para a POC de stream o mecanismo de captura de prompt do observador existente. Com a captura ativada, o bridge observa envio por botão, Enter ou submit, lê o texto do editor e mantém o valor apenas em memória transitória da aba. No início da próxima requisição `POST /backend-api/f/conversation`, associa o prompt ao `attemptId` aleatório da tentativa. Quando a resposta reconstruída é persistida, `prompt_text` e `response_text` ficam juntos na mesma linha SQLite.

O backend migra o banco existente adicionando `prompt_text`; registros antigos ficam nulos e payloads 0.1.12 continuam aceitos. O endpoint autenticado de capturas recentes inclui os dois campos. Nenhum ID de conversa, URL, pessoa, conta ou máquina foi acrescentado. A POC continua em `127.0.0.1`, com captura opt-in e uso de dados sintéticos.

## FILES-CHANGED

- `governanca-main/governanca-main/stream-capture-poc/extension/manifest.json` (0.1.13)
- `governanca-main/governanca-main/stream-capture-poc/extension/src/content/network-bridge.js`
- `governanca-main/governanca-main/stream-capture-poc/extension/src/background/service-worker.js`
- `governanca-main/governanca-main/stream-capture-poc/extension/tests/prompt-correlation.test.mjs`
- `governanca-main/governanca-main/stream-capture-poc/backend/server.py`
- `governanca-main/governanca-main/stream-capture-poc/backend/tests/test_server.py`
- `governanca-main/governanca-main/stream-capture-poc/README.md`
- `governanca-main/governanca-main/stream-capture-poc/PROGRESSO_TESTES_CAPTURA.md`

## TESTS-ADDED / RESULTS

- Node: envio por botão, Enter e submit; associação ao stream seguinte; pausa limpa o prompt pendente — 3 novos testes `PASS`.
- Regressão Node dos metadados — 3 testes `PASS`.
- Backend: persistência conjunta, compatibilidade com payload sem prompt, limites do texto e regressão de stream/metadados — 11 testes `PASS`.
- `node --check` dos scripts da extensão e testes — `PASS`.
- SQLite local migrou: coluna `prompt_text` presente; 22 registros existentes preservados com prompt nulo.
- API reiniciada; `/health` responde `schema_version=stream-capture-0.3`; rota autenticada inclui o campo `prompt_text`.
- Navegador real 0.1.13 — `NOT_TESTED`.

## RISKS

- A associação usa sequência temporal entre o evento de envio no editor e o início do stream, sem persistir ID de conversa. Mudanças nos seletores ou fluxos múltiplos de stream podem produzir prompt nulo ou associação incorreta; reteste de navegador é necessário.
- O prompt completo passa a ser persistido quando a captura opt-in está ativa. Usar apenas conteúdo sintético na POC. Os registros são obtidos pela API local autenticada e não são exibidos como histórico no popup.
- Esta implementação não adiciona identidade de máquina, cadastro corporativo, controle de acesso administrativo nem armazenamento remoto. A decisão de arquitetura de máquina permanece em aberto.

## RETEST-INSTRUCTIONS

1. Recarregar a extensão e a aba ChatGPT; confirmar versão 0.1.13 e API `/health` 0.3.
2. Ativar a captura e enviar um prompt sintético por botão. Confirmar uma linha recente com `prompt_text` e `response_text` pareados.
3. Repetir por Enter e verificar o segundo par.
4. Pausar antes de um novo envio e confirmar que não foi criado novo registro.
5. Usar somente prompts/respostas sintéticos; não avaliar aprovação de política ou rollout neste reteste.
