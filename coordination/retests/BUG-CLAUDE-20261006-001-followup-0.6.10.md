# Rodada de QA complementar — Claude 0.6.10

## Objetivo

Completar a validação da correção de captura sem reabrir `BUG-CLAUDE-20261006-001`, que passou no escopo de fidelidade textual.

## Casos obrigatórios

1. Repetir `Responda exatamente com: QA-CLAUDE-BASE-01` por botão e por Enter.
2. Confirmar em ambos `adapter_version=0.6.10` e texto persistido exatamente igual ao texto visível.
3. Observar separadamente `capture_status=complete` e `capture_status=incomplete`.
4. Executar uma resposta longa e uma interrupção.
5. Validar uma resposta com Markdown/parágrafos.
6. Repetir o caso de material sem texto, se disponível no roteiro.

## Critério para novo bug

Se a interface mostrar sinais claros de que a geração terminou e a API persistir `incomplete`, registrar um novo bug de classificação de conclusão com interaction ID, sinais visuais, versão e passos reproduzíveis. Não alterar a política de CPF.

## Relatório

Gravar o resultado em `qa/results/` com estados `PASS`, `FAIL`, `BLOCKED`, `NOT_TESTED` e `POLICY_QUESTION`. Esta rodada não deve alterar código.
