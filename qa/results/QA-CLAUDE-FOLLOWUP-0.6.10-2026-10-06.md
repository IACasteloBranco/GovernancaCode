# QA complementar — Claude 0.6.10

**Data:** 2026-10-06  
**Pedido:** `coordination/retests/BUG-CLAUDE-20261006-001-followup-0.6.10.md`  
**Site:** Claude (`claude.ai`)  
**Versão:** `0.6.10`, confirmada no manifest e em cada interação consultada no SQLite  
**Backend:** `127.0.0.1:8000`, health `ok`, `schema_version=0.1`  
**Dados:** prompts e conteúdos gerados sintéticos.

## Resultados por caso

| TEST-ID | Caso | Resultado observado | Estado |
|---|---|---|---|
| QA-CLAUDE-BASE-BUTTON-001 | Prompt original por botão | Resposta persistida igual ao texto visível: `QA-CLAUDE-BASE-01`. Interaction `6dae8458-127a-4f7b-8799-5897f8f04607`; `adapter_version=0.6.10`; `capture_status=incomplete` | `PASS` para fidelidade do texto |
| QA-CLAUDE-BASE-ENTER-001 | Prompt original por Enter | Resposta persistida igual ao texto visível: `QA-CLAUDE-BASE-01`. Interaction `2c0944f2-1f7f-4116-8cd9-54d5e64b4762`; `adapter_version=0.6.10`; `capture_status=incomplete` | `PASS` para fidelidade do texto |
| QA-CLAUDE-COMPLETION-001 | Estado de resposta curta após a interface indicar término | Botão e Enter mostraram “Claude terminou a resposta”, mas ambas as respostas ficaram `incomplete` no SQLite | `FAIL` |
| QA-CLAUDE-LONG-001 | Resposta longa sintética, 12 parágrafos | 5.713 caracteres; começa em `QA-LONG-START-01`, termina em `QA-LONG-END-01`, sem rótulo de interface; `capture_status=complete`. Interaction `fa8ad3e8-dbd8-4772-af31-694ad9ae8786` | `PASS` |
| QA-CLAUDE-INTERRUPT-001 | Interrupção manual durante resposta longa | A interface mostrou “A resposta do Claude foi interrompida”; 2.073 caracteres parciais, marcador inicial presente, marcador final ausente; `capture_status=incomplete`. Interaction `6a87572b-0ef5-4441-a06c-76eb1e2f86b2` | `PASS` |
| QA-CLAUDE-MARKDOWN-001 | Título, parágrafo, lista, tabela e bloco de código Markdown | A interface mostrou os componentes. SQLite omitiu `QA-MD-CODE`, achatou a tabela e acrescentou “O Claude trabalha diretamente com sua base de código”. Interaction `a7ef2fbd-1948-4f50-b589-48476a5ee788` | `FAIL` |
| QA-CLAUDE-MATERIAL-CSV-001 | Arquivo CSV sintético sem texto explicativo | Claude respondeu que o CSV foi criado, mas nenhum arquivo/cartão ficou visível; `generated_materials.capture_status=not_observed`. Interaction `5987a400-17fe-4214-8646-4956ae665b7b` | `BLOCKED` — material não foi exposto para validar captura |
| QA-CLAUDE-MATERIAL-ARTIFACT-001 | Artifact HTML visível; repetido com pedido sem texto explicativo | Dois Artifacts com tabelas sintéticas ficaram visíveis. Em ambos, SQLite registrou `generated_materials.capture_status=not_observed`. No caso sem prosa, `responses[].text` ficou `VvisualizeVvisualize show_widgetQA-MATERIAL-ONLY-01`. Interactions `b1141fa9-1166-4b4e-ba3e-f1cc045b1650` e `da9f2708-f1c1-4993-984c-3128ae554f36` | `FAIL` |

## Bugs registrados

- `BUG-CLAUDE-20261006-002` — estado `incomplete` apesar de a interface indicar conclusão; MEDIUM.
- `BUG-CLAUDE-20261006-003` — perda e contaminação da resposta em Markdown; MEDIUM.
- `BUG-CLAUDE-20261006-004` — Artifact visível não registrado como material e marcadores internos gravados como resposta; HIGH.

## Fechamento

- Casos: 8
- `PASS`: 4 (dois casos de fidelidade base, resposta longa e interrupção)
- `FAIL`: 3 (estado de conclusão, Markdown e captura do Artifact)
- `BLOCKED`: 1 (tentativa de CSV sem arquivo visível)
- `NOT_TESTED`: 0
- `POLICY_QUESTION`: 0
- Nenhum `CRITICAL` identificado; bugs abertos: 1 HIGH e 2 MEDIUM.

**Recomendação:** `REJECT` para aprovação da versão 0.6.10 até corrigir e retestar os três bugs abertos. Este resultado não reabre o bug original de fidelidade do texto simples, aprovado no escopo estreito do reteste anterior. Não alterei código nem política.
