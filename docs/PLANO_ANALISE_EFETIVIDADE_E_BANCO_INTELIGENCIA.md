# Plano de análise da efetividade e dos dados do MVP

## Objetivo

Comprovar, com dados sintéticos, que o MVP registra as informações básicas de uso de IA nos contextos Work e chatbot comum. Em seguida, fechar as lacunas do modelo e avaliar a estrutura necessária para consultas sobre o funcionamento dos departamentos.

Este plano separa três decisões: se a captura funciona, quais dados o banco precisa guardar e quais análises a empresa autoriza. Uma aprovação técnica não aprova o uso dos dados para análise de funcionários.

## Escopo do MVP local

Para cada tentativa de interação, o sistema deve registrar:

- funcionário identificado e departamento vigente na data do envio;
- contexto de uso, classificado como Work ou chatbot comum;
- texto enviado e resultado da política, permitido ou bloqueado;
- resposta recebida, ou estado explícito de ausência, interrupção ou falha;
- horários observados no cliente e recebidos pelo backend;
- presença de arquivos anexados ao prompt e, quando observável, nome, tipo e tamanho;
- associação entre prompt, resposta, arquivos e interação;
- estado da captura, incluindo motivo quando o conteúdo estiver incompleto ou indisponível.

O MVP guarda metadados dos arquivos. Não guarda seus bytes. A classificação Work ou chatbot comum deve vir de um campo ou contexto observável, não de inferência sobre o texto do prompt.

## Estado encontrado no repositório

| Área | Implementação encontrada | O que falta comprovar ou fazer |
|---|---|---|
| Prompt e resposta | A extensão ativa captura o prompt no ChatGPT Web e reconstrói a resposta da stream. Há ensaios sintéticos recentes de envio, edição, regeneração e interrupção. | Repetir a matriz em Work e chatbot comum e comparar cada texto com a interface. |
| Funcionário | A instalação precisa estar atribuída a uma pessoa. O backend copia o nome associado para os registros. | Confirmar a identidade operacional e representar um identificador estável de funcionário, sem depender só do nome. |
| Departamento | Não há campo de departamento no contrato ou nas tabelas inspecionadas. | Definir a fonte do departamento e guardar o departamento vigente no momento da interação. |
| Contexto Work ou chatbot | O contrato registra a plataforma, mas não distingue os dois contextos de uso pedidos. | Definir como o operador reconhece cada contexto e gravá-lo de forma explícita. |
| Horários | Prompts e respostas têm horários observados e recebidos pelo backend. | Conferir ordem, fuso e associação em ambos os contextos, incluindo interrupções. |
| Arquivos | Existem contratos para anexos e uma tabela separada de metadados. A sonda observa rotas específicas de downloads do ChatGPT. | O fluxo de envio de arquivo pelo usuário não está comprovado. O metadado separado não tem vínculo direto com `interaction_id`; nome e tipo devem ser conferidos em um envio sintético. |
| Bloqueio | A extensão aplica a política local antes do envio. | Comprovar se cada tentativa bloqueada deixa registro persistido com resultado e regra aplicável. |
| Persistência e retenção | O backend usa SQLite local e remove registros após o prazo configurado, sete dias por padrão. Há testes de persistência e expiração. | Reexecutar a suíte no estado atual e validar a retenção desejada pela empresa. Sete dias é um padrão técnico, não uma decisão de negócio. |
| Aprovação dos critérios | `policies/README.md` descreve a política ativa como material de trabalho. A pasta `qa/` não está presente nesta cópia de trabalho. | Aprovar critérios de aceite e decisões de uso dos dados antes de usar conteúdo de funcionários. |

Os ensaios recentes estão em [relatório de validação da versão 0.4.2](../reports/2026-10-13-validacao-recarga-edicao-v0.4.2.md). A suíte da extensão passou 26 testes nessa rodada. Esses resultados não comprovam departamento, anexos enviados, classificação dos dois contextos ou uso analítico.

## Etapas de análise

### 1. Fixar os critérios e os contextos

1. Definir o que a empresa chama de Work e chatbot comum e como a extensão reconhece cada um.
2. Definir o identificador do funcionário e a fonte oficial do departamento.
3. Aprovar quais tentativas devem ser registradas, inclusive prompts bloqueados e interações sem resposta.
4. Aprovar finalidade, acesso e prazo de retenção dos dados usados para governança e análise departamental.

