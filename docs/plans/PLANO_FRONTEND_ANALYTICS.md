# Plano do painel de analytics

Este plano adiciona um painel administrativo em `analytics/` e integra a página ao backend atual. O painel mostra somente os dados agregados que a API já expõe. A interface visual final seguirá a referência `Files/ATA_Governanca_IA_Castelo_Branco.pdf`, fornecida pelo responsável.

## Como executar o plano

Conclua cada fase e confira as evidências antes de iniciar a seguinte. Use somente contas e dados sintéticos até que o responsável aprove o uso de dados reais. Não altere políticas nem amplie acesso a texto de prompts ou respostas.

## Fases

### Fase 1. Preparar o backend para o painel

- [x] Confirmar que `GET /v1/admin/analytics/summary` permanece a fonte de dados do painel.
- [x] Implementar uma sessão de painel separada do token de acesso da extensão. Na implantação `lab`, validar a identidade Workspace e restringir o `sub` ao operador configurado.
- [x] Implementar OAuth do painel com `state`, `nonce`, URI de callback exata e validação dos parâmetros antes da troca de código.
- [x] Guardar a sessão em cookie `HttpOnly`, `Secure` em HTTPS, `SameSite=Lax` e com prazo ligado à expiração do token. Não guardar token em `localStorage` nem em JavaScript persistente.
- [x] Expor um endpoint de sessão que devolva apenas o estado de login e o e-mail autorizado, sem retornar o token Google ao navegador.
- [x] Permitir que o painel consulte o resumo usando a sessão validada pelo backend. Preservar os controles atuais de operador e de departamento.
- [x] Adicionar testes para callback inválido, `state` e `nonce`, domínio não autorizado, operador diferente, sessão expirada e consulta agregada sem conteúdo bruto.
- [x] Atualizar `.env.example`, README do backend e guia de implantação com URI de callback, segredo e configurações necessárias.
- [x] Rodar a suíte do backend com dados sintéticos, revisar o diff e atualizar o Graphify.

**Concluído quando:** o backend valida e limita uma sessão do painel sem expor tokens ao JavaScript, e todos os testes do fluxo passam.

**Status em 2026-10-18.** PASS nos testes sintéticos e na revisão do diff. O login real permanece NOT_TESTED até registrar a URI HTTPS do painel no cliente Google e configurar `GOOGLE_ANALYTICS_REDIRECT_URI`. A página estática pertence à Fase 2.
### Fase 2. Criar a primeira versão funcional do painel

- [x] Criar em `analytics/` uma página estática simples servida pelo backend no mesmo host.
- [x] Implementar entrada e saída da conta Workspace usando os endpoints de sessão da Fase 1.
- [x] Exibir totais, atividade por departamento e atividade por colaborador usando apenas `GET /v1/admin/analytics/summary`.
- [x] Permitir filtro por período e mostrar estados de carregamento, lista vazia, sessão expirada e falha da API.
- [x] Manter a interface neutra e funcional. Não tentar inferir o padrão visual final.
- [x] Verificar a página ao vivo com dados sintéticos e cobrir os estados principais em testes.
- [x] Atualizar o relatório de evidências e o Graphify.

**Concluído quando:** o operador sintético entra, consulta o resumo, filtra o período e encerra a sessão; outro usuário não autorizado recebe bloqueio.

**Status em 2026-10-18.** PASS com dados e identidades sintéticos. A página foi conferida no navegador com consulta, filtro de datas, lista vazia, sessão expirada, erro da API e logout. Os testes do backend confirmam a sessão do operador autorizado e o bloqueio de outra identidade. Login com Google real e implantação HTTPS permanecem NOT_TESTED até configurar o cliente OAuth no ambiente `lab`.

### Fase 3. Aplicar o padrão visual da Governança de IA

- [x] Receber e inspecionar a referência visual fornecida pelo responsável.
- [x] Traduzir cores, tipografia, espaçamento, componentes e comportamento responsivo para a página existente.
- [x] Preservar navegação por teclado, rótulos acessíveis, contraste e estados de erro e carregamento.
- [x] Revisar a página em navegador com os cenários sintéticos da Fase 2.
- [x] Registrar capturas e evidências da validação visual em `reports/2026-10-18-analytics-dashboard-phase3.md`.

