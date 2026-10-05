# Política inicial de bloqueio de prompts por padrões textuais

**Versão:** 0.1 — 28/09/2026  
**Contexto:** uso corporativo de ferramentas de IA no escritório contábil  
**Escopo desta versão:** texto digitado ou colado no campo de prompt, antes do envio. Arquivos anexados, imagens, áudio, OCR e conteúdo obtido por links ficam fora da inspeção desta versão.

## 1. Objetivo

Impedir o envio acidental de credenciais e de grandes volumes de informações identificáveis de clientes a ferramentas de IA não autorizadas para esse tratamento. A extensão intercepta a tentativa de envio, examina o texto, aplica regras versionadas e informa ao usuário a ação e o motivo. O bloqueio é preventivo; a equipe de governança deve manter um caminho para corrigir falsos positivos e autorizar fluxos necessários ao trabalho.

A simples menção a CPF, CNPJ, DAS, folha ou senha não causa bloqueio. As decisões consideram **padrão detectado, validação, quantidade, contexto e destino**. Regras baseadas em regex são um primeiro filtro, não uma classificação completa de confidencialidade.

## 2. Decisões possíveis

| Decisão | Efeito | Uso inicial |
| --- | --- | --- |
| `BLOCK` | Interrompe o envio e mostra orientação para remover ou mascarar o dado | Segredo confirmado; lote de dados pessoais acima do limite; combinação de dados identificáveis e destino proibido |
| `REVIEW` | Interrompe temporariamente e encaminha para fluxo interno de revisão, se disponível | Evidência relevante, mas inconclusiva; documento marcado como sigiloso; exceção operacional |
| `WARN` | Exibe orientação e permite continuar segundo a política corporativa | CPF único, informação pontual ou baixa confiança |
| `ALLOW` | Permite o envio | Sem regra acionada ou exceção formal aplicável |

Na ausência de um fluxo de revisão implementado, `REVIEW` deve ter uma decisão operacional explícita por categoria; não pode virar aprovação automática silenciosa. Para `BLOCK`, a pessoa deve poder editar o texto e tentar novamente. Uma liberação excepcional exige justificativa e autorização com prazo e escopo.

## 3. Catálogo inicial de regras

Os exemplos de regex abaixo são **candidatos** para implementação. Testar contra textos reais anonimizados, Unicode, quebras de linha e o motor de regex usado pela extensão. Prefixos de tokens devem ser cadastrados conforme as ferramentas efetivamente usadas pela empresa; não presumir que qualquer sequência aleatória seja uma chave.

### R01 — Chave privada em formato PEM

- **Detectar:** delimitadores como `-----BEGIN PRIVATE KEY-----`, `-----BEGIN RSA PRIVATE KEY-----`, `-----BEGIN EC PRIVATE KEY-----` e `-----BEGIN OPENSSH PRIVATE KEY-----`.
- **Expressão ilustrativa:** `-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----` (ignorando maiúsculas/minúsculas).
- **Decisão:** `BLOCK` mesmo que o texto esteja incompleto. Não armazenar o corpo da chave no evento.
- **Observação:** um arquivo `.pfx` anexado não é detectado por esta regra. A palavra “certificado” sozinha também não basta.

### R02 — Token ou segredo com formato conhecido

- **Detectar:** prefixos e formatos documentados dos serviços aprovados, ou cadeias de conexão que contenham usuário e senha.
- **Decisão:** `BLOCK` após confirmar prefixo, alfabeto e comprimento; `REVIEW` para candidato sem formato confiável.
- **Implementação:** manter uma configuração separada por fornecedor, com testes positivos e negativos; nunca copiar valores reais para os testes. Exemplos de nomes de campo: `api_key`, `access_token`, `client_secret`, `authorization: bearer`.

### R03 — Credencial declarada no texto

- **Detectar:** rótulo de credencial seguido de atribuição e valor. Candidato ilustrativo: `\b(?:senha|password|passwd|api[_ -]?key|client[_ -]?secret|access[_ -]?token)\b\s*(?::|=|é)\s*["']?([^\s"',;]{8,})` com flag de caixa indiferente.
- **Confirmar:** valor não é placeholder (`********`, `<SENHA>`, `exemplo`, `teste`, `sua-chave-aqui`), não é apenas uma URL pública ou uma frase de documentação; aplicar critérios específicos ao tipo. Aceitar aspas e espaços com um parser adicional quando necessário.
- **Decisão:** `BLOCK` se a credencial for plausível ou tiver formato conhecido; `REVIEW` se houver dúvida.
- **Não bloquear:** “Como redefinir a senha do e-CAC?” ou “A variável `API_KEY` deve ser configurada”.

