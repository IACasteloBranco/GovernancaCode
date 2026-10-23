# Controles de privacidade: configuração e operação

**Estado:** mudanças locais implementadas; implantação e revisão jurídica pendentes. Este documento não aprova política, risco ou publicação.

## Controles no código

- A extensão apresenta um aviso versionado e exige confirmação de ciência antes de habilitar captura. O aceite é vinculado à conta Google no modo `lab` ou ao ID atribuído no modo local; trocar a versão do aviso desativa a captura até novo aceite. O aceite não substitui o termo assinado.
- A pessoa pode pausar a captura e pode remover os dados locais pelo popup. A remoção limpa o aceite, a chave e os históricos locais e gera outro identificador de instalação. Ela não apaga dados do backend.
- Históricos locais de capturas, metadados, diagnósticos e vínculos de conversa expiram em 90 dias. A limpeza ocorre na inicialização, em alarme diário e antes da leitura ou gravação. Se o Chrome estiver fechado, os itens vencidos serão removidos na próxima execução da extensão.
- O backend usa 90 dias por padrão e impede configuração superior a 90 para interações, respostas/eventos associados, capturas técnicas, metadados e auditoria de acesso. `RETENTION_DAYS` pode ser menor para ambiente local; o ambiente implantado deve fixar `RETENTION_DAYS=90`.
- `GOOGLE_CONTENT_VIEWER_SUBS` contém os Google `sub` de liderança e da chefia de IA, separados por vírgula. Essas identidades podem consultar o resumo e o conteúdo integral. Leitura de conteúdo registra `sub`, horário UTC, rota e quantidade, sem copiar o conteúdo, filtro de colaborador ou ID de conversa. Tentativas de identidade verificada não autorizada nas rotas de conteúdo também são registradas.
- O responsável executa exclusões no host do backend por um comando local e fica identificado pelo usuário do sistema operacional. Os viewers usam identidades Google individuais. Sem a nova lista de viewers, o modo `lab` não libera consultas; o antigo `GOOGLE_OPERATOR_SUB` não é fallback.

## Executar um pedido de exclusão

1. Receba o pedido pelo canal de privacidade (+55 75 9864-6173), confirme a identidade do solicitante e obtenha o ID de colaborador. Registre a data do pedido e a resposta em controle interno da empresa, sem copiar prompt ou resposta.
2. O responsável pela ferramenta entra no host do backend com sua conta individual do sistema operacional. Não execute o comando com uma conta compartilhada.
3. No diretório `backend/`, execute, substituindo o código pelo ID confirmado:

   ```sh
   python -m app.delete_employee_data --employee-id CB-1234 --confirm-employee-id CB-1234
   ```

4. Registre apenas o horário, o operador e as quantidades devolvidas. O backend apaga em uma transação as interações e respostas/eventos relacionados, capturas técnicas, metadados de arquivos e instalações atribuídas ou com pedido pendente para o colaborador. Registros sem ID de colaborador só são removidos se estiverem ligados à instalação dele; registros explicitamente atribuídos a outra pessoa são preservados. Também elimina a chave pública e nonces do servidor para essas instalações. A exclusão é segura para repetir; uma repetição sem registros retorna contagens zero.
5. Peça ao colaborador para usar **Apagar dados locais** no popup. O cadastro corporativo de colaboradores permanece como registro operacional. Não copie IDs de conversa, prompts, respostas ou conteúdo de anexos no registro do pedido.

O prazo de 15 dias úteis é uma meta interna informada pela empresa. Backups ainda não estão configurados e o comando não remove cópias históricas de backup. Se houver restauração de um backup feito antes da exclusão, reaplique os pedidos de exclusão que chegaram depois daquele snapshot antes de liberar o serviço. Essa lista de pedidos precisa ser mantida em controle administrativo separado; não restaure o banco diretamente para produção sem essa etapa.

## Pedidos de acesso ou correção

Receba pedidos pelo mesmo telefone, confirme a identidade da pessoa e encaminhe ao responsável pela ferramenta. O acesso ao conteúdo integral exige uma conta Google `sub` cadastrada como viewer; o colaborador não recebe acesso ao painel por ser titular. O responsável deve consultar os registros sob autorização, fornecer somente os dados da própria pessoa e registrar a resposta sem incluir prompts ou respostas no controle do pedido. A correção ainda é um procedimento manual no banco de dados e deve ser revisada para não alterar registros de outra pessoa; não há endpoint de correção implementado.

## Configuração que falta no ambiente implantado

O repositório não contém configuração ativa de Compute Engine, Cloudflare Tunnel, backups ou Cloud Logging. As alterações locais não mudam recursos da nuvem. Antes de afirmar que todos os dados expiram em 90 dias:

- Configure o serviço implantado com `RETENTION_DAYS=90`, os viewers autorizados em `GOOGLE_CONTENT_VIEWER_SUBS` e `PILOT_DEPARTMENT_CODE=*` para abranger os departamentos ativos. Restrinja o acesso ao host para que somente o responsável execute exclusões. Não compartilhe nem registre segredos no repositório.
- Configure cópia consistente do SQLite em armazenamento separado, criptografia, acesso mínimo e ciclo de vida de 90 dias. Faça restauração de ensaio em ambiente isolado e valide a reaplicação de exclusões posteriores ao snapshot.
- Configure e verifique por separado retenção de 90 dias e acesso mínimo para logs e snapshots do Google Cloud e Cloudflare. Logs de proxy não devem incluir corpos de requisição, tokens, prompts ou respostas.
- Revise firewall, conta de serviço, TLS, política Zero Trust, alertas de acesso e resposta a incidentes. Os detalhes reais precisam ser confirmados na configuração da VM e do túnel.

## Decisões antes de publicação ou rollout

- Confirmar os IDs Google `sub` das duas funções de leitura e contas individuais de sistema operacional para o responsável por exclusões.
- Revisar com privacidade/jurídico a base legal, o aviso e o uso obrigatório, especialmente a leitura humana de conversas identificadas e as métricas individuais.
- Confirmar se a confirmação dentro da extensão, junto ao termo assinado, atende à política da Chrome Web Store para distribuição privada. Essa implementação não certifica elegibilidade.
- Publicar uma política de privacidade em URL estável e confirmar o canal que será divulgado no painel da loja. O telefone informado é o contato atual.
