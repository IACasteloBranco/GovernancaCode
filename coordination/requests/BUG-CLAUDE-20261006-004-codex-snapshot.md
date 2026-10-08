# Direcionamento ao Codex — BUG-CLAUDE-20261006-004 após snapshot

## Evidência disponível

O Work produziu snapshots semânticos sanitizados em:

- `reports/evidence/DOM-ARTIFACT-QA-ARTIFACT-HTML-01-2026-10-06.txt`
- `reports/evidence/DOM-ARTIFACT-QA-MATERIAL-ONLY-01-2026-10-06.txt`

Ambos mostram a mesma estrutura observável:

```text
container [label="visualize: QA-..."]
  iframe [title="Visualize Widget"]
    container [class="vis-container"]
      heading
      table
```

## Direção de implementação

1. Usar somente sinais observados: `iframe[title="Visualize Widget"]`, o contêiner hospedeiro `.vis-container` e o rótulo acessível com prefixo `visualize:` quando disponível.
2. Detectar o Artifact no contêiner da mensagem atual, sem procurar na página inteira e sem associar Artifacts de mensagens antigas.
3. Não tentar ler o conteúdo do iframe remoto. O contrato permite registrar `presence_only` quando o material está visível, mesmo sem metadados internos acessíveis.
4. Registrar `generated_materials.capture_status=observed` e um item com `capture_status=presence_only` quando o card hospedeiro for visível.
5. Usar o rótulo sintético `visualize: ...` apenas como metadado opcional; não persistir a origem remota do iframe nem conteúdo externo.
6. Remover do texto da resposta os marcadores internos observados no bug (`VvisualizeVvisualize show_widget...`) somente quando identificados como protocolo de widget. Não remover texto normal que contenha “visualize” ou “show_widget” em contexto legítimo.

## Testes obrigatórios

- fixture com `iframe[title="Visualize Widget"]` e `.vis-container` dentro de uma resposta Claude;
- fixture com Artifact sem prosa explicativa;
- fixture com texto comum mencionando Artifact sem iframe, que deve resultar em `not_observed`;
- fixture com Artifact em resposta antiga, que não deve ser associado à resposta atual;
- verificar que iframe remoto não é lido e que o resultado permanece `presence_only`;
- manter os 61 testes existentes e adicionar regressões específicas do BUG-004;
- executar `npm.cmd test` e registrar o resultado.

## Versão e bloqueio

- produzir uma nova versão identificável, preferencialmente `0.6.12`;
- atualizar manifest, diagnóstico, `adapter_version`, testes e documentação dependente;
- não encaminhar a versão para o Work antes de incluir o novo status em `coordination/status/`;
- o reteste conjunto continua pausado até a implementação e a suíte automatizada passarem.

## Retorno esperado

```text
BUG-ID: BUG-CLAUDE-20261006-004
STATUS: READY_FOR_RETEST | BLOCKED
VERSION: 0.6.12
ROOT-CAUSE:
CHANGE-SUMMARY:
FILES-CHANGED:
TESTS-ADDED:
AUTOMATED-TEST-RESULT:
RISKS:
RETEST-INSTRUCTIONS:
```
