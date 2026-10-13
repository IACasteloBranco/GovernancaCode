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
| Reensaio após fallback de cartão | NOT_TESTED | Requer anexar novamente o arquivo sintético no compositor e enviar outro prompt após a atualização de código. |

## Contrato implementado

- `observed`: um ou mais arquivos foram encontrados nos controles do compositor; cada item registra `name`, `mime_type`, `size_bytes`, `capture_status` e `source`.
- `not_observed`: o compositor foi inspecionado e nenhum arquivo foi encontrado.
- `unavailable`: o compositor ou os controles não puderam ser inspecionados.
- Texto vazio só é enviado quando há metadados observados de pelo menos um arquivo.
- Até 20 itens são enviados; excedentes definem `truncated: true`.
- Metadados de envio ficam em `interactions.attachments_json`; não precisam da tabela `artifact_metadata`, que continua destinada a arquivos gerados ou baixados.

## Limites e próximos passos

1. Anexar novamente o documento sintético pelo controle normal de anexos.
2. Recarregar extensão e aba, agora em `0.4.4`, e enviar um novo prompt sintético.
3. Confirmar nome, tipo, tamanho, pessoa atribuída e texto do prompt pela API e pela linha SQLite.
4. Repetir por Work e chatbot comum quando esses contextos estiverem definidos no modelo.

O campo MIME é o valor fornecido pelo navegador; não é inferido pela extensão do nome. A presença em `FileList` indica seleção observada no envio, não confirma que o serviço remoto recebeu ou processou o arquivo. Upload por colar/arrastar sem um controle inspecionável também precisa ser verificado no ensaio real.
