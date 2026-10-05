# Passo a passo — B01 (clique) e B02 (Enter)

**Data:** 24/09/2026  
**Referência:** [roteiro de validação local](ROTEIRO_VALIDACAO_LOCAL_POC_v0.1.md).  
**Objetivo:** verificar se cada uma das 20 tentativas reais de envio produz exatamente um prompt persistido, com texto fiel e ID único. Executar 10 por clique e 10 por Enter, separadamente.

**Atualização operacional de 02/10/2026:** executar este ensaio com `extension-prompt-block-poc/` 0.5.0 e a instalação atribuída a uma pessoa. O projeto da conversa é apenas contexto observado. O [estado atual](ESTADO_ATUAL_2026-10-01.md) descreve o cadastro e a atribuição. O restante do procedimento conserva os marcadores B01/B02 originais.

## 1. Preparação

1. Deixe o backend rodando em um terminal. Em outro PowerShell, execute `Invoke-RestMethod http://127.0.0.1:8000/health`; espere `status=ok` e `schema_version=0.1`.
2. Em `chrome://extensions`, confira que a extensão integrada 0.5.0 está carregada. No popup, confira código da instalação, pessoa, prefixo da chave, conta declarada e **Captura: habilitada**. Informe o token e clique **Salvar configuração** quando necessário. Se tiver recarregado a extensão, recarregue também a aba do ChatGPT.
3. Anote versão do Chrome (`chrome://version`), versão do backend (`0.1.0`, salvo alteração), data e conversa de laboratório usada.
4. Abra **uma conversa de laboratório já existente** e mantenha nela todos os 20 envios. Não use outras abas do ChatGPT durante B01/B02. Nova conversa e múltiplas abas serão avaliadas em cenários próprios.
5. Abra o [CSV de evidências](REGISTRO_EVIDENCIAS_POC_v0.1.csv). Prepare 20 linhas com `cenario_id` de `B01-01` a `B01-10` e de `B02-01` a `B02-10`. Deixe os campos de resultado em branco até cada execução.
6. No PowerShell aberto na pasta `backend`, anote a contagem inicial de interações:

   ```powershell
   .\.venv\Scripts\python.exe -c "import sqlite3; db=sqlite3.connect('data/lab.sqlite3'); print(db.execute('SELECT COUNT(*) FROM interactions').fetchone()[0])"
   ```

   Essa contagem inclui testes anteriores. Durante B01/B02, evite outras chamadas que criem interações para poder medir o incremento de cada bloco.

## 2. B01 — dez envios pelo botão

Repita os passos abaixo para `01`, `02`, ... `10`, **um prompt por vez**:

1. Digite no ChatGPT o texto `LAB-B01-01: Responda apenas OK-B01-01.`; substitua `01` pelo número da rodada. O marcador torna cada tentativa identificável. Use só texto sintético e sem anexo.
2. Clique **uma vez** no botão de enviar. Não pressione Enter nessa rodada.
3. Confirme visualmente que o ChatGPT mostrou o prompt como enviado. Aguarde a resposta terminar ou o popup registrar um estado terminal, por até três minutos. Se nenhum estado de resposta surgir nesse período, registre a ausência. Feche e reabra o popup para atualizar **Entregas recentes**.
4. Localize **um** `prompt: confirmed` para a tentativa e anote seu `interaction_id`. Observe se aparece `response: confirmed:complete`, `confirmed:incomplete` ou `capture_failed:...` para o mesmo ID. B01 mede o prompt; estados de resposta serão examinados com mais detalhe em C01/C02.
5. Consulte o registro no backend com o comando da seção 4. Confirme que `prompt.text` é exatamente o texto digitado e que o ID não apareceu em outra tentativa.
6. Preencha a linha `B01-nn` do CSV. Marque `falhou` se o envio ocorreu na interface mas não gerou confirmação, se gerou dois IDs ou se o texto divergiu. Em caso de falha, anote o horário e o diagnóstico antes de qualquer nova tentativa.

Após a décima tentativa, rode novamente a contagem da preparação. O resultado esperado é **contagem inicial + 10**. Compare também os dez IDs anotados: todos devem ser diferentes.

## 3. B02 — dez envios por Enter

Anote a contagem ao terminar B01. Repita os passos abaixo para `01` a `10`:

1. Digite `LAB-B02-01: Responda apenas OK-B02-01.`; substitua `01` pelo número da rodada.
2. Com o cursor no campo do prompt, pressione **Enter uma vez**. Não clique no botão e não use Shift+Enter. B04 testará quebra de linha e composição separadamente.
3. Confirme visualmente o envio e aguarde o estado terminal, por até três minutos, antes de preparar o próximo prompt. Registre a ausência de evento se atingir esse limite. Feche e reabra o popup para ler eventos novos.
4. Anote o único `prompt: confirmed`, seu `interaction_id`, o estado de resposta e o horário. Consulte `prompt.text` no backend e compare com o texto digitado.
5. Preencha a linha `B02-nn` do CSV. Registre qualquer envio não detectado, duplicado ou com texto diferente.

Ao final, a contagem deve ser **contagem após B01 + 10**; em uma rodada sem outras interações, isso equivale à contagem inicial + 20. Os dez IDs de B02 devem ser distintos entre si e dos IDs de B01.

## 4. Consulta de cada ID

Em um PowerShell separado do terminal do backend, informe o token local uma vez e consulte cada ID anotado no popup:

```powershell
$token = Read-Host "Token de laboratório"
$id = "COLE_AQUI_O_INTERACTION_ID"
$registro = Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/v1/interactions/$id" `
  -Headers @{ Authorization = "Bearer $token" }

$registro.interaction_id
$registro.status
$registro.prompt.text
```

Troque somente `$id` nas próximas consultas. Não copie o token para o CSV nem para capturas de tela. Se caracteres acentuados da resposta aparecerem trocados no PowerShell, isso pode ser efeito de decodificação do terminal; os prompts propostos aqui usam caracteres ASCII para tornar a conferência de B01/B02 direta.

O popup atual não mostra `client_event_id`; deixe essa coluna vazia e registre a limitação. **Não invente o ID.** O incremento do banco, os IDs distintos e a inspeção individual verificam o resultado disponível na interface atual.

## 5. Fechamento dos blocos

| Medida | Aceite B01 | Aceite B02 |
|---|---:|---:|
| Tentativas enviadas na interface | 10 | 10 |
| Prompts confirmados no backend | 10 | 10 |
| IDs distintos | 10 | 10 |
| Textos idênticos ao digitado | 10 | 10 |
| Registros extras para a mesma tentativa | 0 | 0 |

Se uma tentativa falhar, preserve a linha e o diagnóstico. Não transforme um reenvio em substituto da tentativa perdida: registre-o como nova execução com observação própria. Corrija a causa e repita o bloco afetado com novos marcadores. Ao terminar, informe os totais de B01 e B02 e os tipos de falha encontrados antes de avançar para respostas longas, navegação e duas abas.
