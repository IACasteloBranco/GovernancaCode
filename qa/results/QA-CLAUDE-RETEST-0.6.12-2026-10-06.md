# QA Claude 0.6.12 — R1 bloqueada e R2 retestada parcialmente

**Data:** 2026-10-06  
**Pedido:** `coordination/retests/BUG-CLAUDE-20261006-002-003-004-0.6.12.md`  
**Site:** Claude (`claude.ai`)  
**Versão candidata no manifest:** `0.6.12` em `Extensão/extension-prompt-block-poc/manifest.json`  
**Versão reportada pelas interações existentes no SQLite:** `0.6.10`  
**Dados:** nenhuma nova entrada foi enviada; as entradas sintéticas visíveis eram de execuções anteriores.

**Complemento de ambiente:** em 2026-10-06, inventário de superfícies mostrou somente Codex In-app Browser e Codex MCP Apps. A tentativa de abrir `chrome://extensions` em um perfil Chrome de QA retornou que o navegador Chrome não está disponível. Assim, não há gerenciador de extensões para remover a cópia antiga ou carregar a pasta unpacked nesta sessão.

**Rechecagem após refresh solicitada:** o inventário continuou mostrando somente Codex In-app Browser e Codex MCP Apps; o perfil Chrome continua indisponível. Não foi possível confirmar a extensão pelo popup, e nenhum prompt foi enviado.

**Rechecagem após reinstalação informada pelo usuário:** o inventário segue sem perfil Chrome e abrir `chrome://extensions` retorna `Browser is not available: chrome`. A consulta somente leitura ao SQLite não encontrou interação nova: os registros mais recentes continuam com `adapter_version=0.6.10`. A versão carregada e o popup da candidata `0.6.12` continuam sem confirmação; nenhum prompt foi enviado.

## Complemento R2 — após reinstalação/refresh do usuário

O usuário informou que a extensão `0.6.12` foi reinstalada no navegador do GPT. Uma conversa nova foi aberta em `claude.ai/new` e o prompt sintético de identificação foi enviado. A interação correspondente e sua resposta confirmaram `adapter_version=0.6.12`; portanto, os registros antigos `0.6.10` não foram usados como evidência desta rodada.

