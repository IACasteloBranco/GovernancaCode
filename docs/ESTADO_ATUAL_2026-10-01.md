# Estado atual da POC — 01/10/2026

Este documento registra o estado verificado no código e no banco local em 01/10/2026. Os resultados do navegador dependem de execução manual e não são inferidos dos testes automatizados.

**Atualização de 02/10/2026:** a instalação agora é atribuída somente à pessoa. O projeto é contexto observado quando aparece na URL e não bloqueia o envio em outros chats. Os procedimentos abaixo foram ajustados para esse fluxo; os números históricos desta seção continuam referentes a 01/10.

## Componentes em uso

| Componente | Estado verificado |
| --- | --- |
| Backend | API FastAPI local em `backend/`, esquema SQLite 0.2, autenticação por `LAB_API_TOKEN`, cadastro de instalação e validação de assinatura ECDSA P-256 quando `MACHINE_SIGNATURE_REQUIRED=true`. |
| Extensão integrada | `extension-prompt-block-poc/`, versão 0.5.0. Avalia texto antes do envio, aplica regras e bloqueio manual, vincula a instalação a um projeto e observa prompts e respostas na página. |
| Extensão original | `extension/`, versão 0.1.11, mantida separadamente. Não contém o fluxo de vínculo por pessoa/projeto da versão integrada. |
| Sonda de rede | `extension-network-poc/`, experimental. Ainda não reconstrói nem correlaciona com confiança o texto final da resposta. |

## Evidências e limites

- O banco local tem migrações `0.1` e `0.2`, 38 interações históricas, 17 respostas e **uma instalação cadastrada sem atribuição de pessoa e projeto**. Essas interações são anteriores à validação completa da versão integrada; não comprovam captura na 0.5.0.
- Em 01/10/2026, os 33 testes automatizados da extensão integrada passaram. Os 11 testes do backend também passaram usando o ambiente virtual do projeto. Esses testes verificam o código, não uma rodada completa no Chrome.
- O cadastro pelo botão **Cadastrar ou atualizar vínculo** registra o ID e a chave pública da instalação. Ele não faz a atribuição administrativa. Enquanto a atribuição estiver pendente, o popup informa **Instalação sem atribuição confirmada** e mostra a captura como pausada.
- A captura de respostas pelo DOM continua experimental. Anexos não são observados; a extensão envia `attachments: []`. Não há fila offline nem reenvio automático.
- Ainda falta uma prova ponta a ponta, na versão 0.5.0, de instalação atribuída, envio em chats diferentes, persistência de prompt assinado e associação fiel da resposta. Não declarar a rastreabilidade `pessoa → contexto de projeto observado → prompt → resposta` como concluída.

## Como concluir o vínculo e ativar a captura

1. Inicie o backend a partir de `backend/` no PowerShell:

   ```powershell
   .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```

   Confira `http://127.0.0.1:8000/health`. O endpoint confirma disponibilidade, mas não valida o token.
2. Em `chrome://extensions`, carregue **extension-prompt-block-poc/**. No popup, informe a conta declarada e o mesmo `LAB_API_TOKEN` do `backend/.env`; salve. O token permanece apenas na sessão da extensão e pode precisar ser informado novamente após reiniciar o navegador.
3. Clique **Cadastrar ou atualizar vínculo**. Anote o **Código da instalação** e os 16 primeiros caracteres da impressão digital da chave exibidos no popup. Confira que o cadastro foi aceito.
4. Um operador, na pasta `backend/`, associa a instalação à pessoa. Confira os valores antes de executar:

   ```powershell
   .\.venv\Scripts\python.exe assign_machine.py "CODIGO_DA_INSTALACAO" "NOME" --fingerprint-prefix "16_CARACTERES_DA_CHAVE"
   ```

5. Clique novamente **Cadastrar ou atualizar vínculo**. O popup deve mostrar pessoa e prefixo da chave. Recarregue a aba do ChatGPT, marque **Habilitar captura observacional** e clique **Salvar configuração** com o token preenchido. A caixa pode estar marcada no armazenamento local e ainda aparecer desmarcada no popup enquanto faltarem token ou atribuição.
6. Faça um envio curto com texto fictício. Confira **Entregas recentes** e consulte o `interaction_id` confirmado na API. Registre também as falhas; um `HTTP 200` de `/health` não comprova a captura.

Não copie o token para documentos, prints ou o CSV de evidências. Não use conteúdo de clientes nesta POC.

## Próxima validação

Execute o [roteiro local](ROTEIRO_VALIDACAO_LOCAL_POC_v0.1.md) com a versão 0.5.0. Registre separadamente falhas de token (`401`), atribuição pendente, bloqueio por política e falha de captura. Depois compare cada prompt e resposta persistidos com o conteúdo visível no navegador. A pesquisa de captura pela rede e a retenção/liberação da resposta permanecem etapas futuras.