### R04 — Códigos de recuperação

- **Detectar:** `código(s) de recuperação`, `backup codes`, `recovery codes` junto de uma lista de códigos com o formato esperado.
- **Decisão:** `BLOCK` quando houver múltiplos códigos plausíveis; `REVIEW` para um código isolado sem contexto suficiente.

### R05 — Lote de CPFs identificáveis

- **Detectar:** candidatos no formato `000.000.000-00` ou 11 dígitos, aceitando separadores usuais.
- **Confirmar:** eliminar pontuação, rejeitar sequências repetidas, validar dígitos verificadores e contar CPFs **distintos**. Limitar a procura por comprimento de texto para evitar custo excessivo.
- **Decisão proposta para piloto:** 1 CPF válido: `WARN`; 2–4 CPFs válidos: `REVIEW`; 5 ou mais CPFs válidos: `BLOCK`. Esses limiares são hipóteses para calibração, não exigência legal.
- **Contexto agravante:** tabela ou várias linhas associando CPF a nome, remuneração, saúde, conta bancária ou outros campos pessoais podem justificar `BLOCK` com menos de 5 registros.
- **Não bloquear:** número inválido, CPF de exemplo inválido ou pergunta genérica sobre validação de CPF.

### R06 — Dados pessoais estruturados em linhas

- **Detectar:** repetição de cabeçalhos ou rótulos como `nome`, `CPF`, `data de nascimento`, `salário`, `conta`, `PIX` e linhas com registros correspondentes.
- **Decisão:** `BLOCK` para conjunto identificável acima do limite aprovado; `REVIEW` se a estrutura for incerta. Contar registros, não apenas palavras-chave.
- **Cuidado:** nomes próprios, valores monetários e a palavra “salário” isolados são sinais fracos. Não bloquear por eles sozinhos.

### R07 — Dados pessoais sensíveis identificáveis

- **Detectar:** combinação de identificador pessoal e informação de saúde, biometria, religião, origem racial ou étnica, vida sexual, opinião política ou filiação sindical. Vocabulário isolado produz apenas um candidato.
- **Decisão:** `BLOCK` quando a combinação for clara e o destino não estiver aprovado; caso ambíguo, `REVIEW`.
- **Cuidado:** regex não entende bem contexto, negação ou citações. Não tratar toda ocorrência da palavra “saúde” como dado sensível de uma pessoa.

### R08 — Marcadores de sigilo em conteúdo extenso

- **Detectar:** `CONFIDENCIAL`, `SIGILOSO`, `USO INTERNO`, `NÃO DISTRIBUIR` associados a texto substancial ou a um modelo documental conhecido.
- **Decisão:** `REVIEW` por padrão. `BLOCK` apenas quando o documento ou o destino estiverem classificados previamente como proibidos.
- **Não bloquear:** “Escreva um aviso de confidencialidade” ou uma única linha de exemplo.

### R09 — Dados de empresa e documentos fiscais

- **Detectar:** CNPJ, inscrições, valores de DAS, SPED, PGDAS-D ou notas fiscais.
- **Decisão:** **não bloquear por padrão**. Combinar com classificação do cliente, volume de registros, conteúdo sigiloso e destino. CNPJ identifica pessoa jurídica e, sozinho, não equivale automaticamente a dado pessoal sensível.
- **Exemplo:** pergunta sobre cálculo do DAS: `ALLOW`; planilha textual de dezenas de clientes com faturamento: `REVIEW` ou `BLOCK`, conforme a política de destino.

## 4. Contexto de destino

Configurar uma lista de ferramentas e ambientes: `aprovado_para_dados_de_cliente`, `aprovado_apenas_para_dados_mascarados` e `não_aprovado`. A mesma detecção pode resultar em ações diferentes conforme o destino e o acordo corporativo aplicável. A lista precisa ser mantida pela governança; a regex não determina as condições contratuais de uma ferramenta.

Para o piloto, aplicar `BLOCK` a segredos em qualquer destino acessado pela extensão. Para dados de clientes, começar com bloqueio de lotes em destinos não aprovados e calibrar as demais decisões com Segurança, Jurídico/Privacidade e operação fiscal.

