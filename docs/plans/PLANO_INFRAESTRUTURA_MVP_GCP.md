# Plano de infraestrutura do MVP no Google Cloud

**Status:** proposta para revisão. Este documento não aprova uso de dados reais nem autoriza custos ou implantação.

**Aditivo local de 21/10/2026:** as decisões atuais de retenção, acesso, exclusão e destinatários estão em [Controles de privacidade: configuração e operação](CONTROLES_PRIVACIDADE_OPERACAO.md). Elas substituem neste plano as referências a retenção de sete dias, a um único operador e ao escopo apenas Contábil. O backup continua sem configuração confirmada.

## Objetivo

Hospedar o backend e o banco do MVP em uma única máquina virtual do Google Cloud para um grupo interno controlado. A extensão continua instalada nos navegadores dos participantes e envia eventos à API por HTTPS.

O plano original foi escrito para contas e conteúdo sintéticos. O backend usa PostgreSQL no modo `lab` e mantém retenção configurável de 90 dias por padrão. [O README do backend](../../backend/README.md) descreve a migração e os limites operacionais.

## Arquitetura proposta

```mermaid
flowchart LR
  C[Chrome do grupo de teste<br/>Extensão instalada] -->|HTTPS pela VPN ou rede autorizada| P[Proxy TLS na VM]
  P -->|127.0.0.1:8000| A[FastAPI e Uvicorn<br/>um worker]
  A --> D[(PostgreSQL gerenciado — serviço pendente de escolha)]
  S[Secret Manager] -. segredo do laboratório .-> A
  A --> L[Cloud Logging<br/>sem payloads]
  D -. backup controlado .-> B[Cloud Storage]
```

O modo `lab` requer um PostgreSQL acessível pelo backend. O provedor, a região e a topologia ainda aguardam decisão operacional; não configure um arquivo SQLite em Persistent Disk como banco de produção.

## Componentes

