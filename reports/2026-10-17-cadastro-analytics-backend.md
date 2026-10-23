# Cadastro e analytics do backend

## Escopo

Esta mudança prepara o cadastro de colaboradores e o analytics administrativo. O frontend ficou fora do escopo por decisão do responsável pelo projeto.

## Implementação

- O esquema `0.8` adiciona `departments` e `employees` ao SQLite.
- `import_roster.py` valida CSV com dados sintéticos ou oficiais e só grava com `--apply`.
- A importação atualiza registros existentes e não remove colaboradores ausentes.
- `assign_machine.py` recebe o código do colaborador e busca nome e departamento no cadastro.
- `GET /v1/admin/analytics/summary` retorna totais e agrupamentos por colaborador e departamento.
- O endpoint usa a autenticação de operador existente e aplica o escopo departamental no modo `lab`.
- A resposta do analytics não inclui texto de prompts ou respostas.

## Verificações

| Caso | Resultado | Evidência |
|---|---|---|
| Suíte do backend antes da mudança | `PASS` | 23 testes passaram. |
| Importação repetida do mesmo cadastro | `PASS` | O teste manteve uma linha por colaborador e departamento. |
| Colaborador ausente em importação posterior | `PASS` | O registro anterior permaneceu no banco. |
| Colaborador duplicado no CSV | `PASS` | O parser rejeitou o arquivo antes da gravação. |
| Layout corporativo combinado | `PASS` | Teste sintético validou os blocos de departamentos e colaboradores na mesma planilha. |
| Atribuição por código e fingerprint | `PASS` | O teste resolveu nome e departamento pelo cadastro. |
| Analytics protegido por operador | `PASS` | A credencial de captura recebeu `401`. |
| Analytics limitado ao departamento piloto | `PASS` | Um registro de outro departamento não entrou no total. |
| Ausência de conteúdo bruto no analytics | `PASS` | A resposta não continha o prompt ou a resposta sintética. |
| Suíte do backend depois da mudança | `PASS` | 27 testes passaram. |
| Validação do exemplo pela CLI | `PASS` | Um colaborador e um departamento foram validados sem gravação. |
| Estrutura do CSV oficial | `PASS` | Leitura local contou 21 departamentos e 65 colaboradores com códigos válidos, sem gravar ou exibir registros. |
| Atualização do Graphify | `PASS` | O grafo foi reconstruído com 1.160 nós e 1.937 arestas. |

Comando principal de verificação:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest tests -q -p no:cacheprovider
```

## Limitações

- O frontend administrativo ainda não existe.
- O CSV oficial foi inspecionado somente quanto à estrutura e aos totais; nomes e códigos não foram exibidos nem importados.
- A implantação na VM não foi executada nesta mudança.
- O Graphify não conseguiu percorrer diretórios temporários antigos com permissão negada. Os arquivos de código alterados entraram na extração.
- O pytest emite um aviso de depreciação da integração `httpx` do `TestClient`. O aviso não causa falha.
- A conta Google compartilhada identifica a conta. A instalação atribuída fornece a separação por colaborador.
