# Plano da PoC do proxy local para ChatGPT Desktop

**Status:** proposta para investigação. A captura pelo proxy ainda não foi comprovada no ChatGPT Desktop instalado.

## Objetivo

Validar se um coletor local pode observar, com escopo restrito, as requisições e respostas do ChatGPT Desktop e encaminhar eventos normalizados ao backend de Governança de IA.

A PoC deve responder primeiro se o aplicativo usa um proxy HTTP configurável e aceita a CA de teste. Ela não deve instalar um coletor permanente nem modificar o backend ou a extensão antes de demonstrar o fluxo.

## Fluxo proposto

```text
ChatGPT Desktop
    │ HTTPS configurado para o proxy local
    ▼
Proxy local
    ├── encaminha a conexão ao serviço de destino
    ├── observa apenas hosts e formatos validados
    ├── associa requisição e resposta, inclusive streaming
    └── produz eventos normalizados
            │
            ▼
Aplicação de políticas e minimização local
            │ HTTPS, identidade e assinatura da máquina
            ▼
Backend de Governança de IA
```

O proxy e o envio ao backend são partes distintas. Uma falha no envio não deve alterar nem repetir a requisição original ao ChatGPT. A fila local, se necessária, deve ter limite de tamanho e retenção definidos antes da implementação.

## Fases de trabalho

### 1. Identificar o aplicativo e o caminho de rede

- Confirmar pacote, versão, caminho do executável, processos filhos e janela do ChatGPT Desktop.
- Observar metadados de conexão para determinar destinos, protocolos e portas usados pelo aplicativo.
- Verificar se o aplicativo aceita configuração de proxy por processo ou por usuário.
- Identificar os endpoints e o formato de streaming sem tentar contornar pinning, autenticação ou validação TLS.

**Saída:** inventário de aplicação e evidência de rede com limites claros. Não coletar corpos, credenciais ou conversas nessa fase.

#### Reconhecimento inicial em 20/10/2026

- O menu Iniciar mostra o nome `ChatGPT`, mas o AppID é `OpenAI.Codex_2p2nqsd0c76g0!App`.
- O pacote registrado é `OpenAI.Codex`, versão `26.1013.4894.0`, arquitetura `X64`.
- Foram encontrados 13 processos `ChatGPT.exe` sob o diretório desse pacote. A consulta de processo não expôs handles ou títulos de janela.
- Não havia conexões TCP estabelecidas nem endpoints UDP locais associados a esses PIDs no instante da consulta. Isso é uma amostra ociosa e não prova que o aplicativo não use a rede.
- O proxy WinHTTP estava em acesso direto. O proxy WinINet do usuário estava desativado.
- O shell usado na investigação tinha `HTTP_PROXY`, `HTTPS_PROXY` e `ALL_PROXY` configurados para `127.0.0.1:9`. Esses valores pertencem ao shell. Não foi possível confirmar se os processos do aplicativo herdaram essas variáveis.
- O inventário de apps nativos da sessão não retornou janelas. As consultas WMI usadas para consultar processos também foram negadas.

**Status da fase:** `BLOCKED` para confirmar destinos e protocolo por processo. A identidade do pacote e as configurações gerais de proxy foram observadas. Falta uma conexão atribuível ao aplicativo e uma confirmação visual da janela alvo.

**Próximo teste:** numa nova conversa do ChatGPT Desktop, enviar somente o prompt sintético `Responda somente OK.` e observar metadados de conexão e estado do stream. Esse teste transmitirá o texto ao serviço OpenAI. Não executá-lo sem autorização explícita.

### 2. Validar o proxy em laboratório

- Usar uma VM descartável com snapshot e dados exclusivamente sintéticos.
- Começar com um cliente de teste local para validar o encaminhamento, o parser e a reconstrução de streaming.
- Testar o ChatGPT Desktop somente após definir como instalar e remover uma CA de teste dentro da VM.
- Interceptar somente destinos previamente identificados e aprovados.
- Não usar proxy global do sistema na primeira experiência. Preferir configuração isolada para o processo, se o aplicativo suportar.

