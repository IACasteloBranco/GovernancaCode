# POC integrada de captura, bloqueio e vínculo por instalação v0.6.13

Esta pasta combina a captura de prompt da extensão `0.1.11` com o bloqueio antes do envio. A política é derivada de [`politica_bloqueio_prompts_v0_1.md`](../politica_bloqueio_prompts_v0_1.md). O ChatGPT Web está classificado como **não aprovado para dados de clientes** neste piloto. A extensão original e a POC de rede permanecem separadas.

## Claude e arquivos

A vers?o 0.6.0 adiciona Claude e registra apenas metadados ou presen?a de arquivos enviados e materiais gerados. Consulte [contrato, atualiza??o e valida??o](../docs/CLAUDE_E_ARQUIVOS_2026-10-05.md). Os seletores novos ainda precisam de valida??o nas sess?es autenticadas.

## Fluxo

1. Enter, clique ou submit dispara uma avaliação **síncrona e local** do texto do editor. O texto original não é alterado.
2. A regra manual **Bloquear todos os envios** prevalece quando ligada. Com ela desligada, a política textual retorna `ALLOW`, `WARN`, `REVIEW` ou `BLOCK`.
3. `BLOCK` e `REVIEW` impedem o evento de interface. `REVIEW` fica retido, pois ainda não existe fluxo de autorização. O texto permanece no editor para correção. O aviso na página e **Última decisão** no popup explicam qual regra causou o resultado, sem repetir o dado detectado.
4. `ALLOW` e `WARN` criam uma permissão curta para **uma única** requisição `POST .../conversation`; o interceptor `MAIN` consome essa permissão antes de chamar `fetch` original. `WARN` também mostra um aviso.
5. O observador antigo captura tentativas de envio a ChatGPT ou Claude e os envia ao backend quando a captura e o token estão configurados. Para prompts retidos, o diagnóstico local guarda somente ação, versão, IDs de regras e contagens, nunca o texto ou o valor detectado.

O observador procura o editor visível e reconhece o botão **Enviar** pelo `aria-label` quando a interface não fornece `data-testid`. Na captura da resposta, observa **Parar** no mesmo formulário. Depois que esse botão desaparece e o controle volta a **Iniciar conversa por voz** ou **Enviar**, aguarda dois segundos sem mudança no texto antes de enviar `complete`. A estrutura anterior com `data-testid="stop-button"` continua aceita. Sem sinal de geração observado, o texto estável é enviado como `incomplete`. Esses estados dependem do DOM visível e ainda precisam ser validados no Chrome após cada mudança da interface.
Quando outro prompt é enviado antes dessa espera terminar, o observador revisa a resposta anterior e registra o estado do compositor no instante do envio, antes da consulta assíncrona à extensão. Se o texto está presente, não há múltiplas respostas candidatas e o compositor já voltou ao controle normal, envia `complete`; se **Parar** ainda está visível, envia `incomplete`.
Blocos de assistente sem texto não contam como respostas candidatas adicionais. Se o envio seguinte ainda resultar em `incomplete`, o log local mostra apenas os sinais usados na decisão (`stop`, `ready`, `ambiguous`, controles e quantidade de caracteres), sem copiar o texto da conversa.

A avaliação local funciona mesmo se o backend responder `HTTP 401`. Sem atribuição da instalação a uma pessoa, a barreira local bloqueia o envio. Com a pessoa atribuída, a extensão não restringe o envio ao projeto; o backend exige assinatura válida quando `MACHINE_SIGNATURE_REQUIRED=true`.

## Vínculo da instalação à pessoa

A conta do ChatGPT pode ser compartilhada. Cada instalação da extensão tem um UUID e uma chave ECDSA P-256 própria. A extensão assina o corpo de cada evento enviado ao backend com timestamp e nonce. O operador associa esse UUID ao nome da pessoa. O projeto é observado na URL quando disponível e registrado como contexto da interação; ele não determina se o envio é liberado.

Para o projeto de exemplo `https://chatgpt.com/g/g-p-6abacc4edb1c81918be5e01d0038640a/project`, o ID é `g-p-6abacc4edb1c81918be5e01d0038640a`.
Se a URL trouxer um nome depois dos 32 caracteres hexadecimais, como `.../g/g-p-6abe9293e8248191ada3632b6a5316a6-eduardo/c/...`, atribua somente `g-p-6abe9293e8248191ada3632b6a5316a6`. A extensão remove esse nome ao comparar o projeto e registrar o prompt.

