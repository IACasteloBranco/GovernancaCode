# Reteste Work — diagnóstico de injeção e captura — 0.3.3

**Pasta:** `extension-network-poc/` na raiz do repositório clonado
**Versão candidata:** `0.3.3`; adapter esperado `0.3.2-network`
**Site:** `https://chatgpt.com/`

## Pré-checagem

1. Recarregue a extensão carregada sem compactação no perfil Chrome dedicado e recarregue a aba ChatGPT.
2. No popup, confirme `POC: 0.3.3` e `Adapter: 0.3.2-network`.
3. Confirme que o estado da aba mostra política e captura ativas. Se não, registre integralmente a mensagem `Chrome:` mostrada pelo diagnóstico e finalize `BLOCKED` com status `MACHINE`.
4. Não altere permissões ou configuração durante a coleta de evidência. Se o Chrome solicitar nova autorização ao recarregar, documente a solicitação e aguarde decisão do responsável.

## Ensaio funcional (somente após pré-checagem ativa)

1. Confirme que a captura observacional está habilitada, vínculo da instalação atribuído, API local disponível e bloqueio manual desligado.
2. Envie somente o prompt sintético `Responda apenas OK-REDE-033.`
3. Confirme a resposta na página, um envio no backend local, `adapter_version=0.3.2-network`, uma linha de resposta e evento correspondente.
4. Registre resultado comparativo da sonda (`network_candidate_selected` ou `dom_fallback`) sem copiar texto do stream para o relatório.

O resultado deve ser `PASS`, `FAIL`, `BLOCKED`, `NOT_TESTED` ou `POLICY_QUESTION`. A implementação Codex não aprova o próprio reteste.
