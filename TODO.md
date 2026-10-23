# Próximas correções do projeto

Esta lista reúne lacunas observadas na revisão do repositório em 18/10/2026. Ela não aprova políticas, uso de dados reais ou implantação. Use dados sintéticos até que as decisões humanas abaixo estejam registradas.

## P0. Decisões de governança antes de ampliar o piloto

O responsável registrou decisões iniciais em [Decisões de governança do piloto](docs/plans/DECISOES_GOVERNANCA_PILOTO.md). As decisões não alteram a política de bloqueio.

- [x] Definir dados coletados e finalidade inicial: prompts, respostas, metadados de arquivos, identificação atribuída, departamento, horário e decisão/regra de bloqueio. A análise posterior deve buscar métricas e padrões de uso e operação.
- [x] Definir que a análise futura com LLM deverá receber os dados corporativos capturados; a escolha do serviço será retomada depois da ferramenta de analytics.
- [x] Definir retenção de 90 dias para registros e backups. Expurgo significa apagar os dados quando vencerem 90 dias do recebimento.
- [x] Definir grupos autorizados: responsável pelo projeto, liderança e equipe de monitoramento preventivo. A autenticação usará identidades corporativas do Cloud Identity.
- [x] Definir que `REVIEW` e `BLOCK` entram no indicador agregado de prompts potencialmente perigosos, mantendo contagens distintas para cada decisão.
- [x] Definir o responsável por receber contestações de bloqueio: o responsável pelo projeto.
- [x] Definir que um CPF válido em destino não aprovado continua acionando `BLOCK`, inclusive quando houver somente um CPF.
- [ ] Aprovar o limiar de R06 para dados pessoais estruturados.
  - Recomendação: tabela com cabeçalho `nome` e `CPF`, `REVIEW` para 2 a 4 registros com CPF válido e `BLOCK` para 5 ou mais. A partir de 2 registros, também recomendo `BLOCK` quando houver campos sensíveis associados. Ver detalhes no [registro de decisões](docs/plans/DECISOES_GOVERNANCA_PILOTO.md).
- [x] Inspecionar no código o comportamento quando a extensão ou o backend falha.
  - Resultado: o gate consulta o backend antes do POST de conversa e bloqueia quando não recebe uma resposta saudável. Sem `blocker-main.js`, a extensão ainda não consegue interceptar o envio.
- [x] Configurar bloqueio quando o backend não responder à checagem de saúde antes do envio.
  - O gate exige que `/health` responda com `status: "ok"` antes de liberar o POST de conversa e revalida o estado local de captura e atribuição. Timeout, erro de rede, estado local inválido ou resposta inválida bloqueiam o envio.
- [ ] Ensaiar no Chrome a API indisponível, token recusado ou expirado e gate da extensão ausente.
  - Limite atual: a checagem de saúde não confirma a gravação do prompt nem detecta um token revogado se `/health` continuar público e saudável. A inspeção de código não substitui os ensaios no navegador.
- [ ] Preparar e entregar o aviso aos participantes antes da instalação.
  - Critério: aviso descreve captura, finalidade, perfis com acesso, retenção de 90 dias e contato para dúvidas/contestação.

## P1. Tornar bloqueios visíveis sem coletar prompts

- [ ] Definir o contrato mínimo para eventos de decisão.
  - Critério: registra horário, ação, método, destino, versão da política, IDs das regras e contagens; não inclui texto do prompt, segredo detectado nem valor correspondente.
- [ ] Enviar eventos `BLOCK`, `REVIEW` e bloqueio de rede da extensão ao backend com assinatura da instalação e identidade vinculada.
  - Critério: evento é autenticado, validado, idempotente e continua separado de `WARN`, `ALLOW` e falhas de captura.
- [ ] Persistir e expurgar eventos de bloqueio conforme a retenção aprovada.
  - Critério: migração preserva bancos existentes e limpeza cobre os novos eventos.
- [ ] Exibir no analytics contagens separadas por categoria, período e departamento autorizado.
  - Critério: endpoint e painel não expõem texto bruto nem ampliam o escopo atual do operador.
- [ ] Validar o fluxo completo com dados sintéticos no navegador e no banco.
  - Critério: tentativas permitidas, avisadas, em revisão, bloqueadas pela política e bloqueadas pela rede aparecem na categoria correta sem duplicação.
- [ ] Implementar autorização do analytics para os grupos e identidades Cloud Identity definidos.
  - Critério: o responsável, a liderança e a equipe de monitoramento autorizados acessam conforme o escopo aprovado; outras contas recebem bloqueio. A implementação atual aceita somente um `GOOGLE_OPERATOR_SUB`.

## P1. Fechar lacunas de captura e interpretação

