# Solicitação ao Work — Snapshot DOM sanitizado do Artifact

## Motivo

O Codex solicitou um trecho do DOM real para corrigir `BUG-CLAUDE-20261006-004` sem inventar seletores. O repositório ainda não possui snapshot ou HTML sanitizado do Artifact; existem apenas os relatos e interaction IDs do QA.

## Cenário

Usar o cenário já reproduzido em `qa/bugs/BUG-CLAUDE-20261006-004.md`, preferencialmente o Artifact HTML sem prosa explicativa:

- versão: `0.6.10`;
- site: `claude.ai`;
- interaction: `da9f2708-f1c1-4993-984c-3128ae554f36` se ainda estiver acessível; caso contrário, reproduzir com dados sintéticos;
- confirmar que o Artifact está visualmente presente antes de capturar.

## Artefato solicitado

Salvar em `reports/evidence/BUG-CLAUDE-20261006-004-artifact-dom.html` um trecho sanitizado contendo:

1. o contêiner mínimo da mensagem do assistente que inclui o Artifact;
2. o card/contêiner visual do Artifact e a tabela sintética;
3. os atributos `data-*`, classes, roles, `aria-*`, links e test IDs relevantes;
4. a relação estrutural entre resposta, card e controles de Artifact.

Pode usar marcadores sintéticos como `SYNTHETIC_ARTIFACT_TITLE`, `SYNTHETIC_CELL_A` e `SYNTHETIC_WIDGET_MARKER`. Não incluir prompt, nome de conta, URL privada, token, cookies, conteúdo real ou identificadores pessoais.

## Metadados obrigatórios

Criar também `reports/evidence/BUG-CLAUDE-20261006-004-artifact-dom.md` com:

```text
BUG-ID: BUG-CLAUDE-20261006-004
DATE:
SITE: claude.ai
EXTENSION-VERSION:
INTERACTION-ID: (pode ser omitido se uma nova reprodução for usada)
ROOT_SELECTOR:
ARTIFACT_SELECTOR_CANDIDATES:
RESPONSE_CONTAINER_SELECTOR:
SANITIZATION:
LIMITATIONS:
```

Descrever quais partes foram removidas ou substituídas e não registrar o HTML completo da página. O snapshot deve ser apenas o menor trecho necessário para orientar seletores e fixture.

## Resultado

Depois de salvar os dois arquivos, registrar em `qa/results/` que o snapshot foi produzido. Não alterar código nem marcar o BUG-004 como aprovado.
