# Handoff — captura pareada de prompt, resposta e metadados

**Atualizado em:** 8 de outubro de 2026

**Projeto:** POC isolada em `stream-capture-poc`

**Objetivo:** validar a captura do prompt no envio, sua associação à resposta reconstruída e persistência local pareada em SQLite, além de metadados de artefatos, sem identificar usuário, máquina ou conversa.

## Estado atual

A POC observa, no mundo `MAIN` da página, o `fetch` da rota `POST /backend-api/f/conversation` quando a resposta é `text/event-stream`. O parser interpreta frames DPU/SSE e tenta reconstruir o texto da resposta. A ponte captura o texto no editor no evento de envio, mantém-no em memória transitória na aba e o associa ao início da próxima requisição de conversa. Se a resposta for capturada, prompt e resposta são enviados juntos à API local e persistidos na mesma linha SQLite.

O corpo bruto da stream não é persistido. O registro contém `prompt_text`, `response_text` e metadados técnicos como status, MIME, bytes, chunks, frames, marcador de término, duração e resumos dos formatos de evento. A versão 0.1.12 observa metadados de artefatos separadamente, sem ler nem persistir o corpo dos arquivos. A versão 0.1.13 acrescenta a captura pareada do prompt e resposta.

O Brave foi usado pelo usuário para os ensaios da extensão. O controle de navegador disponível ao agente não expôs a sessão do Brave; portanto, os resultados abaixo vêm do diagnóstico da extensão e da consulta local ao SQLite, não de uma automação do navegador pelo agente.

## Resultados dos testes 1–4

Os quatro novos envios aparecem no SQLite com estado `complete`, marcador `[DONE]`, `protocol_done=1`, `reader_done=1` e `truncated=0`. Isso confirma recebimento e armazenamento da stream, mas não garante que o texto reconstruído esteja correto.

| Teste | Caso | Resultado armazenado | Avaliação |
|---|---|---|---|
| 1 | Resposta curta com duas linhas | `CAPTURA_INICIO\nlinha dois\nCAPTURA_FIM` | Reconstrução correta. 6.032 bytes, 15 frames. |
| 2 | Unicode e símbolos | `Ação: café, coração, ção.\nSímbolos: ✓ → • 😀` | Reconstrução correta, incluindo acentos, símbolos e emoji. 6.164 bytes, 15 frames. |
| 3 | Geração de arquivo TXT | `Arquivo \`poc-captBaixar o arquivo](sandbox:/mnt/data/poc-captura.txt)` | Captura armazenada, mas texto reconstruído está corrompido/incompleto. 14.540 bytes, 24 frames. |
| 4 | Geração de arquivo CSV | `Arquivo \`poc-captmnt/data/poc-captura.csv)` | Captura armazenada, mas texto reconstruído está corrompido/incompleto. 18.340 bytes, 25 frames. |

Há também um registro anterior de smoke test (`OK`), fora dos quatro testes acima.

## Conclusão técnica

- A extensão alcançou a API local e a API persistiu os quatro casos no SQLite.
- Os casos simples de texto, múltiplas linhas e Unicode passaram.
- Os dois casos de geração de arquivo expuseram uma falha no parser/reconstrutor de atualizações DPU: a resposta final foi armazenada como completa, mas seu texto ficou truncado ou montado incorretamente.
- `complete` descreve o encerramento observado da stream. Não é uma validação de fidelidade do texto reconstruído.
- A POC captura a resposta textual reconstruída e métricas técnicas. Não salva os bytes dos arquivos gerados nem os metadados estruturados de arquivo; isso ainda precisa ser investigado.

## Próximos passos

1. Corrigir o parser DPU para operações que substituem ou editam trechos já emitidos, preservando a ordem e os índices dos blocos.
2. Criar casos de teste sintéticos para snapshots, `append`, `replace`, patches em partes existentes, Markdown com links `sandbox:`, e atualizações que chegam em múltiplos frames.
3. Reexecutar os testes 1 e 2 como regressão e repetir os casos de TXT e CSV. Comparar o texto armazenado com a resposta final esperada.
4. Investigar separadamente a requisição de transferência do arquivo e onde os metadados (nome, MIME e tamanho) aparecem. Só então decidir como modelá-los no SQLite; não inferir metadados ausentes no stream da conversa.
5. Depois da fidelidade da reconstrução, validar limites: resposta interrompida, erro de rede, resposta sem texto e eventual PDF/arquivo adicional.
6. Documentar resultados novos aqui e atualizar o README da POC quando o comportamento deixar de ser experimental.

