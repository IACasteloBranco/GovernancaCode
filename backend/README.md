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

Para desenvolvimento local, edite `.env` e configure `CAPTURE_API_TOKEN` e `OPERATOR_READ_TOKEN` como segredos diferentes, ambos com pelo menos 24 caracteres. O antigo `LAB_API_TOKEN` é aceito apenas como credencial de captura no modo local. No ambiente `lab`, use a configuração Google Workspace descrita abaixo. O arquivo `.env` e o banco ficam fora do controle de versão. Inicie a API:

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

O banco é criado em `backend/data/lab.sqlite3`. `/health` é público. No modo local, capturas exigem token de captura e assinatura da instalação; consultas exigem token de operador. No modo `lab`, todas as rotas protegidas exigem token de identidade Google. A documentação interativa não é publicada. Para encerrar, use `Ctrl+C`.

## Testes automatizados

Instale as dependências de desenvolvimento e execute os testes com dados sintéticos e bancos temporários:

```powershell
python -m pip install -r requirements-dev.txt
python -m pytest -q tests
```

## Rotas

| Método e rota | Acesso | Função |
|---|---|---|
| `GET /health` | Público | Estado da API e versão do esquema. |
| `POST /v1/interactions` | Captura + assinatura | Registra uma solicitação; `client_event_id` é idempotente. |
| `POST /v1/machines` | Credencial de captura | Cadastra a instalação e sua chave pública; no modo `lab`, vincula o `sub` Google. |
| `GET /v1/machines/{installation_id}` | Assinatura da instalação; também login Google no modo `lab` | Consulta somente a atribuição da própria instalação. |
| `POST /v1/auth/google-code` | Código OAuth, PKCE e nonce | Troca o código no servidor e devolve token de identidade verificado, `sub`, e-mail e expiração. Disponível apenas em `lab`. |
| `POST /v1/interactions/{interaction_id}/response` | Captura + assinatura | Registra snapshot observado como `complete` ou `incomplete`. |
| `GET /v1/interactions/{interaction_id}` | Token de operador | Consulta o registro, respostas e eventos técnicos. |
| `GET /v1/admin/analytics/summary` | Token de operador | Retorna totais e agrupamentos sem o texto de prompts ou respostas. |

Envie JSON conforme os exemplos do documento principal `POC_EXTENSAO_BACKEND_GOVERNANCA_IA_v0.1.md`. Campos extras são rejeitados. `observed_at` precisa incluir fuso horário. Repetição do mesmo evento com conteúdo diferente resulta em `409`; a repetição idêntica devolve o mesmo ID e `duplicate: true`. O limite de prompt, resposta e anexos é configurável no `.env`.

## Autenticação e rede

No modo `lab`, configure `APP_ENV=lab`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_EXTENSION_REDIRECT_URI` (URI HTTPS exata cadastrada no Google) e `GOOGLE_WORKSPACE_DOMAIN`. O segredo OAuth fica somente no servidor. A extensão envia ao backend o código de autorização, o `code_verifier` PKCE, o nonce e a URI de redirecionamento; a API troca o código com o Google e valida assinatura, público, emissor, validade, domínio e nonce do token de identidade. O código do setor piloto vai em `PILOT_DEPARTMENT_CODE`; o `sub` da conta operadora vai em `GOOGLE_OPERATOR_SUB`. Ambos podem ficar vazios durante a configuração inicial, mas captura e consulta ficam bloqueadas até serem definidos. O retorno de `/v1/auth/google-code` mostra o `sub` verificado para essa configuração; não use o e-mail como identificador estável. Tokens compartilhados de captura e leitura não autorizam rotas em `lab`.

No ambiente de teste, use interface privada atrás de TLS e firewall interno e permita apenas os clientes autorizados. Não publique a porta diretamente na internet. Configure `ALLOWED_ORIGINS` somente se chamadas cross-origin da extensão forem necessárias; se a extensão usar service worker para chamar a API, mantenha CORS vazio.

O endereço de origem salvo é o observado diretamente pelo servidor. Cabeçalhos de proxy não são interpretados. Logs operacionais não registram corpos de requisição. A API não guarda anexos binários.

## Vínculo da instalação ao projeto

Com `MACHINE_SIGNATURE_REQUIRED=true` (padrão), a API aceita capturas somente com assinatura ECDSA P-256 de uma instalação cadastrada e atribuída a nome, ID estável e departamento. O cabeçalho assina método, caminho, timestamp, nonce e SHA-256 do corpo. O backend rejeita assinatura inválida, repetição de nonce e atribuição incompleta. Cada evento guarda uma cópia dos identificadores vigentes no momento da captura. Registros antigos permanecem sem ID/departamento. O campo `usage_context` permanece `unknown` quando não há sinal confiável; a classificação Work ou Chat está fora do MVP atual.

Antes da primeira atribuição, valide o cadastro com `python import_roster.py <arquivo.csv>`. Use `--apply` somente depois de revisar o resumo. O importador aceita os cabeçalhos documentados em `docs/GUIA_IMPLANTACAO_MVP.md`, não remove colaboradores ausentes e pode ser executado novamente.

Depois que a extensão cadastrar a chave pública, o operador executa `python assign_machine.py <installation_id> --employee-id <ID> --fingerprint-prefix <16-caracteres>` na pasta `backend`. O backend busca o nome e o departamento no cadastro. O prefixo é exibido no popup e deve conferir antes da atribuição. Em `lab`, a instalação deve ter um `sub` Google vinculado no cadastro e o departamento precisa ser o setor piloto. Uma instalação antiga sem `sub` não é liberada automaticamente. O vínculo é armazenado no SQLite; a extensão não pode atribuir a pessoa. A chave privada permanece no perfil do Chrome e esta POC não comprova posse física do computador. Uma conta Google compartilhada identifica a conta, não cada pessoa que a usou.

Para revogar uma instalação, execute `python revoke_machine.py <installation_id> --fingerprint-prefix <16-caracteres>` no host do backend. A revogação bloqueia novas capturas e a consulta da atribuição; registros já guardados permanecem sujeitos à retenção. Para revogar o operador, remova ou substitua `GOOGLE_OPERATOR_SUB` e reinicie a API.

## Retenção e encerramento

Registros com mais de `RETENTION_DAYS` (30 dias por padrão) são removidos na inicialização e em rotina diária. Respostas e eventos associados são removidos por chave estrangeira. Ao concluir o experimento, pare o processo, revogue as instalações e o operador no modo `lab` (ou os tokens no modo local) e remova o banco e seus arquivos auxiliares de `data/`, após confirmar que as evidências necessárias são sintéticas e foram guardadas separadamente.

## Estado da implementação

Esta é a primeira versão executável do backend. O processo mantém um único worker e usa SQLite local. A suíte automatizada cobre os contratos e persistência básica; integração com a extensão, implantação em VM e roteiro operacional ainda precisam ser exercitados no ambiente de laboratório antes de declarar a POC aceita.
