# Captura de regeneração, ferramentas e streams simultâneas — 2026-10-13

## Escopo

Extensão `extension/` versão 0.4.1, Chrome configurado pelo operador e backend local. Somente prompts sintéticos foram enviados. A política em `policies/` não foi alterada. Este relatório complementa `2026-10-13-captura-texto-stream.md`.

## Resultados

| Caso | Entrada e esperado | Observado | Resultado |
|---|---|---|---|
| Regeneração, antes da correção | Prompt sintético `FIGO 91`; permitir nova resposta somente após decisão de política | O POST foi retido pela barreira de rede, pois o menu de regeneração não passava pelo editor. A UI exibiu a falta de decisão válida | FAIL, reproduzido |
| Regeneração, após a correção | `Regeneração sintética 0.4.1: responda somente AZUL 23.`; duas respostas na mesma interação | A UI exibiu `AZUL 23` nas duas versões. A interação `81e8d781-2024-4589-8b55-884d01f97101` tem duas respostas `complete` com IDs de evento distintos (`9a4ca390-1d8f-42e9-9a11-180e65d6ca3b` e `e85d63ef-bbfb-4359-8cac-075534da9678`); cada ID encontra seu `stream_captures` completo | PASS |
| Política na regeneração | Mesmo texto do turno deve ser reavaliado; marcador PEM sintético deve ser retido | Teste local permite prompt sintético seguro, retém `-----BEGIN PRIVATE KEY-----` e bloqueia uma segunda seleção sem turno pendente | PASS |
| Resposta com ferramenta | Python calcula a soma dos quadrados de 1 a 50; guardar apenas a resposta final | Stream real contém chamada `python`, saída da ferramenta, mensagens de raciocínio e resposta final. `responses.text` contém somente `42925`, com status `complete`; interação `f94082ff-6d09-4959-ad46-cd0cbcff3c66`, 15.509 bytes e 21 frames técnicos | PASS |
| Duas abas com streams simultâneas | A gera lista longa; B responde `BETA 84`; preservar associação por tentativa | B terminou antes de A. Interações `800f2090-28f7-498a-8cd7-026fc30a9643` (7 caracteres) e `684be024-1db4-4e12-b88b-0711f9d84699` (5.713 caracteres) têm resposta e captura técnica completas com os comprimentos correspondentes | PASS |
| Suíte da extensão | Parser, correlação, política, ponte e manifesto | `node --test --test-isolation=none extension/tests/*.test.mjs`: 24 testes passaram | PASS |
| Suíte do backend | Rotas, identidade e persistência | `.venv/Scripts/python.exe -m pytest -p no:cacheprovider tests -q --tb=short`: 18 testes passaram; um aviso de depreciação do Starlette | PASS |

## Implementação e limites

O menu **Tentar novamente** reutiliza o prompt do turno, reavalia a política e cria um novo ID de tentativa para o POST e a resposta. A interação original permanece a mesma. A associação usa uma correspondência única com um prompt confirmado nesta aba e conversa; turnos antigos após recarga, duplicados ou de outra aba ficam bloqueados. Os demais modos do menu não têm captura habilitada. O parser ignora mensagens de ferramenta e raciocínio e usa somente texto final do assistente.

Os ensaios com ferramenta e concorrência ocorreram antes da mudança que passou a usar o ID da tentativa também em `responses.client_event_id`; neles, a associação à captura técnica é feita por `interactions.client_event_id`. O ensaio de regeneração confirma o vínculo direto das duas respostas à captura técnica. Não foram usadas credenciais ou dados pessoais reais nos prompts de teste.

Na primeira execução, o pytest ficou `BLOCKED` por permissão do sandbox no diretório temporário, inclusive com `--basetemp` no workspace. Reexecutado fora do sandbox com autorização, terminou `PASS` (18/18). `graphify update .` concluiu após as mudanças de código; avisou sobre diretórios antigos sem permissão de leitura.
