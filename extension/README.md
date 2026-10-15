# Captura local de prompt e resposta

Para arquivos gerados ou baixados, a extensao le apenas os cabecalhos `Content-Disposition`, `Content-Type` e `Content-Length`. Nao clona nem le o corpo; metadados ausentes ficam nulos.

Esta é a extensão Chrome ativa em `extension/`. Ela aplica a política local antes do envio, captura o prompt no editor e reconstrói a resposta da cópia do stream `POST /backend-api/f/conversation`. Não usa API de IA. O backend local em `127.0.0.1:8000` grava os textos em `interactions` e `responses`, atribuídos à instalação e à pessoa cadastrada.

O stream bruto, cookies, cabeçalhos de autenticação e bytes de arquivos não são gravados. `stream_captures` continua armazenando somente métricas e rótulos técnicos. Metadados de arquivos enviados acompanham a interação em `interactions.attachments_json`; metadados de arquivos gerados ou baixados continuam em `artifact_metadata`. As gravações são assinadas pela chave da instalação e exigem o token local configurado no popup.

## Usar

1. Inicie o backend em `backend/` com `.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000`.
2. Em `chrome://extensions`, carregue ou recarregue a pasta `extension` como extensão descompactada. Recarregue também a aba do ChatGPT após uma atualização da extensão.
3. No popup, configure o `LAB_API_TOKEN` definido em `backend/.env`, cadastre e atribua a instalação a uma pessoa, e habilite a captura.
4. Faça ensaios somente com conteúdo sintético. O bloqueador mantém o envio fechado quando a política ou a atribuição não está disponível.

O coordenador registra o prompt ao liberar o envio e vincula seu ID ao primeiro POST de conversa. A sonda lê `response.clone()` sem alterar o stream consumido pelo ChatGPT. O texto é reconstruído por mensagem do assistente e índice de bloco, aplicando snapshots e operações DPU conhecidas. A resposta recebe `complete` apenas com marcador `[DONE]` único, estado final do assistente, leitura encerrada ou aborto posterior ao marcador e ausência de truncamento. Uma interrupção ou formato não reconhecido fica `incomplete`.

No envio, a extensão observa os seletores de arquivo e os cartões de anexo dentro do compositor ativo. Ela registra nome, MIME informado pelo navegador e tamanho quando disponíveis; o cartão pode expor apenas o nome. Prompt vazio só é aceito quando há arquivo selecionado observado. A captura não lê bytes, não deduz MIME pela extensão do nome e não comprova que o serviço remoto recebeu ou processou o arquivo. Se os controles não puderem ser inspecionados, o estado fica `unavailable`; se forem inspecionados sem arquivo, fica `not_observed`.

O comando **Tentar novamente** reavalia o mesmo prompt pela política antes de liberar outro POST. O vínculo local usa o caminho da conversa e o UUID `data-turn-key`; apenas o hash SHA-256 do texto normalizado acompanha o vínculo, para validar que o texto continua correspondente. O histórico mantém os 500 vínculos mais recentes, então a nova resposta continua ligada à interação original após recarregar a aba. Cada resposta usa seu próprio `client_event_id`, que também identifica seu registro técnico em `stream_captures`. Mensagens dirigidas a ferramentas e mensagens de raciocínio não entram no texto final.

## Verificação

Na raiz do repositório:

```sh
node --test --test-isolation=none extension/tests/*.test.mjs
```

Depois de recarregar a extensão, envie um prompt sintético e compare o texto visível com `responses.text` da interação recente no SQLite ou pelo endpoint autenticado `GET /v1/interactions/{interaction_id}`. Confira também a atribuição da máquina. A resposta pode ter Markdown no stream e formatação renderizada diferente na página.

## Limites

- No primeiro envio de uma conversa nova, `conversation` fica `unknown` quando a rota ainda não contém o ID. A análise por conversa não inclui esse envio. A extensão não atualiza esse campo depois que a URL muda.
- O protocolo privado do ChatGPT pode mudar. Patches de texto não reconhecidos e estados terminais ambíguos devem ficar incompletos.
- O texto parcial de uma resposta interrompida pode ser gravado com status `incomplete`.
- A correlação depende da aba ativa e do primeiro POST de conversa após a liberação. Recarregar a aba durante uma resposta encerra a tentativa sem entrega confirmada.
- Turnos sem UUID ou sem vínculo local permanecem bloqueados; os demais modos do menu de regeneração ainda não têm cobertura.
- A página e o stream são a origem dos dados observados; a extensão não garante autenticidade criptográfica do conteúdo fornecido pelo próprio site.
