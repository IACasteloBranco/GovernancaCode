# QA — POC de rede 0.3.0 — primeiro fluxo funcional

## Execução

- Data: 2026-10-07
- Site: ChatGPT Web em Chrome real
- Prompt: `Teste sintético da sonda de rede: responda apenas OK-REDE-030.`
- Resposta visível na interface: `OK-REDE-030`
- Nenhum dado real foi utilizado.

## Resultado

`FAIL — prompt capturado, resposta não persistida`

O popup confirmou a extensão `0.3.0`, adapter `0.3.0-network`, política e captura ativas, com `main=active`. O envio foi aceito pelo ChatGPT e a resposta apareceu concluída na interface.

No SQLite local, a nova interação foi criada:

- interaction_id: `780e1eee-2eae-4158-a11c-8f20abad1742`
- adapter_version: `0.3.0-network`
- status: `request_captured`
- evento registrado: `request / captured`

Após a conclusão visual e nova consulta, não havia registro correspondente em `responses` nem evento `response`. Portanto, a captura do prompt está comprovada, mas a captura/persistência da resposta não está.

## Limite da evidência

Esta execução não permite afirmar se `stream_summary` foi emitido pela sonda, porque o conteúdo do popup de diagnóstico não foi acessível pela automação após o envio. O próximo diagnóstico deve coletar os eventos locais da seção `Sonda de rede (somente local)` e verificar se o observer está finalizando a resposta.
