# Backend da POC de Governança de IA

API de laboratório para registrar prompts e respostas fictícios observados pela extensão Chrome. A implementação é uma trilha experimental; não representa backup completo nem comprova autoria ou captura integral.

## Requisitos

- Python 3.11 ou superior.
- Conteúdo e conta/projeto exclusivamente de laboratório.
- Um token aleatório próprio para cada ambiente. Não use senhas pessoais ou tokens do ChatGPT.

## Execução local no Windows PowerShell

```powershell
cd backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Para desenvolvimento local, edite `.env` e configure `CAPTURE_API_TOKEN` e `OPERATOR_READ_TOKEN` como segredos diferentes, ambos com pelo menos 24 caracteres. O antigo `LAB_API_TOKEN` é aceito apenas como credencial de captura no modo local. O modo local usa SQLite. O ambiente `lab` exige PostgreSQL em `DATABASE_URL` e a configuração Google Workspace descrita abaixo. O arquivo `.env` e o banco ficam fora do controle de versão. Inicie a API:

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

O banco SQLite local é criado em `backend/data/lab.sqlite3`. Em `lab`, configure `DATABASE_URL` como segredo e aplique o esquema antes de iniciar a API:

```powershell
python -m app.migrate_database
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

`/health` é público. No modo local, capturas exigem token de captura e assinatura da instalação; consultas exigem token de operador. No modo `lab`, todas as rotas protegidas exigem token de identidade Google. A documentação interativa não é publicada. Para encerrar, use `Ctrl+C`.

### Migrar um SQLite existente

Pare a API e faça um snapshot consistente do SQLite já inicializado na versão 1.0. A importação é somente leitura na origem e aceita apenas um snapshot com as tabelas esperadas. Configure `DATABASE_URL` para o PostgreSQL de destino e aplique o esquema. Rode primeiro a prévia; para gravar, confirme o host e nome do banco exibidos pela prévia:

```powershell
python -m app.migrate_database
python -m app.import_sqlite --source C:\caminho\snapshot.sqlite3
python -m app.import_sqlite --source C:\caminho\snapshot.sqlite3 --apply --confirm-target host/banco
```

A importação grava em uma transação, aceita somente conflitos idênticos, confere contagens e aplica a retenção configurada antes do commit. Preserve o SQLite original até validar o destino. A importação deve ocorrer em janela de manutenção, com a API parada para evitar divergência após o snapshot.

## Testes automatizados

