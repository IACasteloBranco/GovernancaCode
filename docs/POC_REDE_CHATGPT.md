# POC de captura no fluxo de rede do ChatGPT Web

> Registro experimental iniciado em 25/09/2026. A sonda permanece separada da extensão integrada 0.5.0; veja o [estado atual](ESTADO_ATUAL_2026-10-01.md). As observações de `HTTP 401` abaixo descrevem aqueles ensaios, não um diagnóstico da sessão atual.

**Estado:** investigação experimental. O print do DevTools de 25/09/2026 mostra uma requisição `conversation` via `fetch`, HTTP 200, 8,58 s, seguida por chamadas `prepare`, `batch` e `finalize`. O print não revela o corpo ou o sinal de conclusão; o protocolo da resposta permanece não identificado.

**Evidência da sonda em 25/09/2026:** dois envios distintos produziram `POST /backend-api/:id/conversation`, HTTP 200, `text/event-stream`. O `fetch end` ocorreu após 390–453 ms e marcou apenas a chegada dos headers. A cópia do corpo leu 23 frames/7.484 bytes em um envio e 21 frames/9.028 bytes no outro, mas terminou em `stream_error`. Nos dois casos, a chamada `sentinel/:id/finalize` terminou vários segundos **antes** do erro da cópia; portanto, não é evidência suficiente de conclusão da geração. A versão 0.2.2 preserva tipos de evento e marcador de fim já observados mesmo quando a leitura falha, e registra somente a classe do erro. O backend local respondeu `HTTP 401` aos prompts; sua autenticação é independente da sonda de rede e precisa ser corrigida para correlacionar entregas no backend.

**Nova evidência às 20:39:** a cópia de `conversation` leu 24 frames/9.223 bytes em 5.835 ms, incluindo 13 eventos `delta`, nove eventos `message` com subtipo ainda desconhecido e um marcador explícito `[DONE]`. Depois do marcador, a leitura da cópia terminou com `AbortError`. Isso distingue fim de protocolo (`[DONE]`) de fechamento limpo do corpo (`readerDone`), mas ainda não comprova que todo o conteúdo visível foi reconstruído. A versão 0.2.3 registra `protocolDone` e um resumo das formas dos objetos JSON dos eventos, sem registrar valores de texto, para localizar os campos necessários à reconstrução.

**Nova evidência às 20:44:** outro envio teve 23 frames/9.110 bytes, `protocolDone=1` e `AbortError`. Os eventos mostraram campos `v`, `p` e `o`, inclusive um caminho em `content/parts`; isso é compatível com deltas de atualização, mas não determina sozinho a ordem de montagem do texto. A versão 0.2.4 registra a sequência de até 32 formas de evento, o tipo da operação e as categorias dos caminhos. Valores de `v`, prompt e resposta continuam fora do diagnóstico.

## 1. Diagnóstico da extensão existente

- `extension/` permanece como implementação estável. `extension-network-poc/` é uma cópia isolada para o experimento.
- Manifest V3, versão inicial copiada `0.1.11`, injeta `src/content/observer.js` em `https://chatgpt.com/*` no mundo isolado e em `document_idle`. Permissões: `storage` e acesso ao backend local `http://127.0.0.1/*`.
- O observador captura o prompt ao detectar clique, Enter ou `submit`. Ele consulta `status` no service worker, envia o prompt ao backend e recebe `interaction_id`.
- A resposta atual é lida do DOM por `setInterval` a cada 500 ms, usando atributos de papel e conteúdo, com estados `complete`, `incomplete` e `capture_failed`. **Não há `MutationObserver` na implementação atual.** O sinal de streaming depende de um seletor de botão e pode faltar em variantes da interface.
- O service worker valida origem, aba, frame e `documentId`; monta chamadas fixas à API local e guarda o vínculo `interaction_id → documentId` em `chrome.storage.session`. O token também fica em sessão; instalação, conta declarada e habilitação ficam em `chrome.storage.local`.
- A API recebe `POST /v1/interactions` e `POST /v1/interactions/{id}/response`, e devolve confirmação. O popup mostra até 100 eventos diagnósticos de sessão, sem prompt, resposta ou token.
- O backend aceita um snapshot de resposta por evento e armazena `capture_status=complete|incomplete`. A POC de rede não deve enviar uma segunda resposta para o mesmo prompt enquanto a captura do DOM estiver ativa.

