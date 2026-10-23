# Governança de IA

## Objetivo

Este repositório usa um fluxo único de trabalho assistido por ferramentas. A mesma sessão pode investigar, implementar e verificar mudanças. A pessoa responsável mantém as decisões de política, aceite de risco e rollout.

## Fontes de verdade

Use esta ordem quando as fontes divergirem:

1. Políticas aprovadas em `policies/`.
2. Casos de teste aprovados em `qa/`.
3. Estas instruções.
4. Documentação técnica em `docs/`.
5. Implementação nos diretórios dos componentes.

Não altere uma regra de governança para fazer uma implementação ou verificação passar. Mudanças em `policies/` exigem aprovação humana explícita.

## Fluxo de trabalho

1. Entenda o pedido e identifique os componentes e critérios afetados.
2. Se `graphify-out/graph.json` existir, consulte o grafo antes de pesquisar ou abrir fontes do código. Use `graphify query`, `graphify path` ou `graphify explain` conforme a pergunta. Se o grafo não existir ou estiver incompleto, informe essa limitação e navegue pelas fontes disponíveis.
3. Use pstack por meio de `poteto-mode` em mudanças com várias etapas, decisões de arquitetura ou causa desconhecida. Deixe o roteador selecionar skills como `how`, `why`, `architect` ou `tdd` conforme a necessidade. Para tarefas pequenas e claras, trabalhe diretamente.
4. Use Ponytail para manter a solução no menor escopo que resolva o pedido. Preserve validações, segurança e tratamento de erros necessários.
5. Implemente e execute as verificações relevantes ao escopo. Use dados sintéticos. Não use credenciais ou dados pessoais reais.
6. Depois de alterar código, execute `graphify update .` quando Graphify estiver disponível. Não é necessário atualizar o grafo para mudanças somente em documentação.
7. Revise o diff e os documentos afetados. Registre comandos, resultados e limitações junto à mudança; crie relatório em `reports/` quando o ciclo exigir evidência formal.
8. Informe arquivos alterados, verificações executadas e pontos que dependem de decisão humana.

## Uso das ferramentas

- **Graphify:** navegue por relações entre arquivos e conceitos. Não invente relações ausentes no grafo. Um grafo inexistente não bloqueia a tarefa.
- **pstack:** use `poteto-mode` para rotear tarefas não triviais. Skills específicas podem ser chamadas diretamente quando a intenção pedir uma delas.
- **Ponytail:** prefira mudanças pequenas e remova estruturas antigas quando deixarem de servir ao fluxo atual.
- **Automação do navegador:** use apenas sites e perfis autorizados, com entradas sintéticas. Não acesse recursos fora do escopo.

## Política e verificação

A implementação é um mecanismo de aplicação da política, não a própria política. Quando a política ou a expectativa de um teste aprovado estiver ambígua, registre `POLICY_QUESTION` e peça decisão humana. Não declare aprovação de risco, política ou rollout em nome da pessoa responsável.

Os resultados de casos usam `PASS`, `FAIL`, `BLOCKED`, `NOT_TESTED` ou `POLICY_QUESTION`. Bugs devem registrar entrada sintética, esperado, observado, passos para reproduzir e evidência disponível.

## Histórico

`qa/` mantém casos e evidências existentes. `coordination/` mantém registros do fluxo anterior para consulta histórica. Esses arquivos não definem o processo ativo. Veja [Fluxo de trabalho](docs/guide/FLUXO_TRABALHO.md).

## Graphify

Quando `graphify-out/graph.json` existir, consulte-o antes da primeira pesquisa ou leitura de código em uma pergunta sobre o repositório. Use `graphify query "<pergunta>"`, `graphify path "<A>" "<B>"` e `graphify explain "<conceito>"` para consultas focadas. Leia fontes apenas para confirmar ou detalhar os pontos localizados.

Se `graphify-out/wiki/index.md` existir, use-o para navegação ampla. Leia `graphify-out/GRAPH_REPORT.md` para revisão de arquitetura ampla ou quando as consultas focadas não trouxerem contexto suficiente.

Depois de modificar código, rode `graphify update .` para manter o grafo atualizado. O grafo pode não existir durante uma geração inicial; nesse caso, continue pelas fontes do projeto.
