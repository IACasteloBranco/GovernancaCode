# Evidências da Fase 3 do painel de analytics

## Escopo

A Fase 3 aplicou ao painel a paleta azul-marinho e dourada, o cabeçalho com as marcas, o título em bloco arredondado, os títulos de seção numerados, as divisórias finas e o rodapé discreto da referência visual. A página continua estática em `analytics/index.html`.

O JavaScript, os endpoints, os campos do resumo e o fluxo de autenticação não mudaram. A interface continua exibindo apenas agregados.

## Escolha visual

A proposta A manteve o bloco de título azul-marinho do documento de referência. A proposta B usou título claro para reduzir o espaço antes dos totais. O avaliador independente atribuiu 28/30 à A e 25/30 à B.

A proposta A venceu em aderência visual, responsividade e acesso por teclado. O primeiro rascunho já usava o bloco azul-marinho do plano. Depois da comparação, mantive essa composição e incorporei os controles de 44 px, o foco visível e as regiões de tabela acessíveis pelo teclado.

## Verificações

- **PASS**. Chrome com sessão sintética `operador.sintetico@example.test` carregou os quatro totais `12`, `9`, `3` e `2`, um departamento sintético e uma pessoa sintética.
- **PASS**. O filtro de 1 a 4 de outubro de 2026 enviou `from=2026-10-01T03:00:00.000Z` e `to=2026-10-05T03:00:00.000Z`. O limite superior exclusivo preserva o dia final no fuso `America/Sao_Paulo`.
- **PASS**. Os estados de lista vazia, erro da API, login necessário e carregamento foram conferidos com respostas sintéticas. O logout limpou os totais e as tabelas.
- **PASS**. Em 320 px, `documentElement.scrollWidth` e `clientWidth` foram ambos 305 px. Em desktop, a página usou quatro colunas para os totais e duas para as tabelas. O Chrome não mostrou rolagem horizontal da página.
- **PASS**. A navegação por Tab chegou à região da tabela de departamentos. O foco usou o contorno `#805c16`.
- **PASS**. O contraste calculado foi 6,07:1 para o foco em branco, 8,01:1 para o dourado claro sobre marinho, 13,67:1 para branco sobre marinho, 5,40:1 para texto secundário em branco, 8,71:1 para erro e 7,79:1 para sucesso. O texto de carregamento ficou em 10,08:1.
- **PASS**. As capturas de desktop e de 320 px foram geradas e inspecionadas no Chrome durante a validação. O driver do navegador entregou as imagens inline, sem caminho para exportá-las ao workspace. Este relatório registra as medidas e os estados observados.
- **PASS**. A página executou o JavaScript sem erros de console durante os fluxos exercitados. A chamada real ao OAuth Google não foi iniciada.
- **PASS**. `git diff --check` encerrou com código 0. O comando relatou arquivos temporários protegidos fora dos arquivos desta fase.
- **PASS**. `graphify update .` atualizou o grafo para 1.260 nós e 2.091 relações. O Graphify ignorou pastas temporárias protegidas e usou extração sequencial.

## Limites

- **NOT_TESTED**. Login OAuth real, domínio HTTPS e implantação no Google Cloud.
- **NOT_TESTED**. Uso com dados reais. A validação usou somente valores sintéticos.
- **NOT_TESTED**. Reutilização dos símbolos gráficos originais. O cabeçalho usa nomes de marca e elementos CSS, sem adicionar imagens ou dependências.

## Resultado

Fase 3 **PASS** para implementação e validação visual local com dados sintéticos. A Fase 4 ainda precisa configurar e validar o ambiente autorizado do Google Cloud.
