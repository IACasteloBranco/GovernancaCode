# Reteste Work — falha de persistência da Network POC — versão 0.3.1

**Pasta:** `C:\Users\eduardo.pires\Repos\Governanca_Code\Extensão\extension-network-poc`  
**Site:** ChatGPT Web (`https://chatgpt.com`)  
**Versão candidata:** manifest/popup `0.3.1`; interação `adapter_version=0.3.1-network`  
**Versão 0.3.0:** permanece `REJECT` para captura de resposta.

## Preparação

1. Desative outras cópias da extensão, carregue a pasta acima e recarregue a aba do ChatGPT.
2. Confirme no popup a POC `0.3.1`, o adapter `0.3.1-network`, policy e captura ativos, `main=active` e a aba atual com scripts ativos.
3. Use apenas o prompt sintético: “Responda apenas `OK-REDE-031`.”

## Evidência a coletar

1. No popup, registre em **Entregas recentes** a sequência de observer disponível: `capture:started`, `capture:answer_found`, `capture:finalizing` ou `capture:delivery_error`.
2. Em **Sonda de rede**, registre se houve `stream_summary` ou `stream_error`, `protocolDone`, truncamento e sequência estrutural. Não copie conteúdo bruto do stream.
3. Consulte o SQLite pelo `interaction_id` novo. Confirme `adapter_version=0.3.1-network`, status final, exatamente uma linha em `responses` e evento `response` correspondente.
4. Confirme que o texto persistido corresponde à resposta visível. O diagnóstico `network_capture` pode ser `matched_dom` ou fallback DOM; ambos devem continuar permitindo a entrega de uma única resposta.

## Interpretação

- Sem `capture:started`: observer não iniciou; registrar `FAIL` da captura e versão/estado dos scripts.
- `started` sem `answer_found`: falha de associação/leitura DOM; manter resposta como não capturada e incluir contagens estruturais disponíveis.
- `answer_found` sem `finalizing`: falha de finalização/condição de conclusão.
- `finalizing` sem evento `response: confirmed:...` ou sem linha no SQLite: falha na entrega ou backend; preservar erro do popup e hora/interaction ID.
- Registrar estado (`PASS`, `FAIL`, `BLOCKED`, `NOT_TESTED` ou `POLICY_QUESTION`) e evidência sanitizada em `qa/results/`. Não usar credenciais nem conteúdo real.

A análise CDP anterior não substitui este reteste. Não marcar a POC aprovada sem confirmar a persistência real.
