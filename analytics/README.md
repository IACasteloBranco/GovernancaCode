# Analytics do MVP

Este diretório contém o painel administrativo de analytics. A página estática `index.html` é servida pelo backend em `/analytics/`. A Fase 3 aplicou à página as cores, as divisórias e os títulos numerados da referência visual.

## Uso previsto

O operador consulta um resumo sem expor o texto de prompts ou respostas:

```http
GET /v1/admin/analytics/summary?from=2026-10-01T00:00:00Z&to=2026-11-01T00:00:00Z
```

Na página, o navegador envia automaticamente o cookie HttpOnly da sessão autorizada. Chamadas diretas também podem usar a credencial de operador conforme o modo configurado.

O endpoint retorna totais de interações, respostas, streams e metadados de arquivos. Também retorna agrupamentos por colaborador e departamento. No ambiente `lab`, o backend limita o resultado ao departamento autorizado pela autenticação do operador.

`GET /v1/admin/analytics/interactions` pesquisa registros e retorna o prompt e a última resposta. Esse acesso, assim como `GET /v1/interactions/{interaction_id}`, exige uma identidade Google listada em `GOOGLE_CONTENT_VIEWER_SUBS`. O backend registra operador, horário, rota e quantidade retornada por 90 dias, sem copiar prompt, resposta, ID de conversa ou filtro de colaborador para a auditoria. Tentativas com uma identidade Google válida não autorizada também são registradas para essas rotas.

`example-roster.csv` contém somente dados sintéticos e mostra o formato normalizado aceito pelo importador. O importador também reconhece a planilha corporativa que combina, na mesma linha, as colunas `Departamentos, Código` e `Funcionário, Código, Departamento`.

## Estrutura

- `backend/app/analytics.py` contém a rota e as consultas.
- `backend/app/security.py` aplica a autenticação de operador existente.
- `backend/app/db.py` mantém o SQLite usado pela captura.
- `backend/app/main.py` implementa o login OAuth do painel e a sessão em cookie.
- `analytics/index.html` contém o painel estático servido pelo backend.

## Estado do painel

- A sessão usa os endpoints `/v1/auth/dashboard/*`; o painel atual consulta o resumo, e a API também dispõe de pesquisa de conteúdo integral sob autorização mais restrita.
- A página mostra totais, agrupamentos por departamento e colaborador, filtro de datas, estados de sessão, carregamento, lista vazia e falhas.
- Os dados continuam protegidos por sessão e limitados pelo departamento autorizado no modo `lab`.
- O modo local não habilita OAuth do painel. O login requer configuração e callback HTTPS no modo `lab`.
- A interface usa azul-marinho, detalhes dourados, um bloco de título arredondado e seções numeradas. O leiaute se adapta a telas estreitas e mantém os estados acessíveis por teclado.

## Decisão de arquitetura

Foram consideradas duas formas de implantação.

1. Um serviço de analytics com banco próprio separaria a carga, mas criaria outra implantação, sincronização de dados e possível custo.
2. Um módulo no backend atual consulta o SQLite com os mesmos limites de acesso e retenção usados pela captura.

A primeira versão usa a segunda opção. Ela adiciona um endpoint e nenhuma dependência. Se o volume superar a capacidade da VM ou do SQLite, uma etapa futura poderá criar um serviço separado usando o mesmo contrato HTTP.

## Limites atuais

- Não há exportação de relatórios.
- A interface atual do painel não mostra prompts ou respostas; a API dispõe de uma rota separada de pesquisa integral, protegida e auditada.
- Os números cobrem apenas os dados ainda presentes após a retenção configurada.
- A conta Google compartilhada não prova qual pessoa usou a máquina. A atribuição vem da instalação cadastrada.
