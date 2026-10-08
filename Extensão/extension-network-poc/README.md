# POC experimental de bloqueio e espelhamento de rede — 0.3.3

Esta POC isolada do ChatGPT Web combina o bloqueador da extensão integrada com a sonda de rede e uma tentativa conservadora de reconstruir a resposta do stream. Não substitui a extensão integrada e não está aprovada para rollout.

## O que faz

- Avalia prompts usando a cópia do engine de política existente e intercepta clique, Enter, submit e POST de conversa.
- Mantém o bloqueio manual adicional, o vínculo da instalação e a liberação de uso único. O bloqueio manual começa conforme a configuração salva; prompts também permanecem bloqueados quando não há atribuição da instalação.
- Captura o prompt e a resposta visível pelo observador existente e envia esses snapshots ao backend local `http://127.0.0.1:8000` quando a captura está habilitada.
- Para `POST /backend-api/.../conversation`, espelha uma cópia do stream. A reconstrução aceita somente partes textuais do assistente, status final reconhecido e o marcador `[DONE]`. Não reconhece outros formatos como resposta persistível.
- Usa o candidato de rede para a entrega somente se ele corresponder exatamente ao texto do DOM e não houver ambiguidade; em qualquer outro caso usa o DOM. O resultado comparativo local registra apenas `matched`/fallback, nunca o texto.
- A leitura do stream não consome nem atrasa o corpo original da aplicação. O texto candidato passa transitoriamente por memória da página/observador e não aparece no diagnóstico da sonda.

Essa associação ainda depende da janela curta do envio ativo e não comprova causalidade para regeneração, ferramenta, cancelamento ou múltiplas requisições. O modo espelho é experimental. Não há retenção/liberação de stream (Buffered Mode).

## Carregar e configurar

1. No Chrome, abra `chrome://extensions`, ative o modo de desenvolvedor e carregue esta pasta com **Carregar sem compactação**.
2. Desative outras cópias da extensão de governança e recarregue a aba `https://chatgpt.com`.
3. No popup, configure o token do laboratório, habilite captura e registre/atualize o vínculo da instalação. O operador deve atribuir a instalação no backend antes que envios sejam permitidos.
4. O controle **Bloquear todos os envios** é uma regra manual adicional; a policy textual continua ativa sem ela. Use apenas prompts sintéticos.
5. Confirme `0.3.3` no popup e `adapter_version=0.3.2-network` em interações novas. A 0.3.3 melhora o diagnóstico de sondas ausentes, sem alterar o adapter ou a política.
6. Após um prompt, consulte no popup **Entregas recentes** e **Sonda de rede (somente local)**. Os eventos `observer: capture:started`, `answer_found`, `finalizing` e `delivery_error` localizam a etapa da captura sem armazenar texto. `network_capture: matched_dom; network_candidate_selected` indica que o candidato de rede coincidiu e foi escolhido para a mesma resposta enviada ao endpoint local. `dom_fallback` indica que ele divergiu ou não foi reconhecido. Confirme a persistência pelo evento `response: confirmed:...` e pela consulta local.

## Limites e diagnóstico

A sonda guarda localmente somente metadados sanitizados e até 100 eventos na sessão. Não guarda corpos de requisição, headers de autenticação, cookies, prompts, respostas, URL completa nem query string nos diagnósticos. A resposta persistida pelo observador é o snapshot normal da interação no backend local; habilitar essa captura grava texto de interação sintético no SQLite local conforme o fluxo já existente.

O experimento não demonstra que o protocolo interno do ChatGPT é estável nem que um candidato de rede pode ser usado sem comparação com o DOM. Formatos não reconhecidos, stream sem `[DONE]`, texto não final, stream truncado, divergência ou ambiguidade caem para o DOM. Retestar em navegador real é obrigatório; a suíte automatizada não equivale a QA independente.

Execute `npm.cmd test` nesta pasta para verificar os testes locais de bloqueio, stream, comparação com DOM e fallback.
