# Desbloqueio do QA da POC de rede 0.3.0

## Estado

`BLOCKED — ambiente sem navegador Chrome/Edge controlável pelo Work`.

O executável do Google Chrome existe no Windows, mas a sessão atual expõe somente o Codex In-app Browser e MCP Apps. A aba do In-app Browser não hospeda extensões carregadas via `chrome://extensions`; recarregar essa aba não confirma nem produz a injeção da POC.

## Procedimento obrigatório para o Work

Executar o reteste em um perfil real do Chrome ou Edge que esteja disponível ao navegador do Work:

1. Abrir `chrome://extensions` no mesmo perfil usado para o teste.
2. Ativar o modo de desenvolvedor.
3. Carregar como extensão sem compactação:
   `C:\Users\eduardo.pires\Repos\Governanca_Code\Extensão\extension-network-poc`
4. Confirmar a versão `0.3.0` e verificar erros da extensão.
5. Abrir `https://chatgpt.com` no mesmo navegador/perfil e recarregar a aba.
6. Abrir o popup dessa extensão a partir dessa aba e confirmar que política e captura estão ativas.
7. Confirmar eventos em `Sonda de rede (somente local)` após um único prompt sintético.
8. Consultar somente a interação criada nessa execução e registrar `adapter_version=0.3.0-network`.

Não enviar prompt no Codex In-app Browser. Se o Work não tiver um Chrome/Edge controlável, manter `BLOCKED` e registrar a limitação; não aprovar a candidata com base apenas na versão exibida no popup.

## Observação de implementação

O popup atual verifica diretamente os scripts isolados de política/observador, mas não expõe um handshake explícito do `network-probe-main.js` no contexto `MAIN`. Após desbloquear o ambiente, o implementador deve considerar um diagnóstico explícito `MAIN probe: active` para evitar ambiguidade futura.