Instale as dependências de desenvolvimento e execute os testes com dados sintéticos e bancos temporários:

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest -q tests
```

## Pacote do painel para o laboratório

No diretório raiz do repositório, execute `python backend/build_analytics_package.py`. O script gera `reports/analytics-backend-lab.zip` com `backend/app/`, `backend/requirements.txt`, `backend/.env.example` e `analytics/index.html`. Ele valida os arquivos e o conteúdo do ZIP antes de substituir o artefato.

O pacote não inclui `.env`, banco de dados, testes, caches ou arquivos temporários. Confira o SHA-256 e obtenha aprovação operacional antes de transferir o ZIP ao Google Cloud.

## Rotas

| Método e rota | Acesso | Função |
|---|---|---|
| `GET /health` | Público | Estado da API e versão do esquema. |
| `GET /analytics/` | Público | Entrega a página estática do painel, que consulta dados somente após autenticação. |
| `POST /v1/interactions` | Captura + assinatura | Registra uma solicitação; `client_event_id` é idempotente. |
| `POST /v1/machines` | Credencial de captura | Cadastra a instalação e sua chave pública; no modo `lab`, vincula o `sub` Google. |
| `GET /v1/machines/{installation_id}` | Assinatura da instalação; também login Google no modo `lab` | Consulta somente a atribuição da própria instalação. |
| `POST /v1/machines/{installation_id}/assignment-request` | Assinatura da instalação | Registra um pedido pendente para um colaborador ativo; não atribui a máquina. |
| `GET /v1/admin/machines/assignment-requests` | Sessão do operador ou token local | Lista pedidos dentro do escopo autorizado. |
| `POST /v1/admin/machines/{installation_id}/assignment-request/approve` | Sessão do operador ou token local | Aprova um pedido pendente após revalidar cadastro, departamento e instalação. |
| `POST /v1/admin/machines/{installation_id}/assignment-request/reject` | Sessão do operador ou token local | Recusa e remove o pedido pendente. |
| `POST /v1/auth/google-code` | Código OAuth, PKCE e nonce | Troca o código da extensão e devolve token de identidade verificado. Disponível apenas em `lab`. |
| `GET /v1/auth/dashboard/start` | Público | Inicia OAuth do painel com `state`, `nonce` e PKCE. Exige callback, operador e setor piloto configurados. |
| `GET /v1/auth/dashboard/callback` | Retorno OAuth Google | Valida o callback e cria uma sessão do operador em cookie HttpOnly, Secure e SameSite=Lax. |
| `GET /v1/auth/dashboard/session` | Cookie de sessão | Retorna somente estado, e-mail e expiração. Nunca retorna o token Google. |
| `POST /v1/auth/dashboard/logout` | Navegador | Apaga o cookie de sessão do painel. |
| `POST /v1/interactions/{interaction_id}/response` | Captura + assinatura | Registra snapshot observado como `complete` ou `incomplete`. |
| `GET /v1/interactions/{interaction_id}` | Viewer Google autorizado | Consulta o registro, respostas e eventos técnicos; a leitura é auditada. |
| `GET /v1/admin/analytics/summary` | Sessão do painel ou token de operador | Retorna totais e agrupamentos sem o texto de prompts ou respostas. |
| `GET /v1/admin/analytics/interactions` | Viewer Google autorizado | Pesquisa por colaborador/departamento e retorna prompt/resposta; cada leitura é auditada sem gravar conteúdo no log. |

Envie JSON conforme os exemplos do documento principal `POC_EXTENSAO_BACKEND_GOVERNANCA_IA_v0.1.md`. Campos extras são rejeitados. `observed_at` precisa incluir fuso horário. Repetição do mesmo evento com conteúdo diferente resulta em `409`; a repetição idêntica devolve o mesmo ID e `duplicate: true`. O limite de prompt, resposta e anexos é configurável no `.env`.

## Autenticação e rede

No modo `lab`, configure `APP_ENV=lab`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_EXTENSION_REDIRECT_URI` (URI HTTPS exata da extensão), `GOOGLE_ANALYTICS_REDIRECT_URI` (URI HTTPS exata de `/v1/auth/dashboard/callback`) e `GOOGLE_WORKSPACE_DOMAIN`. O segredo OAuth fica somente no servidor. A extensão mantém seu fluxo com PKCE. O painel inicia seu próprio fluxo com `state`, `nonce` e PKCE. A API troca o código com o Google e valida assinatura, público, emissor, validade, domínio e nonce do token. O cookie do painel é `HttpOnly`, `Secure`, `SameSite=Lax`. O `sub` autorizado para leitura do painel e do conteúdo deve estar em `GOOGLE_CONTENT_VIEWER_SUBS`, uma lista separada por vírgula que contém somente liderança e chefia de IA. O código do setor vai em `PILOT_DEPARTMENT_CODE`; `*` libera todos os departamentos ativos para esses viewers. Sem a lista nova, o acesso em `lab` fica bloqueado; `GOOGLE_OPERATOR_SUB` não é aceito como fallback. Não use e-mail como identificador estável. Tokens compartilhados não abrem rotas de leitura em `lab`.

No ambiente de teste, use interface privada atrás de TLS e firewall interno e permita apenas os clientes autorizados. Não publique a porta diretamente na internet. Configure `ALLOWED_ORIGINS` somente se chamadas cross-origin da extensão forem necessárias; se a extensão usar service worker para chamar a API, mantenha CORS vazio.