| TEST-ID | Caso | Evidência | Estado |
|---|---|---|---|
| QA-PREP-VERSION-0612-R2 | Prompt sintético de identificação | `interaction_id=3cc4753a-1a82-4f6a-a54b-cff2463f4083`; request e response `adapter_version=0.6.12`, `capture_status=complete`. O texto também contém uma saudação adicional, então o marcador serviu para identificar a interação, não como teste de resposta exata. | `PASS` |
| QA-CLAUDE-BASE-BUTTON-001-R612 | Resposta curta por botão | `interaction_id=73fb80fe-7d0d-4215-a9fd-44d5fd6eb108`; resposta exatamente `QA-CLAUDE-BASE-01`; `capture_status=complete`; versões do pedido e resposta `0.6.12`. | `PASS` |
| QA-CLAUDE-BASE-ENTER-001-R612 | Resposta curta por Enter | `interaction_id=9487b454-af6e-4184-a1fd-44d5fd6eb108`; resposta exatamente `QA-CLAUDE-ENTER-01`; `capture_status=complete`; versões do pedido e resposta `0.6.12`. | `PASS` |
| QA-CLAUDE-LONG-001-R612 | Resposta longa, 12 parágrafos sintéticos | `interaction_id=615458f3-8723-4f39-ad16-1b2890ab945b`; 4.177 caracteres, início `QA-LONG-START-0612`, fim `QA-LONG-END-0612`; resposta visível concluída e persistida `complete`. | `PASS` |
| QA-CLAUDE-INTERRUPT-001-R612 | Interrupção deliberada de resposta longa | `interaction_id=5dff353d-9683-4cca-8274-49f2b418eeda`; UI indicou interrupção; 1.145 caracteres, marcador inicial presente e final ausente; request/response `0.6.12`, `capture_status=incomplete`. | `PASS` |
| QA-CLAUDE-MARKDOWN-001-R612 | Heading, parágrafo, lista, tabela e código | `interaction_id=e389a608-ee1f-4273-8942-c32690a50fc3`; UI mostrou `QA-MD-CODE-0612`, tabela com células e marcadores. SQLite preservou lista, células e separadores da tabela, mas omitiu o bloco e `QA-MD-CODE-0612`; não persistiu a contaminação textual de interface vista em outro ponto da UI. | `FAIL` |
| QA-CLAUDE-MATERIAL-ARTIFACT-001-R612 | Artifact HTML separado com prosa | `interaction_id=216bcfa5-824d-4b22-96fd-f71fe43da181`; Artifact visualmente exibido em painel separado. SQLite: `generated_materials.capture_status=not_observed`, `items=[]`. Texto persistido não contém os marcadores internos `VvisualizeVvisualize show_widget` ou `visualize:`, HTML ou URL. | `FAIL` |
| QA-CLAUDE-MATERIAL-ONLY-001-R612 | Artifact HTML solicitado sem prosa | `interaction_id=d82892f8-d4c7-4a44-8c7e-953a242f97b9`; Artifact visualmente exibido. A UI também mostrou texto de explicação/afirmação de criação apesar da instrução para deixar a resposta vazia. SQLite: `generated_materials.capture_status=not_observed`, `items=[]`; sem protocolo interno, HTML ou URL no texto persistido. | `FAIL` |
| QA-CLAUDE-MATERIAL-NO-WIDGET-001-R612 | Menção comum a “Artifact” sem material novo | A UI exibiu toast: `Envio bloqueado: O bloqueio manual de todos os envios está ligado no popup.` Nenhuma interação foi criada para o marcador `QA-ARTIFACT-MENTION-0612`. | `BLOCKED` |
| QA-CLAUDE-MATERIAL-STALE-001-R612 | Não associar Artifact antigo à resposta atual | Não foi possível criar a resposta comum seguinte por causa do bloqueio manual global de envios. | `BLOCKED` |
| QA-CLAUDE-STABLE-NO-SIGNAL-001-R612 | Texto estável sem sinal explícito de conclusão | Não executado nesta rodada; requer novo prompt, mas os envios foram bloqueados pelo controle manual global antes desse caso. | `NOT_TESTED` |

### Observação de escopo do Artifact

Para confirmar a existência do painel/material, usei somente a renderização visual da página. Não naveguei ao iframe, consultei seu DOM/atributos, URL, rede ou conteúdo interno. Os campos do SQLite foram consultados por marcador sintético e resumidos como estados/indicadores; nenhum HTML remoto foi recuperado.

### Estado R2

- `PASS`: 5, incluindo a verificação de versão.
- `FAIL`: 3, BUG-003 e BUG-004 (dois casos do material).
- `BLOCKED`: 2, menção sem widget e associação de Artifact antigo, devido ao bloqueio manual ligado no popup.
- `NOT_TESTED`: 1, texto estável sem sinal explícito.
- BUG-002: os casos curtos por botão/Enter, longa concluída e interrupção passaram neste reteste; o cenário de texto estável sem sinal não foi testado.
- BUG-003 e BUG-004 continuam com falhas reproduzidas na `0.6.12`.
- A presença do bloqueio manual impediu completar a regressão; não alterei a configuração do popup.

**Recomendação R2:** `REJECT` para aprovação de QA da `0.6.12` enquanto BUG-003 e BUG-004 falham. Executar os casos bloqueados após o responsável desligar o bloqueio manual no popup; isso não substitui a correção e o reteste dos dois bugs. Nenhuma decisão de rollout é tomada por este relatório.

## Complemento R3 — autorização para continuação e limite do popup

**Autorização humana:** recebida para desligar temporariamente `Bloquear todos os envios` exclusivamente durante os casos sintéticos pendentes, e restaurar o estado original ao final.

**Estado inicial registrado:** ativado, conforme o toast observado na R2: “Envio bloqueado: O bloqueio manual de todos os envios está ligado no popup.” Não houve alteração por esta rodada.

**Tentativa de execução:** o inventário do controle de navegador nesta sessão expôs apenas a aba do Claude no Codex In-app Browser e MCP Apps. O popup da extensão e o gerenciador de extensões não estão disponíveis como superfícies controláveis; não foi possível desligar ou confirmar o toggle. Para preservar o estado autorizado, não tentei alterar armazenamento, abrir páginas internas da extensão, nem enviar prompts adicionais.