**Saída:** matriz de compatibilidade por destino, protocolo, fluxo e versão do aplicativo. Se o aplicativo rejeitar a CA, não contornar a proteção; registrar o limite e parar essa rota.

### 3. Definir dados e política de captura

Antes de persistir ou enviar conteúdo, obter decisão humana para:

- Capturar texto de prompts e respostas ou apenas metadados.
- Aplicar políticas localmente antes do envio e o que fazer quando a inspeção falhar.
- Permitir, bloquear ou deixar passar requisições quando o proxy estiver indisponível.
- Restringir a captura a determinados aplicativos, hosts, workspaces ou departamentos.
- Definir retenção, acesso, auditoria e eventual fila local.
- Autorizar instalação e escopo da CA de teste no laboratório.

Até essas decisões, a PoC deve evitar registrar conteúdo de conversas. As políticas aprovadas em `policies/` prevalecem sobre este plano.

### 4. Normalizar eventos localmente

Cada evento deve conter somente os campos necessários:

| Campo | Uso |
|---|---|
| `client_event_id` | Identificador único para repetição idempotente. |
| `device_installation_id` | Associação à máquina cadastrada. |
| `platform` | Origem `chatgpt_desktop`, após aprovação da mudança de contrato. |
| `adapter_version` | Versão do coletor e parser. |
| `observed_at` | Horário UTC observado no endpoint. |
| `request_id` | Correlação local entre requisição e resposta. |
| `capture_status` | `complete`, `incomplete`, `unavailable` ou outro estado aprovado. |
| `endpoint` | Host e classe de endpoint permitidos, sem query string ou segredo. |
| `stream_state` | Marcadores de término, truncamento e erro de leitura. |
| `content` | Prompt ou resposta somente se a política aprovar a captura. |
| `attachments` | Metadados observados, sem conteúdo de arquivo. |

Não gravar cabeçalhos de autorização, cookies, tokens, chaves, corpos HTTP brutos ou tráfego de destinos não aprovados. Não inferir que uma captura está completa apenas porque a conexão terminou.

### 5. Integrar ao backend existente

- Reutilizar o cadastro da máquina e a assinatura ECDSA P-256 já usados pelo projeto.
- Proteger a chave privada do coletor com armazenamento criptográfico do Windows, em vez de copiá-la para arquivos de configuração.
- Confirmar compatibilidade do formato de assinatura e do texto assinado com `verify_machine_signature()`.
- Reutilizar `/v1/interactions` e `/v1/interactions/{interaction_id}/response` para conteúdo autorizado, após o backend aceitar `chatgpt_desktop`.
- Reutilizar a estrutura de stream existente somente se seus campos e restrições representarem o protocolo observado. Hoje ela é específica de `chatgpt_web` e `/backend-api/f/conversation`.
- Reutilizar identificadores e proteção contra duplicidade. Não enviar o mesmo evento pela extensão e pelo coletor desktop.
- Aplicar validação, limites de tamanho e políticas locais antes de enviar ao backend.

**Mudanças posteriores possíveis:** adicionar `chatgpt_desktop` aos esquemas aplicáveis e adaptar a captura de stream para representar o protocolo observado. Não alterar o backend até a PoC comprovar necessidade e as decisões de governança estarem registradas.

### 6. Verificar a PoC

Executar somente com eventos e texto sintéticos. A PoC passa quando:

- O proxy encaminha o tráfego sem alterar a semântica da conversa de teste.
- A configuração alcança apenas o processo ou destino previsto.
- O parser correlaciona requisição, resposta e fim do streaming, e marca truncamentos corretamente.
- Nenhum segredo ou corpo bruto aparece em logs, arquivos temporários ou diagnósticos.
- O backend aceita eventos assinados, atribui a máquina correta e não duplica reenvios.
- A falha do backend não repete nem corrompe a requisição original.
- A reversão do laboratório remove a CA, a configuração de proxy e os dados de teste.

Registrar cada caso em `qa/` com resultado `PASS`, `FAIL`, `BLOCKED`, `NOT_TESTED` ou `POLICY_QUESTION`, além de entrada sintética, esperado, observado e evidência.

## Riscos e limites

