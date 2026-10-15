# Graph Report - Governanca_Code  (2026-10-14)

## Corpus Check
- 145 files · ~131,793 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 19 file(s) not represented in the graph (top: .log 7, .css 5, (none) 3)

## Summary
- 979 nodes · 1552 edges · 121 communities (70 shown, 51 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 93 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e29eb3b4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- main.py
- schemas.py
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
- Plano de infraestrutura do MVP no Google Cloud
- Fluxo de trabalho
- README.md
- Captura de regeneração, ferramentas e streams simultâneas — 2026-10-13
- Plano de análise da efetividade e dos dados do MVP
- Attachment metadata selection cache design
- attachment-metadata-event-cache.todo.md
- validation_error_handler
- Backend da POC de GovernanÃ§a de IA
- Selected design: prompt attachment metadata
- POC experimental de bloqueio e espelhamento de rede — 0.3.3
- files.test.mjs
- ChatGPT Network Capture POC
- Attachment metadata consolidation
- judge.md
- Captura local de prompt e resposta
- extension/src/content/files.js
- Candidate B: a separate observation of conversation context
- test_machine_identity.py
- test_api.py
- db.py
- machine_identity.py
- Candidate A — Extend the existing artifact observation
- Candidate C: link artifacts to the observed conversation
- 2026-10-14-metadados-arquivos-gerados.md
- QA tipo 20261008 sample
- Teste captura sample
- candidate-network.md
- candidate-dom.md
- Generated artifact metadata
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
9. `Documentation Index` - 14 edges
10. `clean_expired()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Shape` --references--> `create_artifact_metadata()`  [INFERRED]
  .audit/generated-artifact-metadata/candidates/candidate-a.md → backend/app/main.py
- `Repeated-file batch retest` --references--> `AttachmentMetadata`  [INFERRED]
  .audit/2026-10-14-upload-correlation.todo.md → backend/app/schemas.py
- `Evidence from active files` --references--> `AttachmentMetadata`  [INFERRED]
  .audit/attachment-metadata/candidate-dom.md → backend/app/schemas.py
- `Achado no código ativo` --references--> `InteractionCreate`  [INFERRED]
  .audit/attachment-metadata/candidate-network.md → backend/app/schemas.py
- `Grounded flow and ownership` --references--> `ArtifactMetadataCreate`  [INFERRED]
  .audit/generated-artifact-metadata/candidates/candidate-b.md → backend/app/schemas.py

## Import Cycles
- None detected.

## Communities (121 total, 51 thin omitted)

### Community 0 - "main.py"
Cohesion: 0.12
Nodes (19): connect(), initialize(), json_dump(), project_id_from_url(), create_artifact_metadata(), create_interaction(), create_response(), create_stream_capture() (+11 more)

### Community 1 - "schemas.py"
Cohesion: 0.10
Nodes (15): ArtifactMetadataCreate, AttachmentMetadata, ConversationContext, EventRecord, FileObservation, HealthResponse, InteractionAccepted, InteractionCreate (+7 more)

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
Cohesion: 0.21
Nodes (17): apply(), artifactTarget(), captureAttempt(), captureDownloadHeaders(), construct(), conversationContext(), dispositionFileName(), emit() (+9 more)

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
Cohesion: 0.11
Nodes (17): Clipboard paste follow-up, Diagnostic retention follow-up, Evidence, Repeated-file batch retest, Upload correlation retest, broadcastPolicy(), ensureMachineKey(), hex() (+9 more)

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
Cohesion: 0.27
Nodes (13): Claude and File Metadata Capture History, File Observation Evidence Levels, Current POC State as of 2026-10-01, Button and Enter Submission Validation, B01 and B02 Prompt Capture Procedure, Backend POC Deployment Plan, Local and Internal Lab Backend Architecture, Extension POC Deployment Plan (+5 more)

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

### Community 85 - "Plano de infraestrutura do MVP no Google Cloud"
Cohesion: 0.18
Nodes (11): Acesso e segurança, Ajustes necessários na aplicação, Arquitetura proposta, Componentes, Critérios para iniciar o piloto, Custos e oferta gratuita, Decisões pendentes, Etapas de implantação (+3 more)

### Community 86 - "Fluxo de trabalho"
Cohesion: 0.29
Nodes (6): Comece pelas regras e pelo contexto, Escolha a abordagem, Fluxo de trabalho, Implemente e verifique, Papel das pastas existentes, Registre o resultado

### Community 87 - "README.md"
Cohesion: 0.29
Nodes (5): Archived versions, Contents, Governança de IA, Stack ativa, Versões anteriores

### Community 88 - "Captura de regeneração, ferramentas e streams simultâneas — 2026-10-13"
Cohesion: 0.40
Nodes (4): Captura de regeneração, ferramentas e streams simultâneas — 2026-10-13, Escopo, Implementação e limites, Resultados

### Community 89 - "Plano de análise da efetividade e dos dados do MVP"
Cohesion: 0.10
Nodes (18): 1. Fixar os critérios e os contextos, 2. Medir a captura atual, 3. Fechar as lacunas do contrato de dados, 4. Validar retenção e volume, 5. Preparar a análise de inteligência da empresa, Critério para declarar o MVP local válido, Decisões de governança pendentes, Escopo do MVP local (+10 more)

### Community 90 - "Attachment metadata selection cache design"
Cohesion: 0.29
Nodes (6): Attachment metadata selection cache design, Candidates, Data shape, Decision, Limits, Usage sketch

### Community 93 - "Backend da POC de GovernanÃ§a de IA"
Cohesion: 0.40
Nodes (4): Backend da POC de GovernanÃ§a de IA, Lab API for synthetic interactions, Machine signature and person assignment, Seven-day data retention

### Community 94 - "Selected design: prompt attachment metadata"
Cohesion: 0.33
Nodes (5): Accepted footprint, Constraints, Selected design: prompt attachment metadata, Synthesis decision, Usage contract

### Community 95 - "POC experimental de bloqueio e espelhamento de rede — 0.3.3"
Cohesion: 0.40
Nodes (4): Carregar e configurar, Limites e diagnóstico, O que faz, POC experimental de bloqueio e espelhamento de rede — 0.3.3

### Community 97 - "ChatGPT Network Capture POC"
Cohesion: 0.50
Nodes (3): ChatGPT Network Capture POC, Policy Rule Actions and Decision Priority, Prompt Blocking Policy 0.1

### Community 100 - "Captura local de prompt e resposta"
Cohesion: 0.50
Nodes (4): Captura local de prompt e resposta, Limites, Usar, Verificação

### Community 101 - "extension/src/content/files.js"
Cohesion: 0.14
Nodes (22): consume(), fileMetadata(), observe(), rememberDrop(), rememberPaste(), rememberSelection(), syncRoute(), visibleCardMetadata() (+14 more)

### Community 102 - "Candidate B: a separate observation of conversation context"
Cohesion: 0.14
Nodes (13): Alternatives considered, Candidate B: a separate observation of conversation context, Grounded flow and ownership, Implementation reconciliation, Next implementation step, Open questions and risks, Problem, Rubric check (+5 more)

### Community 103 - "test_machine_identity.py"
Cohesion: 0.26
Nodes (15): clean_expired(), iso(), utc_now(), get_settings(), main(), b64(), client(), key_material() (+7 more)

### Community 104 - "test_api.py"
Cohesion: 0.17
Nodes (13): fingerprint(), client(), interaction_payload(), test_file_metadata_and_material_only_response_roundtrip(), test_files_reject_binary_fields_and_invalid_observations(), test_incomplete_response_and_unknown_interaction_are_explicit(), test_interaction_is_persisted_idempotently_and_conflicts_on_changed_payload(), test_old_fingerprints_remain_idempotent_after_metadata_upgrade() (+5 more)

### Community 106 - "machine_identity.py"
Cohesion: 0.18
Nodes (6): _decode(), enroll_machine(), key_fingerprint(), Machine, public_key_from_jwk(), require_machine_signature()

### Community 107 - "Candidate A — Extend the existing artifact observation"
Cohesion: 0.15
Nodes (12): Alternatives considered, Candidate A — Extend the existing artifact observation, Implementation reconciliation, Next implementation step, Open questions and risks, Problem, Red-flag screen and rubric, Shape (+4 more)

### Community 108 - "Candidate C: link artifacts to the observed conversation"
Cohesion: 0.17
Nodes (11): Alternatives considered, Candidate C: link artifacts to the observed conversation, Candidate self-grade, Implementation reconciliation, Next implementation step, Open questions and risks, Problem, Shape (+3 more)

### Community 109 - "2026-10-14-metadados-arquivos-gerados.md"
Cohesion: 0.40
Nodes (4): Network observation, Privacy change, Uploaded file retest, Verification

### Community 112 - "candidate-network.md"
Cohesion: 0.25
Nodes (7): Achado no código ativo, Alternativa considerada, Critério sintético para declarar o fluxo funcional, Incertezas e limite de comprovação, Menor desenho, Pontos exatos a tocar, arrayBuffer()

### Community 113 - "candidate-dom.md"
Cohesion: 0.40
Nodes (4): Alternative and uncertainty, Evidence from active files, Smallest design, Touch points

### Community 114 - "Generated artifact metadata"
Cohesion: 0.40
Nodes (4): Design arena, Findings, Generated artifact metadata, Task

## Knowledge Gaps
- **24 isolated node(s):** `QA tipo 20261008 sample`, `Teste captura sample`, `Anthropic Cookie Consent Snapshot`, `DOM Metadata Test Snapshot: 14 Passed, Streaming Error`, `DOM Metadata Test Snapshot: 21 Passed` (+19 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 450 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **51 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Menor desenho` connect `candidate-network.md` to `schemas.py`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Are the 15 inferred relationships involving `Settings` (e.g. with `clean_expired()` and `connect()`) actually correct?**
  _`Settings` has 15 INFERRED edges - model-reasoned connections that need verification._
- **What connects `QA tipo 20261008 sample`, `Teste captura sample`, `Anthropic Cookie Consent Snapshot` to the rest of the system?**
  _24 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `main.py` be split into smaller, more focused modules?**
  _Cohesion score 0.12312312312312312 - nodes in this community are weakly interconnected._
- **Why does `InteractionDetail` connect `schemas.py` to `candidate-network.md`, `main.py`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Should `schemas.py` be split into smaller, more focused modules?**
  _Cohesion score 0.09851551956815115 - nodes in this community are weakly interconnected._
- **Why does `arrayBuffer()` connect `candidate-network.md` to `files.test.mjs`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._