| TEST-ID | Caso pendente | Estado | Motivo |
|---|---|---|---|
| QA-CLAUDE-MATERIAL-NO-WIDGET-001-R612 | Menção comum a `Artifact` sem widget | `BLOCKED` | Toggle manual ligado e popup inacessível nesta sessão. |
| QA-CLAUDE-MATERIAL-STALE-001-R612 | Isolamento de Artifact antigo | `BLOCKED` | Requer nova resposta enviada; toggle manual ligado e popup inacessível. |
| QA-CLAUDE-STABLE-NO-SIGNAL-001-R612 | Texto estável sem sinal explícito de conclusão | `NOT_TESTED` | Requer novo prompt; toggle manual ligado e popup inacessível. |

**Restauração:** não aplicável; o bloqueio não foi alterado. Seu estado atual é presumido como o estado inicial ativado, mas não pôde ser revalidado no popup.

**Próximo requisito naquele momento:** disponibilizar o popup da extensão como superfície acessível ao Work, ou o responsável humano desligar o toggle e informar quando estiver pronto. A correção do estado pelo usuário e os resultados da continuação estão registrados em R4 abaixo.

## Complemento R4 — após correção do estado do bloqueio

O usuário esclareceu que `Bloquear todos os envios` estava desligado e nunca havia sido ativado. O toast de bloqueio observado na R2 permanece registrado como evidência contraditória. Não acessei o popup nem alterei o toggle; os envios a seguir passaram na interface, e todas as interações novas confirmaram `adapter_version=0.6.12`.

| TEST-ID | Caso | Evidência | Estado |
|---|---|---|---|
| QA-CLAUDE-MATERIAL-NO-WIDGET-001-R612-R4 | Menção comum a `Artifact` sem widget | `interaction_id=43eae52c-e16e-4f01-932a-ef3694b53502`; resposta curta foi enviada; request e response `0.6.12`, `capture_status=complete`; `generated_materials.capture_status=not_observed`, `items=[]`. | `PASS` |
| QA-CLAUDE-MATERIAL-STALE-001-R612-R4 | Isolamento de Artifact antigo | Em conversa que continha Artifact sintético anterior, a nova resposta visível foi somente `QA-MATERIAL-ISOLATION-0612`. `interaction_id=81ecf004-45f2-40c7-89a2-7d68adb40c13`; request/response `0.6.12`, `capture_status=complete`; `generated_materials=not_observed`, `items=[]`; texto persistido não contém material antigo. | `PASS` |
| QA-CLAUDE-STABLE-NO-SIGNAL-001-R612-R4 | Texto aparentemente estável enquanto a resposta ainda não tinha sinal de término | Durante a geração, a UI ainda mostrava atividade; capturas visuais consecutivas mostraram o mesmo trecho parcial sem marcador final. Nesse intervalo, `interaction_id=4b5c1f55-19b9-491f-9a79-c7d38debb5fd` permanecia `request_captured`, sem resposta e sem `capture_status=complete`. Após a UI concluir, o registro ficou `complete`, `response_version=0.6.12`, 20.613 caracteres, com marcadores inicial/final. | `PASS` |

**Estado do bloqueio e restauração:** estado original registrado como desligado conforme declaração do usuário. Nenhuma alteração foi feita; portanto, a restauração consistiu em manter esse estado. Não foi possível confirmar o valor diretamente no popup, que não está disponível nesta sessão. Os envios aceitos após a correção confirmam que o fluxo estava operacional.

**Resultado dos casos pendentes:** 3 `PASS`, 0 `FAIL`, 0 `BLOCKED`. Esta complementação fecha apenas os três casos pendentes da rodada; não altera BUG-002, BUG-003 ou BUG-004 nem a recomendação R2 relativa às falhas de Markdown e Artifact.

## Resultado da preparação — R1 (histórico)