- O ChatGPT Desktop pode ignorar a configuração de proxy, usar outros hosts ou mudar o protocolo após uma atualização.
- O aplicativo pode recusar a CA de teste. A PoC não deve enfraquecer essa validação.
- Um proxy que termina TLS pode acessar dados de sessão em memória. O processo e a chave da CA precisam de controles rigorosos.
- Streaming, compressão, novas versões de payloads e endpoints não reconhecidos podem produzir eventos incompletos.
- Capturar conteúdo aumenta o impacto de vazamentos e amplia obrigações de acesso e retenção.
- A observação local não prova ações em ferramentas remotas, ambientes isolados ou tarefas do Codex.

## Fora do escopo desta PoC

- Instalação permanente, serviço Windows, autostart ou rollout corporativo.
- Alteração de proxy global ou de configurações de segurança nesta máquina.
- Contorno de certificate pinning, extração de credenciais ou captura indiscriminada.
- Alterações em `policies/`, na extensão ou no backend antes das evidências e aprovações necessárias.
- Interface gráfica, suporte a vários provedores, análise de custos e alertas avançados.

## Tentativa de teste controlado em 20/10/2026

O usuário autorizou um teste restrito com o prompt sintético `Responda somente OK.`. A automação disponível nesta sessão retornou `apps: []` para aplicativos nativos. Havia abas de navegador no inventário, mas nenhuma foi usada como substituto do ChatGPT Desktop.

Uma consulta passiva encontrou 16 processos `ChatGPT.exe`, todos no pacote `OpenAI.Codex_26.1013.4894.0_x64__2p2nqsd0c76g0`. Na mesma amostra, `Get-NetTCPConnection -State Established` não retornou conexões atribuídas a esses PIDs.

**Resultado:** `BLOCKED`. Não foi possível inserir o prompt, observar a árvore UIA, detectar o envio ou correlacionar uma conexão de rede. As etapas de leitura de prompt, resposta, conclusão de geração e anexos permanecem `NOT_TESTED`. A amostra de sockets sem conexão é pontual e não demonstra que o aplicativo nunca se conecta.

**Limitação do ambiente:** o processo estava ativo, mas o canal de automação desta sessão não expôs a janela nativa. Nenhuma conversa anterior ou arquivo foi lido. Nenhuma configuração do aplicativo ou do sistema foi alterada.

## Referência externa: `reddpy/chatgpt-app-analysis` (20/10/2026)

O repositório foi lido localmente no commit `a4a86d2` e comparado com o pacote Windows instalado. É um dossiê de engenharia reversa produzido por terceiros; seus relatos não foram reproduzidos nesta máquina e não são documentação oficial da OpenAI.

### O que é aproveitável

- O dossiê analisa um alvo macOS `26.911.61220`, Electron `42.3.0` e core Rust identificado como `0.155.0-alpha.2.6`. Nosso pacote Windows é `26.1013.4894.0`; portanto, os caminhos e resultados de rede não podem ser transferidos diretamente entre essas versões/plataformas.
- O arquivo `harness/sampler-capture.patch` modifica o sampler de `guardian-v2` no código Rust do Codex, adicionando saída JSONL da requisição do classificador e do veredito. Isso captura evidência usada pela revisão de segurança de ações, não um fluxo geral de prompts/respostas da conversa.
- O próprio documento descreve que a entrada do classificador pode incluir instruções, transcrição de evidências e ação planejada. Mesmo em uma ferramenta de segurança, esse registro pode conter conteúdo muito sensível; qualquer reprodução exigiria dados sintéticos, diretório isolado e escopo de coleta explícito.
- A documentação relata que `HTTPS_PROXY` e `CODEX_CA_CERTIFICATE` funcionaram para certos caminhos HTTP no app-server Mac. O texto apresenta relatos divergentes para WebSocket: uma seção afirma que o WebSocket do classificador não passou pelo proxy HTTP; outra afirma que o WebSocket da chamada Luna passou. Sem os JSONL brutos, capturas e build reproduzível — ausentes do clone — não é possível reconciliar se são endpoints, modos ou execuções diferentes.
- A seção de API lista endpoints do renderer, mas não fornece os artefatos brutos necessários para validar a completude ou associar cada endpoint a um fluxo de conversa. Tratar esse mapa como índice para investigação, não como contrato de integração.

