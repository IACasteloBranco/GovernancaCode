# QA

Este diretório concentra casos e artefatos de validação independentes da implementação.

## Localização atual

- Roteiros manuais: `docs/ROTEIRO_VALIDACAO_LOCAL_POC_v0.1.md` e `docs/PASSO_A_PASSO_B01_B02_POC_v0.1.md`.
- Testes automatizados da extensão: `Extensão/extension-prompt-block-poc/tests/`.
- Testes automatizados do backend: `backend/tests/`.
- Fixture DOM para arquivos: `Extensão/extension-prompt-block-poc/tests/files-browser.html`.

O agente Work deve registrar cada execução com `PASS`, `FAIL`, `BLOCKED`, `NOT_TESTED` ou `POLICY_QUESTION`, sem alterar o código.
