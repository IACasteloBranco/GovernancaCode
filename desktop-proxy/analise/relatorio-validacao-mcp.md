# Relatorio de validacao do normalizador MCP

**Data:** 2026-10-21  
**Resultado:** PASS nos testes sinteticos e na projecao metadata-only do rollout avaliado.

## Escopo e metodo

- Validacao local de `desktop-proxy/rollout_normalizer.py` e `desktop-proxy/test_rollout_normalizer.py`.
- Um rollout local previamente identificado como originado no ChatGPT Desktop foi processado em modo `metadata_only`.
- A inspecao foi limitada a contagens e campos estruturais. A saida nao contem mensagens, argumentos de ferramentas nem resultados de ferramentas.
- Nenhum arquivo de rollout foi alterado; nao houve conexao ao backend.

## Verificacoes

| Verificacao | Resultado |
|---|---|
| Suite focal do normalizador | 8 testes passaram (`python -m unittest discover -s desktop-proxy -p test_rollout_normalizer.py -v`) |
| Schema / modo | v3 / `metadata_only` |
| Registros validos / invalidos | 4827 / 0 |
| Mensagens retidas | 0 |
| Chamadas MCP projetadas | 88 |
| Chamadas com item, thread, turno, servidor, ferramenta e status | 88 de 88 |
| Chamadas com duracao derivada dos timestamps | 88 de 88 |
| Campos de argumentos/resultados nas chamadas MCP | Nao |
| Conflitos de identidade apos corrigir alias `Reasoning`/`reasoning` | 0 |
| Conflitos de conteudo em modo metadata-only | 0 |

## Chamadas MCP observadas

- Por servidor: `codex_app` 3, `cua_repl` 81, `node_repl` 3, `playwright` 1.
- Por status: `completed` 72, `failed` 16.
- As 88 chamadas vieram de `event_msg.item_completed` nesta amostra.
- `failed` e o status registrado no rollout; a causa nao foi investigada.

## Analise

A v3 projeta chamadas MCP em `mcp_tool_calls[]` com correlacao por `item_id`, `thread_id` e `turn_id`, servidor/ferramenta, status e tempos, sem propagar argumentos ou resultados. O teste sintetico comprova a projecao e a ausencia de argumentos/resultados mesmo com `include_content=True`.

A leitura da amostra revelou que o mesmo tipo de raciocinio aparece com capitalizacao diferente entre fontes. O normalizador passou a reconhecer `Reasoning` e a tratar esse alias como a mesma identidade de `reasoning`. Antes da correcao, os 812 pares dessa amostra eram reportados como conflitos; apos a correcao, o resultado real ficou com zero conflitos de identidade e zero tipos desconhecidos dessa categoria. O teste novo cobre essa equivalencia.

A amostra confirma que os eventos MCP existem neste rollout e podem ser projetados localmente em modo de metadados. Isso nao comprova cobertura de todas as sessoes, versoes do aplicativo ou fontes de chamadas.

## Limitacoes

- Trata-se de um unico rollout; contagens e cobertura nao devem ser generalizadas.
- `duration_ms` e a diferenca entre timestamps do arquivo, nao uma medicao independente da execucao.
- Ha 5 marcadores de compactacao e 13 tipos/categorias ainda nao normalizados.
- Nao foram validados watcher continuo, envio ao backend, deduplicacao com a extensao ou coleta sob outras versoes/estados.
- O arquivo `desktop-proxy/analise/rollout-mcp-metadata.json` contem a projecao `metadata_only`, sem mensagens.

## Evidencias

- Implementacao: `desktop-proxy/rollout_normalizer.py`.
- Testes sinteticos: `desktop-proxy/test_rollout_normalizer.py`.
- Saida: `desktop-proxy/analise/rollout-mcp-metadata.json`.
