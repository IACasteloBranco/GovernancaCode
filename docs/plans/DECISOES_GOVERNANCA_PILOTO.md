# Decisões de governança do piloto

Registro das respostas dadas pelo responsável do projeto em 18/10/2026. Este documento registra decisões e pendências; não modifica a política de bloqueio nem declara aprovação de risco ou rollout.

## Aditivo de privacidade — 21/10/2026

As respostas mais recentes do responsável substituem as decisões antigas abaixo somente nos temas de destinatários, finalidade, pessoas autorizadas, aviso, exclusão e operação de privacidade. O uso será interno, obrigatório para colaboradores no Brasil, com termo assinado antes da coleta e opção existente para desativar a captura. A finalidade é análise interna de uso individual e por departamento, qualidade e melhoria dos processos. A empresa orientará a anonimização antes do envio de conversas à IA; a extensão não anonimiza automaticamente.

Não haverá envio de prompts ou respostas a provedor de LLM como parte deste projeto. O dado será recebido pela empresa e processado na infraestrutura Google Cloud; Cloudflare opera o túnel de rede. Os únicos autorizados a auditar conteúdo integral são liderança e chefia do departamento de IA. O responsável pela ferramenta executa pedidos de exclusão recebidos pelo telefone +55 75 9864-6173; a meta interna é até 15 dias úteis. A retenção da aplicação e dos históricos locais é 90 dias; backup e retenção de logs do Google Cloud/Cloudflare ainda exigem configuração e conferência no ambiente.

O backend local agora permite registrar a ciência da versão do aviso antes da captura, controla a lista de viewers por Google `sub` e mantém auditoria de leitura sem conteúdo. A exclusão é executada pelo responsável no host do backend com uma conta individual do sistema operacional. Este aditivo não aprova a base legal, o uso de métricas individuais para desempenho nem a elegibilidade na Chrome Web Store.

## Decisões registradas

### Dados e finalidade

O piloto coletará prompts, respostas, metadados de arquivos, nome atribuído à instalação, usuário, departamento, horário e decisões de bloqueio com referência à política aplicável.

A análise ocorrerá depois da implementação dos projetos. O responsável pelo projeto extrairá os dados e fará análises de volume, qualidade, características de uso e operação, além de procurar padrões.

**Substituído pelo aditivo de 21/10/2026:** a decisão de 18/10 previa envio de dados capturados para LLM. A decisão vigente é não enviar prompts ou respostas a provedor de LLM como parte do projeto.

### Retenção

O prazo definido é de 90 dias. Para este registro, o prazo aplica-se aos registros capturados e às cópias de segurança. Expurgo significa apagar os dados depois de 90 dias contados do recebimento.

### Acesso

**Substituído pelo aditivo de 21/10/2026:** a lista antiga incluía responsável pelo projeto e equipe de monitoramento preventivo. A decisão vigente autoriza leitura integral somente à liderança e à chefia do departamento de IA, com identidades Google configuradas por `sub`.

Na versão registrada em 18/10, o backend aceitava um único `GOOGLE_OPERATOR_SUB`. A implementação local agora aceita uma lista, mas os `sub` ainda precisam ser preenchidos no ambiente implantado.

### Indicadores de bloqueio

O responsável quer agrupar decisões `REVIEW` e `BLOCK` sob um indicador de prompts potencialmente perigosos. O analytics deve manter as contagens de `REVIEW` e `BLOCK` separadas para não representar uma revisão como bloqueio efetivo.

### Contestação

O responsável pelo projeto receberá dúvidas e contestações sobre bloqueios.

### Comunicação

O responsável informou que avisará os participantes sobre o programa. O aviso tem um rascunho local para revisão e precisa ser entregue antes da instalação.

## Decisões ainda abertas

### Análise com LLM — decisão antiga supersedida

O registro de 18/10 previa enviar dados capturados para análise posterior com LLM. O aditivo de 21/10 substitui essa decisão: não enviar dados a serviço de LLM como parte do projeto.

### Limiares da política de bloqueio

“Limiar” é a quantidade ou condição que muda uma ação de `WARN` para `REVIEW` ou `BLOCK`. O responsável decidiu manter o comportamento atual de R05. O limiar recomendado para R06 ainda aguarda aprovação.

