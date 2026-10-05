# Relatório de andamento — Governança de IA

**Data:** 28/09/2026  
**Escopo:** extensão Chrome para ChatGPT Web e backend local de laboratório  
**Fontes:** código e documentação do repositório, registros locais da API e testes relatados nesta conversa.

> Registro histórico de 28/09/2026. Para o esquema do banco, o vínculo da instalação e as validações mais recentes, consulte o [estado atual de 01/10/2026](ESTADO_ATUAL_2026-10-01.md).

## 1. Resumo

O projeto chegou a uma POC integrada que captura prompts, avalia regras locais e bloqueia o envio ao ChatGPT Web antes da requisição de conversa. A captura de respostas continua experimental: a estratégia baseada no DOM falhou em vários testes reais; a sonda de rede identificou o transporte, mas ainda não reconstruiu nem correlacionou de forma determinística o conteúdo final. O trabalho de identificação por instalação e projeto foi implementado no código, porém ainda não há evidência de validação ponta a ponta no navegador e no backend atualizado.

| Frente | Estado em 28/09/2026 |
| --- | --- |
| Captura e registro de prompts | Implementados; 38 interações constam no banco de laboratório antigo. |
| Bloqueio antes do envio | Confirmado manualmente na POC de bloqueio; integrado à captura e às regras na versão 0.5.0. |
| Políticas locais | Implementadas e cobertas por testes automatizados; falta validação operacional da versão integrada no Chrome. |
| CPF | Candidatos encontrados por padrão textual e confirmados por dígitos verificadores; CPF válido gera `BLOCK` no destino piloto. |
| Identificação por instalação/projeto | Implementada; falta cadastrar e atribuir instalações reais e testar o fluxo completo. |
| Captura determinística de respostas | Não concluída. A sonda identificou `fetch` com `text/event-stream` e marcador `[DONE]`, mas não montou a resposta final. |
| Retenção/liberação integral de respostas | Não iniciada; depende da captura e correlação confiáveis. |

## 2. Etapas realizadas

### 2.1 Base: extensão e backend de laboratório

- Criamos uma extensão Manifest V3 para `chatgpt.com` e uma API local com SQLite. O fluxo inicial observa Enter, clique e `submit`, captura o prompt, envia ao service worker e registra a interação na API com um ID. Há popup para configuração e diagnósticos.
- O backend oferece registro idempotente de interações, associação de snapshots de resposta, consulta por ID, token de laboratório e retenção configurável. O banco local não é um backup completo das conversas.
- A versão original permanece em [`extension/`](../extension/README.md), atualmente **0.1.11**. Ela continua separada das POCs.

### 2.2 Testes de captura de respostas pelo DOM

- Nos dez envios de 24/09 entre **17:30:38 e 17:33:07** (horário de Brasília), os dez prompts foram registrados. Quatro respostas apareceram como `confirmed:complete`; seis terminaram como `capture_failed:new_prompt`.
- Nos dez envios seguintes, entre **17:58:14 e 17:59:10**, houve dois `complete`, três `incomplete` e cinco `capture_failed:new_prompt`. O usuário informou que aguardava a liberação do próprio ChatGPT antes de cada novo envio. Portanto, a falha não pode ser atribuída simplesmente a envios simultâneos.
- Em 25/09, outros testes mostraram prompt confirmado sem resposta capturada, mesmo com a resposta visível. O diagnóstico apontou inicialmente zero elementos encontrados pelos seletores antigos. Foram acrescentados seletores para a estrutura observada no Chrome e ajustes de associação, porém os registros posteriores ainda incluíram `incomplete` e dependência do próximo envio para reconhecer a resposta anterior.
- O banco local contém **38 interações** observadas de 24/09 15:52:24 a 25/09 14:59:56, no horário de Brasília: **8** com status `complete`, **9** `incomplete` e **21** `request_captured`. Esses dados pertencem às versões de teste anteriores; não comprovam o comportamento da versão 0.5.0.

### 2.3 Investigação do fluxo de rede

