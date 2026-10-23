# Plano de análise da efetividade e dos dados do MVP

## Objetivo

Comprovar, com dados sintéticos, que a captura acompanha de forma contínua as interações realizadas no modo Work. Em seguida, fechar as lacunas do modelo e avaliar a estrutura necessária para consultas sobre o funcionamento dos departamentos.

Este plano separa três decisões: se a captura funciona, quais dados o banco precisa guardar e quais análises a empresa autoriza. Uma aprovação técnica não aprova o uso dos dados para análise de funcionários.

## Escopo do MVP local

Para cada tentativa de interação em Work, o sistema deve registrar:

- funcionário identificado e departamento vigente na data do envio;
- texto enviado e resultado da política, permitido ou bloqueado;
- resposta recebida, ou estado explícito de ausência, interrupção ou falha;
- horários observados no cliente e recebidos pelo backend;
- presença de arquivos anexados ao prompt e, quando observável, nome, tipo e tamanho;
- associação entre prompt, resposta, arquivos e interação;
- estado da captura, incluindo motivo quando o conteúdo estiver incompleto ou indisponível.

O MVP guarda metadados dos arquivos. Não guarda seus bytes. A classificação do modo fica fora do MVP. O sistema deve capturar as interações em Work sem depender de um sinal visual de modo.

## Estado encontrado no repositório

| Ãrea | Implementação encontrada | O que falta comprovar ou fazer |
|---|---|---|
| Prompt e resposta | Em 10 envios sintéticos consecutivos na conversa Work, os prompts foram únicos, fiéis e atribuídos. As 10 respostas foram marcadas `complete`, mas o banco guardou apenas `ACK-`, enquanto a interface mostrou `ACK-01` a `ACK-10`. Um teste local reproduziu a perda do sufixo em deltas textuais. | `FAIL`: o parser local foi ajustado para anexar `v` textual do evento delta e a suíte focada passou; falta recarregar a extensão e comprovar a igualdade no navegador. Conversas novas e retomadas continuam pendentes. |
| Funcionário | A instalação está atribuída a um nome e a um ID estável. O backend copia esses valores para os registros. | Conferir a atribuição em uma sequência contínua de interações. |
| Departamento | A instalação está atribuída a um código de departamento e o backend registra a atribuição nos eventos. | Conferir que o departamento vigente acompanha cada interação da sequência. |
| Contexto e modo | O contrato admite `usage_context`, mas não há classificação validada para Work e chatbot comum. | A classificação do modo não é requisito do MVP. Reavaliar depois da validação operacional em Work. |
| Horários | Prompts e respostas têm horários observados e recebidos pelo backend. | Conferir ordem, fuso e associação em envios consecutivos, conversas retomadas e interrupções. |
| Arquivos | Existem contratos para anexos e uma tabela separada de metadados. A sonda observa rotas específicas de downloads do ChatGPT. | O fluxo de envio de arquivo pelo usuário não está comprovado. O metadado separado não tem vínculo direto com `interaction_id`; nome e tipo devem ser conferidos em um envio sintético. |
| Bloqueio | A extensão aplica a política local antes do envio. | Comprovar se cada tentativa bloqueada deixa registro persistido com resultado e regra aplicável. |
| Persistência e retenção | O backend usa SQLite local e remove registros de uso e auditoria após o prazo configurado, 90 dias por padrão. Os históricos locais da extensão também expiram em 90 dias. | Configurar e verificar separadamente backups e logs dos provedores para confirmar o prazo integral de 90 dias. |
| Aprovação dos critérios | `policies/` contém a política ativa da POC. A pasta `qa/` não está presente nesta cópia de trabalho. A política mantém decisões de calibração e retenção pendentes. | Aprovar os critérios de aceite e as decisões de uso dos dados antes de usar conteúdo de funcionários. |

Os ensaios anteriores estão em [relatório de validação da versão 0.4.2](../../reports/2026-10-13-validacao-recarga-edicao-v0.4.2.md). A suíte da extensão passou 26 testes nessa rodada. Esses resultados não comprovam operação contínua em Work nem o fluxo de anexos enviados ou o uso analítico.

## Etapas de análise

### 1. Fixar os critérios da operação em Work

1. Definir uma sequência representativa de uso em Work, incluindo conversas novas e retomadas.
2. Definir o identificador do funcionário e a fonte oficial do departamento.
3. Aprovar quais tentativas devem ser registradas, inclusive prompts bloqueados e interações sem resposta.
4. Aprovar finalidade, acesso e prazo de retenção dos dados usados para governança e análise departamental.

**Saída:** critérios de aceite aprovados. Decisões de finalidade, acesso e retenção que ainda não tenham aprovação recebem `POLICY_QUESTION`.

### 2. Medir a captura atual

Executar testes com contas e conteúdo sintéticos. Registrar a versão da extensão, backend e navegador em cada rodada.

