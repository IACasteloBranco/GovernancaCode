# Claude e metadados de arquivos — histórico até a versão 0.6.12

## Correção 0.6.12 — Artifact, Markdown e conclusão curta

A extração Claude prioriza contêineres de Markdown e serializa headings, listas, tabelas e blocos de código. Artifacts são reconhecidos apenas quando um `iframe[title="Visualize Widget"]` visível está presente no host da mensagem atual; captura somente presença no host, nunca lê o iframe remoto. O rótulo acessível `visualize:` pode fornecer nome sintético opcional. O marcador `VvisualizeVvisualize show_widget...` só é removido quando corresponde ao Artifact observado. A conclusão curta exige um sinal explícito de término em região de status, resposta associada, compositor pronto e estabilidade; texto estável sozinho continua `incomplete`, e interrupção explícita continua `incomplete`.

O Work forneceu snapshots semânticos sanitizados em `reports/evidence/DOM-ARTIFACT-QA-ARTIFACT-HTML-01-2026-10-06.txt` e `DOM-ARTIFACT-QA-MATERIAL-ONLY-01-2026-10-06.txt`. A correção usa os sinais confirmados e tem fixtures sintéticas. `0.6.12` aguarda o reteste independente; não representa aprovação de QA nem rollout.

## Correção 0.6.10 — identificação do reteste de fidelidade

A versão 0.6.10 identifica o pacote que contém a extração específica da resposta Claude adicionada para `BUG-CLAUDE-20261006-001`. A versão aparece no manifest, no popup e nos registros `adapter_version` enviados pelo service worker e pelo observador. Esta identificação permite distinguir o código atualizado de uma extensão 0.6.9 ainda carregada; a captura correta no DOM real depende de reteste independente.

Para recarregar a versão correta no Chrome: abra `chrome://extensions`, localize e remova a extensão integrada antiga; use **Carregar sem compactação** e selecione exatamente `Extensão/extension-prompt-block-poc/`; confirme **0.6.10** nos detalhes da extensão e no popup de diagnóstico; recarregue a aba do Claude; só então repita os envios por botão e Enter e confira `adapter_version` e `responses[].text` no SQLite/API. Se o registro ainda indicar 0.6.9, interrompa o reteste e verifique qual pasta foi carregada. A questão de política de CPF continua separada como `POLICY_QUESTION`.

## Correção 0.6.8 — ativação da captura no popup

Depois de recarregar a extensão, o token guardado em `chrome.storage.session` desaparece. O popup exigia um token em toda gravação e a validação HTML podia impedir o botão **Salvar configuração** de executar sem explicar a causa. A versão 0.6.8 aceita o token já presente na sessão, mostra quando ele precisa ser informado novamente e preserva na caixa a preferência de captura, distinguindo-a do estado efetivo. Para reativar após recarga, informe no popup o valor `LAB_API_TOKEN` de `backend/.env` e salve; não copie o token para diagnósticos. Passaram 53 testes Node. Não é necessário reiniciar o backend para esta correção.

## Correção 0.6.7 — entrega de resposta

No teste do PDF em 0.6.6, o anexo foi registrado com nome, tipo, tamanho e `source: selection_event`. A resposta não chegou ao banco: o script informou perda do canal da extensão. A versão 0.6.7 tenta novamente até três vezes quando o canal fecha ou o service worker não responde, sempre com o mesmo `client_event_id`, permitindo que a idempotência do backend evite duplicação. O diagnóstico agora distingue canal temporariamente indisponível de contexto da extensão invalidado. O conteúdo fica apenas na memória do script durante as tentativas. Uma invalidação permanente do contexto ou recarga da extensão durante a resposta ainda pode perder essa entrega; o registro anterior não é preenchido automaticamente. Passaram 52 testes Node. Recarregue a extensão e a aba para validar a nova entrega.

## Correção 0.6.6 — seleção de arquivos

Depois que a política voltou a funcionar na versão 0.6.5, o prompt foi confirmado, mas o PNG permaneceu `not_observed`. A versão 0.6.6 registra metadados expostos pelo objeto `File` nos eventos de seleção, colagem ou soltura do arquivo, sem ler bytes. Se nenhum cartão reconhecível estiver visível no envio, esse registro vira a evidência do anexo com `source: selection_event`; cartões observados usam `source: visible_card`. A fonte explicita a diferença de evidência: seleção anterior ao envio não comprova upload concluído. Um clique em controle com rótulo de remoção limpa a seleção pendente. Registros com essa fonte exigem reiniciar o backend atualizado antes do teste porque o contrato rejeita campos desconhecidos. Passaram 51 testes Node, 16 testes pytest e 23 verificações DOM sintéticas. A interface real ainda precisa de novo teste.