## 2. Perguntas empíricas antes de reconstruir a resposta

O ChatGPT Web não publica um contrato de transporte interno para esta extensão. A sonda inicial deve observar, em prompts sintéticos:

1. transporte usado por cada requisição candidata (`fetch`, XHR ou WebSocket);
2. método e caminho sem query string, status, tipo de conteúdo e duração;
3. se a resposta chega em chunks e se há um fechamento observável;
4. correspondência temporal entre o envio do prompt, a requisição candidata e a resposta visível;
5. mudanças em interrupção, regeneração, edição, ferramentas e erros.

Nesta fase, **não copiar corpos de requisição ou resposta**, headers, cookies, credenciais, query strings ou mensagens de WebSocket. Manter apenas metadados de requisições da mesma origem observadas durante uma janela curta após o envio do prompt. Não enviar os metadados da sonda ao backend; o popup exibe somente diagnóstico local.

## 3. Arquitetura proposta para POC A

```text
ChatGPT Web
  ├─ aplicação da página
  └─ sonda MAIN em document_start
       └─ eventos mínimos da comunicação candidata
            └─ ponte ISOLATED → service worker → diagnóstico local

Observador atual ISOLATED → service worker → backend
```

A versão 0.2.1 da sonda mede metadados e preserva o fluxo da página. Para a requisição `conversation` via `fetch`, lê uma cópia do stream e registra somente resumo estrutural: chunks, bytes, frames, tipos de evento e possíveis marcadores de fim. Não registra texto da resposta. Depois de confirmar o protocolo real, reconstruir os eventos reconhecidos, detectar o sinal explícito de término, associar ao evento de prompt local e comparar com o DOM. Só então enviar o snapshot final ao backend, usando um único produtor de resposta por interação. Eventos não reconhecidos devem ficar em estado `ERROR` ou `incomplete`, sem inventar um término por silêncio.

O `client_event_id` já é criado de forma síncrona no início da captura do prompt e aparece nos metadados da sonda como `attempt`. Essa associação por janela temporal serve apenas para descobrir a requisição candidata. **Ela ainda não prova** que uma resposta pertence ao prompt: a POC A precisará confirmar um identificador ou vínculo causal no protocolo observado, inclusive em regenerações, cancelamentos e múltiplas requisições simultâneas. `fetch end` nesta sonda significa chegada dos headers, não fim do corpo ou da geração.

O mundo `MAIN` compartilha o ambiente JavaScript da página e não recebe token nem acesso ao backend. A ponte não confere autenticidade criptográfica aos dados da página; o service worker continua validando formato, aba, origem e `documentId`. O código do `MAIN` nunca deve ler ou transmitir headers de autorização, cookies ou corpos de outras requisições.

## 4. Fronteira para POC B

Retenção/liberação só será considerada após a POC A demonstrar correlação e reconstrução em interações consecutivas. Clonar um `Response` para observação é diferente de reter o stream entregue à aplicação. A POC B precisa comprovar que o frontend aceita um stream atrasado sem quebrar cancelamento, ferramentas, tratamento de erro, controles ou estado interno. Se isso não for demonstrado, a alternativa é uma apresentação controlada fora do fluxo interno da página, documentando que não há atomicidade da interface original.

## 5. Evidência e aceite

Registrar para cada caso: versão do Chrome, modo Chat/Work, horário, ID local do envio, transporte, caminho redigido, status, tipo de conteúdo, começo/fim observados, eventos relevantes, resposta reconstruída, resposta visível e diferença. Usar somente textos sintéticos. A lista de casos inclui curta, longa, Markdown, tabela, código, interrupção, erro, regeneração, edição, envios consecutivos, conversa nova, troca de conversa e ferramentas quando disponíveis.

**Próximo gate:** executar a sonda de metadados no ChatGPT Web real. Não declarar mecanismo, sinal de término, POC A validada ou POC B viável antes dessa evidência.
