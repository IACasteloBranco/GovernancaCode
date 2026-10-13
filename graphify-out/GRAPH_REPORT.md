# Graph Report - Governanca_Code  (2026-10-13)

## Corpus Check
- 136 files · ~120,374 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 19 file(s) not represented in the graph (top: .log 7, .css 5, (none) 3)

## Summary
- 881 nodes · 1435 edges · 109 communities (59 shown, 50 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 80 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `55d20ce8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- connect
- field_validator
- ref_node_assert
- server.py
- Método e resultados da captura de respostas
- Relatório experimental: reconstrução de respostas pelo stream
- answer-response-text.todo.md
- StreamCapturePersistenceTests
- extension/src/content/network-probe-main.js
- extension-network-poc-root-compat/src/background/service-worker.js
- extension-network-poc/src/background/service-worker.js
- Handoff — captura pareada de prompt, resposta e metadados
- extension-prompt-block-poc/src/background/service-worker.js
- extension/manifest.json
- extension/src/background/service-worker.js
- extension-network-poc-root-compat/manifest.json
- Extensão/extension/manifest.json
- extension-network-poc/manifest.json
- extension-prompt-block-poc/manifest.json
- extension-network-poc-root-compat/src/content/network-probe-main.js
- Documentation Index
- extension-network-poc/src/content/network-probe-main.js
- extension-prompt-block-poc/tests/observer.test.js
- extension/src/content/blocker-bridge.js
- extension-network-poc-root-compat/src/content/blocker-bridge.js
- extension-network-poc-root-compat/tests/observer.test.js
- extension-network-poc/src/content/blocker-bridge.js
- extension-network-poc/tests/observer.test.js
- POC integrada de captura, bloqueio e vínculo por instalação v0.6.13
- extension-prompt-block-poc/src/content/blocker-bridge.js
- extension/tests/observer.test.js
- extension/src/content/policy-engine.js
- policy-engine.test.mjs
- extension-network-poc-root-compat/src/content/policy-engine.js
- extension-network-poc/src/content/policy-engine.js
- extension-prompt-block-poc/src/content/observer.js
- extension-prompt-block-poc/src/content/policy-engine.js
- policy-engine.test.js
- Extensão/extension/src/background/service-worker.js
- extension-network-poc-root-compat/package.json
- Captura de prompt e resposta via stream — 2026-10-13
- extension-network-poc-root-compat/src/content/observer.js
- extension-network-poc-root-compat/tests/network-probe.test.js
- extension-network-poc/package.json
- POC experimental de bloqueio e espelhamento de rede — 0.3.3
- extension-network-poc/src/content/observer.js
- extension-network-poc/tests/network-probe.test.js
- extension/package.json
- extension-prompt-block-poc/package.json
- extension/src/content/observer.js
- extension-network-poc-root-compat/src/popup/diagnostics.js
- extension-network-poc/src/popup/diagnostics.js
- DOM Metadata Test Snapshot: 14 Passed, Streaming Error
- extension-prompt-block-poc/src/popup/diagnostics.js
- Extensão de laboratório v0.1.11
- extension/src/content/policy-messages.js
- popup.js
- extension-network-poc-root-compat/src/content/policy-messages.js
- extension-network-poc/src/content/policy-messages.js
- extension-prompt-block-poc/src/content/policy-messages.js
- extension/src/popup/diagnostics.js
- layout-reorg.todo.md
- ports-fetch.todo.md
- Governance Separation of Duties
- QA States and Version Completion Criteria
- ChatGPT Assistant Message DOM Markers
- Backend runtime dependencies
- regeneration-policy.test.mjs
- validation_error_handler
- test_api.py
- Captura de regeneração, ferramentas e streams simultâneas — 2026-10-13
- Plano de análise da efetividade e dos dados do MVP
- test_machine_identity.py
- machine_identity.py
- candidate-network.md
- Selected design: prompt attachment metadata
- main.py
- extension/src/content/files.js
- attachment-metadata-consolidation.todo.md
- judge.md
- schemas.py
- Captura de metadados de anexos no prompt — 2026-10-13
- QA tipo 20261008 sample
- Teste captura sample
- Anthropic Cookie Consent Snapshot
- DOM Metadata Test Snapshot: 14 Passed, Streaming Error
- DOM Metadata Test Snapshot: 21 Passed
- DOM Metadata Test Snapshot: 23 Passed
- Logged-Out ChatGPT Home Page Snapshot

## God Nodes (most connected - your core abstractions)
1. `connect()` - 28 edges
2. `Settings` - 24 edges
3. `get_settings()` - 23 edges
4. `StreamCapturePersistenceTests` - 23 edges
5. `utc_now()` - 17 edges
6. `iso()` - 17 edges
7. `create_interaction()` - 14 edges
8. `Handoff — captura pareada de prompt, resposta e metadados` - 14 edges
9. `clean_expired()` - 13 edges
10. `create_response()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Achado no código ativo` --references--> `InteractionCreate`  [INFERRED]
  .audit/attachment-metadata/candidate-network.md → backend/app/schemas.py
- `Evidence from active files` --references--> `AttachmentMetadata`  [INFERRED]
  .audit/attachment-metadata/candidate-dom.md → backend/app/schemas.py
- `Menor desenho` --references--> `InteractionDetail`  [INFERRED]
  .audit/attachment-metadata/candidate-network.md → backend/app/schemas.py
- `Menor desenho` --references--> `arrayBuffer()`  [INFERRED]
  .audit/attachment-metadata/candidate-network.md → extension/tests/files.test.mjs
- `initialize()` --uses--> `Settings`  [INFERRED]
  backend/app/db.py → backend/app/settings.py

## Import Cycles
- None detected.

## Communities (109 total, 50 thin omitted)

### Community 0 - "connect"
Cohesion: 0.15
Nodes (15): connect(), json_dump(), project_id_from_url(), create_artifact_metadata(), create_interaction(), create_response(), create_stream_capture(), get_interaction() (+7 more)

### Community 1 - "field_validator"
Cohesion: 0.09
Nodes (7): Alternative and uncertainty, Evidence from active files, Smallest design, Touch points, ArtifactMetadataCreate, AttachmentMetadata, StreamCaptureCreate

### Community 3 - "server.py"
Cohesion: 0.15
Nodes (8): connect(), Handler, main(), store_artifact_metadata(), store_capture(), token_matches(), validate(), validate_artifact_metadata()

### Community 4 - "Método e resultados da captura de respostas"
Cohesion: 0.06
Nodes (34): Acesso à aba e diferença em relação à extensão, Conclusão do ensaio de arquivos, CSV, Documentos de referência, Ensaio 6: CSV e PDF, Ensaios adicionais em conversa independente e interrupções — 8 de outubro de 2026, Formatos e reconstrução, Identificadores (+26 more)

### Community 5 - "Relatório experimental: reconstrução de respostas pelo stream"
Cohesion: 0.08
Nodes (24): Captura anterior — formação de nuvem, Captura direta mais recente, Curta — 2 parágrafos, Ensaio exploratório — volume e tamanho das respostas, Ensaios via CDP na aba autenticada — 2026-10-08, Evidência auxiliar — rede, DOM e primeira visibilidade, Evidência mais forte até agora, Evidências históricas e ensaios auxiliares (+16 more)

### Community 8 - "extension/src/content/network-probe-main.js"
Cohesion: 0.20
Nodes (18): apply(), artifactTarget(), captureArtifactMetadata(), captureAttempt(), captureDownloadHeaders(), construct(), dispositionFileName(), emit() (+10 more)

### Community 9 - "extension-network-poc-root-compat/src/background/service-worker.js"
Cohesion: 0.21
Nodes (15): broadcastPolicy(), dispatch(), ensureMachineKey(), hex(), loadMachineAssignment(), log(), logging, logProbe() (+7 more)

### Community 10 - "extension-network-poc/src/background/service-worker.js"
Cohesion: 0.21
Nodes (15): broadcastPolicy(), dispatch(), ensureMachineKey(), hex(), loadMachineAssignment(), log(), logging, logProbe() (+7 more)

### Community 11 - "Handoff — captura pareada de prompt, resposta e metadados"
Cohesion: 0.13
Nodes (14): Ambiente e notas de execução, Classificação de AbortError após marcador terminal — versão 0.1.14, Como retomar em outro chat, Conclusão técnica, Estado atual, Handoff — captura pareada de prompt, resposta e metadados, Identidade por instalação e bloqueio por regex — versão 0.3.0, Integração de captura de prompt e resposta — versão 0.1.13 (+6 more)

### Community 12 - "extension-prompt-block-poc/src/background/service-worker.js"
Cohesion: 0.24
Nodes (13): broadcastPolicy(), dispatch(), ensureMachineKey(), hex(), loadMachineAssignment(), log(), logging, machineHeaders() (+5 more)

### Community 13 - "extension/manifest.json"
Cohesion: 0.15
Nodes (12): action, default_popup, background, service_worker, type, content_scripts, description, host_permissions (+4 more)

### Community 14 - "extension/src/background/service-worker.js"
Cohesion: 0.19
Nodes (11): broadcastPolicy(), ensureMachineKey(), hex(), loadMachineAssignment(), machineHeaders(), policyPorts, ready, registerAndLoadMachine() (+3 more)

### Community 15 - "extension-network-poc-root-compat/manifest.json"
Cohesion: 0.15
Nodes (12): action, default_popup, background, service_worker, type, content_scripts, description, host_permissions (+4 more)

### Community 16 - "Extensão/extension/manifest.json"
Cohesion: 0.15
Nodes (12): action, default_popup, background, service_worker, type, content_scripts, description, host_permissions (+4 more)

### Community 17 - "extension-network-poc/manifest.json"
Cohesion: 0.15
Nodes (12): action, default_popup, background, service_worker, type, content_scripts, description, host_permissions (+4 more)

### Community 18 - "extension-prompt-block-poc/manifest.json"
Cohesion: 0.15
Nodes (12): action, default_popup, background, service_worker, type, content_scripts, description, host_permissions (+4 more)

### Community 19 - "extension-network-poc-root-compat/src/content/network-probe-main.js"
Cohesion: 0.33
Nodes (9): activeAttempt(), apply(), construct(), emit(), inspectConversation(), emitCapture(), observe(), shapeOf() (+1 more)

### Community 20 - "Documentation Index"
Cohesion: 0.06
Nodes (39): Backend da POC de GovernanÃ§a de IA, Lab API for synthetic interactions, Machine signature and person assignment, Seven-day data retention, Claude and File Metadata Capture History, File Observation Evidence Levels, Current POC State as of 2026-10-01, Comece pelas regras e pelo contexto (+31 more)

### Community 21 - "extension-network-poc/src/content/network-probe-main.js"
Cohesion: 0.33
Nodes (9): activeAttempt(), apply(), construct(), emit(), inspectConversation(), emitCapture(), observe(), shapeOf() (+1 more)

### Community 22 - "extension-prompt-block-poc/tests/observer.test.js"
Cohesion: 0.47
Nodes (6): setup(), clickLabeledSend(), clickSend(), flush(), pressEnter(), submitForm()

### Community 23 - "extension/src/content/blocker-bridge.js"
Cohesion: 0.46
Nodes (7): connect(), inspect(), logDecision(), resetGrant(), showNotice(), stop(), verifyMain()

### Community 24 - "extension-network-poc-root-compat/src/content/blocker-bridge.js"
Cohesion: 0.46
Nodes (7): connect(), inspect(), logDecision(), resetGrant(), showNotice(), stop(), verifyMain()

### Community 25 - "extension-network-poc-root-compat/tests/observer.test.js"
Cohesion: 0.50
Nodes (5): setup(), clickSend(), flush(), pressEnter(), submitForm()

### Community 26 - "extension-network-poc/src/content/blocker-bridge.js"
Cohesion: 0.46
Nodes (7): connect(), inspect(), logDecision(), resetGrant(), showNotice(), stop(), verifyMain()

### Community 27 - "extension-network-poc/tests/observer.test.js"
Cohesion: 0.50
Nodes (5): setup(), clickSend(), flush(), pressEnter(), submitForm()

### Community 28 - "POC integrada de captura, bloqueio e vínculo por instalação v0.6.13"
Cohesion: 0.25
Nodes (7): Claude e arquivos, Fluxo, Limites, POC integrada de captura, bloqueio e vínculo por instalação v0.6.13, Regras implementadas, Teste no Chrome, Vínculo da instalação à pessoa

### Community 29 - "extension-prompt-block-poc/src/content/blocker-bridge.js"
Cohesion: 0.46
Nodes (7): connect(), inspect(), logDecision(), resetGrant(), showNotice(), stop(), verifyMain()

### Community 30 - "extension/tests/observer.test.js"
Cohesion: 0.50
Nodes (5): setup(), clickSend(), flush(), pressEnter(), submitForm()

### Community 32 - "extension/src/content/policy-engine.js"
Cohesion: 0.60
Nodes (5): distinctMatches(), evaluate(), normalize(), validCnpj(), validCpf()

### Community 34 - "extension-network-poc-root-compat/src/content/policy-engine.js"
Cohesion: 0.60
Nodes (5): distinctMatches(), evaluate(), normalize(), validCnpj(), validCpf()

### Community 35 - "extension-network-poc/src/content/policy-engine.js"
Cohesion: 0.60
Nodes (5): distinctMatches(), evaluate(), normalize(), validCnpj(), validCpf()

### Community 36 - "extension-prompt-block-poc/src/content/observer.js"
Cohesion: 0.60
Nodes (5): attempt(), captureDiagnostics(), finish(), observeAnswer(), updateAnswer()

### Community 37 - "extension-prompt-block-poc/src/content/policy-engine.js"
Cohesion: 0.60
Nodes (5): distinctMatches(), evaluate(), normalize(), validCnpj(), validCpf()

### Community 39 - "Extensão/extension/src/background/service-worker.js"
Cohesion: 0.47
Nodes (5): dispatch(), log(), logging, ready, request()

### Community 40 - "extension-network-poc-root-compat/package.json"
Cohesion: 0.40
Nodes (4): private, scripts, test, type

### Community 41 - "Captura de prompt e resposta via stream — 2026-10-13"
Cohesion: 0.40
Nodes (4): Captura de prompt e resposta via stream — 2026-10-13, Escopo, Evidência e limitações, Resultados

### Community 42 - "extension-network-poc-root-compat/src/content/observer.js"
Cohesion: 0.70
Nodes (4): attempt(), captureDiagnostics(), finish(), observeAnswer()

### Community 44 - "extension-network-poc/package.json"
Cohesion: 0.40
Nodes (4): private, scripts, test, type

### Community 45 - "POC experimental de bloqueio e espelhamento de rede — 0.3.3"
Cohesion: 0.40
Nodes (4): Carregar e configurar, Limites e diagnóstico, O que faz, POC experimental de bloqueio e espelhamento de rede — 0.3.3

### Community 46 - "extension-network-poc/src/content/observer.js"
Cohesion: 0.70
Nodes (4): attempt(), captureDiagnostics(), finish(), observeAnswer()

### Community 48 - "extension/package.json"
Cohesion: 0.40
Nodes (4): private, scripts, test, type

### Community 49 - "extension-prompt-block-poc/package.json"
Cohesion: 0.40
Nodes (4): private, scripts, test, type

### Community 50 - "extension/src/content/observer.js"
Cohesion: 0.70
Nodes (4): attempt(), captureDiagnostics(), finish(), observeAnswer()

### Community 51 - "extension-network-poc-root-compat/src/popup/diagnostics.js"
Cohesion: 0.83
Nodes (3): probeCurrentTab(), refresh(), send()

### Community 52 - "extension-network-poc/src/popup/diagnostics.js"
Cohesion: 0.83
Nodes (3): probeCurrentTab(), refresh(), send()

### Community 53 - "DOM Metadata Test Snapshot: 14 Passed, Streaming Error"
Cohesion: 0.40
Nodes (5): DOM Metadata Test Snapshot: 10 Passed, DOM Metadata Test Snapshot: 14 Passed, Streaming Error, DOM Metadata Test Snapshot: 15 Passed, DOM Metadata Test Snapshot: 18 Passed, DOM Metadata Test Snapshot: 19 Passed

### Community 54 - "extension-prompt-block-poc/src/popup/diagnostics.js"
Cohesion: 0.83
Nodes (3): probeCurrentTab(), refresh(), send()

### Community 56 - "Extensão de laboratório v0.1.11"
Cohesion: 0.50
Nodes (3): Extensão de laboratório v0.1.11, Limites da primeira implementação, Verificação

### Community 86 - "test_api.py"
Cohesion: 0.16
Nodes (14): fingerprint(), client(), interaction_payload(), test_file_metadata_and_material_only_response_roundtrip(), test_files_reject_binary_fields_and_invalid_observations(), test_incomplete_response_and_unknown_interaction_are_explicit(), test_interaction_is_persisted_idempotently_and_conflicts_on_changed_payload(), test_migration_preserves_old_records_with_unknown_file_observation() (+6 more)

### Community 88 - "Captura de regeneração, ferramentas e streams simultâneas — 2026-10-13"
Cohesion: 0.40
Nodes (4): Captura de regeneração, ferramentas e streams simultâneas — 2026-10-13, Escopo, Implementação e limites, Resultados

### Community 89 - "Plano de análise da efetividade e dos dados do MVP"
Cohesion: 0.10
Nodes (18): 1. Fixar os critérios e os contextos, 2. Medir a captura atual, 3. Fechar as lacunas do contrato de dados, 4. Validar retenção e volume, 5. Preparar a análise de inteligência da empresa, Critério para declarar o MVP local válido, Decisões de governança pendentes, Escopo do MVP local (+10 more)

### Community 90 - "test_machine_identity.py"
Cohesion: 0.26
Nodes (15): clean_expired(), iso(), utc_now(), get_settings(), main(), b64(), client(), key_material() (+7 more)

### Community 91 - "machine_identity.py"
Cohesion: 0.18
Nodes (6): _decode(), enroll_machine(), key_fingerprint(), Machine, public_key_from_jwk(), require_machine_signature()

### Community 93 - "candidate-network.md"
Cohesion: 0.25
Nodes (7): Achado no código ativo, Alternativa considerada, Critério sintético para declarar o fluxo funcional, Incertezas e limite de comprovação, Menor desenho, Pontos exatos a tocar, arrayBuffer()

### Community 94 - "Selected design: prompt attachment metadata"
Cohesion: 0.33
Nodes (5): Accepted footprint, Constraints, Selected design: prompt attachment metadata, Synthesis decision, Usage contract

### Community 95 - "main.py"
Cohesion: 0.17
Nodes (4): initialize(), lifespan(), retention_loop(), require_lab_token()

### Community 97 - "extension/src/content/files.js"
Cohesion: 0.83
Nodes (3): fileMetadata(), observe(), visibleCardMetadata()

### Community 100 - "schemas.py"
Cohesion: 0.28
Nodes (11): EventRecord, FileObservation, HealthResponse, InteractionAccepted, InteractionCreate, InteractionDetail, ObservedField, PromptField (+3 more)

### Community 101 - "Captura de metadados de anexos no prompt — 2026-10-13"
Cohesion: 0.33
Nodes (5): Captura de metadados de anexos no prompt — 2026-10-13, Contrato implementado, Escopo, Limites e próximos passos, Resultado

## Knowledge Gaps
- **24 isolated node(s):** `QA tipo 20261008 sample`, `Teste captura sample`, `Anthropic Cookie Consent Snapshot`, `DOM Metadata Test Snapshot: 14 Passed, Streaming Error`, `DOM Metadata Test Snapshot: 21 Passed` (+19 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 382 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **50 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Menor desenho` connect `candidate-network.md` to `schemas.py`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Are the 15 inferred relationships involving `Settings` (e.g. with `clean_expired()` and `connect()`) actually correct?**
  _`Settings` has 15 INFERRED edges - model-reasoned connections that need verification._
- **What connects `QA tipo 20261008 sample`, `Teste captura sample`, `Anthropic Cookie Consent Snapshot` to the rest of the system?**
  _24 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `field_validator` be split into smaller, more focused modules?**
  _Cohesion score 0.08866995073891626 - nodes in this community are weakly interconnected._
- **Why does `arrayBuffer()` connect `candidate-network.md` to `ref_node_assert`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Should `ref_node_assert` be split into smaller, more focused modules?**
  _Cohesion score 0.12380952380952381 - nodes in this community are weakly interconnected._
- **Why does `InteractionDetail` connect `schemas.py` to `connect`, `candidate-network.md`, `main.py`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._