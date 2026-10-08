# Consolidação do Orchestrator — exploração CDP 2026-10-07

## Escopo da evidência

Os documentos em `governanca-main/governanca-main/` descrevem captura exploratória via CDP na mesma aba do navegador, principalmente em ChatGPT. Eles não validam a extensão de navegador, o fluxo Claude ou uma implementação de coleta por máquina.

## O que foi demonstrado

- corpos de streams de conversa puderam ser recuperados e comparados com a UI em amostras exploratórias;
- `Network.dataReceived` foi usado para conferir volume, mas o corpo completo exigiu `Network.getResponseBody` após o encerramento ou nova tentativa de stream;
- frames DPU exigem reconstrução por índice, incluindo substituições e acréscimos;
- `ERR_ABORTED` não distingue sozinho conclusão de interrupção;
- geração de CSV/PDF usa requisição da conversa, metadados de download e transferência de conteúdo separados;
- downloads puderam ser verificados localmente com tamanho, MIME e hash sintético.

## Limites e riscos

- os IDs CDP/navegador são transitórios;
- a amostra é concentrada em uma sessão/rota e precisa de conversa independente;
- semântica de `messageId` e regeneração ainda não foi confirmada;
- uma tentativa de Stop não teve captura de rede correspondente;
- a extensão ainda não reproduziu esses ensaios;
- corpos brutos, URLs assinadas, cookies e tokens não devem ser persistidos.

## Decisão do Orchestrator

Não alterar a captura DOM/Claude nem introduzir CDP em produção com base apenas nesses ensaios. O CDP deve permanecer como instrumento experimental para validar hipóteses e orientar uma futura implementação controlada.