- [ ] Validar o bloqueio antes da transmissão nos métodos suportados.
  - Critério: clique, Enter, submit, regeneração e bloqueio de rede têm resultado observado no navegador e na requisição.
- [ ] Documentar os limites de inspeção no painel e nos materiais do piloto.
  - Critério: anexos, imagens, áudio, OCR, links e conteúdo não observável não são apresentados como cobertos pela política.
- [ ] Comprovar a captura de anexos enviados e sua associação à interação.
  - Critério: testes sintéticos verificam presença, nome, tipo e tamanho quando disponíveis, sem guardar bytes.
- [ ] Revalidar a captura de respostas, conversas retomadas, interrupções e ausência do backend.
  - Critério: dados persistidos correspondem à interface e estados incompletos não aparecem como respostas completas.

## P1. Identificar e atualizar a versão executada no Lab

- [ ] Gerar artefatos somente de uma revisão identificada do repositório.
  - Critério: cada pacote registra commit, versão e SHA-256; o processo recusa fontes com alterações não registradas ou informa explicitamente a revisão empacotada.
- [ ] Criar procedimento repetível de instalação e atualização na VM.
  - Critério: atualiza código sem substituir `.env` nem banco, valida o pacote, reinicia o serviço e permite retorno à versão anterior.
- [ ] Configurar serviço persistente, HTTPS, callback OAuth exato e acesso pela rede aprovada.
  - Critério: serviço volta após reinício; certificado e cookie seguro são válidos; usuários fora do escopo recebem bloqueio.
- [ ] Confirmar banco em armazenamento persistente e testar restauração de backup sintético.
  - Critério: registros permanecem após reinício e uma restauração documentada recupera o serviço.
- [ ] Executar validação ponta a ponta no Lab antes de declarar a Fase 4 concluída.
  - Critério: OAuth, captura, analytics, retenção, reinício e isolamento de acesso têm evidência registrada.

## P2. Criar critérios de aceite e manter a documentação

- [ ] Criar casos de validação aprovados em `qa/` para os fluxos de bloqueio, captura, autenticação, retenção e analytics.
  - Critério: cada caso tem entrada sintética, esperado, observado, resultado e evidência.
- [ ] Manter este TODO ligado aos relatórios de implementação e aos casos de validação.
  - Critério: fechar itens somente com evidência; registrar `POLICY_QUESTION` quando depender de decisão humana.
- [ ] Antes da primeira análise com LLM, escolher o provedor e definir controle da chave e tratamento dos dados.
  - O responsável decidiu que os dados capturados serão enviados para análise. A escolha do provedor, o controle da chave e o tratamento no serviço serão discutidos depois que a ferramenta de analytics estiver implementada.

## Sequência recomendada

1. Resolver as decisões P0 necessárias para cada dado ou uso que será testado.
2. Fechar o contrato e a validação local dos eventos de bloqueio.
3. Implementar a captura e o indicador no analytics com dados sintéticos.
4. Corrigir e revalidar as lacunas de captura.
5. Preparar a atualização reproduzível e concluir a verificação do Lab.
6. Criar os casos aprovados em `qa/` e fechar cada item com evidência.

## Pauta de melhorias priorizada

Itens levantados pelo responsável do projeto; a ordem abaixo reflete a prioridade informada. São propostas de trabalho, não decisões de política nem autorização de implantação.

1. [ ] **Facilitar a instalação nas máquinas.** Avaliar um fluxo em que a pessoa informe o nome completo, o sistema confira o código associado e acione a instalação/configuração no servidor. Definir validação da identidade, autorização para executar código e confirmação antes de qualquer execução remota.
2. [ ] **Investigar a inconsistência no primeiro prompt do chat.** Reproduzir com entradas sintéticas, registrar esperado e observado e identificar se a causa está na inicialização, captura, identificação ou comunicação com o backend antes de propor correção.
3. [ ] **Revisar a política de governança interna.** Avaliar as regras e o processo interno vigentes, registrar lacunas e propostas para decisão humana. Alterações em `policies/` dependem de aprovação explícita.
4. [ ] **Avaliar suporte ao ChatGPT App.** Delimitar a plataforma e os fluxos de captura/bloqueio que precisam ser cobertos e validar as limitações técnicas antes de estimar implementação.
5. [ ] **Avaliar Claude.** Investigar separadamente Cowork com computer use, chat web e app, registrando viabilidade e cobertura de cada superfície.

## Expansão operacional

- [ ] Planejar e executar a instalação nas demais máquinas da empresa, após validar o procedimento e o escopo de cada instalação.
- [ ] Obter/configurar um domínio para o tunnel fixo e validar acesso, TLS e configuração do serviço no ambiente aprovado.
