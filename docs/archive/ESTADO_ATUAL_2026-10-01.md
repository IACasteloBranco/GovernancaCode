# Estado atual da POC — 01/10/2026

Este documento registra o estado verificado no código e no banco local em 01/10/2026. Os resultados do navegador dependem de execução manual e não são inferidos dos testes automatizados.

**Atualização de 02/10/2026:** a instalação agora é atribuída somente à pessoa. O projeto é contexto observado quando aparece na URL e não bloqueia o envio em outros chats. Os procedimentos abaixo foram ajustados para esse fluxo; os números históricos desta seção continuam referentes a 01/10.

**Estrutura ativa em 13/10/2026:** o backend principal fica em `backend/` e a extensão de captura de stream 0.3.0 fica em `extension/`. As versões anteriores estão em `obsolete/`. Carregue somente `extension/` no Chrome e siga o [guia da extensão ativa](../../extension/README.md). Como a pasta mudou, o Chrome gera outro ID para a instalação unpacked; cadastre e atribua a nova instalação.

## Componentes registrados em 01/10/2026

| Componente | Estado verificado |
| --- | --- |
| Backend | API FastAPI local em `backend/`, esquema SQLite 0.2, autenticação por `LAB_API_TOKEN`, cadastro de instalação e validação de assinatura ECDSA P-256 quando `MACHINE_SIGNATURE_REQUIRED=true`. |
| Extensão integrada (registro de 01/10) | `obsolete/Extensão/extension-prompt-block-poc/`, versão 0.5.0 naquela data. A versão atual está indicada no mapa de pastas acima. |
| Extensão original | `obsolete/Extensão/extension/`, versão 0.1.11, mantida separadamente. Não contém o fluxo de vínculo por pessoa/projeto da versão integrada. |
| Sonda de rede | `obsolete/Extensão/extension-network-poc/`, versão experimental. Consulte o mapa acima para a versão atual. |

## Evidências e limites

- O banco local tem migrações `0.1` e `0.2`, 38 interações históricas, 17 respostas e **uma instalação cadastrada sem atribuição de pessoa e projeto**. Essas interações são anteriores à validação completa da versão integrada; não comprovam captura na 0.5.0.
- Em 01/10/2026, os 33 testes automatizados da extensão integrada passaram. Os 11 testes do backend também passaram usando o ambiente virtual do projeto. Esses testes verificam o código, não uma rodada completa no Chrome.
- O cadastro pelo botão **Cadastrar ou atualizar vínculo** registra o ID e a chave pública da instalação. Ele não faz a atribuição administrativa. Enquanto a atribuição estiver pendente, o popup informa **Instalação sem atribuição confirmada** e mostra a captura como pausada.
- A captura de respostas pelo DOM continua experimental. Anexos não são observados; a extensão envia `attachments: []`. Não há fila offline nem reenvio automático.
- Ainda falta uma prova ponta a ponta, na versão 0.5.0, de instalação atribuída, envio em chats diferentes, persistência de prompt assinado e associação fiel da resposta. Não declarar a rastreabilidade `pessoa → contexto de projeto observado → prompt → resposta` como concluída.

## Ativação atual

Use o guia da [extensão ativa](../../extension/README.md) para carregar o pacote 0.3.0, cadastrar a instalação, atribuí-la a uma pessoa e executar ensaios sintéticos. As instruções detalhadas abaixo desta seção pertenciam à versão anterior e foram substituídas.
## Próxima validação

Execute o [roteiro local](../guide/ROTEIRO_VALIDACAO_LOCAL_POC_v0.1.md) com a versão 0.5.0. Registre separadamente falhas de token (`401`), atribuição pendente, bloqueio por política e falha de captura. Depois compare cada prompt e resposta persistidos com o conteúdo visível no navegador. A pesquisa de captura pela rede e a retenção/liberação da resposta permanecem etapas futuras.
