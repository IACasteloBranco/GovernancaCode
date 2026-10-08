# Reteste Work — bloqueador e captura espelhada — Network POC 0.3.0

**Pasta:** `C:\Users\eduardo.pires\Repos\Governanca_Code\Extensão\extension-network-poc`  
**Site:** ChatGPT Web (`https://chatgpt.com`)  
**Versão candidata:** `0.3.0`; `adapter_version=0.3.0-network`  
**Status:** candidata experimental, não aprovada.

## Preparação

1. Desative outras cópias da extensão para evitar bloqueios ou entregas duplicadas.
2. Carregue esta pasta sem compactação, recarregue a aba e confirme a versão no popup.
3. Configure token local e atribuição da instalação. Confirme que o diagnóstico do popup mostra scripts de política e captura ativos.
4. Use apenas textos sintéticos. Não use credenciais, dados pessoais ou conteúdo real.

## Bloqueador

1. Execute casos sintéticos da suíte de política aprovada e confirme que decisão de bloqueio impede o POST de conversa e mostra o motivo sem ecoar o conteúdo.
2. Confirme que um envio permitido libera uma única requisição e que novas tentativas precisam de nova avaliação.
3. Verifique o estado do bloqueio manual adicional sem alterar política ou configuração existente sem autorização.

## Stream e persistência

1. Em conversa nova, envie prompt sintético que peça resposta curta e exata com marcador `QA-NETWORK-CAPTURE-030`.
2. Confirme a resposta na interface e no diagnóstico se `network_capture` registrou `matched_dom` ou `dom_fallback`.
3. Consulte o SQLite/backend local pelo `interaction_id` dessa execução. Confirme `adapter_version=0.3.0-network`, no máximo uma resposta para a interação e que o texto persistido corresponde à interface.
4. Reexecute com resposta Markdown/código sintético. Registre se o espelho igualou o DOM; diferenças devem resultar em fallback, nunca substituir o texto visível.
5. Registre versão carregada, interaction IDs, estado (`PASS`, `FAIL`, `BLOCKED`, `NOT_TESTED` ou `POLICY_QUESTION`), status do stream e evidência sanitizada em `qa/results/`. Não salvar tokens, headers, cookies, corpos brutos de rede ou respostas reais.

## Limites

O resultado de rede via CDP de 2026-10-07 não valida a extensão. O modo espelho não comprova correlação causal do protocolo em regenerações, ferramentas ou requisições simultâneas. A validação deve confirmar a versão ativa e a persistência da interação desta rodada; a suíte automatizada não substitui QA.
