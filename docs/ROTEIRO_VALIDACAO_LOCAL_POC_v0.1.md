# Roteiro de validação local — extensão e backend da POC

**Versão:** 0.1  
**Data:** 24/09/2026  
**Base:** [especificação da POC](../POC_EXTENSAO_BACKEND_GOVERNANCA_IA_v0.1.md), [plano da extensão](PLANO_IMPLANTACAO_EXTENSAO_POC_v0.1.md) e [plano do backend](PLANO_IMPLANTACAO_BACKEND_POC_v0.1.md).  
**Ambiente inicial (histórico):** extensão Chrome 0.1.4 e API local em `127.0.0.1:8000`.  
**Aplicação atual:** executar os cenários com a extensão integrada 0.5.0 após o [vínculo administrativo](ESTADO_ATUAL_2026-10-01.md); registrar a versão usada em cada rodada.

## 1. Ponto de partida e objetivo

Em 24/09/2026, uma interação sintética percorreu o fluxo extensão → API → SQLite. O popup confirmou prompt e resposta para o mesmo `interaction_id`; a consulta ao banco mostrou estado `complete`, texto não vazio e conteúdo armazenado corretamente. Esse resultado valida o caminho básico em uma execução. Não há ainda uma medição de cobertura ou estabilidade.

A próxima etapa mede, com casos reproduzíveis, se a extensão detecta as rotas de envio, associa a resposta ao prompt certo e apresenta as falhas sem declarar persistência indevida. O trabalho continua no mesmo computador, com conta/projetos de laboratório e textos fictícios.

## 2. Entregas desta etapa

1. Registro de cada execução no [modelo de evidências](REGISTRO_EVIDENCIAS_POC_v0.1.csv), incluindo versão do Chrome, extensão e backend.
2. Matriz abaixo executada por clique, Enter, respostas curtas/longas, navegação, duas abas e indisponibilidade da API.
3. Lista de defeitos reproduzíveis, com causa provável, correção e nova execução dos cenários afetados.
4. Relatório curto de fechamento: cobertura observada, falhas abertas, viabilidade do contexto de projeto e decisão sobre a próxima iteração.

Na versão integrada 0.5.0, a avaliação anterior ao envio e o bloqueio por projeto já estão implementados. Este roteiro ainda mede a captura observacional; resultados de política e de vínculo devem ser anotados separadamente para não contar um envio bloqueado como falha de captura.

## 3. Preparação da rodada

- Usar uma conta do ChatGPT e conversas/projetos reservados ao laboratório. Os prompts e respostas esperadas devem ser sintéticos.
- Iniciar o backend local e conferir `/health`; confirmar `schema_version=0.1`.
- Carregar `extension-prompt-block-poc/` descompactada e conferir versão 0.5.0. Informar o token de `backend/.env`, cadastrar a instalação, atribuí-la a uma pessoa com `assign_machine.py` e atualizar o vínculo no popup. Só então habilitar e salvar a captura.
- Conferir no popup pessoa, prefixo da chave e **Captura: habilitada**. O código da instalação sozinho não comprova atribuição. A política textual continua ativa em todos os chats.
- Recarregar as abas do ChatGPT após atualizar a extensão; confirmar que o popup registra eventos da versão atual.
- Registrar versão do Chrome, data/hora, revisão do código e versão do adapter. Fazer uma interação curta inicial para verificar conectividade e token.
- Preparar dois projetos e pelo menos duas conversas de laboratório, caso a conta de teste ofereça esses recursos. Se não oferecer, registrar a indisponibilidade como limite do ambiente.
- Escolher prompts curtos identificáveis, por exemplo `LAB-CLIQUE-01` e `LAB-ENTER-01`. Evitar qualquer texto ou anexo de cliente.

Cada execução deve ter um identificador de cenário e um resultado observado. O operador compara visualmente o prompt e a resposta no ChatGPT com o registro consultado no backend; a confirmação no popup verifica entrega, não fidelidade do conteúdo.

## 4. Sequência de execução

### Bloco A — identidade, instalação e configuração

| ID | Cenário | Quantidade | Resultado esperado |
|---|---|---:|---|
| A01 | Abrir ChatGPT e outro domínio | 1 por domínio | Captura ativa somente em `chatgpt.com`; popup mostra versão e ID. |
| A02 | Fechar e reabrir Chrome | 1 | Mesmo ID de instalação; token solicitado novamente se a sessão tiver sido encerrada; captura pausada enquanto faltar token. |
| A03 | Trocar conta declarada entre rodadas | 1 | Novos registros usam o rótulo informado; registros antigos permanecem inalterados. O rótulo não é tratado como autenticação. |
| A04 | Cadastrar instalação sem atribuição | 1 | Popup mostra atribuição pendente; captura permanece pausada e a barreira local não libera envio. |
| A05 | Atribuir pessoa e atualizar vínculo | 1 | Popup mostra pessoa e prefixo da chave; captura pode ser habilitada com token válido. |
| A06 | Abrir outro projeto ou página fora de projeto | 1 por destino | Envio permitido se a política textual permitir; projeto observado registrado quando disponível. |

