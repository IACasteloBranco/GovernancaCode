# Relatório da Fase 4 do painel de analytics

## Escopo

Preparar um pacote local que leve o backend e o painel `analytics/` juntos para o laboratório. Conferir o estado conhecido dos recursos Cloud em modo somente leitura. Nenhum recurso remoto foi alterado.

## Resultado

**PASS** para o pacote local. `backend/build_analytics_package.py` escreve `reports/analytics-backend-lab.zip` com caminhos que preservam a estrutura do repositório. O backend continua localizando a página pelo caminho `analytics/index.html` relativo a `backend/app/main.py`.

O pacote contém 12 arquivos: os módulos Python em `backend/app/`, `backend/requirements.txt`, `backend/.env.example` e `analytics/index.html`. A lista permitida impede inclusão de arquivos fora desses grupos. O script rejeita links simbólicos, arquivos de exemplo com tokens ou senhas preenchidos, caminhos duplicados, arquivos de destino que substituem fontes e arquivos fora do repositório. Ele valida nomes, CRC e hashes do conteúdo antes da troca atômica do ZIP.

## Verificações locais

| Caso | Resultado | Evidência |
|---|---|---|
| Gerar o pacote duas vezes | PASS | `python backend/build_analytics_package.py` retornou o mesmo SHA-256 nas duas execuções. |
| Conferir a estrutura | PASS | `python -m zipfile -l reports/analytics-backend-lab.zip` mostrou 12 caminhos, incluindo `analytics/index.html` e `backend/app/main.py`. |
| Conteúdo e CRC | PASS | O próprio construtor reabriu o ZIP, validou os CRCs e comparou o conteúdo de cada arquivo com a entrada capturada. |
| Segredos e dados locais | PASS | A lista fechada contém somente código-fonte, dependências, `.env.example` e HTML do painel. Não inclui `.env`, SQLite, testes ou caches. |
| Suíte do backend | NOT_TESTED | A aplicação não mudou nesta fase. Não executei a suíte. |
| Graphify | PASS | `graphify update .` gerou 1.286 nós e 2.154 relações. Pastas temporárias protegidas foram ignoradas e a extração usou modo sequencial. |

SHA-256 do pacote: `dc499fcbeaf8c7c040ad16b055c8c2917ccb5127c2ae550f1759f20db48b8daa`.

## Estado Cloud observado

O Google Cloud Console aberto mostrava a VM `governanca-lab-auth-01` em execução em `us-east1-c`, tipo `e2-micro`, com Debian 12. HTTP e HTTPS apareciam desligados. O disco exibido era o disco de boot padrão de 10 GB; não havia um disco de dados separado na tela consultada. A página de detalhes também mostrava que a VM não tem conta de serviço configurada. Essa consulta foi somente leitura.

O relatório de Billing consultado em 18/10 estava agrupado por produto e mostrava R$0,27 para o período de 1 a 18 de outubro. O detalhamento listava Network Analyzer por R$0,10, Network Topology por R$0,10, Performance Dashboards por R$0,07 e Compute Engine por R$0,00. A página dizia que ainda não havia histórico suficiente para projetar o total mensal. O crédito de avaliação exibido era R$1.779,29.

O resumo experimental do Gemini na mesma página atribuía R$0,41 ao SKU de CPU da VM, valor que não coincide com a linha Compute Engine da tabela. Registrei o total da página e a divergência, sem atribuir os R$0,27 à VM isoladamente. O relatório do ensaio de 17/10 registra uma VPC de laboratório, uma regra de SSH por IAP, um IP fixo e um alerta de orçamento de R$100 mensais. Esse alerta notifica e não interrompe gastos.

## Pendências para continuar

| Caso | Resultado | Evidência ou requisito |
|---|---|---|
| Origem HTTPS aprovada para o painel | NOT_TESTED | Não há domínio ou origem HTTPS definida no plano. HTTP e HTTPS estão desligados na VM. |
| Callback OAuth exato do painel | NOT_TESTED | `GOOGLE_ANALYTICS_REDIRECT_URI` depende da origem HTTPS final e de registro no cliente OAuth. |
| Serviço persistente e proxy TLS | NOT_TESTED | Nenhum serviço público foi iniciado nesta etapa. |
| Consulta de analytics após reinício | NOT_TESTED | O pacote não foi transferido nem iniciado na VM. |
| Acesso restrito à rede aprovada | NOT_TESTED | O plano não identifica a VPN ou a faixa de rede aprovada para o painel. |
| Operador e participantes | POLICY_QUESTION | A configuração depende da confirmação do operador individual e dos vínculos aprovados. Não configurei nem consultei esses valores. |
| Custo observado | PASS | O relatório do Billing mostrou R$0,27 entre 1 e 18 de outubro de 2026. A previsão mensal não estava disponível, e o resumo Gemini divergiu da tabela de produtos. |
| Limite de custo aprovado | POLICY_QUESTION | O alerta de R$100 por mês apenas notifica. O limite aceitável para continuar o laboratório ainda precisa de aprovação humana. |
| Disco, backup e retenção | NOT_TESTED | A tela consultada mostra somente o disco de boot. Retenção de snapshots e backups continua pendente no plano de infraestrutura. |

O [plano de infraestrutura](../docs/plans/PLANO_INFRAESTRUTURA_MVP_GCP.md) mantém a escolha do projeto e da região, o orçamento, a rede de acesso, o grupo de participantes, o backup e a operação sujeitos a confirmação humana. A conta usada no ensaio é chamada `My First Project` no Console e não foi tratada como projeto aprovado para uso permanente.

## Decisão técnica

Comparei um manifesto de caminhos, tamanhos e hashes com uma captura imutável de pares `(caminho no ZIP, bytes)`. O juiz independente recomendou a captura, que evita ler uma fonte outra vez entre o hash e a gravação; mantive as verificações de caminho, link simbólico e alias de saída do outro desenho.

O pacote preserva a raiz do repositório em vez de achatar `backend/app/`. Assim, o serviço poderá iniciar a partir da raiz extraída com `backend.app.main:app`, e `main.py` continuará encontrando `analytics/index.html` sem depender de caminhos específicos da VM. A lista explícita de entradas mantém o pacote pequeno e impede que bancos, segredos locais, relatórios e caches entrem por acidente.

## Próximo passo

Depois de confirmar projeto-alvo, domínio HTTPS, rede permitida e limite de custo, transferir o pacote ao host e configurar o serviço em modo `lab`. Registrar o callback HTTPS exato do painel e, então, validar OAuth, consulta com dados sintéticos e persistência após reinício. Não use dados reais até as decisões de acesso, retenção e backup estarem registradas.