### Comparação com o pacote Windows local

Na instalação local, o pacote contém shell Electron/Chromium e binário Rust `codex.exe`; o bundle principal também contém a lógica de um túnel MASQUE restrito a `https://codex-portals.api.openai.com`. A evidência estática não demonstra que esse túnel conduza as conversas do ChatGPT nem que os processos aceitem as variáveis de proxy relatadas para o macOS. Uma amostra ociosa anterior também não identificou conexões ativas atribuíveis aos PIDs.

O `app-server` oficial do Codex usa protocolo JSON-RPC com transporte externo por stdio ou WebSocket, conforme a documentação pública do projeto. Isso torna os eventos do protocolo uma fronteira de pesquisa melhor definida que o scraping de pixels, mas não prova que a janela ChatGPT Desktop permita anexar um cliente observador à instância privada que ela inicia. O processo, o transporte real e a autorização para observação ainda precisam ser comprovados na versão Windows instalada.

### Decisão para a próxima etapa

1. Priorizar inventário passivo e atribuição de conexões durante um teste sintético autorizado; manter processo, destino, protocolo e timestamps, sem conteúdo.
2. Mapear a relação entre a UI, o processo Rust `codex.exe` e seu transporte local usando somente observação de processos/IPC documentável. Não assumir que o túnel MASQUE é o caminho do chat.
3. Só depois avaliar um cliente de teste contra protocolo oficial do app-server ou proxy explicitamente suportado. A evidência do repositório Mac não autoriza aplicar CA, proxy global, modificar binários ou instalar instrumentação neste Windows.
4. Não reutilizar o patch Guardian como coletor de conversas: seu ponto de captura tem semântica diferente e pode registrar contexto sensível de avaliação.

**Limites da revisão:** não foram executados o patch, o app-server, proxy, harness ou comandos de reprodução do repositório. O teste de UI e a observação em tempo de uma requisição continuam `BLOCKED` por falta de controle da janela nativa nesta sessão.

## Verificações locais passivas: OTel, rollouts e transporte (20/10/2026)

### OTel

- O arquivo `%USERPROFILE%\.codex\config.toml` existe. Foi consultada somente a presença da seção `[otel]` e da chave `log_user_prompt`; a seção não existe. Nenhum endpoint, header ou outro conteúdo da configuração foi lido ou exibido.
- A versão observada na cópia do Codex usada pelo daemon é `codex-cli 0.163.0`, retornada por `codex.exe --version`. A execução apenas consultou a versão; houve avisos de acesso negado ao tentar criar/limpar diretórios temporários de aliases em `.codex\tmp`, sem alteração da configuração.
- No código-fonte atual de `openai/codex`, o app-server chama `build_provider`, usa `service.name=codex-app-server`, e a resolução de configuração mantém `log_user_prompt=false`, `log_agent_responses=false` e o exporter de logs como `none` quando não configurados. Isso comprova capacidade no código atual, não que a build Windows instalada habilite ou exporte os eventos do mesmo modo.
- A documentação atual do protocolo menciona sessões locais stdio do Codex Desktop. Isso não oferece um canal público de observação da conexão privada da UI. Um issue upstream anterior relata ausência de exportação OTel na versão Desktop `26.429.61741`; é um relato de outra versão, não prova falha na `26.1013.4894.0`.

### Rollout local

- `%USERPROFILE%\.codex\sessions` existe e contém 89 arquivos `rollout-*.jsonl`, totalizando 386.601.123 bytes na verificação. O arquivo mais recente tinha modificação em 20/10/2026 às 19:37:38 (horário local).
- **Nenhum rollout foi aberto ou pesquisado.** Portanto, está comprovada a presença e a atividade recente do armazenamento, mas não se os arquivos são da UI Desktop, do CLI ou de ambos; também não foi confirmado o schema, a disponibilidade de prompts/respostas, a completude, nem a estabilidade após atualização.

### Processo e transporte local

