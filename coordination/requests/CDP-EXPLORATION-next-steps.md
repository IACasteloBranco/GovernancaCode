# Próximos passos — exploração CDP

## Para o Codex

Não implementar ainda uma captura CDP definitiva. Primeiro propor uma interface de captura separando:

- observação de transporte;
- recuperação do corpo completo;
- reconstrução de frames por índice;
- correlação de operação/conversa/mensagem;
- classificação de término e Stop;
- metadados de transferência de arquivos.

Qualquer protótipo deve ser experimental, desativável e sanitizar dados antes de persistir. Não guardar cookies, tokens, headers de autenticação, URLs assinadas, bytes de arquivos ou payload bruto sem necessidade explícita.

## Validação necessária

1. Repetir a captura em conversa independente.
2. Repetir formatos de resposta e confirmar reconstrução integral.
3. Correlacionar IDs em múltiplos turnos e regeneração.
4. Comparar conclusão normal com pelo menos três Stops explícitos.
5. Repetir CSV/PDF pela extensão, não apenas pelo CDP exploratório.
6. Separar claramente ChatGPT e Claude; não transportar seletores, rotas ou hipóteses de um fornecedor para o outro.

## Critério de avanço

Somente considerar integração quando a mesma capacidade for demonstrada pela extensão, com testes automatizados, evidência sanitizada e validação independente do Work.