**Saída:** critérios de aceite aprovados. Decisões de finalidade, acesso e retenção que ainda não tenham aprovação recebem `POLICY_QUESTION`.

### 2. Medir a captura atual

Executar testes com contas e conteúdo sintéticos. Registrar a versão da extensão, backend e navegador em cada rodada.

| Caso | Execução inicial | Evidência no banco |
|---|---:|---|
| Work: envio por botão e Enter | 10 tentativas por rota | Um prompt por tentativa, texto igual ao enviado, pessoa e contexto corretos. |
| Chatbot comum: envio por botão e Enter | 10 tentativas por rota | Mesmo critério, com contexto distinto de Work. |
| Respostas curtas e longas | Pelo menos 5 de cada por contexto | Texto comparado com a interface, associação correta e estado de captura honesto. |
| Bloqueio da política | 5 permitidos e 5 bloqueados por contexto | Resultado e motivo persistidos; bloqueio não aparece como envio permitido. |
| Arquivo sintético enviado | 3 tipos conhecidos por contexto | Presença, nome e tipo ligados à interação correta; nenhum byte do arquivo armazenado. |
| Interrupção e falha | Interromper antes e depois do primeiro texto; desligar API e restaurar | Estado incompleto ou falha explícito, sem resposta vazia confirmada nem falso sucesso de persistência. |
| Reabertura e regeneração | 2 ciclos por contexto | Sem duplicar prompts e mantendo respostas ligadas à interação original. |

Para cada tentativa, comparar a interface, o diagnóstico da extensão, a API e a linha persistida. Contar tentativas planejadas e tentativas perdidas. Inspeção de código não conta como execução no navegador.

**Saída:** relatório com `PASS`, `FAIL`, `BLOCKED`, `NOT_TESTED` ou `POLICY_QUESTION` por caso, além de cobertura, duplicidades, fidelidade, associação, atribuição e estados incompletos.

### 3. Fechar as lacunas do contrato de dados

Depois da medição, implementar apenas os campos que falharem ou estiverem ausentes. O modelo lógico esperado é:

- **Funcionário:** identificador interno estável e estado ativo.
- **Departamento:** identificador estável e nome.
- **Lotação histórica:** funcionário, departamento e intervalo de vigência.
- **Instalação:** vínculo administrativo com funcionário e histórico de atribuição.
- **Interação:** funcionário, departamento vigente, contexto de uso, plataforma, prompt, horários e resultado da política.
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

1. Cada contexto de uso passar os testes de envio, resposta, bloqueio e interrupção.
2. Funcionário e departamento estiverem corretos no registro persistido.
3. Os arquivos sintéticos aparecerem com nome e tipo ligados à interação correta, sem bytes armazenados.
4. Prompts e respostas forem fiéis à interface e não houver duplicidade ou associação cruzada na amostra.
5. Falhas e interrupções não forem apresentadas como persistência ou resposta completa.
6. Retenção, migração e recuperação tiverem evidência local.
7. Os critérios de aceite e o propósito de uso tiverem aprovação humana registrada.

Esse aceite cobre o MVP local. Implantação nos departamentos, banco central, autenticação corporativa e análise de conteúdo real ficam fora desta etapa.

## Decisões de governança pendentes

- Qual fonte fornece identificador e departamento do funcionário?
Poderiamos fazer isso pelo proprio pop up
- Quem pode ler prompts e respostas em texto bruto?
Somente o responsável pelo Projeto, liderança.
- A análise departamental pode usar conteúdo bruto ou começa por métricas agregadas?
- Provavelmente vou montar uma análise com uma chave de LLM para buscar padrões, comportamentos e etc.
- Qual é o prazo aprovado para guardar prompts, respostas, metadados e eventos técnicos?
Ideal seria de 1 mês para acumular e eu poder fazer um levantamento com uma quantidade maior de dados
- A empresa permite análise individual de uso ou limita os relatórios a grupos e departamentos?
Como eu disse, provavelmente devo utilizar uma chave de LLM para estabelecer as métricas e classificações dos nossos dados
- Como a pessoa é informada sobre a captura e os usos autorizados?
Eles serão avisados, o uso interno é puramente corporativo com emails corporativos e com fins de uso para produtividade dentro da empresa. Ou seja, fica mais simples para articular essas permissões

Não alterar `policies/` para resolver essas perguntas. Registrar as respostas como decisões humanas antes da coleta com dados reais.
