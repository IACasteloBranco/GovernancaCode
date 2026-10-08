# Coordenação entre agentes

Este diretório é o canal oficial de comunicação entre Orchestrator, Codex e Work. Os artefatos são a fonte auditável do estado do trabalho.

## Fluxo de arquivos

1. O Orchestrator cria uma tarefa em `requests/`.
2. O Codex implementa e registra o resultado técnico em `status/`.
3. O Orchestrator cria o pedido de validação ou reteste em `retests/`.
4. O Work executa a validação e grava o resultado em `../qa/results/`.
5. Falhas são registradas em `../qa/bugs/` e retornam ao ciclo.

Não apagar artefatos históricos. Use IDs estáveis e registre versão/commit, estado, próxima ação e responsável.