1. Atualize o backend, instale as dependências de `backend/requirements.txt`, mantenha `MACHINE_SIGNATURE_REQUIRED=true` e reinicie a API.
2. Recarregue esta extensão e a aba do ChatGPT. No popup, salve o token de laboratório e a conta de IA declarada. Clique **Cadastrar ou atualizar vínculo**. O backend registra a chave pública, ainda sem atribuir uma pessoa.
3. Copie o **Código da instalação** e os 16 primeiros caracteres da chave mostrados no popup. No computador do backend, execute `python assign_machine.py <codigo-da-instalacao> "EDUARDO" --fingerprint-prefix <16-caracteres>` dentro da pasta `backend`. O comando confere o código e a chave antes de atribuir.
4. Clique novamente em **Cadastrar ou atualizar vínculo**. O popup deve mostrar pessoa e início da impressão digital da chave.
5. Envie um prompt sintético sem dados sensíveis em uma conversa. O envio e a captura devem ser permitidos em qualquer projeto ou fora de projeto, desde que a política textual permita. O registro da API deve incluir `attributed_person` e `machine_key_fingerprint`; `project_id` é preenchido somente quando observado.

A chave privada desta POC fica em `chrome.storage.local`, acessível apenas aos contextos confiáveis da extensão. Ela identifica a **instalação/perfil do Chrome**; pode ser copiada por quem controla esse perfil e não é uma atestação física da máquina. Se duas pessoas usarem o mesmo perfil, o vínculo não distingue quem digitou. A atribuição administrativa é feita fora da extensão para que a conta compartilhada não possa escolher livremente outro nome.

O vínculo local é atualizado ao abrir/recarregar a aba ou ao clicar em **Cadastrar ou atualizar vínculo**. Se o operador alterar a atribuição no backend enquanto uma aba antiga continua aberta, a extensão pode manter a decisão anterior até atualizar; a API usa o cadastro atual. Recarregue as abas após cada alteração administrativa.

## Regras implementadas

| Regra | Comportamento nesta POC |
| --- | --- |
| R01 | Marcador PEM de chave privada: `BLOCK`. |
| R02 | Credencial em URL: `BLOCK`; Bearer plausível sem formato cadastrado: `REVIEW`. Prefixos específicos de fornecedores ainda não estão cadastrados. |
| R03 | Atribuição de credencial com valor plausível: `BLOCK`; valor com espaços/ambíguo: `REVIEW`; placeholders explícitos não acionam a regra. |
| R04 | Dois ou mais códigos de recuperação plausíveis: `BLOCK`; um: `REVIEW`. |
| R05 | **Exceção experimental da política 0.1.2:** qualquer CPF válido, com ou sem pontuação, é `BLOCK` neste destino não aprovado. A regex encontra candidatos e os dígitos verificadores confirmam a validade. CPF inválido não aciona a regra. O número não entra no diagnóstico. |
| R06 | Tabela com nome, CPF válido e pelo menos duas linhas: `REVIEW`; com remuneração no cabeçalho: `BLOCK`. Cinco ou mais linhas: `BLOCK`. |
| R07 | CPF válido e categoria sensível na mesma linha: `BLOCK`. |
| R08 | Marcador de sigilo com conteúdo substancial: `REVIEW`. Marcador isolado não bloqueia. |
| R09 | Assunto fiscal isolado: `ALLOW`; dez CNPJs válidos com faturamento: `REVIEW`. |

As ações seguem `BLOCK > REVIEW > WARN > ALLOW`. O texto é normalizado com Unicode NFKC e remoção de caracteres invisíveis apenas para análise. A procura é limitada a 100 mil caracteres; acima disso a decisão é `REVIEW`.

## Teste no Chrome

1. Desative as outras versões da Governança IA em `chrome://extensions`. Recarregue esta POC e **recarregue a aba do ChatGPT**.
2. No popup, deixe **Bloquear todos os envios** desmarcado e aplique. A política textual continuará ativa. Confira em **Entregas recentes** `blocker: ... main=active`.
3. Envie um prompt sintético comum, como “Como apurar DAS?”. Espere um único `POST .../conversation` e um evento `decision: ALLOW`.
4. Tente enviar `-----BEGIN PRIVATE KEY-----` como texto sintético. O texto deve permanecer no editor, sem novo `POST .../conversation`, com `decision: BLOCK ... R01` no popup.
5. Compare `900.000.001-75` e `90000000175` (ambos `BLOCK`, CPF válido), `900.000.001-76` (`ALLOW`, dígito inválido) e `000.000.000-00` (`ALLOW`, sequência repetida). Use somente dados sintéticos.
6. Ligue **Bloquear todos os envios** e repita um prompt comum; a decisão deve ser `BLOCK ... MANUAL`. Desligue para voltar à política textual.

Execute `npm test` nesta pasta. Os testes verificam as regras, a interceptação do evento, a permissão de uso único na rede e o registro sem conteúdo do prompt.

## Limites

Esta POC cobre texto digitado ou colado no editor, sem anexos, imagens, áudio, OCR ou links. Prefixos de tokens de fornecedores, exceções formais, revisão humana, classificação contratual de outros destinos e auditoria durável ainda precisam de definição. A implementação no navegador é uma barreira experimental: outros clientes, navegadores ou rotas de envio exigem validação própria antes de uso como controle corporativo definitivo.
