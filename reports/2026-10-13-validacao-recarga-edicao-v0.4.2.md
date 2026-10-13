# Validação após recarga e edição — 2026-10-13

## Escopo

Ensaios sintéticos da extensão Chrome `0.4.2`, com backend local e aba de teste já autenticada. Nenhum prompt ou resposta pessoal foi usado.

## Resultados ao vivo

| Caso | Esperado | Observado | Resultado |
|---|---|---|---|
| Prompt novo | Prompt e resposta associados à mesma interação | `Persistência sintética 0.4.2` gravou `VERDE 58`; interação `d95c0fe6-00e2-4242-872f-cf61f9b4a540`, resposta `complete`, captura técnica `complete` | PASS |
| Regeneração depois de recarregar a conversa | Nova tentativa na interação existente | A opção **Tentar novamente** foi liberada após a recarga. Duas respostas `VERDE 58` ficaram na mesma interação, com IDs de evento `660c04a1-2a53-4e87-bf56-0695a49d878e` e `f750584b-5898-43f6-8430-3b416a59b5a3`; ambas as respostas e capturas técnicas estão `complete` | PASS |
| Edição antes da correção | Prompt alterado e resposta associados sem duplicar interações | A resposta `EDITADO 61` foi capturada como `complete`, mas o banco recebeu duas interações com o mesmo prompt em 77 ms: uma órfã, sem resposta, e outra completa | FAIL reproduzido |
| Edição após a correção | Uma interação para o prompt exato editado e uma resposta/captura completas | A conversa exibiu `Edicao exata sintetica 0.4.2: responda somente ROXO 94.` e `ROXO 94`. O banco tem uma interação (`14282368-e416-4884-81e7-ad3399de9f15`), uma resposta e uma captura técnica; os estados estão `complete` | PASS |
| Interrupção após o marcador final | Classificar conforme o stream recebido | Ao clicar em parar, a resposta de 147 itens já tinha `[DONE]`; captura `complete`, um marcador final e `reader_aborted_after_done=true` | PASS — o stream terminou antes do cancelamento observado |
| Interrupção antes de qualquer texto | Não inventar resposta vazia | Prompt ficou `request_captured`; sem resposta nem captura técnica, pois nenhum texto do assistente havia chegado | PASS — sem conteúdo de resposta disponível |
| Interrupção com texto parcial | Guardar o trecho e marcar incompleto | Prompt `Interrupcao parcial sintetica 0.4.2`; resposta com 212 caracteres, zero marcadores `[DONE]`, `response_status=incomplete` e `stream_status=incomplete` | PASS |
| Modos alternativos: Thinking e pesquisa web | Bloquear modos não suportados sem iniciar nova captura | Ambos exibiram `Este modo de regeneração ainda não é suportado.`. Após as seleções, o marcador parcial continuou com uma interação, uma resposta e uma captura, todos `incomplete`; nenhum registro adicional | PASS |

## Correção

O botão de envio e o evento `submit` chamam a inspeção com nomes de método diferentes. A deduplicação de 500 ms comparava também o método, permitindo dois registros para o mesmo texto. Ela agora deduplica pelo mesmo texto dentro da janela, independentemente do evento. O teste `bloqueio de eventos cobre Enter, clique e submit` cobre clique seguido de `submit` e confirma uma única captura do prompt.

## Verificações

- `node --test --test-isolation=none extension/tests/blocker.test.mjs`: 4/4 PASS.
- `node --test --test-isolation=none extension/tests/*.test.mjs`: 26/26 PASS.
- `graphify update .`: concluído; avisos de leitura negada em diretórios de artefatos antigos e extração sequencial.
- Banco consultado apenas por `0.4.2` e `EDITADO 61`; cada resposta foi conferida com sua captura técnica.

## Limitação pendente

A deduplicação pós-correção foi confirmada no Chrome e no banco. O filtro junta eventos com o mesmo texto em 500 ms; duas mensagens intencionalmente iguais enviadas dentro dessa janela seriam tratadas como um envio só. O modo **Pro** não foi selecionado para evitar iniciar um modo que pode depender de acesso pago; os outros modos alternativos cobertos foram bloqueados localmente.
