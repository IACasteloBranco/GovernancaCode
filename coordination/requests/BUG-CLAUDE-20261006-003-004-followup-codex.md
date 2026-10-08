# Novo direcionamento ao Codex — BUG-003 e BUG-004 após QA 0.6.12

## BUG-003 — Markdown

O reteste em `0.6.12` confirmou que a UI exibiu o bloco de código e o marcador `QA-MD-CODE-0612`, mas o SQLite omitiu esse bloco. A lista, células e separadores de tabela foram preservados.

- **Interaction:** `e389a608-ee1f-4273-8942-c32690a50fc3`
- **Estado:** `FAIL`
- **Direção:** revisar a serialização do contêiner Markdown para preservar `pre/code` e seu texto, sem reintroduzir conteúdo adjacente da interface.
- Adicionar fixture/teste com bloco de código e confirmar `QA-MD-CODE-0612` no payload.

## BUG-004 — Artifacts

O reteste em `0.6.12` confirmou dois Artifacts HTML visíveis, mas ambos foram registrados como `generated_materials.capture_status=not_observed`, sem itens.

- **Interactions:** `216bcfa5-824d-4b22-96fd-f71fe43da181` e `d82892f8-d4c7-4a44-8c7e-953a242f97b9`
- **Estado:** `FAIL`, prioridade HIGH
- **Direção:** revisar a associação entre o host `iframe[title="Visualize Widget"]` e o contêiner da mensagem efetivamente selecionado em runtime. Preservar `presence_only`, sem acessar o iframe remoto.
- Manter o teste de menção comum sem widget e o teste de isolamento de material antigo.
- Se o host estiver fora do nó retornado por `platform.messages()`, ajustar a delimitação da mensagem atual com base no DOM observado, sem usar busca global que possa associar material antigo.

## Requisitos

- Não alterar política.
- Não reabrir BUG-001 nem alterar BUG-002 por causa desta rodada.
- Produzir nova versão identificável, preferencialmente `0.6.13`.
- Executar `npm.cmd test` e incluir fixture de navegador semântica para Markdown e Artifact.
- Retornar `READY_FOR_RETEST` somente após testes automatizados passarem.