### Bloco B — cobertura de prompts

| ID | Cenário | Quantidade | Resultado esperado |
|---|---|---:|---|
| B01 | Envio pelo botão | 10 | Um `client_event_id` e um registro persistido por tentativa observada; texto fiel. |
| B02 | Envio por Enter | 10 | Mesmo critério de B01, com resultado separado do clique. |
| B03 | Dois prompts idênticos em sequência | 2 | Duas interações distintas, sem deduplicação pelo texto. |
| B04 | Shift+Enter e composição de texto | 2 por modo | Nenhum evento antes do envio efetivo. |
| B05 | Nova conversa que muda de URL após envio | 2 | Prompt ligado à conversa de origem observada; resposta não encerrada prematuramente pela mudança inicial de URL. |

Contar tentativas que foram realmente enviadas na interface. Se a extensão não detectar uma rota, registrar perda de cobertura mesmo que não exista evento no popup. Não usar somente o total do backend como denominador.

O procedimento operacional de B01 e B02, incluindo textos de teste, comandos de consulta e preenchimento das evidências, está no [passo a passo de clique e Enter](PASSO_A_PASSO_B01_B02_POC_v0.1.md).

### Bloco C — resposta e contexto

| ID | Cenário | Quantidade | Resultado esperado |
|---|---|---:|---|
| C01 | Respostas curtas | 10 | Associação ao prompt certo; comparação manual de texto e estado `complete`/`incomplete`. |
| C02 | Respostas longas | 5 | Mesmo critério; nenhum `complete` com texto visivelmente truncado. |
| C03 | Conversas em dois projetos e fora de projeto | 1 por contexto | Registrar o ID `g-p-...` correto em cada projeto e `unknown` fora deles. Nunca herdar o projeto anterior. |
| C04 | Interromper geração | 2 | Texto parcial disponível associado à interação correta e estado `incomplete`; sem resposta vazia marcada como confirmada. |
| C05 | Trocar conversa durante geração | 2 | Interação anterior permanece isolada; resposta posterior não é anexada ao ID anterior. |
| C06 | Duas abas com envios simultâneos | 2 pares | IDs, conversa e respostas não se misturam entre abas. |

Registrar o tamanho e o estado da resposta, mas usar também comparação visual. `complete` indica apenas conclusão aparente da interface. A extensão integrada extrai o ID `g-p-...` da URL para contexto, sem usá-lo para bloquear o envio.

### Bloco D — falhas e limites

| ID | Cenário | Quantidade | Resultado esperado |
|---|---|---:|---|
| D01 | Parar a API antes de enviar | 2 | Diagnóstico de entrega sem confirmação; nenhum evento apresentado como persistido. |
| D02 | Token inválido | 1 | Erro HTTP 401 visível; nenhum registro novo. |
| D03 | Restaurar API e enviar novo prompt | 1 | Captura volta a funcionar; nenhum reenvio automático com ID novo de evento anterior. |
| D04 | Fechar popup durante geração | 1 | A captura continua ou a falha é indicada ao reabrir; popup não é requisito para o fluxo. |
| D05 | Reiniciar navegador ou fechar aba durante geração | 1 por ação | Limitação de entrega identificada; não declarar resposta salva sem confirmação. |
| D06 | Anexo fictício pequeno | 1 | Metadados `metadata_only` ou `unavailable` com motivo; não declarar backup do arquivo. |
| D07 | Editar/regenerar e outros controles visíveis | 1 por rota identificada | Cobertura registrada separadamente; modo não suportado permanece explícito. |

A extensão atual envia `attachments: []` e não observa anexos. D06 deve ser registrado inicialmente como lacuna da implementação; não classificar o cenário como aprovado sem capturar metadados ou justificar indisponibilidade no contrato. O backend já possui testes automatizados de idempotência, mas um reenvio real da extensão exige mecanismo próprio; não simular cobertura inexistente.

## 5. Como conferir cada interação

1. Anotar `client_event_id`, quando disponível, e `interaction_id` mostrado no popup. O popup atual mostra o ID da interação, mas ainda não expõe o ID do evento; registrar essa lacuna para melhoria do diagnóstico.
2. Consultar `GET /v1/interactions/{interaction_id}` com o token de laboratório, em outro terminal. Não copiar o token para planilha, prints ou relatório.
3. Comparar `prompt.text` e `responses[].text` com a interface. Para respostas longas, verificar começo, meio e fim, além de trechos especiais como acentos, listas e quebras de linha.
4. Verificar `status`, `capture_status`, horários e versão do adapter. Se houver mais de um snapshot, identificar qual foi o último e se ocorreu sobrescrita ou associação incorreta.
5. Registrar resultado `aprovado`, `falhou` ou `não executável`, com causa e evidência. `confirmed` no popup significa aceite HTTP do backend; `capture_failed` é diagnóstico local.

