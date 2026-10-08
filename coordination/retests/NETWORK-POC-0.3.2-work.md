# Reteste Work — sincronização do bloqueador e persistência de resposta — 0.3.2

**Pasta:** `C:\Users\eduardo.pires\Repos\Governanca_Code\Extensão\extension-network-poc`  
**Site:** ChatGPT Web (`https://chatgpt.com`)  
**Versão candidata:** `0.3.2`; adapter esperado `0.3.2-network`  
**0.3.0 e 0.3.1:** não aprovadas para captura real.

## Preparação

1. No Chrome, remova/desative cópias antigas da POC e carregue somente a pasta acima. Recarregue a aba do ChatGPT.
2. No popup dessa extensão, confirme `POC: 0.3.2`, `Adapter: 0.3.2-network` e `Bloqueio manual: desligado`. Registre a identificação da cópia carregada.
3. Confirme que a atribuição da instalação está ativa. Aguarde a sincronização; se o popup indicar instalação sem atribuição, interrompa o envio e registre `BLOCKED` por `MACHINE`.
4. Use apenas o prompt sintético: “Responda apenas `OK-REDE-032`.”

## Evidência

1. Se houver bloqueio, registre o motivo exato. Durante a sincronização, a mensagem esperada é `estado do bloqueio ainda está sincronizando`; isso não deve ser descrito como manual ligado.
2. Confirme no popup `capture:started`, `capture:answer_found`, `capture:finalizing` ou `capture:delivery_error` e os eventos da sonda, sem copiar conteúdo bruto.
3. Consulte o SQLite pelo `interaction_id`. Confirme `adapter_version=0.3.2-network`, uma linha em `responses` e evento `response` correspondente.
4. Compare o texto persistido com a resposta sintética visível. Use somente conteúdo de teste.

Não marque como aprovado sem evidência no navegador real e persistência confirmada.
