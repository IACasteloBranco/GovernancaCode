# Captura de prompt e resposta via stream — 2026-10-13

## Escopo

Extensão ativa `extension/` versão 0.4.0, Chrome já configurado pelo operador e backend local em `127.0.0.1:8000`. Entradas de ensaio exclusivamente sintéticas. Nenhuma política foi alterada.

## Resultados

| Caso | Esperado | Observado | Resultado |
|---|---|---|---|
| Texto curto com Unicode | Prompt pelo editor, resposta pelo SSE, mesma interação e atribuição | `CAJU 73 Ω` visível e idêntico em `responses.text`; `interactions.client_event_id = stream_captures.capture_id`; resposta `complete`; pessoa atribuída e fingerprint presentes | PASS |
| Espaços nas pontas do prompt após recarga final | Preservar exatamente o texto observado no editor | Editor com dois espaços antes e dois depois; `interactions.prompt_json.text` manteve ambos; `FIGO 91.` em `responses.text`, status `complete`, mesmo ID de correlação e atribuição presente | PASS |
| Markdown, lista, Unicode e código | Reconstrução preserva sintaxe e blocos | `# Frutas`, lista numerada `maçã`, `βeta`, `caju` e bloco `txt` com `A&B <C>` armazenados; 53 caracteres; UI renderizou os elementos correspondentes; resposta `complete` | PASS |
| Interrupção durante geração | Texto parcial vinculado ao prompt, sem classificar como completo | 2.508 caracteres armazenados em `responses.text`, status `incomplete`, 29 frames, nenhum `[DONE]`, leitor não encerrado normalmente | PASS |
| Regressão local | Política, ponte e parser preservados | `node --test --test-isolation=none extension/tests/*.test.mjs`: 21 testes passaram | PASS |
| Backend | Rotas, identidade e persistência | `.venv/Scripts/python.exe -m pytest -p no:cacheprovider tests -q --tb=short` em `backend/`: 18 testes passaram | PASS |

## Evidência e limitações

O SSE real do ensaio `UVA βeta 17` apresentou snapshot do assistente em `in_progress`, patches `/message/status=finished_successfully` e `/message/end_turn=true`, e um `[DONE]`; o texto visível coincidiu. Esse formato foi incluído no teste sintético do parser. A versão anterior da extensão ainda carregada no primeiro ensaio registrava apenas `stream_captures`; após o operador recarregar a extensão e autenticar novamente, os três ensaios acima produziram registros em `interactions` e `responses`.

O navegador bloqueou a automação de `chrome://extensions`; a recarga foi feita pelo operador. Não foram exercitados regeneração, respostas com ferramentas, múltiplos streams concorrentes ou mudança futura do protocolo DPU. Uma estrutura desconhecida permanece `incomplete` ou sem texto capturado, conforme a parte afetada.

Interações de evidência no SQLite: texto curto `7926172b-cb15-4b45-abf0-76f29a15a4b5`, espaços `76e1309e-5776-4083-9768-b198f5f18bc3`, Markdown `2b5a12d2-d60a-4a4b-90d4-d4252674a15e`, interrupção `17106fba-0905-40ae-b1d9-0635710c3041`. `graphify update .` concluiu; avisou apenas sobre diretórios de testes antigos sem permissão de leitura.
