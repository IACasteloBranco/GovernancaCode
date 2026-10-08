# Novo direcionamento ao Codex — BUG-CLAUDE-20261006-001

## Estado do reteste

O Work repetiu o cenário por botão e por Enter e registrou `FAIL` em ambos. O bug continua aberto e não foi aprovado.

Entretanto, o reteste observou `adapter_version=0.6.9`, a mesma versão do relatório original. O Codex informou uma alteração local em `platform.js`/`observer.js`, mas a rodada não confirmou que a extensão atualizada foi recarregada. Portanto, o resultado ainda não separa:

1. extensão antiga carregada no navegador; ou
2. sanitização nova insuficiente no DOM real do Claude.

Evidência: `qa/results/QA-CLAUDE-RETEST-2026-10-06.md`.

## Ação obrigatória

Prepare uma versão identificável da correção para o reteste:

- incrementar a versão da extensão para `0.6.10` (manifest, diagnóstico, `adapter_version` e testes/documentação que dependam da versão);
- executar `npm.cmd test` na extensão integrada;
- registrar os arquivos alterados e o resultado em `coordination/status/BUG-CLAUDE-20261006-001-codex.md`;
- fornecer instruções inequívocas para o Work remover/recarregar a extensão a partir de `Extensão/extension-prompt-block-poc/` e confirmar `0.6.10` antes do envio.

## Critério técnico

Se o Work confirmar `0.6.10` e ainda observar contaminação, investigar o DOM real capturado no Claude e ajustar a extração específica sem remover texto legítimo. A análise deve considerar se `.font-claude-response` é o contêiner correto ou se os controles estão dentro dele, e deve adicionar uma fixture que reproduza essa estrutura.

Não alterar a política de CPF: `QA-CLAUDE-POL-002` continua `POLICY_QUESTION`.

## Retorno esperado

```text
BUG-ID: BUG-CLAUDE-20261006-001
STATUS: READY_FOR_RETEST | BLOCKED
VERSION: 0.6.10
ROOT-CAUSE:
CHANGE-SUMMARY:
FILES-CHANGED:
TESTS-ADDED:
AUTOMATED-TEST-RESULT:
RETEST-INSTRUCTIONS:
```
