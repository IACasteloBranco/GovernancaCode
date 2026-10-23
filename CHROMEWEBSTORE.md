# Preparação da Chrome Web Store — Governança de IA Castelo Branco Contabilidade

**Atualizado:** 22/10/2026
**Estado:** rascunho para revisão e eventual submissão. A empresa decidiu manter a leitura humana atual e declarar que ela apoia métricas mensais; essa decisão não confirma conformidade nem garante aprovação da Chrome Web Store.

Este arquivo organiza os textos e dados que podem ser transcritos para o painel da Chrome Web Store. A política de privacidade detalhada permanece em [docs/drafts/AVISO_PRIVACIDADE_EXTENSAO_DRAFT.md](docs/drafts/AVISO_PRIVACIDADE_EXTENSAO_DRAFT.md). Nenhuma declaração de conformidade ou decisão de política é aprovada por este rascunho.

## Identificação

| Campo | Valor local | Estado |
|---|---|---|
| Nome | Governança de IA Castelo Branco Contabilidade | Igual ao `manifest.json` |
| Versão | 0.4.7 | Igual ao `manifest.json` |
| ID | `njcbfaglhfigplenmpaojjgdbcjcfbjh` | Informado no painel da Store |
| Publicador | Castelo Branco Contabilidade | Confirmado pela empresa |
| País | Brasil | Confirmado pela empresa |
| Categoria sugerida | Produtividade | Confirmar as opções do painel |
| Idioma principal | Português (Brasil) | Confirmado pelo conteúdo da extensão |
| Distribuição pretendida | Privada, para uso interno | Selecionar e confirmar no painel |
| Região | Brasil, se o painel permitir restringir | Confirmar no painel |

## Texto da página da loja

**Descrição curta**

Registra prompts e respostas do ChatGPT para apoiar a governança interna do uso de IA.

**Descrição detalhada**

Governança de IA Castelo Branco Contabilidade ajuda a aplicar as regras internas de uso de IA e a analisar como o ChatGPT é usado no trabalho.

A extensão pode registrar o texto enviado no editor do ChatGPT e a resposta observada, além do horário, da URL e do identificador da conversa, da identidade e do departamento atribuídos à instalação e de metadados dos anexos. Ela atua somente em `chatgpt.com`. Não envia o conteúdo binário dos arquivos anexados.

Os registros são enviados ao backend corporativo e usados para calcular métricas mensais de uso por colaborador e departamento, avaliar a qualidade do uso e estudar como a IA participa das operações. A empresa informa que não usa os dados para treinar modelos. Liderança e chefia do departamento de IA podem ler conversas completas vinculadas ao colaborador para essas análises.

Antes de ativar a captura, a pessoa vê o aviso de privacidade na extensão e confirma que tomou ciência. A captura pode ser pausada pela própria pessoa. A extensão não anonimiza automaticamente o conteúdo; a empresa orienta a anonimização de dados de clientes e terceiros antes do envio ao ChatGPT.

O backend usa Google Cloud e Cloudflare para hospedagem, autenticação e transporte. O prazo interno definido para retenção é de 90 dias; a configuração de backups e a retenção de logs dos fornecedores ainda precisam ser confirmadas. Para dúvidas ou pedidos de privacidade, contate Castelo Branco Contabilidade pelo telefone +55 75 9864-6173.

**Finalidade única**

Apoiar a governança corporativa do uso do ChatGPT, aplicando regras internas e registrando as interações necessárias para métricas mensais de uso por colaborador e departamento e análises de qualidade.

## Permissões e justificativas