## Ambiente e notas de execução

- Extensão de navegador Manifest V3, API local em `127.0.0.1:8766` e SQLite local.
- Token de laboratório local; não incluir o token nem o `.env` no Git.
- A versão do adaptador estava em `0.1.2` nos diagnósticos fornecidos; o validador do backend foi ajustado para aceitar versões compatíveis `0.1.x`.
- A suíte do backend passou anteriormente: 5 testes. Não foi executada novamente durante a consolidação deste handoff.
- Evitar incorporar a pasta irmã `GovernancaCode-main` ou seus arquivos a esta POC/commit. Ela é um projeto separado.

## Como retomar em outro chat

Comece lendo este documento e `stream-capture-poc/README.md`. Para metadados de arquivos, use o estado e as instruções de reteste da seção abaixo. Para fidelidade textual, compare a resposta persistida com a resposta visível antes de alterar o parser. Mantenha conteúdo sintético e não persista corpos SSE, bytes de artefatos nem URLs assinadas.

## Metadados de artefatos — versão 0.1.12

O adaptador observa, quando a captura está ativada:

- `GET /backend-api/conversation/:id/interpreter/download`: lê uma cópia limitada do JSON e extrai somente `file_name`, `mime_type` e `file_size_bytes`.
- `GET /backend-api/estuary/content`: observa `Content-Disposition`, `Content-Type` e `Content-Length`, sem clonar, ler nem enviar o corpo do arquivo.

A API grava essas observações na tabela `artifact_metadata`, independente das respostas da conversa. A API descarta campos fora da lista permitida; URLs de download e IDs de conversa/arquivo não são aceitos nem persistidos. O MIME explícito determina `file_type`; se ausente ou genérico, a extensão do nome pode ser usada e fica marcada como `filename_extension`. Campos indisponíveis ficam nulos.

**Testes automatizados:** 3 testes Node para a sonda e 8 testes Python para validação/persistência passaram. A sintaxe dos quatro arquivos JavaScript também passou. A API foi reiniciada e `/health` respondeu `stream-capture-0.2`; a rota autenticada de metadados respondeu, inicialmente sem observações.

**Estado antes da rodada manual abaixo:** reteste real de navegador `NOT_TESTED`. Na rodada posterior, registrada abaixo, o usuário testou a extensão no ChatGPT Work.

## Rodada manual de metadados — 8 de outubro de 2026

**Executor:** usuário, manualmente no ChatGPT Work. O agente de QA automatizado não participou porque estava com dificuldades de acesso/atualização do navegador. O usuário informou que os três arquivos foram baixados e estão na pasta `Files/`.

**Resultado observado:** a API local recebeu metadados dos três formatos adicionais e a listagem local confirmou a presença dos arquivos. Nome e MIME capturados corresponderam aos tipos esperados:

