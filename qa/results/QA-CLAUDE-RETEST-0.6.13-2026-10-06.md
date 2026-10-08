# Reteste Claude 0.6.13 — bloqueado por divergência de runtime

**Data:** 2026-10-06  
**Pedido:** `coordination/retests/BUG-CLAUDE-20261006-003-004-0.6.13.md`  
**Site:** Claude (`claude.ai`)  
**Versão no manifest local:** `0.6.13` (`Extensão/extension-prompt-block-poc/manifest.json`)  
**Versão reportada pela interação nova:** `0.6.12`  
**Dados:** prompt de identificação exclusivamente sintético.

## Preparação e evidência

Foi aberta uma conversa nova e enviada somente a entrada `Responda exatamente: QA-VERSION-0613`. O registro correspondente no SQLite foi:

- `interaction_id=58075457-f37a-44bf-b384-061b2dd44302`
- `platform=claude_web`
- `adapter_version=0.6.12`
- `response_version=0.6.12`
- `capture_status=complete`
- resposta: `QA-VERSION-0613`

O manifest na pasta candidata informa `0.6.13`, mas a nova interação informa `0.6.12`. O procedimento do encaminhamento exige interromper o reteste quando a versão divergir. O navegador disponível nesta sessão não expõe o popup/gerenciador para recarregar a extensão a partir da pasta candidata e confirmar a ficha de diagnóstico.

## Casos

| TEST-ID | Caso | Estado | Motivo |
|---|---|---|---|
| QA-PREP-VERSION-0613 | Identificação da versão ativa | `BLOCKED` | A interação e a resposta reportaram `0.6.12`, não `0.6.13`. |
| QA-CLAUDE-MARKDOWN-001-R613 | Preservação de `pre/code` em Markdown | `NOT_TESTED` | Interrompido pela divergência de versão. |
| QA-CLAUDE-MATERIAL-ARTIFACT-001-R613 | Artifact HTML com prosa | `NOT_TESTED` | Interrompido pela divergência de versão. |
| QA-CLAUDE-MATERIAL-ONLY-001-R613 | Artifact HTML sem prosa | `NOT_TESTED` | Interrompido pela divergência de versão. |
| QA-CLAUDE-MATERIAL-NO-WIDGET-001-R613 | Menção comum a `Artifact` sem widget | `NOT_TESTED` | Interrompido pela divergência de versão. |
| QA-CLAUDE-MATERIAL-STALE-001-R613 | Isolamento de Artifact antigo | `NOT_TESTED` | Interrompido pela divergência de versão. |

## Fechamento

- `PASS`: 0
- `FAIL`: 0
- `BLOCKED`: 1 (identificação do runtime)
- `NOT_TESTED`: 5
- BUG-003 e BUG-004 permanecem abertos; nenhum comportamento funcional da `0.6.13` foi avaliado nesta rodada.

**Recomendação:** `BLOCKED` — recarregar a extensão `0.6.13` no perfil que serve o Claude e confirmar a versão numa interação nova. Depois, repetir os cenários deste encaminhamento. Este resultado não aprova nem reprova funcionalmente a candidata `0.6.13` e não altera o estado dos bugs ou autoriza rollout.

## Nova tentativa de identificação

Após solicitação do usuário para tentar novamente, foi aberta outra conversa nova e enviado apenas `Responda exatamente: QA-VERSION-0613-RETRY-02`.

- `interaction_id=3b5ddbf7-e99f-41ff-81cc-7ca5d085daf2`
- request `adapter_version=0.6.12`
- response `adapter_version=0.6.12`
- resposta `capture_status=complete`

**Estado:** `BLOCKED` novamente pela divergência. Os casos funcionais de BUG-003/004 continuam `NOT_TESTED` nesta candidata; nenhum prompt funcional adicional foi enviado.
