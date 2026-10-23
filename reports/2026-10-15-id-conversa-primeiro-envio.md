# ID da conversa no primeiro envio de um chat novo

## Decisão técnica

Registrar o primeiro envio com `conversation.capture_status = unknown` quando a rota ainda não contém `/c/<UUID>`. Nesse caso, não preencher `conversation.url` com `https://chatgpt.com/`. Se a rota já contém o ID no momento do envio, manter a URL observada. A mudança não altera a política de captura nem autoriza o piloto.

A extensão grava o prompt antes de a página atribuir a URL definitiva ao chat novo. A resposta posterior usa a rota atual para o vínculo local do turno, mas o backend não atualiza `conversation_json`. Usar essa rota posterior sem prova de que pertence à mesma tentativa pode atribuir outro chat se a pessoa navegar durante a resposta. O repositório não contém evidência de um ID confiável no stream da mesma requisição. A análise por conversa deve excluir interações com `conversation.capture_status = unknown`.

## Caso sintético e resultado

Entrada: envio de `Prompt sintético` em `https://chatgpt.com/` com a extensão habilitada.

Esperado: registrar o prompt e indicar que o ID da conversa não estava disponível no envio.

Observado antes da mudança: `{ "url": "https://chatgpt.com/", "capture_status": "observed" }`. O teste novo falhou com essa diferença.

Observado depois da mudança: a extensão envia `{ "capture_status": "unknown", "reason": "ID da conversa indisponível no momento do envio" }`. O backend aceita e persiste o campo sem URL. Para `https://chatgpt.com/g/g-p-123/c/00000000-0000-4000-8000-000000000030`, o teste confirma a URL com `capture_status = observed`.

Para reproduzir, execute as suítes da extensão e do backend indicadas abaixo. As fixtures do backend definem tokens e retenção sintéticos para impedir que o `.env` local altere o resultado.

## Arquivos alterados

- `extension/src/content/observer.js`, `extension/src/background/service-worker.js` e `extension/manifest.json`: estado da conversa e versão `0.4.6` do adaptador.
- `extension/tests/observer-network.test.mjs` e `extension/tests/blocker-manifest.test.mjs`: casos de conversa nova, conversa identificada e versão do pacote.
- `backend/tests/test_api.py` e `backend/tests/test_machine_identity.py`: persistência de contexto desconhecido e fixtures isoladas do `.env` local.
- `extension/README.md` e `docs/plans/PLANO_IMPLANTACAO_EXTENSAO_POC_v0.1.md`: limite da análise por conversa.
- `graphify-out/`: grafo atualizado depois da mudança de código.

## Verificações

| Verificação | Resultado |
| --- | --- |
| `node --test --test-isolation=none extension/tests/*.test.mjs` | `PASS`: 58 testes. |
| `.venv/Scripts/python.exe -m pytest -q tests -p no:cacheprovider --basetemp ../.tmp/conversation-id-20261015-all-final` em `backend/` | `PASS`: 19 testes, 1 aviso de depreciação do TestClient. |
| Envio em chat novo no Chrome após recarregar a extensão | `BLOCKED`: no ensaio de 2026-10-15, a tentativa atual marcou `data-governanca-prompt-capture=rejected`; não houve registro correspondente no banco. O último registro de chat novo continuou reportando `adapter_version=0.4.4` e a URL raiz observada. |
| ID definitivo do primeiro envio disponível para análise por conversa | `FAIL`: permanece ausente no contrato atual. |

## Reteste após atualização informada da extensão

Entrada sintética: `Validação do chat novo V2. Responda somente com OK-CHAT-NOVO-02.`. O texto foi enviado em um chat novo; a resposta da página foi `OK-CHAT-NOVO-02`. A captura do prompt ficou com estado `rejected`, e a consulta somente leitura ao banco não encontrou interação com esse texto. O último registro existente para chat novo tinha `adapter_version=0.4.4` e `conversation.capture_status=observed` com `url=https://chatgpt.com/`, evidência de que a tentativa anterior usou o pacote antigo. Não foi possível confirmar que o Chrome está executando o pacote `0.4.6`; o ensaio da implementação atual permanece bloqueado até essa confirmação e um novo envio sintético.

`graphify update .` concluiu a atualização do grafo. O comando avisou que não conseguiu ler algumas pastas temporárias de testes; elas não contêm as fontes alteradas.

Antes de usar agrupamentos por conversa no piloto, confirmar com dados sintéticos se o stream fornece um ID ligado à mesma tentativa. Se fornecer, implementar uma atualização restrita à interação original e testar envios simultâneos, troca de chat e repetição da atualização. Até lá, os agrupamentos devem contar e excluir os registros `unknown`.
