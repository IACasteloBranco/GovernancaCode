# Implantar o MVP de captura e analytics

Este guia descreve a ordem de implantação. Use dados sintéticos até concluir a validação do laboratório.

## 1. Preparar o backend

1. Crie o ambiente virtual e instale `backend/requirements.txt`.
2. Crie `backend/.env` a partir de `backend/.env.example`.
3. Configure o OAuth, o departamento piloto, o operador e o caminho do SQLite.
4. Inicie a API e consulte `GET /health`.

Resultado esperado: a API retorna `status=ok` e a versão atual do esquema.

## 2. Validar e importar o cadastro

Prepare um CSV UTF-8 com estas colunas:

```csv
employee_id,person_name,department_code,department_name,active
COLAB-001,Pessoa Sintética,DEP-001,Departamento Sintético,true
```

Também é aceito o layout corporativo existente, com os blocos `Departamentos, Código` e `Funcionário, Código, Departamento` na mesma planilha. As colunas adicionais desse arquivo são ignoradas nesta etapa.

Valide o arquivo sem gravar:

```powershell
python import_roster.py caminho\cadastro.csv
```

Se o resumo estiver correto, aplique a importação:

```powershell
python import_roster.py caminho\cadastro.csv --apply
```

Não envie o CSV real ao Git. A importação não remove colaboradores ausentes do arquivo.

## 3. Iniciar a API na VM

1. Pare o processo anterior da API.
2. Faça um backup do arquivo SQLite.
3. Publique o código do backend.
4. Instale as dependências se `requirements.txt` mudou.
5. Inicie a API. O backend aplica as migrações aditivas.
6. Consulte `GET /health`.

Resultado esperado: o banco conserva os registros existentes e inclui o cadastro importado.

## 4. Cadastrar e atribuir uma instalação

1. Instale a extensão no perfil autorizado do Chrome.
2. Entre com a conta Google configurada.
3. Clique em **Atualizar identificação** para cadastrar a chave da instalação.
4. Copie o identificador e os primeiros 16 caracteres do fingerprint.
5. Na VM, execute:

```powershell
python assign_machine.py <installation_id> --employee-id <employee_id> --fingerprint-prefix <16-caracteres>
```

6. Atualize a identificação no popup.

Resultado esperado: o popup mostra o nome, o código e o departamento vindos do cadastro.

## 5. Validar a captura

1. Ative a captura.
2. Envie um prompt sintético.
3. Aguarde uma resposta completa.
4. Confirme os eventos `response_stored` e `sqlite_stored` no diagnóstico local.
5. Consulte o registro com a credencial de operador.

## 6. Validar o analytics

Consulte:

```http
GET /v1/admin/analytics/summary
Authorization: Bearer <credencial-do-operador>
```

Confirme os totais e os agrupamentos por colaborador e departamento. A resposta não contém o texto de prompts ou respostas.

## 7. Liberar o piloto

Antes do uso com dados reais, confirme:

- o acesso HTTPS está ativo;
- a extensão aponta para a URL correta;
- somente o operador acessa as consultas;
- cada instalação está atribuída ao colaborador correto;
- o backup e a restauração do SQLite foram testados;
- a retenção recebeu uma decisão humana registrada.

O Quick Tunnel atende ao laboratório, mas sua URL pode mudar após uma reinicialização. Use um domínio e um túnel nomeado antes da implantação permanente.
