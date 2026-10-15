# Captura de metadados de anexos no prompt — 2026-10-13

## Escopo

Capturar no instante do envio os metadados dos arquivos selecionados no compositor ativo do ChatGPT Web e associá-los à interação que contém o prompt. A extensão não lê bytes do arquivo e não examina o corpo das requisições de upload.

## Resultado

| Caso | Resultado | Evidência |
|---|---|---|
| Metadados extraídos do `FileList` sem ler bytes | PASS | `extension/tests/files.test.mjs` |
| MIME desconhecido permanece desconhecido; nomes duplicados não são mesclados | PASS | `extension/tests/files.test.mjs` |
| Estado vazio, indisponível e truncamento diferenciados | PASS | `extension/tests/files.test.mjs` |
| Snapshot do compositor chega à captura; prompt só com anexo é permitido | PASS | `extension/tests/blocker.test.mjs` e `extension/tests/observer-network.test.mjs` |
| Pacote inclui o helper e versão `0.4.4` | PASS | `extension/tests/blocker-manifest.test.mjs` |
| Persistência e leitura de metadados pela API | PASS | `backend/tests/test_api.py`: 13 passed |
| Suíte da extensão após fallback de cartão | PASS | `node --test --test-isolation=none extension/tests/*.test.mjs`: 34 passed |
| Envio real 1 — prompt, resposta e atribuição | PASS | `ANEXO-OK 482` foi visto na conversa e na linha sintética do SQLite; a resposta ficou `complete` e havia atribuição. |
| Envio real 1 — metadados do anexo | FAIL | O cartão `synthetic-document.txt` estava visível no compositor, mas o ChatGPT já havia limpado `FileList`. A interação `fcf4038f-747f-49bc-a8ab-894b16ff1c0a` foi gravada como `not_observed`, sem anexos. O fallback para cartão foi implementado depois desse registro. |
| Upload automatizado do arquivo | BLOCKED | O seletor automatizado recusou o arquivo porque a extensão de controle exigiria habilitar acesso amplo a URLs `file://`; essa permissão não foi alterada. O usuário selecionou e enviou manualmente o arquivo sintético no primeiro ensaio. |
| Reensaio após fallback visual | FAIL para captura pareada | A interface recebeu prompt e resposta, mas só os metadados da stream chegaram ao SQLite. Detalhes na seção do reensaio de 14 de outubro. |

## Reensaio após fallback visual — 2026-10-14

| Caso | Resultado | Evidência |
|---|---|---|
| Envio sintético com anexo e resposta | FAIL para captura pareada | Na conversa, `synthetic-document(1).txt` ficou anexado e o ChatGPT respondeu `ANEXO-OK 483`. No SQLite, não há interação nem resposta desse envio. |
| Captura da stream de rede | PASS, somente metadados | A linha `142dd1da-2911-4e1c-825e-8713f10b2d8f` foi recebida em `2026-10-14T17:50:52Z`, com estado `complete`, 12 caracteres, 27 frames, um marcador terminal e atribuição à instalação cadastrada. |
| Metadados do arquivo anexado | NOT_TESTED na persistência | Sem uma linha em `interactions`, não foi possível confirmar nome, MIME ou tamanho no banco. O nome `synthetic-document(1).txt` foi observado na conversa, não no banco. |

Entrada sintética: `Leia o documento sintético anexado e responda somente ANEXO-OK 483`. Esperado: uma interação com prompt e metadados do arquivo, seguida de uma resposta associada. Observado: a interface recebeu prompt, anexo e resposta; a tabela `stream_captures` recebeu só metadados técnicos da stream; `interactions` e `responses` não receberam registros para este envio. O último prompt correspondente no banco continua sendo o teste `ANEXO-OK 482` de 13 de outubro.

Passos: recarregar a extensão e a aba; anexar o arquivo sintético pelo compositor; enviar o prompt acima; confirmar a resposta na interface; consultar `interactions`, `responses` e `stream_captures` no SQLite local. A ausência de `data-governanca-probe-attempt` após o envio não indica falha por si só: `network-probe-main.js` remove o atributo ao consumir o marcador para associar a requisição.

