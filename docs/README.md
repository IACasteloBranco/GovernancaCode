# Documentação do projeto

Use este índice para localizar guias, planos, referências e registros históricos. As tarefas abertas estão em [TODO.md](../TODO.md).

## Guias

- [Fluxo de trabalho](guide/FLUXO_TRABALHO.md): processo ativo de investigação, implementação e verificação.
- [Guia de implantação do MVP](guide/GUIA_IMPLANTACAO_MVP.md): execução dos componentes do MVP.
- [Roteiro de validação local](guide/ROTEIRO_VALIDACAO_LOCAL_POC_v0.1.md): cenários de validação no navegador.
- [Passo a passo B01/B02](guide/PASSO_A_PASSO_B01_B02_POC_v0.1.md): ensaio de envio por clique e Enter.
- [Índice da extensão ativa](../extension/README.md): pacote e instruções da extensão atual.
- [Guia do backend](../backend/README.md): instalação, configuração e rotas da API.

## Planos

- [Plano de infraestrutura no Google Cloud](plans/PLANO_INFRAESTRUTURA_MVP_GCP.md): hospedagem, controles e etapas do piloto.
- [Plano do painel de analytics](plans/PLANO_FRONTEND_ANALYTICS.md): autenticação, interface e transferência ao Lab.
- [Plano de análise e dados](plans/PLANO_ANALISE_EFETIVIDADE_E_BANCO_INTELIGENCIA.md): lacunas de captura, dados e análise.
- [Decisões de governança do piloto](plans/DECISOES_GOVERNANCA_PILOTO.md): decisões registradas e questões ainda abertas.
- [Controles de privacidade: configuração e operação](plans/CONTROLES_PRIVACIDADE_OPERACAO.md): aceite, acesso, retenção, exclusão e pendências de infraestrutura.
- [Verificação contínua](plans/PLANO_TESTES_CONTINUO.md): critérios e rotina de verificação.
- [Plano inicial do backend](plans/PLANO_IMPLANTACAO_BACKEND_POC_v0.1.md) e [plano inicial da extensão](plans/PLANO_IMPLANTACAO_EXTENSAO_POC_v0.1.md): planos históricos de implementação.

## Referências

- [Especificação da POC](reference/POC_EXTENSAO_BACKEND_GOVERNANCA_IA_v0.1.md): escopo e contratos iniciais.
- [Investigação da captura de rede](reference/POC_REDE_CHATGPT.md): evidências experimentais da sonda.
- [Política de bloqueio de prompts](../policies/politica_bloqueio_prompts_v0_1.md): regras ativas da POC, versão 0.1.

## Histórico

- [Estado registrado em 01/10/2026](archive/ESTADO_ATUAL_2026-10-01.md): estado e instruções daquela data.
- [Relatório do projeto de 28/09/2026](archive/RELATORIO_PROJETO_2026-09-28.md): retrato histórico do projeto.
- [Histórico de captura de Claude e arquivos](archive/CLAUDE_E_ARQUIVOS_2026-10-05.md).
- [Modelo histórico de evidências](archive/REGISTRO_EVIDENCIAS_POC_v0.1.csv).
- `coordination/` e os registros antigos de `qa/` preservam evidências do fluxo anterior.

Os relatórios de execução permanecem em `reports/`.

## Diretórios locais

- `.tmp/` guarda pesquisas e saídas locais de execuções de teste.
- `tmp/` guarda arquivos temporários, como resultados de teste e PDFs extraídos.
- [`obsolete/`](../obsolete/README.md) preserva versões antigas e notas históricas. O backend e a extensão ativos ficam nas pastas da raiz.
- `__pycache__/`, `.pytest_cache/`, `pytest-cache-files-*/` e arquivos `.pyc` são caches gerados pelo Python e pelo pytest. O [`.gitignore` da raiz](../.gitignore) os exclui do Git.

Os diretórios `tmp/` e `.tmp/` não fazem parte do runtime. Os registros em `reports/` podem citar caminhos específicos dentro deles.
