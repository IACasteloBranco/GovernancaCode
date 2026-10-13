# Fluxo de trabalho

Este guia descreve como investigar, implementar e verificar mudanças neste repositório com uma única sessão assistida por ferramentas.

## Comece pelas regras e pelo contexto

1. Leia `AGENTS.md` e localize os componentes afetados.
2. Confira as políticas aprovadas em `policies/` e os casos aplicáveis em `qa/`.
3. Se `graphify-out/graph.json` existir, use `graphify query` antes de pesquisar ou abrir arquivos de código. Use `graphify path` para relações entre conceitos e `graphify explain` para entender um item do grafo.
4. Se o grafo não existir, estiver incompleto ou não cobrir os documentos necessários, consulte as fontes diretamente e registre a limitação quando afetar a conclusão.

## Escolha a abordagem

Para mudanças com várias etapas, decisões de arquitetura ou causa ainda desconhecida, entre por `pstack:poteto-mode`. O roteador aponta para skills como `how`, `why`, `architect`, `tdd` ou revisão conforme a tarefa. Para perguntas e edições pontuais, use a abordagem direta.

Use Ponytail para escolher a menor mudança que atende ao pedido. Mantenha regras de segurança, validações e tratamento de erros que protegem os limites do sistema.

## Implemente e verifique

1. Faça a mudança nos componentes e documentos afetados.
2. Execute as verificações automatizadas e manuais pertinentes ao escopo, usando dados sintéticos e ambientes autorizados.
3. Para uma verificação manual em navegador, use a automação disponível quando ela puder acessar o ambiente correto. Caso contrário, registre `BLOCKED` ou `NOT_TESTED` com a limitação observada.
4. Depois de alterar código, rode `graphify update .` se Graphify estiver disponível. Mudanças somente em documentos não exigem reconstrução do grafo.
5. Revise o diff, os links e as instruções. Registre os comandos, resultados e limitações na descrição da mudança. Use `reports/` quando precisar de um relatório de execução durável.

## Registre o resultado

Use `PASS`, `FAIL`, `BLOCKED`, `NOT_TESTED` ou `POLICY_QUESTION` para cada caso executado. Em falhas, preserve a entrada sintética, o resultado esperado, o resultado observado, os passos e as evidências. Não edite políticas para fazer um caso passar.

Ao concluir, informe o que mudou, quais verificações executou e quais decisões ainda pertencem à pessoa responsável. A pessoa responsável aprova mudanças de política, aceite de risco e rollout.

## Papel das pastas existentes

- `policies/` contém regras aprovadas. Alterações exigem aprovação humana explícita.
- `qa/` contém casos e evidências de validação. Use os casos aprovados como critérios.
- `reports/` recebe relatórios que precisam ser mantidos como evidência.
- `coordination/` contém registros do fluxo anterior e fica disponível para consulta histórica.
