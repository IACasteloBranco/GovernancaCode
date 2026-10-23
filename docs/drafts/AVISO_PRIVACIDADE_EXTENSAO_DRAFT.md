# Aviso de privacidade da extensão de governança de IA

**Status:** rascunho para revisão interna e eventual submissão à Chrome Web Store. A empresa decidiu manter o modelo atual de acesso humano e declarar seu uso mensal neste aviso. Isso não confirma conformidade nem garante aprovação da loja; as questões abaixo permanecem abertas.

**Data:** 22/10/2026

## Quem opera a extensão

A Castelo Branco Contabilidade opera esta extensão para uso interno por seus colaboradores no Brasil. Para dúvidas ou solicitações sobre dados pessoais, contate Eduardo Sobreira Alves Pires pelo telefone +55 75 9864-6173.

## Dados tratados

O backend recebe o texto do prompt e da resposta observada, data e hora, identificadores da instalação e do colaborador, departamento, dados de contexto da conversa, estado da captura e metadados de anexos. Ele também registra o endereço IP de origem da requisição. Para arquivos gerados ou baixados, o backend guarda metadados como nome, tipo e tamanho, quando disponíveis. Ele não guarda os bytes desses arquivos nem o stream bruto da resposta.

A extensão mantém dados no perfil do Chrome. Entre eles estão o identificador da instalação, chaves usadas para assinar registros, a opção de captura, a versão e a data da ciência do aviso, vínculos recentes entre conversa e turno, diagnósticos técnicos e resumos de capturas e artefatos. Os históricos locais de capturas, artefatos, diagnósticos e vínculos de turno são removidos após 90 dias. A limpeza ocorre na inicialização, em alarme diário e antes de ler ou gravar esses históricos; se o Chrome estiver fechado no vencimento, a remoção ocorrerá na próxima execução da extensão. O identificador da instalação e a chave permanecem enquanto a instalação estiver cadastrada, salvo se a pessoa usar o controle **Apagar dados locais** no popup, que remove os dados do perfil e gera outro identificador. Os diagnósticos podem registrar a decisão da política e os identificadores das regras acionadas. O vínculo local com um turno guarda um hash do prompt, não o texto do prompt.

A extensão usa o login Google Workspace para autenticar a pessoa. O token de login fica na sessão da extensão e é enviado ao backend para autenticar chamadas. Esse token não faz parte do registro da conversa. A extensão não captura nem encaminha cookies ou cabeçalhos de autenticação do ChatGPT. Ela não envia o conteúdo binário de arquivos anexados.

Ela pode capturar texto que contenha dados pessoais de clientes ou de outras pessoas. A instrução para anonimizar conversas é uma medida operacional. A extensão não anonimiza automaticamente prompts ou respostas.

## Finalidades

A empresa calcula métricas mensais de uso por colaborador e departamento, avalia a qualidade do uso de IA e estuda onde a IA participa das operações e onde seu uso pode melhorar. Os dados não serão usados para treinar modelos de IA.

## Acesso e fornecedores

A liderança da empresa e a chefia do departamento de IA podem acessar prompts e respostas completos vinculados ao colaborador. Esse acesso é usado nas análises mensais de métricas de uso por colaborador e departamento, qualidade do uso de IA e participação da IA nas operações. O backend autoriza as identidades Google configuradas para esses acessos. Cada leitura de conteúdo registra identidade do operador, data e hora, rota e quantidade de registros retornados; o log não copia prompts, respostas, filtros por colaborador ou IDs de conversa. O resumo analítico também fica restrito aos operadores autorizados e permite agrupamentos por departamento ou colaborador.

O backend está hospedado em uma máquina do Google Cloud Compute Engine na região de São Paulo. O login usa Google Workspace. A extensão se comunica com o backend por um Cloudflare Tunnel com Zero Trust e TLS. Google Cloud e Cloudflare participam do processamento ou transporte dos dados conforme a configuração dos serviços.

## Retenção e exclusão

A regra definida pela empresa é reter os registros de uso, a auditoria de acesso e os logs da aplicação por 90 dias, incluindo cópias de backup e recuperação. O backend e os históricos locais da extensão usam 90 dias como padrão. O cadastro corporativo de colaboradores e as atribuições ativas de instalação são registros operacionais mantidos enquanto necessários à operação; a instalação vinculada é removida quando o pedido de exclusão é executado. O backup ainda não está configurado e a retenção de logs do Google Cloud e do Cloudflare ainda precisa ser conferida e ajustada. O prazo de 90 dias para essas cópias e logs só poderá ser confirmado depois da configuração operacional.

