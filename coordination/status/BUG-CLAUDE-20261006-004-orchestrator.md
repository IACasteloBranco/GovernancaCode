# BUG-CLAUDE-20261006-004 — Estado do Orchestrator

## Snapshot recebido

O Work entregou dois snapshots DOM semânticos sanitizados. Eles confirmam um Artifact renderizado por:

- contêiner acessível com rótulo `visualize: ...`;
- `iframe[title="Visualize Widget"]`;
- contêiner `.vis-container` com heading e tabela.

O conteúdo remoto do iframe foi deliberadamente omitido. A implementação deve capturar presença no hospedeiro, não atravessar o iframe.

## Estado

- BUG-004: `OPEN`, aguardando implementação.
- Reteste da `0.6.11`: continua pausado.
- Próxima versão candidata esperada: `0.6.12`.
- Direcionamento: `coordination/requests/BUG-CLAUDE-20261006-004-codex-snapshot.md`.