## 5. Fluxo técnico de decisão

1. Interceptar a tentativa de envio antes da transmissão e identificar o destino. Cobrir clique, Enter e demais formas de submissão previstas pela interface; verificar que a interceptação realmente impede a requisição.
2. Normalizar o texto para análise sem alterar o prompt original: Unicode, espaços, quebras de linha, caracteres invisíveis e variações de caixa. Preservar também uma versão adequada à validação de formatos.
3. Executar detectores específicos, com limites de tamanho e tempo. Regex localiza candidatos; validadores conferem dígitos, comprimento, prefixos, placeholders e contagens.
4. Combinar achados e destino por prioridade: `BLOCK` > `REVIEW` > `WARN` > `ALLOW`. Evitar somar sinais fracos de forma opaca; registrar quais regras determinaram a ação.
5. Mostrar mensagem objetiva: “Envio bloqueado: foi identificada uma possível credencial. Remova-a e tente novamente.” Nunca repetir o valor detectado no pop-up.
6. Registrar evento mínimo: horário, usuário ou identificador corporativo, departamento quando apropriado, destino, versão das regras, IDs acionados, ação, contagens e evidência mascarada ou apenas posição. Não gravar por padrão o prompt integral nem o segredo encontrado.
7. Permitir contestação e acompanhar resultados para ajustar limiares e exceções.

**Falhas:** especificar antes da implantação o comportamento quando a extensão ou o backend estiver indisponível. Para segredos de alta confiança, o desenho recomendado é bloquear e orientar a pessoa a usar o canal interno; para casos ambíguos, aplicar a política de contingência aprovada. A decisão precisa ser visível e auditável.

## 6. Exemplos para testes de aceitação

| Prompt de teste fictício | Resultado esperado | Motivo |
| --- | --- | --- |
| “Como redefinir minha senha no portal?” | `ALLOW` | Palavra isolada, sem valor |
| “Minha senha é `<SENHA>`; explique como alterar” | `ALLOW` ou `WARN` | Placeholder explícito |
| Texto contendo `-----BEGIN PRIVATE KEY-----` | `BLOCK` | Marcador de chave privada |
| “Valide este CPF fictício: 000.000.000-00” | `ALLOW` | Dígitos verificadores inválidos/sequência repetida |
| Texto com cinco CPFs válidos **sintéticos**, distintos | `BLOCK` no destino não aprovado | Lote acima do limiar piloto |
| “Como apurar DAS de uma empresa?” | `ALLOW` | Assunto fiscal sem dado sigiloso |
| “CONFIDENCIAL: crie um título para esta política” | `ALLOW` ou `WARN` | Marcador isolado, sem documento |
| Tabela fictícia com nome, CPF válido e remuneração em várias linhas | `REVIEW` ou `BLOCK` | Dados identificáveis estruturados |

Os casos de teste devem usar dados sintéticos, nunca credenciais ou dados reais. Incluir variações com espaços, quebras de linha, pontuação, acentos, caixa, texto colado e Unicode. Verificar falsos positivos em tarefas comuns do fiscal e falsos negativos por fragmentação de credenciais.

## 7. Limites e próximos passos

Esta versão não inspeciona anexos nem garante detecção de segredos sem formato reconhecível, dados parafraseados, texto em imagens, conteúdo codificado ou campos que a extensão não consiga interceptar. Também não substitui classificação de informação, gestão de acesso, treinamento e regras contratuais com fornecedores de IA.

Antes de ativar bloqueios para todos, definir proprietários das regras, destinos autorizados, limiares de lote, prazo de retenção dos eventos e processo de revisão. Rodar inicialmente em modo de observação com dados minimizados, medir precisão e impacto no trabalho, corrigir regras e então ativar gradualmente os bloqueios de alta confiança.

## Referências de orientação

- ANPD, perguntas frequentes sobre LGPD: https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes
- ANPD, Guia Orientativo sobre Segurança da Informação para Agentes de Tratamento de Pequeno Porte: https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-publica-guia-de-seguranca-para-agentes-de-tratamento-de-pequeno-porte
- OWASP, LLM02:2025 Sensitive Information Disclosure: https://genai.owasp.org/llmrisk/llm022025-sensitive-information-disclosure/