O endereço de origem salvo é o observado diretamente pelo servidor. Cabeçalhos de proxy não são interpretados. Logs operacionais não registram corpos de requisição. A API não guarda anexos binários.

## Vínculo da instalação ao projeto

Com `MACHINE_SIGNATURE_REQUIRED=true` (padrão), a API aceita capturas somente com assinatura ECDSA P-256 de uma instalação cadastrada e atribuída a nome, ID estável e departamento. O cabeçalho assina método, caminho, timestamp, nonce e SHA-256 do corpo. O backend rejeita assinatura inválida, repetição de nonce e atribuição incompleta. Cada evento guarda uma cópia dos identificadores vigentes no momento da captura. Registros antigos permanecem sem ID/departamento. O campo `usage_context` permanece `unknown` quando não há sinal confiável; a classificação Work ou Chat está fora do MVP atual.

Antes da primeira atribuição, valide o cadastro com `python import_roster.py <arquivo.csv>`. Use `--apply` somente depois de revisar o resumo. O importador aceita os cabeçalhos documentados em `docs/guide/GUIA_IMPLANTACAO_MVP.md`, não remove colaboradores ausentes e pode ser executado novamente.

Depois que a extensão cadastrar a chave pública, a pessoa pode informar seu código de colaborador no popup para registrar um pedido pendente. O pedido não atribui nem habilita a captura. O operador revisa o código e o fingerprint em `/analytics` e pode aprovar ou recusar o pedido. O comando `python assign_machine.py <installation_id> --approve-request --fingerprint-prefix <16-caracteres>` continua disponível como alternativa no terminal; para atribuição manual, use `--employee-id <ID>`. O backend busca nome e departamento no cadastro e valida novamente que o colaborador está ativo. Em `lab`, a instalação deve ter um `sub` Google vinculado no cadastro e seu departamento precisa estar autorizado por `PILOT_DEPARTMENT_CODE`. Uma instalação antiga sem `sub` não é liberada automaticamente. O vínculo é armazenado no SQLite; a chave privada permanece no perfil do Chrome e esta POC não comprova posse física do computador. Uma conta Google compartilhada identifica a conta, não cada pessoa que a usou.

Para revogar uma instalação, execute `python revoke_machine.py <installation_id> --fingerprint-prefix <16-caracteres>` no host do backend. A revogação bloqueia novas capturas e a consulta da atribuição; registros já guardados permanecem sujeitos à retenção. Para revogar leitores, remova seus `sub` de `GOOGLE_CONTENT_VIEWER_SUBS`. Restrinja o acesso ao host para que somente o responsável, com conta individual, execute exclusões.

## Retenção e encerramento

Registros de uso e eventos de auditoria com mais de `RETENTION_DAYS` (90 dias por padrão) são removidos na inicialização e em rotina diária. Respostas e eventos associados são removidos por chave estrangeira. Solicitações de exclusão devem ser recebidas pelo canal de privacidade; o responsável executa no host do backend `python -m app.delete_employee_data --employee-id CB-1234 --confirm-employee-id CB-1234`. O comando exige repetir o ID para confirmar e registra o usuário do sistema operacional e as quantidades removidas. A exclusão remove interações e cascatas, capturas de stream, metadados de arquivos e instalações atribuídas ou com pedido pendente para o colaborador. O cadastro corporativo de colaboradores permanece. No modo local, o token compartilhado é apenas para dados sintéticos e não identifica operador.

Esse prazo não configura backups, retenção de logs dos provedores ou expurgo das cópias. O serviço PostgreSQL escolhido precisa configurar backups, ciclo de vida de 90 dias, controles de acesso e um procedimento de restauração que reaplique exclusões posteriores ao snapshot.

## Estado da implementação

O backend mantém SQLite no modo local e PostgreSQL no modo `lab`. Mantenha um único worker até validar concorrência e recuperação com a infraestrutura escolhida; provedor, região, backups e rollout continuam sujeitos às decisões do plano de infraestrutura.