## Correção 0.6.5 — política ausente na aba

Após atualizar para 0.6.4, o popup indicou `Scripts incompletos (política: ausente; captura: ativa)`, sem `decision`. Nessa condição, a barreira de rede rejeita o envio por falta de autorização; o bloqueio manual pode estar desligado. A versão 0.6.5 carrega política e observador no mesmo pacote de scripts no `document_idle`, mantendo a barreira de rede no `document_start`. O diagnóstico de bloqueio de rede agora registra `missing` ou `expired`. Quando há anexo visível, a autorização para a requisição de conversa dura até dois minutos e continua válida para um único uso. Passaram 51 testes Node. Recarregue a extensão e a aba para validar a correção na interface real.

## Correção 0.6.4 — cartão real do Claude

Dois envios de PNG chegaram com `attachments_capture_status: not_observed`. A inspeção da página autenticada mostrou miniaturas em cartões `.cds-card-body`, com `alt` vazio. A versão 0.6.4 reconhece esses cartões dentro da região do compositor e registra `presence_only` quando o nome não está acessível. Cartões em mensagens antigas continuam excluídos. O teste com DOM sintético passou em 21 verificações; a captura real do arquivo ainda precisa ser repetida após atualizar a extensão e a aba.

## Correção 0.6.3 — miniaturas de imagens

No primeiro teste de PNG em Claude, o prompt e a resposta foram registrados, mas `attachments_capture_status` ficou `not_observed`. O adaptador agora reconhece miniaturas com URL `blob:` ou nome de imagem em `alt`, inclusive quando estão no mesmo contêiner do compositor, fora do campo de texto. Nome acessível gera `metadata_only`; miniatura sem nome gera `presence_only`. A busca ignora miniaturas de mensagens anteriores. Passaram 50 testes Node e 19 verificações de DOM com fixtures sintéticas. O teste na interface autenticada deve ser repetido após recarregar a extensão 0.6.3 e a aba do Claude.

## Diagnóstico 0.6.2

Quando o popup mostra captura habilitada, mas não há `decision`, `observer` nem `prompt` após envios no Claude, a aba pode estar sem os scripts da extensão. A versão 0.6.2 consulta diretamente a aba ativa ao abrir o popup e mostra **Estado da aba atual**: scripts presentes, reconhecimento do editor e reconhecimento do botão de envio. A consulta não envia conteúdo da conversa ao popup nem ao backend. Se os scripts estiverem ausentes, recarregue a aba e confira o acesso da extensão ao site `claude.ai` em `chrome://extensions`. Passaram 50 testes da extensão, incluindo os três estados principais desse diagnóstico.

## Correção 0.6.1

Após relato de ausência de captura no Claude (somente eventos `blocker`), o adaptador passou a aceitar um campo editável visível único sem exigir a classe ProseMirror e a reconhecer rótulos de envio/interrupção sem distinção de maiúsculas. A captura também é chamada imediatamente após a autorização local do evento, antes que os handlers da página possam limpar o editor. Eventos bloqueados não acionam essa chamada.

O popup registra `observer: platform=claude_web editor=found|missing send=found|missing editables=N`, sem texto de prompt. O diagnóstico atualiza quando esses sinais mudam. A suíte da extensão passou em 49 testes. Para testar a correção, recarregue a extensão e a aba Claude e confira a versão 0.6.1; ainda é necessário confirmar o resultado na sessão autenticada do usuário. Não é necessário reiniciar o backend para essa correção.

Implementado em `extension-prompt-block-poc/` e `backend/`. A extensão original permanece uma implementação anterior. A versão 0.6.0 adiciona Claude Web, metadados de anexos e evidências de materiais nas respostas. Não guarda bytes, base64, conteúdo extraído nem URLs de download dos arquivos.

## Registro

| Campo | Significado |
| --- | --- |
| `platform` | `chatgpt_web` ou `claude_web`, determinado pelo service worker a partir da origem da aba. |
| `attachments` | Metadados de anexos visíveis no compositor no instante da tentativa de envio. |
| `attachments_capture_status` | `observed`, `not_observed` ou `unavailable`. |
| `attachments_truncated` | A quantidade de evidências excedeu o limite da extensão. |
| `responses[].generated_materials` | Objeto com `capture_status`, `items` e `truncated`, associado à resposta observada. |