| Verificação | Resultado | Estado |
|---|---|---|
| Manifest na pasta candidata | Informa `0.6.12` | Confirmado |
| Versão efetivamente reportada pelo navegador/SQLite | Registros existentes mais recentes reportam `adapter_version=0.6.10` | Divergente |
| Recarregar e instalar a extensão candidata nesta sessão | A sessão disponível é o navegador embutido; não foi possível confirmar/carregar a pasta unpacked nem verificar o popup de diagnóstico | Não realizado |
| Perfil Chrome de QA | Não disponível neste ambiente | Bloqueado |
| Snapshot da conversa | Mostrou conteúdo de casos sintéticos anteriores e Artifact HTML visível | Observação passiva; sem navegação ou requisição direta ao iframe |

O encaminhamento determina interromper o reteste se qualquer indicador ou interação mostrar versão diferente da `0.6.12`. Como o SQLite reporta `0.6.10` e não foi possível confirmar a extensão candidata ativa, os cenários de validação não foram executados. Não foram enviados prompts novos.

## Casos da rodada — R1 (histórico)

| TEST-ID | Caso | Estado | Evidência / motivo |
|---|---|---|---|
| QA-CLAUDE-MATERIAL-ARTIFACT-001-R612 | Artifact HTML e resposta sem prosa explicativa | `BLOCKED` | A sessão ainda reporta `0.6.10`; não foi comparado nenhum registro novo da `0.6.12`. |
| QA-CLAUDE-MATERIAL-ARTIFACT-NO-WIDGET-R612 | Menção comum a “Artifact” sem widget | `NOT_TESTED` | Interrompido pela divergência de versão. |
| QA-CLAUDE-MATERIAL-STALE-ASSOCIATION-R612 | Não associar Artifact antigo à nova resposta | `NOT_TESTED` | Interrompido pela divergência de versão. |
| QA-CLAUDE-MARKDOWN-001-R612 | Heading, parágrafo, lista, tabela e bloco de código | `NOT_TESTED` | Interrompido pela divergência de versão. |
| QA-CLAUDE-BASE-BUTTON-001-R612 | Resposta curta enviada pelo botão | `NOT_TESTED` | Interrompido pela divergência de versão. |
| QA-CLAUDE-BASE-ENTER-001-R612 | Resposta curta enviada por Enter | `NOT_TESTED` | Interrompido pela divergência de versão. |
| QA-CLAUDE-LONG-001-R612 | Resposta longa sintética | `NOT_TESTED` | Interrompido pela divergência de versão. |
| QA-CLAUDE-INTERRUPT-001-R612 | Interrupção de resposta longa | `NOT_TESTED` | Interrompido pela divergência de versão. |
| QA-CLAUDE-STABLE-NO-SIGNAL-001-R612 | Texto estável sem sinal de conclusão | `NOT_TESTED` | Interrompido pela divergência de versão. |

## Evidências consultadas

- Manifest da pasta candidata: `Extensão/extension-prompt-block-poc/manifest.json`, versão `0.6.12`.
- Consulta somente leitura a `backend/data/lab.sqlite3`: interações existentes no Claude, inclusive os dois casos Artifact, reportam `adapter_version=0.6.10`.
- A interface apresentou um Artifact HTML com tabela sintética na conversa; essa observação não valida captura ou persistência na versão candidata.
- O snapshot de acessibilidade retornou texto acessível do widget embutido. Não abri o iframe, naveguei até seu endereço nem solicitei conteúdo remoto diretamente. Como o snapshot já revelou conteúdo interno do widget, ele não deve ser tratado como evidência de que a etapa de inspeção foi estritamente limitada à presença do iframe.

## Fechamento — R1 (histórico; atualizado pela R2 acima)

- `PASS`: 0
- `FAIL`: 0
- `BLOCKED`: 1 (preparação/versão ativa)
- `NOT_TESTED`: 8
- `POLICY_QUESTION`: 0
- BUG-002, BUG-003 e BUG-004 permanecem abertos; nenhum foi aprovado ou fechado por esta rodada.

**Recomendação:** `BLOCKED` — carregar/atualizar a extensão `0.6.12` na sessão de navegador usada para QA, confirmar a versão no popup e numa interação nova no SQLite, e então repetir o reteste. Este relatório não aprova a versão para rollout. Não alterei código, política nem os registros dos bugs.
