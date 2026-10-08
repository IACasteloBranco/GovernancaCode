# Continuação autorizada — QA da sonda ChatGPT 0.2.4

## Autorização humana

Está autorizado **um único envio sintético** com o bloqueio manual temporariamente desligado. A autorização é restrita a este caso e não aprova a sonda, a extensão ou o rollout.

## Separação das extensões

A POC de rede `0.2.4` não possui bloqueio manual. O bloqueio observado veio da extensão integrada `0.6.13`, que pode estar ativa na mesma aba e interceptar o envio antes da sonda observar o tráfego.

Para este ensaio, manter a sonda `0.2.4` ativa e desativar temporariamente a extensão integrada `0.6.13` no perfil de QA, ou desligar apenas o bloqueio dela. Não alterar a sonda para adicionar bloqueio.

## Pré-condição obrigatória

O relatório atual indica `networkProbe=false`. Não enviar nada enquanto a sonda não estiver ativa. Recarregar a aba/extensão conforme possível e confirmar no diagnóstico que a sonda `0.2.4` está ativa (`networkProbe=true`).

## Procedimento

1. Registrar quais extensões estão ativas no perfil de QA.
2. Confirmar a sonda `0.2.4` ativa na aba real.
3. Confirmar que a extensão integrada não está bloqueando o envio.
4. Enviar somente um prompt sintético, sem dados reais, por exemplo:

   ```text
   Responda exatamente: QA-NETWORK-PROBE-0612
   ```

5. Consultar apenas os eventos locais e a interação nova no SQLite/API.
6. Confirmar `adapter_version` da interação e registrar se a sonda observou metadados do stream.
7. Não persistir corpo bruto, resposta completa, cookies, headers, tokens, URLs assinadas ou bytes de arquivo.
8. Restaurar a configuração original da extensão integrada e registrar a restauração no relatório.

## Critério de resultado

- Se a sonda não estiver ativa, registrar `BLOCKED` sem enviar.
- Se a sonda estiver ativa e o envio ocorrer, registrar o interaction ID novo, metadados observados, limitações e estado do bloqueio restaurado.
- Não confundir os testes automatizados com validação da captura em navegador real.

## Segurança da evidência

O screenshot recebido contém conta declarada e identificador de instalação. Não copiar esses valores para novos relatórios, commits ou fixtures. Não incluir token de laboratório.
