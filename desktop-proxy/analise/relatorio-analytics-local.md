# Análise local de sessões Codex

Gerado em: 2026-10-22T17:50:29+00:00
Rollouts instaveis ignorados apos duas leituras: 0.

## Escopo e resultado

- Rollouts principais: 40 (26 comprimidos).
- Rollouts de subagentes excluídos: 110.
- Sessões com mensagens: 40; prompts: 1112; respostas: 2627.
- Chamadas de ferramenta: 9202; chamadas MCP: 2625.
- Sessões com marcador de compactação: 23.
- Registros de tipo desconhecido: 25860; linhas inválidas: 0.
- Origem do aplicativo normalizada: Codex CLI (TUI): 29, Codex Desktop: 11.
- Metadados de computer-use/browser ligados pelo ID de thread: browser metadata: 8, computer-use metadata: 4.
- Arquivos TOML inventariados: computer-use 4; browser 8.

## Identidade e retenção

Cada evento usa `platform=codex_local`, `source_app`, `thread_id`, `turn_id`, `collaborator_code`, `identity_status`, `capture_status`, fontes/ordinais, metadados de tipo de anexo e texto. A busca é pelo código do colaborador; o resultado mostra nome, departamento, código, aplicativo de origem e data, sem expor thread, turno ou estado de captura.

O código exibido é `COLAB-000` com estado `locally_registered_inferred`. O código vem do único registro local de atribuição, mas não há vínculo direto entre esse registro e cada rollout; trate a atribuição como inferida.
A página HTML retém texto de prompts e respostas de todos os rollouts principais processados. Ela é local e não envia dados ao backend. Argumentos/saídas de ferramentas, mensagens developer, nomes/conteúdo de anexos e payloads desconhecidos foram omitidos pelo normalizador existente.

## Limitações observadas

- O originator `codex-tui` foi normalizado como Codex CLI (TUI); o campo `source` pode variar entre `cli` e `vscode` mesmo para essa interface de terminal. A origem `Codex Desktop` permanece separada.
- A contagem de ferramenta mede ocorrências projetadas pelo normalizador, não necessariamente ações concluídas com sucesso.
- `unknown_records` indica tipos sem interpretação no schema atual; não foi feita análise de seus payloads.
- Os horários de mensagens individuais não foram inferidos; a data apresentada é o timestamp de início da sessão.
- A associação entre extensão web e sessões locais não foi tentada nesta análise offline.
- A varredura não é um snapshot atômico: cada arquivo processado foi conferido por tamanho/mtime, mas a pasta pode mudar entre arquivos.

## Arquivo gerado

`analytics-local.html` (contém o texto retido; abrir localmente no navegador).
