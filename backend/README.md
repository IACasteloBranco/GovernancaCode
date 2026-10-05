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

Edite `.env` e substitua `LAB_API_TOKEN` por um segredo aleatório com pelo menos 24 caracteres. O arquivo `.env` e o banco ficam fora do controle de versão. Inicie a API:

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

O banco é criado em `backend/data/lab.sqlite3`. `/health` é público; envios e consultas exigem `Authorization: Bearer <LAB_API_TOKEN>`. A documentação interativa não é publicada. Para encerrar, use `Ctrl+C`.

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
| `POST /v1/interactions` | Token | Registra uma solicitação; `client_event_id` é idempotente. |
| `POST /v1/machines` | Token | Cadastra o código da instalação e sua chave pública; não atribui pessoa. |
| `GET /v1/machines/{installation_id}` | Token | Consulta o vínculo administrativo da instalação. |
| `POST /v1/interactions/{interaction_id}/response` | Token | Registra snapshot observado como `complete` ou `incomplete`. |
| `GET /v1/interactions/{interaction_id}` | Token | Consulta o registro, respostas e eventos técnicos. |

Envie JSON conforme os exemplos do documento principal `POC_EXTENSAO_BACKEND_GOVERNANCA_IA_v0.1.md`. Campos extras são rejeitados. `observed_at` precisa incluir fuso horário. Repetição do mesmo evento com conteúdo diferente resulta em `409`; a repetição idêntica devolve o mesmo ID e `duplicate: true`. O limite de prompt, resposta e anexos é configurável no `.env`.

## Autenticação e rede

O token é obrigatório na inicialização. Em desenvolvimento, a aplicação escuta apenas em `127.0.0.1`. Para uma VM de laboratório, configure `APP_ENV=lab`, use interface privada atrás de TLS e firewall interno e permita apenas os clientes de teste. Não publique a porta diretamente na internet. Configure `ALLOWED_ORIGINS` somente se chamadas cross-origin da extensão forem necessárias; se a extensão usar service worker para chamar a API, mantenha CORS vazio.

O endereço de origem salvo é o observado diretamente pelo servidor. Cabeçalhos de proxy não são interpretados. Logs operacionais não registram corpos de requisição. A API não guarda anexos binários.

## Vínculo da instalação ao projeto

Com `MACHINE_SIGNATURE_REQUIRED=true` (padrão), a API aceita prompt e resposta somente com assinatura ECDSA P-256 de uma instalação cadastrada e atribuída a uma pessoa. O cabeçalho assina método, caminho, timestamp, nonce e SHA-256 do corpo. O backend rejeita assinatura inválida, repetição de nonce e instalação sem pessoa atribuída. O projeto observado é registrado quando disponível, sem restringir a captura. O token de laboratório ainda autentica a conexão, mas não determina a pessoa.

Depois que a extensão cadastrar a chave pública, o operador executa `python assign_machine.py <installation_id> "NOME" --fingerprint-prefix <16-caracteres>` na pasta `backend`. O prefixo é exibido no popup e deve conferir antes da atribuição. O vínculo é armazenado no SQLite; a extensão não pode atribuir a pessoa por esse endpoint. O nome é copiado para cada interação aceita; o ID do projeto vem da URL observada, quando houver. A chave privada permanece no perfil do Chrome e esta POC não comprova posse física do computador.

## Retenção e encerramento

Registros com mais de `RETENTION_DAYS` (sete dias por padrão) são removidos na inicialização e em rotina diária. Respostas e eventos associados são removidos por chave estrangeira. Ao concluir o experimento, pare o processo, revogue o token e remova o banco e seus arquivos auxiliares de `data/`, após confirmar que as evidências necessárias são sintéticas e foram guardadas separadamente.

## Estado da implementação

Esta é a primeira versão executável do backend. O processo mantém um único worker e usa SQLite local. A suíte automatizada cobre os contratos e persistência básica; integração com a extensão, implantação em VM e roteiro operacional ainda precisam ser exercitados no ambiente de laboratório antes de declarar a POC aceita.