| Permissão ou host | Justificativa para o painel |
|---|---|
| `storage` | Mantém preferências de captura, ciência do aviso, identidade da instalação e históricos técnicos. Os históricos locais expiram em 90 dias; a identidade e a chave da instalação permanecem enquanto ela estiver cadastrada. |
| `tabs` | Localiza abas do ChatGPT para sincronizar o estado de captura e relacionar os registros à conversa observada. |
| `identity` | Permite autenticar colaboradores com Google Workspace antes de liberar a captura vinculada à instalação atribuída. |
| `alarms` | Agenda a limpeza periódica dos históricos técnicos locais vencidos. |
| `https://chatgpt.com/*` | Lê o prompt enviado, a resposta observada e os metadados da conversa no serviço que a extensão declara suportar. |
| `https://asked-switching-poly-trackback.trycloudflare.com/*` | Envia autenticação e registros ao backend corporativo atual. Este host é temporário e deve ser substituído por um domínio estável antes da publicação operacional. |

## Declarações de dados para revisão no painel

O mapeamento abaixo é provisório. O texto capturado pode conter dados pessoais de clientes ou terceiros. A extensão não anonimiza automaticamente o conteúdo. Conferir cada categoria disponível no formulário da Store antes de marcar as declarações.

| Categoria provável no formulário | Coleta? | Evidência e finalidade |
|---|---:|---|
| Informações de identificação pessoal | Sim | E-mail/identidade Google, identificador do colaborador e departamento, identificador da instalação e IP recebido pelo backend. Usados para autenticação, atribuição e análise interna. |
| Informações de autenticação | Sim | Código e token de autenticação Google são processados para login e chamadas autenticadas. O token de sessão não é incluído no registro da conversa. |
| Comunicações pessoais e conteúdo gerado pelo usuário | Sim | Texto dos prompts e respostas observadas, enviados ao backend para governança, análise de uso e qualidade. |
| Conteúdo e recursos de sites | Sim | Conteúdo observado em `chatgpt.com`, incluindo prompts e respostas. |
| Atividade de navegação | Sim, limitada | URL e ID da conversa ativa no ChatGPT são observados para relacionar os registros à conversa. Não há captura de histórico fora da conversa observada. |
| Atividade do usuário | Sim | Eventos de captura, horário, resultado e metadados técnicos usados para auditoria e operação. |
| Dados financeiros | Podem estar presentes | Mensagens podem conter dados contábeis ou financeiros inseridos pelo colaborador. A extensão não garante detecção ou remoção de todo esse conteúdo. |
| Dados de saúde ou outras categorias sensíveis | Podem estar presentes | O texto capturado pode conter dados sensíveis se forem inseridos. A orientação de anonimização é operacional e não é aplicada automaticamente. Confirmar a classificação exigida pelo formulário. |
| Localização precisa | Não identificada na implementação | Não há coleta de localização precisa no escopo revisado. |
| Cookies ou cabeçalhos de autenticação do ChatGPT | Não | A extensão não captura nem encaminha cookies ou cabeçalhos de autenticação do ChatGPT. |
| Bytes ou conteúdo binário dos anexos | Não | A implementação registra metadados observados, como nome, tipo e tamanho; não lê nem envia bytes do arquivo. |
| Histórico de navegação fora da conversa observada | Não | A captura é limitada às páginas do ChatGPT abrangidas pelo manifesto. |

**Transmissão e destinatários**

Os dados são transmitidos por HTTPS ao backend operado pela empresa. Google Cloud e Cloudflare participam da hospedagem, autenticação ou transporte conforme os serviços usados. A empresa informa que não vende os dados e não os usa para treinamento de modelos.

**Certificações do formulário**

- Não vender dados a terceiros: compatível com as finalidades informadas pela empresa; confirmar antes de certificar.
- Não usar dados para fins não relacionados à finalidade principal: **pendente**. As análises identificadas por colaborador e a leitura humana de conversas precisam ser comparadas com a regra de uso limitado da Store.
- Não usar dados para avaliar crédito ou concessão de empréstimo: compatível com as finalidades informadas; confirmar antes de certificar.
- Declaração de conformidade com Limited Use: **não marcar enquanto as questões de acesso humano e métricas individuais estiverem abertas**.

## Política de privacidade

**URL pública e estável:** pendente. O documento local é um rascunho e não pode ser usado como URL pública até revisão e publicação.