| Arquivo | MIME observado | Resultado técnico |
|---|---|---|
| `qa-tipo-20261008.txt` | `text/plain` | Capturado e classificado |
| `qa-tipo-20261008.json` | `application/json` | Capturado e classificado |
| `qa-tipo-20261008.xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | Capturado e classificado |

Para TXT e JSON, a API registrou uma observação `metadata_json` e uma `download_headers` cada. Para XLSX, foram registradas duas observações de cada origem, embora a pasta `Files/` tenha uma entrada com esse nome. Como cada observação recebe um identificador aleatório e não se persiste um ID do artefato do ChatGPT, a POC ainda não consegue agrupar ou deduplicar com segurança essas observações.

Na rodada manual anterior, não houve registro para `qa-pausado-20261008.csv` nem para a resposta de texto sem arquivo. O caso `qa-sem-download-20261008.csv` produziu registros `download_headers` e `metadata_json`. Isso demonstra uma requisição de conteúdo observada na página, mas não permite concluir se houve clique humano: o observador acompanha requisições da página e não distingue clique de carregamento automático. Portanto, a distinção entre “sem clique” e “com clique” permanece `NOT_TESTED`, não sendo tratada como falha da extensão.

**Conclusão desta rodada:** a captura e classificação de TXT, JSON e XLSX repetiram o comportamento esperado no ChatGPT Work; o fluxo parece consistente nesses formatos. Resultado manual observado: `PASS` para presença/classificação dos três formatos; `PASS` para ausência de registro com captura pausada e resposta sem arquivo; `NOT_TESTED` para distinguir download manual de requisição automática. Tamanho não é critério de aprovação nesta POC. Os corpos dos arquivos não foram inspecionados nesta verificação. Os testes automatizados continuam sendo a evidência para garantir que a captura dos cabeçalhos não lê o corpo.

**Nota de governança:** estes são testes manuais feitos pelo usuário. Não são um relatório independente produzido pelo agente Work/QA e não alteram políticas nem representam decisão de rollout.

## Teste manual de nome repetido — 8 de outubro de 2026

O usuário gerou e baixou duas vezes um CSV sintético usando o mesmo nome solicitado, `qa-dedupe-20261008.csv`, com conteúdo marcador diferente em cada prompt. A consulta da API encontrou seis observações, todas com MIME `text/csv` e `file_type=text/csv`:

- Primeira geração: um par de observações, `metadata_json` e `download_headers`, para o nome solicitado.
- Segunda geração: um par para o nome solicitado e outro par para `qa-dedupe-20261008(1).csv`.

O resultado confirma que as duas fontes continuam sendo observadas, mas não permite decidir se o par com sufixo `(1)` representa uma terceira materialização, uma resposta adicional da aplicação ou uma observação duplicada. O teste, portanto, demonstra a limitação atual de correlação; não valida uma regra de deduplicação. A POC deve preservar as seis observações até que uma chave de agrupamento segura seja definida, em vez de mesclá-las apenas pelo nome/MIME/tempo.

**Estado:** captura e classificação `PASS`; contagem de artefatos lógicos e deduplicação `NOT_TESTED` por falta de correlação confiável entre observações e arquivos. Não foi necessário abrir o conteúdo dos arquivos.

## Integração de captura de prompt e resposta — versão 0.1.13

O mecanismo de captura de prompt do POC anterior (`Extensão/extension`) foi portado para esta POC de stream. O bridge observa envio por botão, Enter e `submit` do formulário; lê apenas o texto do editor. O prompt é mantido em memória na aba e vinculado pelo `attemptId` aleatório ao início da próxima requisição `POST /backend-api/f/conversation`. Não lê nem persiste o corpo da requisição de conversa, URL, IDs de conversa ou dados de conta.

Quando há captura de resposta, `prompt_text` e `response_text` são enviados na mesma chamada à API e persistidos na mesma linha `stream_captures`. Prompt e resposta têm limite de 100.000 caracteres cada. O backend migra bancos existentes adicionando `prompt_text`; linhas anteriores ficam com `NULL`. Payloads da extensão 0.1.12 sem prompt continuam aceitos e são armazenados como não pareados. O endpoint autenticado de capturas recentes agora devolve os dois textos.

Se a extensão estiver pausada, as filas transitórias de prompt são limpas e a captura da resposta não é encaminhada. Quando não há prompt observável no editor, o campo fica nulo, sem impedir o registro da resposta. Isso pode ocorrer em envios por áudio/anexo, mudanças na interface ou falta de correspondência entre o evento de envio e o início do stream; a associação é sequencial por aba e requer reteste real.

**Testes automatizados após a implementação:**

- `node --check` nos scripts da extensão e testes — `PASS`.
- Node: captura e pareamento no botão, Enter e submit; pausa descarta prompt pendente; regressão de metadados — 6 testes `PASS`.
- Python: persistência do prompt e resposta na mesma linha, compatibilidade com payload antigo, limites do prompt e regressão do backend — 11 testes `PASS`.

**Estado de navegador real:** `NOT_TESTED` na versão 0.1.13. Próximo reteste manual deve usar somente prompt e resposta sintéticos, confirmar o par na mesma linha do endpoint autenticado e testar botão/Enter, pausa e envio sem texto. A captura é opt-in pela configuração da POC; os registros não são exibidos como histórico ao usuário final. A versão continua local, sem identidade de máquina e sem backend corporativo.