- Na amostra, havia 13 processos `ChatGPT.exe` no pacote Windows; também havia processos `codex.exe`, incluindo executáveis sob a release `app-server-daemon` `0.163.0`. Não foi coletada relação pai/filho suficiente para atribuí-los conclusivamente à janela Desktop.
- Nenhum listener TCP nem conexão TCP estabelecida foi observado entre os PIDs amostrados de `ChatGPT.exe` e `codex.exe`. Isso é apenas um snapshot: não detecta stdio, named pipes, sockets Unix/AF_UNIX, IPC do Electron, nem conexões que não estivessem ativas durante a consulta.
- A busca não identificou uma porta WebSocket local para o app-server. Não se tentou conectar ao daemon nem abrir seus canais locais.

### Resultado e próximo gate

`rollout_presence=PASS` (metadados apenas); `otel_config_present=FAIL` (seção ausente no config atual); `otel_desktop_export=NOT_TESTED`; `live_app_server_transport=NOT_TESTED` (nenhum TCP observado e IPC não enumerado); `rollout_content/schema=NOT_TESTED` (históricos preservados sem leitura).

Um teste que prove OTel nesta instalação exige adicionar temporariamente uma configuração `[otel]` ao config do usuário, apontá-la exclusivamente para um receptor em loopback, habilitar captura do prompt sintético, reiniciar o Desktop para reler a configuração e depois restaurar o arquivo original e apagar os dados de teste. Isso altera o ambiente e grava conteúdo sintético local; não foi feito nesta etapa e requer autorização explícita. O teste de rollouts pode ser feito com um novo turno sintético e comparar somente nomes/timestamps/tamanho de arquivos novos; o corpo do arquivo continuará fechado até autorização específica.

### Fontes de implementação upstream consultadas