O colaborador pode apagar os dados locais pelo popup e solicitar acesso, correção ou exclusão dos dados do backend pelo telefone indicado acima. O objetivo interno é concluir solicitações de exclusão em até 15 dias úteis; esse é o prazo de atendimento definido pela empresa, não uma afirmação de prazo legal universal. O responsável pela ferramenta executa a exclusão pelo backend. São removidos interações e suas respostas/eventos, capturas técnicas de stream, metadados de arquivos e a atribuição/chave da instalação vinculada. O cadastro de colaboradores usado para a operação da empresa permanece. O evento de auditoria guarda apenas as quantidades removidas, o operador e o horário, sem o ID do colaborador. A exclusão de cópias de backup existentes exigirá reaplicar a exclusão após uma restauração; o processo de backup ainda não está ativo.

## Uso obrigatório e aviso aos colaboradores

A empresa destina a extensão aos colaboradores e exige seu uso. Cada colaborador deve assinar um termo antes do início da coleta. Antes de ativar a captura, a extensão apresenta este aviso e exige uma confirmação de ciência vinculada à conta ou ao colaborador atribuído. Essa confirmação local não substitui o termo assinado nem comprova, por si só, a base legal do tratamento. A captura pode ser desativada pelo próprio colaborador. A empresa orienta os colaboradores a anonimizar conversas antes de enviá-las a ferramentas de IA; a extensão não faz essa anonimização automaticamente. Mudanças no aviso e no uso da ferramenta serão comunicadas pelo canal interno da empresa; alterações do aviso exigem uma nova confirmação na extensão.

## Segurança

A empresa hospeda o backend no Google Cloud Compute Engine e usa Cloudflare Tunnel com Zero Trust e TLS para o tráfego entre a extensão e o backend. A configuração de backup ainda está pendente. Este aviso não descreve controles de acesso, proteção de dados armazenados, logs de provedores ou recuperação de backup que ainda não foram confirmados.

## Questões que precisam ser resolvidas antes da publicação

- **POLICY_QUESTION — Consentimento e divulgação:** validar com a Chrome Web Store se o aviso e a confirmação dentro da extensão, junto ao termo assinado antes da coleta, atendem às regras de distribuição privada. O uso obrigatório, a confirmação local e o termo assinado não resolvem sozinhos a base legal nem garantem compatibilidade com a política da loja.
- **POLICY_QUESTION — Acesso humano ao conteúdo:** a empresa decidiu manter a leitura de conversas identificadas por liderança e chefia de IA para preparar métricas e análises mensais. Este aviso declara essa finalidade e esses leitores. A Chrome Web Store restringe a leitura humana a exceções específicas; a divulgação, por si só, não confirma compatibilidade nem garante aprovação. O responsável deverá avaliar e declarar o uso no painel sem afirmar conformidade que não possa atestar.
- **POLICY_QUESTION — Uso das métricas individuais:** confirmar se as métricas por colaborador podem ser usadas para avaliação de desempenho ou decisões disciplinares, ou se ficam restritas à análise operacional e de qualidade do uso de IA.
- **Configuração:** configurar backups do banco no Compute Engine, retenção de 90 dias para backups e logs aplicáveis no Google Cloud e Cloudflare, restauração e reaplicação de exclusões feitas depois do snapshot.
- **Autenticação:** confirmar quais dados de autenticação e registros técnicos o Google, o Google Cloud e o Cloudflare retêm nos fluxos de login e de API.
- **Dados locais:** o prazo de 90 dias já é aplicado a vínculos de turno, diagnósticos e resumos locais. Identificador da instalação, chave e atribuição permanecem enquanto a instalação estiver cadastrada; definir o procedimento de revogação quando a pessoa sair ou a instalação for substituída.
- **Exclusão:** validar operacionalmente o endpoint restrito ao responsável e o escopo descrito acima. A exclusão de registros antigos sem atribuição confiável e de cópias de backup depende de revisão operacional.
- **Controle de acesso:** preencher `GOOGLE_CONTENT_VIEWER_SUBS` com os `sub` das identidades autorizadas e restringir o acesso ao host do backend para que somente o responsável execute exclusões. Os `sub` ainda precisam ser obtidos e configurados no ambiente implantado.
- **Base legal:** confirmar com a pessoa responsável por privacidade ou assessoria jurídica a base legal para o tratamento de dados de colaboradores e a redação dos direitos aplicáveis.

- **Destino de métricas individuais:** confirmar se métricas individuais podem ser usadas em avaliação de desempenho ou decisões disciplinares. A finalidade informada neste aviso limita o uso a análises internas de uso e qualidade; nenhum outro uso foi aprovado nesta conversa.

## Referências

- [Políticas de dados da Chrome Web Store](https://developer.chrome.com/docs/webstore/program-policies/policies)
- [Direitos dos titulares segundo a ANPD](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares)
- [Lei Geral de Proteção de Dados Pessoais, artigos 18 e 19](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm)