O PowerShell 5.1 da estação exibiu caracteres UTF-8 de forma incorreta na consulta JSON, enquanto o SQLite guardou o texto correto. Comparar o conteúdo após decodificá-lo corretamente ou usar um cliente que exiba UTF-8; não registrar erro de captura apenas por esse efeito de terminal.

## 6. Evidência mínima e métricas

Preencher uma linha do CSV por tentativa planejada, incluindo as tentativas não detectadas. Os campos principais são cenário, modo de envio, versão, conversa/projeto de laboratório, horário, ID, resultado do popup, status do backend, conferência do texto e observação. Prints são opcionais e devem conter apenas dados sintéticos.

Calcular ao final:

- **Detecção por rota:** tentativas observadas pela extensão ÷ tentativas enviadas na interface, separadas por clique e Enter.
- **Persistência:** interações confirmadas no backend ÷ tentativas observadas.
- **Duplicidade:** registros excedentes para a mesma tentativa.
- **Associação de resposta:** respostas vinculadas ao prompt/conversa corretos ÷ respostas avaliadas.
- **Fidelidade:** textos iguais ao conteúdo visível ÷ textos comparados, separados em prompts, respostas curtas e longas.
- **Completude honesta:** ocorrências de `complete` com texto truncado ou com streaming ainda ativo.
- **Contexto e vínculo:** projeto/conversa corretos, envios bloqueados fora do projeto e atribuições incorretas, em contagens distintas.
- **Diagnóstico:** falhas de API e observação apresentadas explicitamente ÷ falhas provocadas.

Não interpretar a amostra como estatística de cobertura universal. Ela identifica rotas e condições testadas nesta versão do Chrome e do ChatGPT.

## 7. Critérios de aceite e decisão

Para concluir esta rodada como validação local satisfatória:

- B01 e B02: 10/10 envios de cada modo, com um registro por envio e texto fiel. Qualquer perda ou duplicação exige correção e repetição do bloco afetado.
- C01 e C02: todas as respostas de teste associadas ao prompt correto; nenhuma marcada `complete` se houver truncamento visível. Estados `incomplete` devem ter motivo observável e ser investigados.
- C04 a C06: nenhum vazamento de resposta entre conversas ou abas. Falha de associação interrompe a expansão.
- D01 e D02: nenhum falso positivo de persistência quando API/token falham.
- A04 a A06 e C03: confirmar cadastro, atribuição e captura em diferentes contextos; registrar separadamente qualquer falha de vínculo, token ou política. D06 continua como lacuna de anexos; `attachments: []` não comprova cobertura.

Se um caso falhar, registrar passos para reproduzir, versão, ID e motivo de diagnóstico. Corrigir o adapter ou o contrato, repetir o caso e executar uma regressão curta dos fluxos básicos. Se identificação de projeto, detecção de envio ou associação de resposta falhar de modo recorrente, interromper a expansão e rever a viabilidade, conforme a especificação original.

## 8. Ordem de trabalho técnico durante a rodada

1. Concluir cadastro e atribuição da instalação; executar A, B01/B02 e C01/C02; corrigir falhas que impeçam o fluxo básico.
2. Ampliar o diagnóstico da extensão com `client_event_id`, rota de envio e motivo de estado incompleto, sem armazenar conteúdo no log.
3. Executar C03 com a URL do projeto vinculado e de outro projeto. Conferir o ID `g-p-...` no registro aceito e o bloqueio local fora do projeto.
4. Executar navegação, interrupção e duas abas; ajustar a correlação se houver troca de IDs ou textos.
5. Exercitar falhas de entrega e anexo fictício; implementar apenas metadados de anexo que sejam realmente observáveis.
6. Consolidar métricas, falhas abertas e recomendação da próxima versão. Medir também as decisões da avaliação anterior ao envio, já implementada na extensão integrada.

## 9. Fechamento da etapa

O relatório final desta rodada deve conter versão e ambiente, tabela de resultados por cenário, métricas acima, defeitos corrigidos, limites ainda presentes e decisão: **avançar**, **repetir após correções** ou **rever a viabilidade do adapter**. Se avançar, definir separadamente o escopo de autenticação individual, fila offline, anexos e melhorias na avaliação anterior ao envio.

Os registros da API continuam sujeitos à retenção de sete dias do laboratório. Guardar somente evidências sintéticas necessárias ao relatório e eliminar os dados de teste após o experimento, conforme o plano do backend.
