# Analytics do MVP

Este diretório define o analytics administrativo da ferramenta. O frontend ficará aqui quando seu desenho for aprovado. Nesta etapa, o backend fornece somente a API protegida.

## Uso previsto

O operador consulta um resumo sem expor o texto de prompts ou respostas:

```http
GET /v1/admin/analytics/summary?from=2026-10-01T00:00:00Z&to=2026-11-01T00:00:00Z
Authorization: Bearer <credencial-do-operador>
```

O endpoint retorna totais de interações, respostas, streams e metadados de arquivos. Também retorna agrupamentos por colaborador e departamento. No ambiente `lab`, o backend limita o resultado ao departamento autorizado pela autenticação do operador.

`example-roster.csv` contém somente dados sintéticos e mostra o formato normalizado aceito pelo importador. O importador também reconhece a planilha corporativa que combina, na mesma linha, as colunas `Departamentos, Código` e `Funcionário, Código, Departamento`.

## Estrutura

- `backend/app/analytics.py` contém a rota e as consultas.
- `backend/app/security.py` aplica a autenticação de operador existente.
- `backend/app/db.py` mantém o SQLite usado pela captura.
- Este diretório receberá o frontend em uma etapa posterior.

## Etapas de implementação

1. Registrar o contrato do endpoint e manter o frontend fora do escopo.
2. Criar o cadastro de departamentos e colaboradores no SQLite.
3. Importar um CSV validado sem apagar cadastros ausentes.
4. Resolver nome e departamento pelo código do colaborador durante a atribuição.
5. Criar um endpoint de resumo protegido pela credencial de operador.
6. Verificar autenticação, filtros, agrupamentos e ausência de texto bruto na resposta.
7. Atualizar a documentação de operação e o grafo do repositório.

## Decisão de arquitetura

Foram consideradas duas formas de implantação.

1. Um serviço de analytics com banco próprio separaria a carga, mas criaria outra implantação, sincronização de dados e possível custo.
2. Um módulo no backend atual consulta o SQLite com os mesmos limites de acesso e retenção usados pela captura.

A primeira versão usa a segunda opção. Ela adiciona um endpoint e nenhuma dependência. Se o volume superar a capacidade da VM ou do SQLite, uma etapa futura poderá criar um serviço separado usando o mesmo contrato HTTP.

## Limites desta etapa

- Não há frontend.
- Não há exportação de relatórios.
- Não há consulta ao texto de prompts ou respostas.
- Os números cobrem apenas os dados ainda presentes após a retenção configurada.
- A conta Google compartilhada não prova qual pessoa usou a máquina. A atribuição vem da instalação cadastrada.