Instrumentação adicionada em `extension/src/content/observer.js` e `extension/src/background/service-worker.js`: o DOM recebe somente `pending`, `stored` ou `rejected`, e o popup registra a rejeição com um código genérico (`http_NNN`, `prompt_invalid_or_paused` ou `internal_error`). Nenhum texto de prompt ou detalhe arbitrário da resposta da API é incluído. A suíte da extensão passou com 37 testes, incluindo rejeição fora da aba do ChatGPT. O reensaio ao vivo confirmou a gravação pareada de texto; o fluxo de rejeição ainda não foi exercitado com um erro HTTP identificado.

## Reensaio de texto após instrumentação — 2026-10-14

O popup mostrou `prompt_stored` para a interação `fff3bb2d-297b-4824-9d3c-3caf07376fc5`, seguida de eventos de rede. A consulta direta ao SQLite confirmou essa interação com estado `complete`, prompt de 5 caracteres e resposta de 29 caracteres associada ao mesmo `client_event_id`; a stream também consta como `complete` com 14 frames. Resultado: `PASS` para captura pareada de texto. A observação de anexos ficou `not_observed`, portanto este envio não valida os metadados do arquivo.

O texto explicativo do popup foi corrigido: antes dizia que prompts e respostas não eram gravados, embora a extensão já os capturasse no backend local. A descrição agora informa a captura e esclarece que os anexos enviados têm somente metadados registrados, sem leitura do conteúdo dos arquivos.

## Reensaio bloqueado e diagnostico preciso - 2026-10-14

O usuario anexou `synthetic-document(2).txt` ao compositor. O clique em Enviar foi bloqueado pela extensao com a mensagem de sincronizacao da politica. O popup registrou `policy_decision` como `ALLOW` e, em seguida, `prompt_rejected` com `prompt_invalid_or_paused`. Tambem houve eventos `blocker_health` com `main_active=true` e `machine_assigned=true`. O popup informou que a sonda nao estava carregada na aba ativa.

A consulta ao SQLite mostrou que a ultima interacao continua sendo `fff3bb2d-297b-4824-9d3c-3caf07376fc5`, recebida as `18:05:54Z`, sem anexo observado. Portanto, o envio com o novo anexo nao chegou a criar interacao no banco. O codigo antigo usava o mesmo erro para dois casos: captura pausada e payload invalido. Os eventos historicos nao permitem distinguir qual deles ocorreu.

A validacao do endpoint local agora registra `capture_paused` quando a captura esta desativada e `invalid_prompt` quando o payload nao passa na validacao. Os codigos nao incluem texto do prompt, nomes de arquivo nem detalhes da excecao. `node --test --test-isolation=none extension/tests/*.test.mjs` passou com 38 testes. `graphify update .` atualizou o grafo, com avisos de acesso negado a diretorios temporarios de testes.

Naquele momento, o reensaio do navegador ainda estava pendente. O resultado apos recarregar a extensao e a aba esta na secao seguinte.

## Ensaio real apos atualizacao - 2026-10-14

| Caso | Resultado | Evidencia |
|---|---|---|
| Prompt sintetico | PASS | SQLite guardou o prompt na interacao `c1191724-f38d-4460-885f-3772e381c5ea`; tamanho 66 caracteres. O texto nao foi incluido neste relatorio. |
| Nome do anexo | PASS | `attachments_capture_status=observed`; nome `synthetic-document(2).txt`; `source=visible_card`; `capture_status=metadata_only`. |
| MIME e tamanho do anexo | NOT_TESTED | O fallback do cartao nao forneceu esses valores; ambos ficaram nulos no banco. |
| Atribuicao | PASS | A interacao foi associada a Eduardo e ficou `complete`. |
| Resposta | PASS | A interface exibiu `ANEXO-OK 483`; SQLite guardou resposta `complete` de 12 caracteres, ligada a mesma interacao e ao mesmo `client_event_id`. |

Entrada sintetica: `Leia o documento sintético anexado e responda somente ANEXO-OK 483`. A extensao permitiu o envio depois da recarga. A resposta e o nome observado no cartao do arquivo foram persistidos. Este teste nao comprova MIME ou tamanho, pois o fallback visivel so observou o nome do arquivo.