- Para preservar a extensão original, criamos a sonda isolada [`extension-network-poc/`](../extension-network-poc/README.md), versão **0.2.4**. Ela roda no contexto `MAIN`, observa metadados e lê uma cópia do stream, sem alterar o fluxo entregue ao ChatGPT.
- Os testes de 25/09 identificaram `POST /backend-api/:id/conversation` via `fetch`, resposta HTTP 200 com `text/event-stream`. O evento `fetch end` indicava apenas a chegada dos cabeçalhos. Em dois envios, a sonda observou `[DONE]` (`protocolDone=1`), seguido por `AbortError` na cópia do stream. Também observou eventos `delta` e campos estruturais ligados a `content/parts`.
- Isso estabeleceu um candidato a sinal de fim do protocolo, mas **não** estabeleceu o conteúdo completo nem uma relação determinística `Prompt N → Response N`. A **POC A (Mirror Mode)** de reconstrução e comparação com o DOM ficou pendente. A **POC B (Buffered Mode)** de retenção/liberação não foi implementada. A investigação de resposta foi pausada por decisão do usuário para priorizar o bloqueio de prompts.
- A sonda limita seus diagnósticos a metadados locais; não grava cookies, headers de autorização, token, texto de prompt ou resposta.

### 2.4 Bloqueio preventivo e regras

- Uma POC separada comprovou o bloqueio antes de a requisição `conversation` seguir ao ChatGPT. Houve um teste inicial em que o popup mostrava bloqueio, mas a requisição ainda chegava; após ajuste, o usuário confirmou que o envio passou a ser efetivamente impedido.
- Consolidamos captura e bloqueio em [`extension-prompt-block-poc/`](../extension-prompt-block-poc/README.md), versão **0.5.0**, mantendo as outras versões. O texto é avaliado local e sincronicamente antes do envio por Enter, clique ou `submit`. O aviso na página e o popup mostram ação e regra sem reproduzir o dado detectado. A camada `MAIN` exige uma autorização curta de uso único para cada `POST .../conversation` permitido.
- A política é derivada de [`politica_bloqueio_prompts_v0_1.md`](../politica_bloqueio_prompts_v0_1.md). Para o piloto, o ChatGPT Web foi classificado como **não aprovado para dados de clientes**. As decisões são `ALLOW`, `WARN`, `REVIEW` e `BLOCK`; `REVIEW` fica retido porque não há fluxo de aprovação humana.
- As regras R01–R09 cobrem chaves privadas, credenciais, códigos de recuperação, CPF, tabelas de dados pessoais, combinação de identificador com categoria sensível, marcadores de sigilo e certos conjuntos de dados fiscais. A exceção experimental da R05 bloqueia **qualquer CPF válido** nesse destino, com ou sem pontuação. A expressão encontra candidatos e o algoritmo valida os dígitos; números inválidos e sequências repetidas não acionam R05. O valor encontrado não entra no diagnóstico do bloqueio.
- Também há controle manual de **Bloquear todos os envios**. O texto bloqueado permanece no editor para correção.

### 2.5 Identificação por instalação e projeto

- Como a conta do ChatGPT é compartilhada por departamento, optamos por atribuir cada instalação da extensão a uma pessoa e ao **ID estável** de seu projeto, em vez de usar o e-mail compartilhado como identidade individual.
- A versão 0.5.0 gera um UUID e uma chave ECDSA P-256 por instalação/perfil do Chrome. A extensão assina eventos enviados à API; o backend confere assinatura, timestamp, nonce e hash do corpo, rejeita repetição e exige que o projeto do evento corresponda ao vínculo administrativo.
- O operador cadastra a chave pública, confere sua impressão digital e atribui nome e ID de projeto pelo comando [`assign_machine.py`](../backend/assign_machine.py). O projeto de exemplo informado foi `g-p-6abacc4edb1c81918be5e01d0038640a`, denominado **EDUARDO**. A comparação usa o ID da URL, pois o nome visível pode mudar.
- A chave privada fica em `chrome.storage.local`. Esse mecanismo identifica uma **instalação/perfil**, não comprova a identidade física de quem digitou; perfis compartilhados ou copiados reduzem essa garantia. A atribuição atualizada no backend pode demorar a refletir em abas antigas até recarregá-las.
- O banco de laboratório consultado neste relatório ainda tem esquema anterior à versão 0.5.0: **não contém a tabela `machines`**. Assim, não há registro local que demonstre matrícula ou atribuição real já concluída. O backend atualizado precisa ser iniciado para migrar o banco e o fluxo deve ser testado no Chrome.

