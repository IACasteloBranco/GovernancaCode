# Codex status — metadados de artefatos na POC de stream

**WORK-ID:** ARTIFACT-METADATA-POC-0.1.12  
**DATA:** 2026-10-08  
**STATUS:** READY_FOR_RETEST

## CHANGE-SUMMARY

A extensão observa o JSON do endpoint de metadados e os cabeçalhos da resposta de transferência iniciada pela interface. Persiste somente nome, MIME, tamanho disponível, origem e tipo detectado com a origem da classificação. Não lê nem envia o corpo do artefato e não armazena URL assinada nem IDs de conversa/arquivo. A API expõe consulta autenticada dos 20 metadados mais recentes; o popup lista as observações.

MIME explícito prevalece. Quando não está presente ou é `application/octet-stream`, a extensão usa a extensão do nome como inferência e registra `type_source=filename_extension`. JSON sem nenhum campo útil é descartado; CSV com metadados JSON nulos pode ser identificado pelos cabeçalhos da transferência, se ela for iniciada pela interface.

## FILES-CHANGED

- `governanca-main/governanca-main/stream-capture-poc/extension/src/content/network-probe-main.js`
- `governanca-main/governanca-main/stream-capture-poc/extension/src/content/network-bridge.js`
- `governanca-main/governanca-main/stream-capture-poc/extension/src/background/service-worker.js`
- `governanca-main/governanca-main/stream-capture-poc/extension/src/popup/popup.html`
- `governanca-main/governanca-main/stream-capture-poc/extension/src/popup/popup.js`
- `governanca-main/governanca-main/stream-capture-poc/extension/manifest.json` (versão `0.1.12`)
- `governanca-main/governanca-main/stream-capture-poc/extension/tests/artifact-metadata.test.mjs`
- `governanca-main/governanca-main/stream-capture-poc/backend/server.py`
- `governanca-main/governanca-main/stream-capture-poc/backend/tests/test_server.py`
- `governanca-main/governanca-main/stream-capture-poc/README.md`
- `governanca-main/governanca-main/stream-capture-poc/PROGRESSO_TESTES_CAPTURA.md`

## TESTS-ADDED

- 3 testes Node: extração allowlist de JSON sem URL assinada; observação dos cabeçalhos sem ler o corpo; respeito ao estado pausado.
- 3 testes Python: persistência de MIME explícito; inferência pela extensão quando MIME ausente/genérico; idempotência e rejeição de URLs, caminhos e payload sem metadados.

## TEST-RESULTS

- JavaScript: `node --check` nos quatro arquivos da extensão — PASS.
- Extensão: `node --test tests/artifact-metadata.test.mjs` — 3 PASS.
- Backend: `python -m unittest discover -s tests -v` — 8 PASS.
- API local reiniciada; `/health` respondeu `stream-capture-0.2`; `/v1/artifact-metadata/recent` autenticado respondeu sem erro.
- Navegador real: NOT_TESTED.

## RISKS

- O endpoint de metadados pode devolver campos nulos; nesse caso, o JSON sozinho não identifica o tipo.
- Observações do JSON e dos cabeçalhos são armazenadas separadamente. Sem persistir IDs do aplicativo, a POC não garante que duas observações correspondam ao mesmo artefato.
- Os endpoints são detalhes da implementação web atual e podem mudar.
- Cabeçalhos de transferência só são observados quando a própria interface inicia a requisição; a extensão não inicia downloads.

## RETEST-INSTRUCTIONS

1. Em `chrome://extensions`, recarregar a extensão e confirmar versão `0.1.12`; recarregar a aba do ChatGPT.
2. Confirmar API acessível e captura ativa no popup.
3. Gerar um CSV sintético e um PDF sintético. Para testar `download_headers`, iniciar o download pela interface.
4. Verificar no popup ou em `/v1/artifact-metadata/recent` nome, MIME, tamanho quando informado, origem e `type_source`.
5. Confirmar que nenhuma observação contém URL assinada, ID de conversa/arquivo ou conteúdo do artefato.
6. Registrar cada caso como PASS/FAIL/BLOCKED/NOT_TESTED em relatório independente de QA. Não aprovar a própria implementação pelo Codex.