| Regra | Decisão para o destino não aprovado | Como contar |
|---|---|---|
| R05, CPFs identificáveis | 1 ou mais CPFs válidos distintos: `BLOCK`. | Validar dígitos verificadores e contar CPFs distintos no prompt. Repetições contam uma vez. CPFs inválidos não contam. No destino aprovado, manter o comportamento já definido na política. |
| R06, dados estruturados | Recomendação pendente: com cabeçalho `nome` e `CPF`, 2 a 4 registros geram `REVIEW`; 5 ou mais geram `BLOCK`. A partir de 2 registros, recomendo `BLOCK` quando houver campo sensível associado. | Contar linhas de registro com CPF válido. Não contar palavras-chave isoladas. Saúde e outras categorias sensíveis também são cobertas por R07, que pode bloquear uma combinação identificável mesmo em uma linha. |

O responsável rejeitou a recomendação anterior de permitir um CPF isolado com `WARN`. R05 permanece em `BLOCK` para qualquer CPF válido distinto em destino não aprovado. Para R06, recomendo interromper para revisão conjuntos de 2 a 4 registros, bloquear 5 ou mais e bloquear tabelas menores que liguem vários identificadores a campos sensíveis. `REVIEW` pode entrar no agregado de “prompts potencialmente perigosos”, mas deve continuar separado de `BLOCK` nos dados e na interface. A recomendação de R06 ainda depende de aprovação explícita.

**Diferença para o código atual:** R05 corresponde à decisão do responsável. R06 bloqueia tabelas com cinco ou mais linhas e também duas ou mais quando o cabeçalho contém termos financeiros reconhecidos. R07 bloqueia uma linha que associe CPF válido a um termo sensível reconhecido quando o destino não é aprovado. Adotar a recomendação de R06 exigirá alinhar a política e a implementação. Não altere `policies/politica_bloqueio_prompts_v0_1.md` nem R06 no código até o responsável aprovar o limiar.

### Falha da extensão ou do backend

O responsável acreditava que a extensão bloqueava quando não conseguia acessar o backend e pediu uma verificação do código. A leitura de `extension/src/content/blocker-main.js`, `blocker-bridge.js` e `background/service-worker.js` mostrou que o bloqueio da tentativa é local e depende da extensão instalar o gate e emitir uma autorização de uso único. O gate bloqueia requisições sem essa autorização.

O gate consulta agora `/health` antes de liberar cada POST de conversa que ele intercepta. A resposta precisa ser HTTP de sucesso e conter `status: "ok"`. A extensão também confirma que a captura continua ativa e que a atribuição da instalação ainda vale. Timeout, falha de rede, estado local inválido ou resposta inválida bloqueiam a requisição e mostram um aviso. O código não reutiliza uma resposta positiva em envios seguintes.

Essa checagem confirma que a API respondeu, mas não confirma que a captura do prompt foi gravada. Como `/health` é público, uma resposta saudável também não detecta um token revogado no servidor. Se o backend cair depois da checagem ou a captura falhar enquanto `/health` responde, o POST de conversa ainda pode seguir. Respostas `401` ou `403` fecham a sessão para envios seguintes, mas não desfazem um envio já autorizado.

A resposta da ponte usa `window.postMessage`, que a página também pode observar ou forjar. Esta mudança atende à falha operacional do backend indisponível no fluxo normal da extensão; não transforma a página em uma fronteira resistente a código deliberadamente adulterado.

Se `blocker-main.js` não for injetado ou falhar antes de instalar o proxy de `fetch`, o gate de rede não existe naquela página. A ponte isolada pode registrar `main_active: false`, mas esse diagnóstico não bloqueia a página por si só. A inspeção do código não substitui testes no Chrome.

O requisito de resposta recente do backend está implementado para POSTs cobertos pelo gate. Ainda falta verificar no Chrome API desligada, timeout, token recusado ou expirado e gate ausente. Se `blocker-main.js` não for instalado, a extensão não barra a requisição. A checagem de `/health` também não substitui uma confirmação de gravação do prompt.

## Próximas ações

- **Concluído por decisão:** não integrar um provedor LLM para análise dos dados capturados.
- Aprovar o limiar recomendado para R06. R05 permanece em `BLOCK` para qualquer CPF válido distinto em destino não aprovado.
- Testar modo sem backend e falha/desativação da extensão com entradas sintéticas.
- Validar os `sub` autorizados e a configuração da exclusão no ambiente implantado.
- Revisar e entregar o aviso aos participantes antes da instalação planejada.