- `openai/codex`, [inicialização OTel do app-server](https://github.com/openai/codex/blob/main/codex-rs/app-server/src/lib.rs), [defaults do OTel](https://github.com/openai/codex/blob/main/codex-rs/core/src/config/otel.rs), [persistência dos rollouts](https://github.com/openai/codex/blob/main/codex-rs/rollout/src/recorder.rs) e [README do app-server](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md). São fontes upstream atuais, não os binários exatos instalados.
- Issue [#21382](https://github.com/openai/codex/issues/21382) registra ausência de telemetria OTel na app Desktop `26.429.61741`, embora CLI exportasse; o relato é histórico e não determina a build Windows local.

### Tentativa do teste OTel após autorização (20/10/2026)

O usuário autorizou o teste temporário com config, receptor `127.0.0.1` e prompt sintético. Antes de alterar o ambiente, tentei localizar uma janela principal `ChatGPT.exe` pelo Windows UI Automation. Os processos estavam ativos, mas nenhum expôs `MainWindowHandle`; a busca não encontrou editor acessível. A automação nativa da sessão também não lista apps.

**Resultado:** `BLOCKED` antes da alteração. Não editei `config.toml`, não iniciei receptor, não encerrei/reiniciei processos e não transmiti prompt. A autorização não foi usada porque não havia como executar o turno nem verificar a restauração/limpeza do teste. Para retomar, a janela do Desktop precisa estar exposta a uma sessão de UIA interativa; depois, o teste pode ser repetido com o mesmo escopo sintético.

## Normalizador de rollout v3 — retenção local opcional (21/10/2026)

### Evidência da amostra já inspecionada

Os resultados abaixo vieram de um único rollout e não foram reexecutados pelo normalizador. Nenhum texto, ID ou caminho do arquivo é reproduzido aqui.

- `event_msg.item_completed` continha itens completos. As 14 mensagens `UserMessage` e 52 `AgentMessage` da amostra tinham texto não vazio.
- Os fluxos `item_completed` e `response_item` tinham 242 IDs distintos em comum, entre 695 e 717 ocorrências, respectivamente. A interseção parcial não permite descartar uma fonte.
- Os 13 pares observados de `task_started`/`task_complete` tinham `turn_id` correspondente. Os 716 de 717 itens `response_item` com metadado de turno correspondiam aos 13 turnos; um item não tinha essa correlação.
- Os registros `developer` não tinham campo de origem. Eles permanecem `role=developer`, `origin=unknown`; não são classificados como instrução de sistema.
- A amostra tinha um marcador `compacted`. Isso prova a presença do marcador, não que o conteúdo de todos os turnos anteriores foi alterado ou removido.

Essa amostra sustenta pareamento explícito por `turn_id` quando disponível; não sustenta a suposição de que todo rollout terá pares completos ou o mesmo schema.

### Formato canônico e minimização

O protótipo `rollout_normalizer.py` usa um ledger de observações por linha e projeções derivadas por turno e chamada de ferramenta. Cada ocorrência conserva ordinal e fonte (`event_msg.item_completed` ou `response_item`). Representações equivalentes do mesmo `item_id` e papel recebem uma identidade lógica, sem apagar a proveniência. Conflitos de identidade ficam separados e são reportados.

O modo padrão continua `metadata_only`. Com `--include-content`, `messages[]` retém as partes textuais de mensagens `user` e `assistant`, fora do ledger de observações. Ocorrências idênticas do mesmo item compartilham um registro de conteúdo e preservam ambas as fontes. Quando os IDs diferem, o normalizador também une o texto idêntico do mesmo papel e turno entre `response_item` e `event_msg.item_completed`; conserva os IDs e as origens de ambas as ocorrências. Textos iguais em turnos diferentes ou repetidos na mesma fonte continuam separados. Se o mesmo item tiver textos divergentes, as variantes são mantidas e marcadas como conflito. Esse modo serve à revisão retrospectiva; não aplica nem simula bloqueio preventivo.

Os dois modos omitem texto `developer`, reasoning, argumentos e saídas de ferramentas, comandos, stdout/stderr, nomes/caminhos/tamanho/binários de anexos e payloads desconhecidos. O resultado registra presença de texto, tipos de partes não textuais, IDs estruturais, papel, ferramenta, status declarado, ordinal e timestamps explícitos. Para `CommandExecution`, um código de saída explícito vira somente `zero` ou `nonzero`; `completed` não é interpretado como sucesso.

Turnos usam `paired` apenas quando há exatamente um início e um término; ausência vira `unpaired` e duplicidade vira `ambiguous`. Eventos sem `turn_id` permanecem sem associação; a v1 não adivinha pela posição. Marcadores `compacted` são preservados na sequência e só indicam sobreposição ou posição relativa observável, sem afirmar perda de conteúdo. Linhas JSON inválidas e tipos desconhecidos geram diagnóstico sanitizado sem trecho bruto.

Chamadas e saídas de ferramenta são correlacionadas por `call_id` apenas na projeção e apenas como `paired` quando há uma ocorrência de cada lado; ausência ou duplicidade fica explícita. O status é preservado como declarado pelo rollout, sem convertê-lo em sucesso/falha. Para `CommandExecution`, somente a classe do código de saída explícito é mantida.

Registros `McpToolCall` têm outra forma. Cada ocorrência inclui `id`, servidor, ferramenta, status e os tempos do evento; o rollout também expõe `thread_id` e `turn_id`. A versão 3 do normalizador mantém esses metadados em `observations[]` e `mcp_tool_calls[]`, calcula `duration_ms` quando os dois tempos são válidos e preserva a origem e a ordem. Argumentos e resultados permanecem fora da saída, inclusive com `--include-content`. Os arquivos TOML em `~/.codex/computer-use/sessions` e `~/.codex/browser/sessions` registram permissões por sessão. Seus nomes correspondem ao ID da thread, que pode ser ligado ao rollout e às chamadas MCP.

### Gate de política e integração

`policies/politica_bloqueio_prompts_v0_1.md` trata inspeção preventiva no campo de envio da extensão, não define retenção de conversas do Desktop/Codex. Seguindo a orientação do usuário nesta conversa, foi implementada a capacidade de retenção textual no protótipo local, desativada por padrão e acionada explicitamente por `--include-content`. Isso autoriza a capacidade de protótipo, não a execução em lote, envio ao backend ou rollout corporativo. A finalidade operacional, escopo de usuários, controle de acesso, retenção, descarte e aplicação dos detectores após o envio ainda requerem decisão de governança (`POLICY_QUESTION`).

O protótipo é um utilitário offline e não modifica o backend, a extensão ou rollouts de origem. A integração posterior precisaria mapear a projeção aprovada ao contrato do backend, atribuir colaborador/departamento por identidade corporativa confiável, usar chave idempotente por origem/ordinal e deduplicar entre extensão e Desktop sem fundir fontes com evidência insuficiente. Falhas de parse e lacunas devem acompanhar o evento como estado de captura, não virar sucesso implícito.

**Estado da implementação:** oito testes sintéticos do normalizador passaram, incluindo metadados MCP sem argumentos/resultados e equivalência do tipo `Reasoning` entre fontes. A amostra metadata-only foi processada sem reter mensagens e registrou 88 chamadas MCP. O normalizador não está integrado ao backend. O schema upstream pode variar por versão; tipos e associações ainda não reconhecidos permanecem visíveis como desconhecidos/não associados.

## Monitor local de mudanças em rollouts (21/10/2026)

`rollout_monitor.py` é um processo manual e em primeiro plano que faz uma varredura inicial de metadados e depois reconcilia a árvore `~/.codex/sessions` a cada segundo. Ele considera apenas arquivos regulares chamados `rollout-*.jsonl`, não segue links/reparse points, não abre conteúdo, não chama o normalizador, não persiste checkpoints e não envia eventos ao backend.

Os eventos `created`, `grew`, `shrank`, `modified`, `replaced` e `missing` descrevem apenas diferenças entre duas observações do filesystem. Uma varredura incompleta emite `scan_error`, preserva o baseline e não produz falsos `missing`; a primeira varredura completa seguinte informa `recovered`. Ausência não prova exclusão, crescimento não prova append nem envio, e silêncio não prova término de geração. A varredura inicial cria um baseline sem tratar arquivos antigos como novos.

O monitor ainda não captura prompts/respostas e não distingue ChatGPT Desktop de Codex CLI. Arquivos criados e modificados entre duas varreduras podem ser observados apenas no estado final. A enumeração não é um snapshot atômico nem uma fronteira contra troca maliciosa de diretórios durante a varredura. O próximo passo, caso o contrato seja aprovado, é um leitor incremental separado, limitado a dados sintéticos e a conteúdo novo após o início explícito do monitor; não deve reler o histórico existente.


## Coletor incremental local (22/10/2026)

`rollout_collector.py` implementa a leitura incremental em processo manual. A primeira varredura registra metadados e cursores no fim dos rollouts existentes, sem importar seu conte?do. Para arquivos novos, l? registros JSONL completos; para arquivos existentes, l? somente bytes acrescentados desde o cursor SQLite. O cursor e os eventos normalizados s?o confirmados na mesma transa??o, permitindo retomar ap?s rein?cio sem inserir de novo o trecho j? confirmado.

O banco local armazena texto de mensagens `user` e `assistant`, c?digo de colaborador inferido, origem do aplicativo, turno, fontes e metadados de tipos de anexo. Argumentos/resultados de ferramentas, instru??es `developer` e payloads desconhecidos continuam exclu?dos. Rollouts nunca s?o apagados. Truncamento, substitui??o, modifica??o sem crescimento e aus?ncia ficam marcados como lacuna/aus?ncia; a causa n?o ? inferida. Arquivos `.zst` n?o entram no monitor incremental.

A valida??o foi feita com rollouts sint?ticos: baseline sem hist?rico, captura de linhas novas, retomada/idempot?ncia, deduplica??o entre fontes em polls distintos, lacuna ap?s truncamento e minimiza??o de argumentos de ferramenta. A p?gina de analytics ainda n?o l? o SQLite; nenhuma informa??o foi enviada ao backend. O banco cont?m texto em claro e n?o tem expira??o autom?tica; sua reten??o e acesso precisam ser definidos antes de qualquer distribui??o corporativa.

**Escopo de chamadas MCP:** a versão 3 também projeta metadados de chamadas `McpToolCall` por thread e turno. Ela mantém o ID do item, servidor, ferramenta, status, tempos, duração derivada e ordinal. Não mantém argumentos nem resultados. Os testes automatizados desta alteração não foram executados; a verificação limitou-se à sintaxe.
