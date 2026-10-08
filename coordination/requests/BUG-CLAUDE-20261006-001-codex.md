# Direcionamento ao Codex — BUG-CLAUDE-20261006-001

## Identificação

- **BUG-ID:** `BUG-CLAUDE-20261006-001`
- **TEST-ID:** `QA-CLAUDE-CAPTURE-001`
- **Versão observada:** `0.6.9`
- **Site:** Claude Web (`claude.ai`)
- **Categoria:** `response_capture_fidelity`
- **Severidade:** `MEDIUM`
- **Estado:** `OPEN`

## Análise do Orchestrator

O QA confirmou que a resposta visual foi exatamente `QA-CLAUDE-BASE-01`, mas o valor persistido em `responses[].text` também incluiu o rótulo acessível `Claude respondeu:`, glifos dos controles da barra de ações e `agora`.

Isso é uma falha de integridade da captura, não uma falha de bloqueio: a resposta foi marcada como `complete`, mas o texto armazenado não corresponde ao conteúdo observável da resposta. A evidência do QA está em `qa/bugs/BUG-CLAUDE-20261006-001.md` e `qa/results/QA-CLAUDE-2026-10-06.md`.

Hipótese técnica a confirmar: para Claude, o caminho de `visibleText()` em `src/content/observer.js` cai em `innerText/textContent` do nó `.font-claude-response` quando não encontra blocos `[data-markdown-text-style="assistant-message"]`. Esse nó aparentemente contém conteúdo da resposta e elementos adjacentes de acessibilidade/ações.

Não alterar a política de CPF. O caso `QA-CLAUDE-POL-002` continua separado como `POLICY_QUESTION`, pois `policies/` ainda não contém uma decisão aprovada para essa expectativa.

## Direcionamento de implementação

1. Reproduzir o caso com o prompt sintético:

   ```text
   Responda exatamente com: QA-CLAUDE-BASE-01
   ```

2. Inspecionar a estrutura DOM real da mensagem Claude na sessão autorizada e identificar o contêiner mínimo que representa somente o conteúdo gerado.
3. Ajustar a extração específica do adaptador Claude para excluir rótulos acessíveis, botões/controles, glifos de ação, horário e conteúdo de navegação da mensagem.
4. Preservar quebras de linha e Markdown legítimos da resposta; não aplicar uma remoção textual ampla que possa apagar conteúdo produzido pelo modelo.
5. Manter os caminhos existentes para materiais gerados e respostas sem texto. A correção não deve quebrar `complete`, `incomplete`, interrupção ou detecção de artefatos.

## Testes obrigatórios

- adicionar um teste de regressão com uma fixture de resposta Claude contendo texto da resposta mais rótulo acessível, controles, ícones e horário;
- confirmar que a saída contém somente o texto da resposta;
- manter um caso com Markdown/quebras de linha legítimos;
- manter um caso de resposta vazia com material observado;
- executar a suíte Node da extensão integrada;
- repetir o cenário no navegador e conferir o campo persistido no SQLite/API.

## Critérios de aceite

- Para o cenário do QA, `responses[].text` é exatamente `QA-CLAUDE-BASE-01`.
- Nenhum rótulo de interface, ícone, controle ou horário é persistido como texto da resposta.
- Não há regressão nos testes existentes de ChatGPT, Claude, `complete`, `incomplete` e materiais.
- O Codex deve devolver `READY_FOR_RETEST` com causa-raiz, arquivos alterados, testes e instruções de reteste.
- O Codex não deve marcar o bug como aprovado; o Work fará o reteste.

## Formato de retorno

```text
BUG-ID: BUG-CLAUDE-20261006-001
STATUS: READY_FOR_RETEST | BLOCKED
ROOT-CAUSE:
CHANGE-SUMMARY:
FILES-CHANGED:
TESTS-ADDED:
AUTOMATED-TEST-RESULT:
RISKS:
RETEST-INSTRUCTIONS:
```