O diagnostico mais preciso, com codigos `capture_paused` e `invalid_prompt`, ainda nao foi exercitado por uma rejeicao depois da atualizacao. `Work`, chatbot comum e captura do departamento do colaborador tambem nao foram verificados neste ensaio.

## Reensaio de metadados do anexo — 2026-10-14

O ensaio real com `synthetic-document(3).txt` persistiu a interação `ce5c1b4a-dad7-474e-94a6-6dcea0d088d8` e a resposta vinculada. A resposta `ANEXO-OK 484` apareceu na interface. O banco registrou o nome com `source=visible_card`, mas `mime_type` e `size_bytes` permaneceram nulos: o `FileList` já estava vazio quando o prompt foi observado.

Foi implementado um cache temporário que lê somente `name`, `type` e `size` no evento `change` do seletor de arquivo. No envio, esses valores são associados aos cartões visíveis; o cache só é descartado após confirmação do backend. Cartões removidos são descartados na observação seguinte. Nenhum objeto `File` ou byte do arquivo é guardado ou lido.

Resultado local: `node --test --test-isolation=none extension/tests/*.test.mjs` passou com 43 testes, incluindo cache após limpeza de `FileList`, nomes duplicados, remoção, rejeição do backend sem descarte e ausência de leitura dos bytes. O reensaio no navegador ainda depende de recarregar a extensão local e a aba; MIME e tamanho do novo caminho continuam `NOT_TESTED` em execução real.

## Reensaio no navegador após cache de seleção — 2026-10-14

O usuário anexou `synthetic-document(4).txt`. Foi enviado o prompt sintético de validação e a interface respondeu `ANEXO-OK 485`. A consulta somente de metadados ao SQLite encontrou a interação `72182cbc-e1dc-4155-97db-a533c60f20ee`, estado `complete`, resposta `complete` de 12 caracteres. Porém, o anexo ficou com `source=visible_card`, `mime_type=null` e `size_bytes=null`.

Resultado: `FAIL` para o novo caminho de seleção ao vivo. A gravação do prompt e da resposta passou, mas não há evidência de que `rememberSelection` tenha sido acionado ou associado ao mesmo compositor. A causa ainda não foi isolada; pode ser que o código atualizado não estivesse carregado na aba ou que o evento/root do seletor não tenha correspondido. A página mostrou `data-governanca-prompt-capture=stored`, confirmando que o observer de prompt está ativo. Não foi possível ler diretamente `chrome://extensions` pela automação para confirmar o caminho carregado.

Entrada sintética: o mesmo padrão de leitura do documento e resposta curta usado nos ensaios anteriores, com marcador `485`. Esperado: `source=selection_event`, MIME e tamanho preservados do seletor. Observado: apenas nome do cartão. A captura da interação e resposta ficou completa, sem leitura do conteúdo do arquivo.

## Contrato implementado

- `observed`: um ou mais arquivos foram encontrados nos controles do compositor; cada item registra `name`, `mime_type`, `size_bytes`, `capture_status` e `source`.
- `not_observed`: o compositor foi inspecionado e nenhum arquivo foi encontrado.
- `unavailable`: o compositor ou os controles não puderam ser inspecionados.
- Texto vazio só é enviado quando há metadados observados de pelo menos um arquivo.
- Até 20 itens são enviados; excedentes definem `truncated: true`.
- Metadados de envio ficam em `interactions.attachments_json`; não precisam da tabela `artifact_metadata`, que continua destinada a arquivos gerados ou baixados.

## Limites e próximos passos

1. Recarregar a extensão e a aba para atualizar o texto do popup.
2. Anexar novamente o arquivo sintético, enviar um prompt sintético e conferir nome observado, interação, resposta e atribuição no SQLite.
3. Repetir com Work e chatbot comum depois que a captura do anexo passar.

O campo MIME é o valor fornecido pelo navegador; não é inferido pela extensão do nome. A presença em `FileList` indica seleção observada no envio, não confirma que o serviço remoto recebeu ou processou o arquivo. Upload por colar/arrastar sem um controle inspecionável também precisa ser verificado no ensaio real.
