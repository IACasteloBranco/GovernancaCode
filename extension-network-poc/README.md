# POC de rede do ChatGPT Web — sonda de descoberta v0.2.4

Esta pasta é uma cópia experimental de `extension/`. A versão em uso continua intacta. A sonda ainda **não reconstrói o texto da resposta da rede**: ela identifica metadados do transporte e, para a requisição `conversation`, lê uma cópia do stream e resume sua estrutura. A captura de prompt, a captura de resposta pelo DOM e a entrega ao backend da versão anterior continuam ativas nesta cópia.

## Executar a descoberta

1. No Chrome, abra `chrome://extensions`, ative o modo de desenvolvedor e carregue esta pasta com **Carregar sem compactação**. Desative a extensão original durante o teste para evitar entregas duplicadas.
2. Abra ou recarregue uma aba em `https://chatgpt.com`. O `MAIN` é injetado em `document_start`; recarregar a aba após instalar ou atualizar a extensão é obrigatório.
3. Use uma conversa e prompts **sintéticos**. Envie primeiro uma pergunta curta e espere a resposta terminar. Depois faça duas perguntas consecutivas na mesma conversa. Abra e feche o popup para atualizar os eventos.
4. Em **Sonda de rede (somente local)**, copie os eventos `fetch`, `xhr`, `eventsource` ou `websocket` que aparecerem para cada `attempt`, especialmente `fetch stream_summary` ou `fetch stream_error` da requisição `conversation`. Os eventos `fetch end` indicam chegada dos headers, **não** término do stream. `protocolDone=1` indica que a cópia viu `[DONE]`; `readerDone=1` indica que o corpo terminou sem erro. A versão 0.2.4 mantém a sequência de formas dos eventos, até 32 posições, mesmo se a leitura terminar com `AbortError`.
5. Se nenhum evento aparecer, registre isso junto com o horário e a presença ou ausência de `prompt: confirmed` em **Entregas recentes**. Se houver `HTTP 401`, confira o token do backend no popup; isso não impede a sonda local de registrar metadados.

O popup da sonda não mostra prompt, resposta, corpo da requisição, headers, cookies, token, query string ou payload de WebSocket. Caminhos com segmentos não estáticos são redigidos como `:id`. O diagnóstico da sonda fica em `chrome.storage.session`, limitado aos 100 eventos mais recentes; ele não é enviado ao backend. O código no mundo `MAIN` não recebe o token do backend.

## Estado do experimento

- **Descoberta:** o print do DevTools e os registros da sonda de 25/09/2026 confirmam `conversation` via `fetch` com `text/event-stream`. Dois envios mostraram `[DONE]` antes de `AbortError`. A versão 0.2.4 registra a ordem das formas de evento e a categoria das operações de delta para definir a reconstrução. Ainda falta reconstruir e comparar o texto final.
- **POC A / Mirror Mode:** planejada; implementar somente após identificar o fluxo candidato. Ela deverá copiar o fluxo sem consumir o original, reconstruir a resposta, ligar o resultado ao `client_event_id` do prompt e comparar com o DOM antes de substituir o produtor de resposta atual.
- **POC B / Buffered Mode:** depende da POC A validada e de demonstração de retenção segura; ainda não implementada.

Consulte [o diagnóstico e os critérios de aceite](../docs/POC_REDE_CHATGPT.md). Execute `npm test` nesta pasta para verificar o pacote local.
