# POC local de captura de stream

Variante isolada da POC de rede existente. Reaproveita o observador `fetch` no mundo `MAIN` e o parser DPU/SSE. A versão 0.1.13 captura o texto do prompt no editor no evento de envio, associa-o em memória à próxima requisição de conversa e persiste prompt e resposta reconstruída juntos no SQLite local. Não associa conta, pessoa ou ID de conversa.

## O que persiste

- Texto do prompt observado no editor no momento do envio e texto da resposta reconstruído em ordem de blocos DPU, na mesma linha de captura quando a associação é observada.
- Métricas e rótulos técnicos: endpoint, status, MIME, bytes, chunks, frames, marcador de fim, duração, forma dos eventos e sequência de tipos/formatos.
- Metadados observados de artefatos: nome, MIME type, tamanho quando fornecido, tipo detectado e a origem dessa classificação (`mime_type`, extensão do nome ou `unknown`).
- Identificador aleatório por tentativa, usado apenas para idempotência.

Não guarda o corpo SSE bruto, URL assinada de download, conta, pessoa, ID de máquina, cookies ou cabeçalhos gerais da página. O prompt fica somente na memória transitória da aba até a sonda observar o início do próximo `POST /backend-api/f/conversation`; então é associado pelo ID aleatório daquela tentativa. Se a resposta for capturada, o prompt e o texto reconstruído são enviados juntos à API e persistidos na mesma linha. Se não houver prompt observável, `prompt_text` fica nulo e a resposta ainda pode ser registrada. O prompt só é capturado com a extensão ativada. A sonda também observa o JSON de metadados de `/backend-api/conversation/:id/interpreter/download` e os cabeçalhos de `/backend-api/estuary/content`. Para a resposta do endpoint de transferência, lê somente os cabeçalhos; o corpo do arquivo não é lido nem persistido pela extensão. A sonda não altera a resposta consumida pelo ChatGPT. Snapshots completos e respostas parciais com texto são enviados com classificação explícita `complete`/`incomplete`. `complete` exige marcador final, leitura concluída e ausência de truncamento. Uma falha de leitura pode resultar em `incomplete` mesmo que o marcador final já tenha sido observado.

Metadados são gravados em `artifact_metadata`, separados das respostas. MIME explícito tem precedência para `file_type`; se estiver ausente ou for `application/octet-stream`, o tipo pode ser inferido pela extensão de `file_name` e é rotulado como inferido. Campos desconhecidos ficam nulos. URLs, IDs de conversa e IDs de arquivo não são armazenados.

Operações DPU `append` e `replace` em texto são aplicadas. Operações de alteração ainda não suportadas são sinalizadas como truncamento, impedindo que sejam classificadas como completas até que a semântica seja implementada e validada.

## Preparar e executar

Requer Python 3.11+ e Chrome ou Chromium. Não instala dependências Python nem usa a API oficial de identificação do backend.

1. O `backend/.env` local já foi criado a partir de `backend/.env.example`, com token aleatório próprio, banco em `backend/data/stream-captures.sqlite3`, retenção de sete dias e bind somente em `127.0.0.1:8766`. O `.env` e o banco estão ignorados pelo Git.
2. Inicie a API a partir desta pasta:

   ```sh
   cd backend
   python server.py
   ```

3. Em `chrome://extensions`, ative o modo do desenvolvedor e carregue a pasta `extension` como extensão descompactada. Depois, recarregue a aba do ChatGPT.
4. Abra o popup da extensão, cole o valor de `LAB_API_TOKEN` de `backend/.env` e marque **Ativar captura**. O token só fica em `chrome.storage.session`; será necessário inseri-lo de novo depois que o navegador encerrar a sessão.
5. Na aba do ChatGPT, use um prompt sintético. O popup mostra o estado e métricas da captura; a API autenticada confirma a persistência pareada de prompt e resposta no SQLite.
6. Para testar metadados, gere um artefato sintético. O endpoint de metadados JSON pode informar nome/MIME/tamanho; se vier vazio, faça o download pela própria interface para que a extensão possa observar `Content-Disposition`, `Content-Type` e `Content-Length`. Nenhum byte do arquivo é enviado à API local.

Para conferir uma captura armazenada, use o endpoint local autenticado `GET http://127.0.0.1:8766/v1/stream-captures/recent` com o token de laboratório. A rota devolve no máximo 20 interações recentes, com `prompt_text` e `response_text`. Capturas antigas e payloads da extensão 0.1.12 permanecem compatíveis e retornam `prompt_text: null`. A rota pública `/health` confirma que a API e o SQLite inicializaram.

Para consultar os metadados recentes de artefatos, use `GET http://127.0.0.1:8766/v1/artifact-metadata/recent` com o mesmo token. A resposta retorna no máximo 20 observações, sem conteúdo de arquivo ou URL de download.

## Limites deste primeiro teste

- É uma prova de conceito dependente da implementação web atual; mudanças nos eventos da interface ou no formato DPU/SSE podem exigir atualização do observador/parser.
- A correlação prompt-resposta é transitória e sequencial dentro da aba: o editor é lido no envio e vinculado à próxima requisição `conversation` iniciada. Envios por voz/anexo sem texto observável, múltiplos streams por um mesmo envio ou eventos fora de ordem podem deixar `prompt_text` nulo ou exigir reteste. Nenhum ID de conversa é persistido.
- Os ensaios de geração de TXT e CSV pela extensão chegaram ao SQLite, mas a reconstrução do texto ficou incompleta/corrompida. A transferência do arquivo e seus metadados estruturados ainda não são capturados nesta variante. Consulte [PROGRESSO_TESTES_CAPTURA.md](PROGRESSO_TESTES_CAPTURA.md) para os resultados dos testes 1–4 e repita os casos depois das alterações do parser.
- Respostas interrompidas e erros de stream com texto parcial são armazenados como `incomplete`; a ausência de texto de resposta não cria registro.
- A comunicação com a API local exige token aleatório de laboratório; esse token autoriza leitura/escrita local, mas não identifica uma pessoa.
- Desative a captura no popup após os ensaios e use apenas conteúdo sintético enquanto a POC estiver ativa.

## Verificações locais

```sh
cd backend
python -m unittest discover -s tests -v
cd ../extension
node --check src/content/network-probe-main.js
node --check src/content/network-bridge.js
node --check src/background/service-worker.js
node --check src/popup/popup.js
node --test tests/artifact-metadata.test.mjs
node --test tests/prompt-correlation.test.mjs
```
