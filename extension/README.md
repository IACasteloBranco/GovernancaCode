# Extensão de laboratório v0.1.11

Inicie o backend na mesma máquina em `http://127.0.0.1:8000`. No Chrome, abra `chrome://extensions`, habilite o modo de desenvolvedor e use **Carregar sem compactação**, selecionando esta pasta.

No popup, informe conta fictícia e token do backend, habilite a captura e salve. Abra ou recarregue `https://chatgpt.com`. Reiniciar o navegador exige informar novamente o token. O ID da instalação permanece entre reinícios.

A extensão observa clique no botão de envio, Enter e envio do formulário, acompanha respostas novas e envia os eventos ao backend. O painel mostra IDs de entregas confirmadas. Consulte esses IDs pela API autenticada para comparar o conteúdo com a página. Se nenhuma resposta for observada, o painel mostra `capture_failed` e não envia uma resposta vazia ao backend. Projeto ainda é registrado como desconhecido com motivo; anexos não são capturados nesta base.

## Limites da primeira implementação

Seletores da interface precisam de validação manual no Chrome. O adapter reconhece tanto mensagens com `data-message-author-role` quanto a estrutura com `data-content-search-unit-key`, `data-conversation-role` e `data-markdown-text-style` observada no teste de 25/09/2026. O adapter aceita a primeira mudança de URL de uma conversa nova, inclusive quando `/c/...` aparece dentro da rota de um projeto, e ignora alterações apenas de consulta ou fragmento na URL. Mudanças para outra conversa encerram a observação como incompleta. Quando o streaming não é observado, a extensão envia `incomplete` após dois segundos de estabilidade se os controles da resposta aparecerem; sem esse sinal, aguarda dez segundos. O adapter procura a resposta após o último prompt na ordem das mensagens da página, inclusive quando a contagem ou o texto das respostas anteriores permanece igual. Se essa estrutura não estiver disponível, usa a comparação com o histórico anterior. Ao iniciar outro prompt, ele verifica novamente a resposta anterior antes de registrar `capture_failed:new_prompt`. Pausas longas, edição, regeneração, várias respostas ou mudanças no DOM podem impedir a associação. O diagnóstico informa a causa local de `capture_failed`. Não há fila offline nem reenvio automático; fechamento da aba pode perder a entrega final. Uma tentativa observada não comprova aceitação pelo fornecedor.

O token fica apenas em armazenamento de sessão, restrito aos contextos confiáveis. Conteúdo permanece em memória até o envio; o diagnóstico guarda somente metadados. O destino da API é fixo nesta versão. Use somente dados sintéticos.

Após recarregar ou atualizar a extensão em `chrome://extensions`, recarregue também cada aba do ChatGPT. Uma aba com content script antigo pode perder a conexão com o service worker; nesse caso, o console indica que a aba precisa ser recarregada. Em `capture_failed`, o popup informa contagens de mensagens e de estruturas alternativas da página para ajudar a localizar falhas de seleção. Mensagens de diagnóstico não incluem prompt, resposta ou token.

## Verificação

Execute `npm test` para verificar as restrições básicas do pacote. Para aceite real, siga o [roteiro de validação local](../docs/ROTEIRO_VALIDACAO_LOCAL_POC_v0.1.md): clique, Enter, respostas curtas/longas, interrupção, navegação, duas abas e falha da API. Registre resultados antes de considerar a captura validada.