## 3. Problemas observados

1. **Resposta ausente ou incompleta:** o DOM do ChatGPT mudou e os critérios de término não foram suficientes para capturar todas as respostas. `complete` no banco expressa a classificação da extensão, não uma prova independente de integridade.
2. **`capture_failed:new_prompt`:** apareceu mesmo quando o usuário aguardou a interface liberar novo envio. A correlação por observação da página permaneceu instável.
3. **`HTTP 401`:** a extensão recebeu erros de autenticação do backend em ensaios posteriores. Nesses casos, a captura local ou a sonda podem operar, mas o evento não é confirmado na API. É necessário conferir token, backend em execução e, na versão atual, assinatura/atribuição da instalação.
4. **Sonda de rede:** observou `[DONE]` seguido de `AbortError` na cópia do stream. O fechamento do `fetch` não equivale ao fim da geração; falta reconstruir o texto e validar casos como regeneração, interrupção, ferramentas e troca de conversa.
5. **Cobertura funcional:** anexos, imagens, áudio, OCR, conteúdo obtido por links, outros navegadores e outras rotas de envio não são inspecionados pela política textual atual.

## 4. Verificações realizadas em 28/09/2026

| Componente | Resultado |
| --- | --- |
| Extensão original | 20 testes automatizados passaram. |
| Sonda de rede | 25 testes automatizados passaram. |
| POC integrada de políticas | 33 testes automatizados passaram. |
| Backend | 11 testes não puderam ser executados neste ambiente: o `pytest` recebeu `PermissionError` ao criar/acessar diretórios temporários. Isso **não** indica falha das regras da aplicação; a suíte precisa ser repetida em ambiente com acesso ao diretório temporário. |
| Banco local | Leitura confirmou 38 interações e ausência de tabela `machines`; nenhuma migração foi aplicada durante esta análise. |

Os testes automatizados validam comportamentos isolados. Eles não substituem um teste ponta a ponta da versão integrada no Chrome com o backend atualizado.

## 5. Próximos marcos

1. **Validar a versão 0.5.0 no laboratório:** iniciar o backend atualizado, conferir a migração, cadastrar uma instalação, atribuir pessoa/projeto, testar envio permitido no projeto correto e bloqueio em projeto diferente ou fora de projeto. Verificar o registro assinado na API.
2. **Executar a matriz de regras no navegador:** prompt comum, chave privada sintética, CPF válido e inválido, credencial plausível, `REVIEW`, bloqueio manual, Enter, clique e `submit`. Conferir aviso visível e ausência de `POST .../conversation` quando bloqueado.
3. **Resolver os `HTTP 401`** antes de avaliar rastreabilidade de eventos aceitos. Documentar separadamente falha de autenticação, falha de atribuição e falha de política.
4. **Retomar resposta somente depois do marco de entrada:** reconstruir o stream na POC A, comparar com o texto exibido e provar correlação em casos consecutivos. Avaliar a POC B apenas após essa evidência.
5. **Para uso corporativo:** definir administração de instalações, troca/revogação de chaves, processo de revisão e exceções, retenção e acesso aos registros, proteção de dados e backup independente. Esses controles ainda não foram demonstrados por esta POC.

## 6. Conclusão

A parte de **captura e bloqueio preventivo de prompts** tem implementação integrada e testes automatizados positivos; houve confirmação manual do bloqueio na POC. A **identificação por instalação/projeto** está pronta para validação ponta a ponta, mas ainda não aparece no banco em uso. A **captura confiável da resposta** e a **retenção da saída** permanecem abertas. Portanto, a fase de controle de entrada avançou, mas a rastreabilidade completa `pessoa → projeto → prompt → resposta` ainda não pode ser declarada concluída.