O aviso exibido no popup já informa, antes da ativação, os principais dados observados, finalidades, acesso a conversas, infraestrutura, retenção pretendida, ausência de anonimização automática, canal de contato e possibilidade de pausar a captura. O texto completo está no rascunho de privacidade vinculado acima.

Quando a política for publicada, incluir nela a declaração de que os dados recebidos por APIs do Google serão usados de acordo com a política de dados da Chrome Web Store, incluindo os requisitos de uso limitado, se aplicável ao fluxo efetivamente usado.

## Contato

| Campo | Valor | Estado |
|---|---|---|
| Contato de privacidade/suporte | +55 75 9864-6173 | Informado pela empresa |
| Responsável por responder | Eduardo Sobreira Alves Pires | Informado pela empresa |
| E-mail público de suporte | Pendente | Confirmar um endereço monitorado para o painel |
| URL de suporte | Pendente | Opcional, mas recomendada |

## Artes da loja

| Arte | Estado local |
|---|---|
| Ícone da loja, 128×128 PNG | `extension/icons/icon-128.png`, dimensão verificada |
| Captura de tela, 1280×800 ou 640×400 | Pendente; não há captura de tela de loja na pasta `extension/` |
| Capturas adicionais | Opcionais; preparar com dados sintéticos e conferir se não exibem prompts reais |

## Bloqueios antes de certificar ou enviar

1. **Acesso humano ao conteúdo:** a empresa decidiu manter a leitura de conversas identificadas por liderança e chefia de IA para análises mensais de métricas e qualidade. A listagem e o aviso agora declaram essa prática. A política da Store restringe a leitura humana a exceções específicas; transparência não garante conformidade. O publicador precisa avaliar a questão e só certificar Limited Use se puder atestar que o uso atende aos requisitos.
2. **Métricas por colaborador:** confirmar que o uso permanece limitado às finalidades internas informadas e não será usado em avaliação de desempenho ou decisões disciplinares. Essa finalidade adicional não foi aprovada.
3. **Consentimento:** o popup atual pede para a pessoa confirmar que recebeu e leu o aviso. A regra da Store pede uma ação afirmativa que concorde claramente com a coleta e o uso descritos. Confirmar com privacidade/jurídico se o termo assinado e o controle atual atendem ao requisito e aprovar a redação antes de mudar o texto da interface.
4. **URL da política:** revisar e publicar o aviso em endereço público e estável; depois preencher o campo correspondente no painel.
5. **E-mail e suporte:** definir e testar um e-mail público monitorado para o cadastro da loja.
6. **Capturas de tela:** criar ao menos uma imagem nos tamanhos aceitos pelo painel, com dados sintéticos.
7. **Dados declarados:** confirmar as categorias de dados do formulário considerando que prompts e respostas podem conter informações pessoais, financeiras ou sensíveis.
8. **Conta e distribuição:** confirmar a verificação em duas etapas da conta publicadora e selecionar a distribuição privada adequada à organização.

## Histórico local

| Versão preparada | Data | Alteração |
|---|---|---|
| 0.4.7 | 22/10/2026 | Declara que as métricas são mensais e que liderança e chefia de IA podem ler conversas identificadas para essas análises. Ainda não submetida. |

## Referências e evidências locais

- [Políticas do Chrome Web Store](https://developer.chrome.com/docs/webstore/program-policies/policies)
- [Política de dados e perguntas frequentes](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Campos de privacidade do painel](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [Distribuição no painel](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution)
- [Rascunho do aviso de privacidade](docs/drafts/AVISO_PRIVACIDADE_EXTENSAO_DRAFT.md)
- [Controles de privacidade e decisões pendentes](docs/plans/CONTROLES_PRIVACIDADE_OPERACAO.md)
- Implementação revisada: `extension/manifest.json`, `extension/src/popup/popup.html`, `extension/src/content/observer.js`, `extension/src/content/files.js` e `extension/src/background/service-worker.js`.