| Caso | Execução inicial | Evidência no banco |
|---|---:|---|
| Work: operação contínua | 10 envios: 5 pelo botão e 5 por Enter, na mesma conversa retomada | 10 prompts únicos e fiéis, pessoa e departamento corretos; respostas 0/10 fiéis à interface: todas foram persistidas como `complete`, mas somente com o prefixo `ACK-` (resultado `FAIL`). Correção local aguarda recarga da extensão e reteste. |
| Respostas curtas e longas em Work | Pelo menos 5 de cada | Texto comparado com a interface, associação correta e estado de captura honesto. |
| Bloqueio da política em Work | 5 permitidos e 5 bloqueados | Resultado e motivo persistidos; bloqueio não aparece como envio permitido. |
| Arquivo sintético enviado em Work | 3 tipos conhecidos | Presença, nome e tipo ligados à interação correta; nenhum byte do arquivo armazenado. |
| Interrupção e falha | Interromper antes e depois do primeiro texto; desligar API e restaurar | Estado incompleto ou falha explícito, sem resposta vazia confirmada nem falso sucesso de persistência. |
| Retomada e regeneração em Work | 2 ciclos | Sem duplicar prompts e mantendo respostas ligadas à interação original. |

Para cada tentativa, comparar a interface, o diagnóstico da extensão, a API e a linha persistida. Contar tentativas planejadas e tentativas perdidas. Inspeção de código não conta como execução no navegador.

**Saída:** relatório com `PASS`, `FAIL`, `BLOCKED`, `NOT_TESTED` ou `POLICY_QUESTION` por caso, além de cobertura, duplicidades, fidelidade, associação, atribuição e estados incompletos.

### 3. Fechar as lacunas do contrato de dados

Depois da medição, implementar apenas os campos que falharem ou estiverem ausentes. O modelo lógico esperado é:

- **Funcionário:** identificador interno estável e estado ativo.
- **Departamento:** identificador estável e nome.
- **Lotação histórica:** funcionário, departamento e intervalo de vigência.
- **Instalação:** vínculo administrativo com funcionário e histórico de atribuição.
- **Interação:** funcionário, departamento vigente, plataforma, prompt, horários e resultado da política.
- **Resposta:** texto, estado da captura, horários e motivo de ausência ou interrupção.
- **Anexo:** interação relacionada, direção (enviado ou gerado), nome, tipo, tamanho, fonte e estado de observação.
- **Evento de captura:** transições relevantes, falhas de entrega e confirmação do backend.

Copiar o departamento vigente para a interação evita que uma mudança organizacional altere relatórios históricos. A lotação histórica permite reconstruir consultas por período. Alterações no esquema devem ter migração e teste de leitura dos registros anteriores.

### 4. Validar retenção e volume

Usar dados sintéticos para estimar volume. A estimativa precisa de interações por funcionário por dia, tamanho médio de prompts e respostas, metadados por interação e prazo de retenção. O número de 40 a 50 funcionários ativos por dia, sozinho, não determina a capacidade necessária.

Medir inserções concorrentes, consultas por funcionário e departamento, crescimento do banco, tempo de expiração e recuperação após reinício. Registrar também a cópia de segurança e o teste de restauração antes de guardar dados reais.

O SQLite atual atende à prova local. A escolha do banco para uso interno deve esperar os padrões de concorrência, consulta, disponibilidade e retenção. Se esses requisitos exigirem vários escritores ou serviço central, comparar SQLite com PostgreSQL usando a carga sintética medida.

**Saída:** relatório de capacidade com premissas, medições e recomendação. Não projetar capacidade a partir somente do total de funcionários.

### 5. Preparar a análise de inteligência da empresa

Primeiro, listar perguntas de negócio que o proprietário quer responder, por exemplo:

- quais departamentos usam IA e em quais tipos de atividade;
- onde os bloqueios ocorrem e quais regras precisam de revisão;
- quais tarefas aparecem com frequência e podem precisar de orientação ou automação;
- como o uso muda por período, contexto ou ferramenta.

Começar por consultas agregadas por departamento e período. Restringir a consulta de texto bruto a pessoas autorizadas e registrar o acesso. Não criar pontuação individual de produtividade nem inferir desempenho a partir do volume de prompts sem uma decisão explícita de governança.

Manter a captura operacional separada das tabelas e consultas analíticas. Assim, o backend registra os eventos observados e uma camada de análise pode formar indicadores departamentais sem mudar os registros de origem.

**Saída:** catálogo de perguntas, métricas, permissões, prazo de retenção e regras de agregação aprovadas antes de usar dados reais para análise.

## Critério para declarar o MVP local válido

Declarar o MVP local válido somente quando:

1. O fluxo de Work passar os testes de envios consecutivos, conversas retomadas, respostas, bloqueios e interrupções.
2. Funcionário e departamento estiverem corretos no registro persistido.
3. Os arquivos sintéticos aparecerem com nome e tipo ligados à interação correta, sem bytes armazenados.
4. Prompts e respostas forem fiéis à interface e não houver duplicidade ou associação cruzada na amostra.
5. Falhas e interrupções não forem apresentadas como persistência ou resposta completa.
6. Retenção, migração e recuperação tiverem evidência local.
7. Os critérios de aceite e o propósito de uso tiverem aprovação humana registrada.

Esse aceite cobre o MVP local focado em Work. A classificação do modo, a captura em chatbot comum, a implantação nos departamentos, o banco central, a autenticação corporativa e a análise de conteúdo real ficam para etapas posteriores.

## Decisões de governança

As decisões recebidas do responsável e as questões ainda abertas estão no [registro de decisões do piloto](DECISOES_GOVERNANCA_PILOTO.md). Não altere `policies/` até que o responsável aprove as mudanças específicas da política.