`observed` indica evidência na interface; `not_observed` indica que a região foi inspecionada e nenhum dos sinais reconhecidos foi encontrado; `unavailable` indica que não foi possível inspecionar a região, ou que o cliente antigo não enviou essa informação. Nenhum desses estados comprova captura integral.

Cada item contém `name`, `mime_type`, `size_bytes` quando acessíveis. `metadata_only` indica metadados disponíveis; `presence_only` indica somente presença. Não inferimos MIME pela extensão do nome. A extensão limita cada coleção a 20 itens; `MAX_ATTACHMENTS` no backend deve ser pelo menos 20 para aceitar o limite padrão.

Anexos são observados em cartões identificados por `data-file-name` ou test IDs de anexos. Nome, tipo e tamanho podem ser complementados por `FileList` quando existe um cartão visível com nome correspondente. Selecionar um arquivo e removê-lo antes de enviar não constitui evidência de envio. Não há leitura dos bytes nem retenção de objetos `File`.

Materiais são detectados dentro da mensagem do assistente por cartões de arquivos/artefatos, links de download reconhecidos ou controles de download. Uma frase como “criei o arquivo” ou um link comum não basta. Painéis de artefatos externos à mensagem, exportações feitas mais tarde e controles não reconhecidos podem não ser capturados. Links reconhecidos comprovam material disponibilizado na resposta, não autoria, integridade ou sucesso de download.

Prompts com anexo observado e texto vazio e respostas com material observado e texto vazio podem ser persistidos. A estabilidade da captura considera mudanças de texto e de metadados. Sem evidência de conclusão, a resposta continua `incomplete`.

## Claude

O adaptador reconhece editor ProseMirror, mensagens identificadas por `data-testid`/`font-claude-response`, controles de envio/interrupção e a transição de conversa nova para `/chat/<id>`. Há suporte a compositor sem formulário quando é possível delimitar seu contêiner pelos controles.

A identificação da pessoa, assinatura da instalação, token e política textual são compartilhados. A barreira experimental de rede reconhece `POST /api/organizations/<org>/chat_conversations/<chat>/completion`; outras rotas e mecanismos de transporte precisam de validação própria. O projeto Claude fica desconhecido quando não há evidência implementada para identificá-lo. A conta declarada no popup é uma configuração compartilhada, não uma identidade automaticamente extraída do fornecedor.

## Atualização e validação

1. Reinicie o backend com o código atualizado. A inicialização aplica a migração SQLite `0.3` automaticamente, preservando os registros existentes. Os novos campos de registros antigos começam como `unavailable`. O contrato HTTP mantém `schema_version: "0.1"`; esse número é independente da migração SQLite. Clientes antigos precisam atualizar o backend antes da extensão 0.6.0.
2. Recarregue `extension-prompt-block-poc/` em `chrome://extensions` e recarregue as abas de ChatGPT e Claude. Confira pessoa atribuída, token e captura habilitada.
3. Em cada plataforma, valide Enter e clique, conversa nova, resposta longa, interrupção e navegação. Compare prompt, resposta e plataforma pela API.
4. Envie um arquivo sintético, depois remova outro antes de enviar; confirme que o segundo não aparece como enviado. Teste também anexo sem texto.
5. Solicite um material e confira a evidência associada à resposta. Verifique nome/tipo/tamanho quando acessíveis e `presence_only` quando não forem. Envie outra pergunta e confirme que o material anterior não foi reutilizado.
6. Teste texto que apenas afirma ter criado um arquivo, sem controle ou cartão: deve permanecer `not_observed`. Repita bloqueio manual e bloqueio textual para verificar que envios retidos não são capturados.

Em 05/10/2026 passaram 45 testes Node, 16 testes pytest e 15 verificações em DOM real com fixtures sintéticas pelo Playwright. Incluem origem da plataforma, assinatura dos metadados, migração, idempotência, limites, rejeição de campos de conteúdo, materiais sem texto e isolamento entre respostas.

Para repetir os testes DOM, sirva `extension-prompt-block-poc/` localmente e abra `/tests/files-browser.html`; o resultado deve mostrar 15 verificações e nenhum `error`. Os testes Node usam `npm.cmd test` no Windows; os do backend usam `.venv/Scripts/python.exe -m pytest -q tests`.

A sessão de navegador disponível durante a implementação não estava autenticada no Claude. Assim, os testes com fixtures não constituem aceite da interface real; a rodada autenticada acima ainda está pendente, inclusive para os seletores de arquivos do ChatGPT.
