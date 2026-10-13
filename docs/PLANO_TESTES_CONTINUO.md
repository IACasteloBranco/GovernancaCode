# Verificação contínua

Este plano orienta verificações nas mudanças da extensão, do backend e das POCs. Uma única sessão investiga, implementa e executa as verificações disponíveis. A pessoa responsável decide sobre política, aceite de risco e rollout.

## Critérios

Use as políticas aprovadas em `policies/` e os casos existentes em `qa/` como critérios. Se uma política ou expectativa estiver ambígua, registre `POLICY_QUESTION` e solicite decisão humana. Não altere política nem caso aprovado para fazer uma verificação passar.

Use dados sintéticos e ambientes autorizados. Não registre tokens, credenciais ou conteúdo real.

## Rotina por mudança

1. Identifique os componentes, políticas e casos afetados.
2. Quando `graphify-out/graph.json` existir, consulte-o antes de pesquisar ou abrir fontes de código. Se o grafo não existir ou estiver incompleto, navegue pelas fontes e registre a limitação quando ela afetar a conclusão.
3. Para mudanças com várias etapas, decisões de arquitetura ou causa desconhecida, use `pstack:poteto-mode` para rotear a tarefa à skill adequada. Use Ponytail para limitar a implementação ao escopo necessário.
4. Execute os testes automatizados dos componentes alterados e as verificações manuais pertinentes. Registre os comandos, resultados e limitações.
5. Para cada caso, registre `PASS`, `FAIL`, `BLOCKED`, `NOT_TESTED` ou `POLICY_QUESTION`. Uma inspeção do código não comprova execução no navegador real.
6. Em uma falha, registre entrada sintética, resultado esperado e observado, passos para reproduzir e evidência em `qa/bugs/` quando aplicável.
7. Após alterar código, rode `graphify update .` se Graphify estiver disponível. Mudanças somente em documentos não exigem atualização do grafo.
8. Revise o diff e comunique os arquivos alterados, verificações executadas e decisões pendentes.

## Localização e comandos

Use os comandos do `package.json` do componente. Exemplos para este repositório:

```powershell
# Backend
Set-Location backend
.\.venv\Scripts\python.exe -m pytest -q tests

# Extensão integrada arquivada
Set-Location ..\obsolete\Extensão\extension-prompt-block-poc
npm.cmd test

# POC de rede, quando alterada
Set-Location ..\extension-network-poc
npm.cmd test
```

Os testes automatizados também ficam em `backend/tests/` e nos diretórios `tests/` dos componentes. Consulte `extension/README.md` para localizar as variantes e versões. Para a POC de captura de stream, consulte `extension/`.

## Cobertura por componente

Escolha casos conforme o escopo e os critérios aprovados. Considere os seguintes grupos quando forem pertinentes:

- **Backend:** autenticação, validação, idempotência, assinatura e nonce quando habilitados, persistência, consulta e retenção.
- **Extensão:** instalação e configuração, classificação e bloqueio segundo política, captura, associação entre prompt e resposta, contexto, indisponibilidade do backend e mensagens de falha.
- **POC de rede:** diagnóstico das sondas, seleção de adapter, fallback observacional, envio ao backend local e comportamento na aba autorizada.
- **POC de stream:** bloqueio local, ausência de conteúdo sensível no payload, assinatura por instalação, atribuição da instalação e metadados sem texto de prompt, resposta, stream ou arquivo.
- **Red team controlado:** tentativas sintéticas de contornar os controles alterados, somente nos sites e ambientes de laboratório autorizados.

## Verificações no navegador

Carregue a pasta indicada em `extension/README.md` e confira a versão antes de executar o roteiro aplicável. Se a automação não alcançar o navegador ou a extensão correta, registre `BLOCKED` ou `NOT_TESTED` e descreva o limite observado. Não substitua a execução real por uma inspeção de código.

## Relatórios e aprovação

Registre resultados junto à mudança. Use `reports/` para evidências que precisam permanecer disponíveis como relatório durável. Preserve os resultados existentes em `qa/` e os arquivos de `coordination/` como histórico, sem usá-los como instruções do processo atual.

Uma execução não aprova política, aceite de risco nem rollout. Essas decisões pertencem à pessoa responsável.
