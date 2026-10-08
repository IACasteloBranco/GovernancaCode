# Reteste QA — correção de captura Claude

**Data:** 2026-10-06  
**Bug:** BUG-CLAUDE-20261006-001  
**Site:** Claude (`claude.ai`)  
**Versão observada no SQLite e manifest:** 0.6.10  
**Rota:** botão de envio  
**Dados:** prompt sintético.

## Caso repetido

**TEST-ID:** QA-CLAUDE-CAPTURE-001  
**Entrada:** `Responda exatamente com: QA-CLAUDE-BASE-01`  
**Esperado:** o campo de resposta persistido contém somente o texto da resposta visível.  
**Observado:** Claude respondeu `QA-CLAUDE-BASE-01`; o SQLite também contém exatamente `QA-CLAUDE-BASE-01`, sem rótulo da interface, ícones ou horário.  
**Estado:** `PASS`

**Evidência:** `interaction_id=afdf0a79-c5eb-4e24-807d-9b94c754004c`; `platform=claude_web`; `adapter_version=0.6.10`; eventos `request=captured` e `response=incomplete`.

O Claude indicou visualmente que terminou a resposta, mas o backend recebeu `capture_status=incomplete`. O texto está fiel; este caso confirma a correção de fidelidade, mas não confirma a classificação de conclusão. A documentação técnica prevê `incomplete` quando o observador não confirma um sinal de geração/conclusão. Este estado foi registrado como limite observado, sem abrir outro bug nesta execução.

## Resultado

O defeito de contaminação do texto não foi reproduzido em 0.6.10. BUG-CLAUDE-20261006-001 passa neste reteste de fidelidade. Isso não aprova a versão completa nem substitui regressão de outras rotas. O envio por Enter não foi repetido nesta rodada.