**Concluído quando:** a página segue a referência fornecida e os fluxos validados na Fase 2 continuam funcionando.

**Referência recebida em 2026-10-18.** A inspeção visual identificou azul-marinho e dourado como cores de destaque, cabeçalho com as duas marcas, títulos de seção numerados em blocos, divisórias finas, cantos arredondados, tipografia sem serifa e rodapé discreto. A página da Fase 2 recebeu esses elementos sem mudar o fluxo de dados ou autenticação. O conteúdo da ata não será usado como dado do painel.

**Status em 2026-10-18.** PASS em desktop e em viewports de 375 px e 320 px com sessão e dados sintéticos. Totais, agrupamentos, filtro por período, estados vazio, erro, login necessário, carregamento e logout foram conferidos no navegador. O teste de teclado chegou à região rolável da tabela com foco visível. OAuth real e implantação no Google Cloud permanecem NOT_TESTED.

### Fase 4. Preparar a transferência para Google Cloud

- [x] Incluir `analytics/` no pacote de implantação do backend sem copiar dados locais, segredos ou arquivos temporários.
- [ ] Configurar no ambiente de laboratório a origem HTTPS e o callback OAuth exato do painel.
- [ ] Validar acesso pela rede aprovada, certificado TLS, cookie seguro e bloqueio de usuários fora do escopo.
- [ ] Fazer uma consulta com dados sintéticos após reiniciar o serviço.
- [x] Registrar custos observados e limitações do ambiente.

**Concluído quando:** o painel responde no host de laboratório autorizado e mantém autenticação, escopo e consulta após reinício. A implantação em produção continua sujeita às decisões humanas de acesso, retenção, backup e custo.

**Status em 2026-10-18.** O pacote local passou na validação e inclui `analytics/index.html`; o SHA-256 e o inventário estão no [relatório da Fase 4](../../reports/2026-10-18-analytics-dashboard-phase4.md). A consulta somente leitura no Cloud Console mostrou a VM do ensaio em execução, com HTTP e HTTPS desligados, e R$0,27 no relatório do Billing de 1 a 18 de outubro. A previsão de custo ainda não está disponível. A origem pública HTTPS, o callback do painel, o serviço persistente e a consulta após reinício permanecem NOT_TESTED. O limite de custo, o projeto-alvo, a rede autorizada, os participantes e a operação ainda dependem de decisão humana. Nenhum recurso Cloud foi alterado nesta etapa.

## Arquitetura escolhida

O backend serve os arquivos do painel no mesmo host da API. O navegador inicia OAuth com Google e retorna a um callback do painel. O backend valida `state`, `nonce`, domínio e `sub` do operador. O backend guarda a sessão em cookie protegido e encaminha as consultas ao endpoint agregado. O endpoint atual continua limitando os registros ao departamento autorizado no modo `lab`.

Essa escolha evita CORS e não cria outro serviço ou banco. A autenticação da extensão permanece separada. O painel não recebe nem persiste o ID token Google em JavaScript.

## Dependências entre fases

```text
Fase 1: autenticação e entrega da página pelo backend
  -> Fase 2: painel funcional com o endpoint agregado
    -> Fase 3: aplicação da referência visual
      -> Fase 4: transferência e validação no Google Cloud
```

## Limites e decisões humanas

- O fluxo OAuth da extensão usa um redirect URI `chromiumapp.org`; o painel precisa de seu próprio callback registrado no Google.
- A URI pública do painel depende do domínio HTTPS que será definido para o laboratório.
- O escopo inicial mostra apenas agregados. Acesso a prompt e resposta não faz parte do painel.
- A liberação para dados reais, a política de retenção, backup e a autorização de operadores continuam sob decisão do responsável.
- O plano não modifica `policies/` nem declara aprovação de risco ou rollout.