| Componente | Proposta | Limite do MVP |
|---|---|---|
| Projeto GCP | Projeto dedicado ao laboratório, separado de projetos corporativos e de produção. | Um ambiente `lab`; sem ambientes redundantes. |
| Região | Preferir `southamerica-east1` (Osasco, São Paulo) se a equipe, a política interna e a conta permitirem. | Região e localização dos dados precisam de aceite da empresa. [Regiões do Compute Engine](https://docs.cloud.google.com/compute/docs/regions-zones). |
| Compute Engine | VM Linux LTS com tamanho definido após estimar participantes e volume. | Uma VM não preemptiva; sem autoscaling ou alta disponibilidade. |
| Banco | Serviço PostgreSQL gerenciado ou PostgreSQL administrado pela TI. | Provedor, região, acesso privado, custo, backup e restauração dependem de decisão operacional. |
| Backend | Python 3.11+, FastAPI e Uvicorn, executados por `systemd`. | Um worker. A aplicação escuta apenas em `127.0.0.1:8000`. |
| Proxy HTTPS | Caddy ou Nginx termina TLS e encaminha para a API local. | O acesso à API fica restrito à VPN ou à faixa de rede aprovada. |
| Segredos | Secret Manager fornece ao backend o segredo do cliente OAuth por uma conta de serviço com acesso mínimo. | Nenhum segredo OAuth entra na extensão; os tokens compartilhados servem apenas ao modo local. |
| Logs | Cloud Logging recebe logs técnicos sem corpo de requisição, prompts, respostas, cookies ou tokens. | Não enviar payloads ao sistema de logs. |
| Backup | Use mecanismo consistente com o PostgreSQL escolhido. | Retenção e eliminação das cópias precisam de decisão humana antes do uso. |
| Extensão | Pacote instalado nos navegadores do grupo por procedimento controlado. | Não hospedar código executável da extensão no backend. |

O Compute Engine mantém discos persistentes separados da VM. Isso permite manter o disco de dados ao recriar a máquina, desde que a política de exclusão do disco esteja configurada corretamente. [Discos persistentes no Compute Engine](https://docs.cloud.google.com/compute/docs/disks/persistent-disks).

## Acesso e segurança

1. Crie o projeto GCP do laboratório e dê acesso administrativo somente às pessoas responsáveis pela implantação.
2. Restrinja a porta HTTPS aos usuários conectados à VPN corporativa ou a uma rede de saída aprovada. Não exponha a porta `8000` nem o banco à internet.
3. Restrinja SSH ao caminho administrativo aprovado pela equipe de infraestrutura. Não use regras de firewall abertas a `0.0.0.0/0` para administração.
4. Reserve um nome DNS para a API e configure um certificado TLS válido para esse nome. Mantenha Uvicorn ligado ao loopback da VM.
5. Dê à conta de serviço da VM somente permissão para ler o segredo do laboratório e gravar backups, se a rotina de backup precisar dessa permissão.
6. Mantenha o segredo OAuth fora do pacote da extensão, do repositório, dos logs e das imagens de máquina.
7. Use login individual Google Workspace. Configure `GOOGLE_CONTENT_VIEWER_SUBS` com os `sub` autorizados da liderança e da chefia de IA. Restrinja o acesso ao host para que somente o responsável execute exclusões. Use `PILOT_DEPARTMENT_CODE` com o escopo interno aprovado.

No modo `lab`, a API valida o ID token Google e vincula o `sub` à chave da instalação. A assinatura comprova a chave do perfil do navegador, não a posse física do computador. O operador autorizado consulta somente os registros do setor piloto. O login deve usar conta individual; `contabil@...`, por ser compartilhada, não permite atribuir ações a uma pessoa. O endpoint HTTPS, o cliente OAuth e a lista aprovada de participantes ainda dependem da TI e do responsável pelo piloto.

Para este piloto, configure `PILOT_DEPARTMENT_CODE=FgXMby6awkvcKxQjk04Yr4sAz2mSdMTZ`, código do Contábil na linha 8 da [planilha corporativa de departamentos](https://docs.google.com/spreadsheets/d/1i06KE4iG0AYKDll_vZETnJNwHp5fPrrfCX4eTAalQsk/edit). Não importe a lista de funcionários para o repositório.

## Ajustes necessários na aplicação

1. Substitua a URL fixa `http://127.0.0.1:8000` da extensão por uma configuração de ambiente HTTPS para o endereço aprovado da API.
2. Atualize `host_permissions` no manifesto da extensão para autorizar esse domínio HTTPS. Preserve a configuração local usada no desenvolvimento.
3. Configure `DATABASE_URL` como segredo do PostgreSQL escolhido; mantenha credenciais fora do repositório e dos logs.
4. Configure `APP_ENV=lab`, cliente e segredo OAuth, URI de redirecionamento, `GOOGLE_CONTENT_VIEWER_SUBS`, `PILOT_DEPARTMENT_CODE`, limites de payload e `RETENTION_DAYS=90` por mecanismo protegido no host. Os tokens compartilhados ficam restritos ao desenvolvimento local.
5. Mantenha CORS vazio enquanto a extensão chamar a API pelo service worker, conforme o README atual. Confirme as permissões de host da extensão no teste de integração.
6. Mantenha a API em um único worker. Não aumente réplicas antes de migrar o banco para um servidor cliente-servidor.
7. Confirme o `sub` da conta individual do operador e os vínculos dos participantes com o cadastro oficial antes de atribuir instalações. Revogue instalações quando o vínculo deixar de valer.

Os pontos atuais da URL e das permissões estão em [`service-worker.js`](../../extension/src/background/service-worker.js) e [`manifest.json`](../../extension/manifest.json). O caminho do banco e as configurações ficam em [`settings.py`](../../backend/app/settings.py).

## Etapas de implantação

1. **Feche as decisões de acesso e custo.** Confirme o projeto e a conta de faturamento, a região, o grupo de teste, a VPN ou rede permitida e o orçamento mensal aprovado.
2. **Prepare a extensão.** Defina um ID estável, registre o redirecionamento OAuth correspondente, configure a URL HTTPS e a permissão exata do host da API. Gere o pacote de laboratório e defina como a equipe distribuirá a extensão aos participantes.
3. **Crie os recursos GCP.** Crie a VM, a conta de serviço, as regras de firewall e o Persistent Disk. Configure alertas de orçamento antes de iniciar a VM.
4. **Configure o host.** Instale as dependências fixadas, crie o usuário sem privilégios, monte o disco de dados e configure `systemd` e o proxy TLS.
5. **Configure a API.** Carregue os segredos, registre os redirects OAuth, defina o `sub` do operador e o setor piloto; aplique o esquema PostgreSQL e inicie um único worker ligado a `127.0.0.1:8000`.
6. **Configure backup e restauração.** Use o método consistente com o serviço PostgreSQL escolhido. Restaure uma cópia em ambiente temporário e confirme consultas com registros sintéticos.
7. **Execute o piloto.** Cadastre e atribua instalações a contas individuais. Teste login, captura, autorização dos viewers, exclusão, token vencido, troca de conta, revogação, retenção, indisponibilidade e reinício da VM com dados sintéticos.
8. **Encerre o laboratório.** Revogue o token, pare a VM e elimine o banco, o disco e as cópias de backup conforme a decisão aprovada de retenção.

## Critérios para iniciar o piloto

- O grupo acessa a API somente pela rede aprovada e recebe resposta HTTPS válida.
- O backend aceita a extensão de laboratório e persiste eventos sintéticos após reinício do processo e da VM.
- O banco não fica acessível pela rede.
- Só o `sub` aprovado do operador consulta registros do Contábil; uma conta participante, externa ou compartilhada não recebe acesso de operador.
- A API aceita captura somente com sessão Google válida, vínculo individual aprovado e assinatura da instalação; a revogação é recusada no servidor e a extensão se desativa ao receber a recusa.
- Prompts, respostas, tokens e cookies não aparecem nos logs.
- Um backup sintético foi restaurado com sucesso.
- A retenção aprovada foi aplicada ao banco e às cópias de backup.
- O custo estimado, o orçamento e os responsáveis operacionais foram aprovados.
- O responsável pelo experimento confirmou o escopo de dados e os participantes.

## Custos e oferta gratuita

Não trate o nível gratuito como premissa do MVP. A oferta do Compute Engine inclui uma VM `e2-micro` somente em três regiões dos EUA, além de limites mensais de disco e saída de dados. A região de São Paulo não está nessa lista. Novos clientes elegíveis podem receber US$ 300 por 90 dias. Confirme a elegibilidade da conta da empresa. Durante o teste, o Google não cobra o uso. Sem upgrade ao fim do período, os recursos param e podem ser excluídos após o prazo de recuperação. Após o upgrade, o uso acima dos créditos e dos limites gratuitos pode gerar cobrança. [Limites e condições do Google Cloud Free Program](https://docs.cloud.google.com/free/docs/free-cloud-features).

Crie alertas de orçamento no projeto do laboratório. Alertas comuns notificam, mas não bloqueiam gastos automaticamente. [Orçamentos do Cloud Billing](https://docs.cloud.google.com/billing/docs/how-to/budgets).

## Persistência PostgreSQL

O backend agora usa PostgreSQL no modo `lab` e preserva SQLite para desenvolvimento local. A criação do esquema é explícita (`python -m app.migrate_database`); a API valida a versão antes de iniciar. Para importar um SQLite existente, pare a API, crie um snapshot consistente e siga a prévia e a importação transacional no [README do backend](../../backend/README.md). Mantenha um worker e não habilite réplicas até validar a concorrência, restauração, retenção e exclusões com o PostgreSQL escolhido.

A escolha de provedor, região, custo, backup gerenciado e rollout continua pendente. Não use o desenho de SQLite deste plano como arquitetura do ambiente `lab`; atualize o desenho de implantação depois da decisão operacional.

Cloud Run não é a escolha inicial para o código atual. Seu filesystem gravável é temporário, e o serviço é indicado para aplicações que não exigem filesystem local persistente e que aceitam várias instâncias. [Contrato de execução do Cloud Run](https://docs.cloud.google.com/run/docs/container-contract) e [critérios de adequação](https://docs.cloud.google.com/run/docs/fit-for-run).

## Decisões pendentes

- `POLICY_QUESTION`: quem aprova e confere os vínculos entre `sub`, funcionário e departamento no cadastro oficial? Não atribua a conta compartilhada `contabil@...` a uma pessoa.
- `POLICY_QUESTION`: o operador terá acesso ao texto bruto de prompts e respostas do Contábil, ou apenas a metadados? O endpoint de detalhe expõe texto bruto quando autorizado.
- A TI precisa fornecer o cliente OAuth, segredo, URI de redirecionamento para o ID estável da extensão e o endereço HTTPS da API. O operador precisa obter seu `sub` pelo login individual.
- Definir e testar o cliente usado pelo operador para consultar a API com seu ID token; ainda não há interface administrativa dedicada.
- O prazo definido agora é 90 dias para backups e recuperação. A configuração do backup e a verificação do ciclo de vida continuam pendentes antes de qualquer uso de dados reais.
- Qual projeto e conta de faturamento da empresa serão usados?
- A região será São Paulo? A equipe de segurança ou governança tem requisito de localização de dados?
- A empresa já oferece VPN para os participantes? Se não, qual mecanismo privado será aprovado para alcançar a API?
- Quantas pessoas participarão e qual orçamento mensal máximo foi aprovado?
- Quem será responsável por administração, backups, restauração, expurgo e encerramento do laboratório?

Este plano não altera políticas. A política atual da POC limita os testes a contas e conteúdo de laboratório; o uso de dados reais exige decisão explícita dos responsáveis.
