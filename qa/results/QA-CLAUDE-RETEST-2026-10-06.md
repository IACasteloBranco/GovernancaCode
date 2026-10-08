# Reteste QA — BUG-CLAUDE-20261006-001

**Data:** 2026-10-06  
**Site:** Claude (`claude.ai`)  
**Versão observada no SQLite:** 0.6.9  
**Backend:** `127.0.0.1:8000`, `schema_version=0.1`  
**Ambiente:** navegador interno do Codex; aba recarregada antes do reteste. O gerenciador da extensão não estava disponível para confirmar um reload separado da extensão.

## Resultados

| TEST-ID | Rota | Estado | Evidência |
|---|---|---|---|
| QA-CLAUDE-CAPTURE-001-RETEST | Repetição exata do envio por botão | `FAIL` | `interaction_id=1b9d27c6-9069-49f8-a088-1701b0d2ea38`; prompt e resposta registrados, `platform=claude_web`, versão 0.6.9, estado `complete`. A resposta persistida continua incluindo `Claude respondeu:`, glifos de ícones e `agora`. |
| QA-CLAUDE-ENTER-RET-001 | Envio adjacente por Enter | `FAIL` | `interaction_id=72031eff-dc42-4040-9368-6b178ca0e352`; prompt e resposta registrados, `platform=claude_web`, versão 0.6.9, estado `complete`. A mesma contaminação aparece no texto persistido. |

Em ambos os casos, a resposta visível no Claude continha apenas o marcador pedido. A captura do prompt, a associação e a recepção da resposta funcionaram, mas o conteúdo de `responses[].text` não corresponde apenas à resposta. Os eventos de backend foram `request=captured` e `response=complete` para cada interação.

## Resultado do reteste

`FAIL`. O defeito permanece reproduzível por botão e por Enter. BUG-CLAUDE-20261006-001 continua `OPEN`; não houve aprovação de QA.

O arquivo local `Extensão/extension-prompt-block-poc/src/content/platform.js` contém uma função `responseText` que tenta remover controles e rótulos. Isso não foi suficiente para corrigir o resultado observado no runtime. A versão efetivamente registrada continuou 0.6.9; a amostra não permite distinguir entre código ainda não atualizado no runtime e sanitização insuficiente. Não alterei código.

## Próxima ação

Solicitar ao Codex nova correção ou confirmação de que a extensão instalada corresponde ao código atualizado. Depois, repetir o envio original e a verificação de resposta no SQLite.
