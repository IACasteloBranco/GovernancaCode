# Coletor local para ChatGPT Desktop

Espaço de trabalho para a prova de conceito do proxy local de captura e entrega de eventos ao backend de Governança de IA.

Escopo inicial: investigar e validar o fluxo em ambiente isolado. Não instalar CA, alterar proxy do sistema ou coletar tráfego real neste diretório sem uma etapa explicitamente autorizada.

## Monitor de rollouts

`rollout_monitor.py` observa mudanças de metadados em `~/.codex/sessions` enquanto o processo está rodando. Inicie-o manualmente:

```powershell
python desktop-proxy/rollout_monitor.py
```

O monitor faz uma linha de base na inicialização e depois verifica a árvore a cada segundo. Ele emite eventos JSONL no stdout com caminho relativo, tamanho e horário observado. Não abre os rollouts, não executa o normalizador, não grava estado, não envia dados ao backend e não instala um serviço. Encerre com Ctrl+C.

Os caminhos relativos incluem identificadores de sessão. Não redirecione a saída para um local compartilhado sem revisar esse conteúdo. Uma mudança de tamanho não prova envio de mensagem nem conclusão de resposta. O Desktop e o Codex CLI podem usar a mesma pasta, então o monitor não atribui a origem do arquivo.

## Coletor incremental local

`rollout_collector.py` acompanha arquivos `.jsonl` e grava prompts e respostas normalizados em SQLite. A execução é manual, em primeiro plano; não instala serviço e não envia dados ao backend:

```powershell
python desktop-proxy/rollout_collector.py --collaborator-code COLAB-000
```

Na primeira varredura, os rollouts existentes formam uma linha de base: o coletor lê somente a primeira linha de metadados e posiciona o cursor no fim do arquivo. Depois disso, processa linhas JSON completas acrescentadas. O banco fica em `desktop-proxy/analise/rollout-monitor.sqlite3`; ele armazena texto de mensagens `user` e `assistant`, origem, turno e metadados mínimos. Argumentos e saídas de ferramentas, mensagens `developer` e payloads desconhecidos continuam fora, conforme `rollout_normalizer.py`.

Reiniciar o processo retoma os cursores gravados. Arquivo truncado, substituído, modificado sem crescer ou ausente gera estado de lacuna/ausência; o coletor preserva os eventos já gravados e não tenta reconstruir histórico. Arquivos `.zst` não são acompanhados. A identidade `COLAB-000` é atribuída localmente e permanece inferida.

O SQLite contém texto e fica ignorado pelo Git. O coletor não aplica políticas de retenção nem de acesso: mantenha o banco restrito a esta máquina e remova-o quando a revisão terminar. O arquivo de rollout de origem nunca é apagado.
