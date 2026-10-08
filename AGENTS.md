# AGENTS.md — Governança de IA

## 1. Objetivo

Este repositório é operado por três agentes com responsabilidades separadas:

- **Orchestrator — Coordination Agent**: coordena o fluxo, roteia tarefas e consolida estados; não implementa, não testa como aprovador e não altera políticas.
- **Codex — Development Agent**: implementa e mantém a extensão de Governança de IA.
- **Work — QA & Red Team Agent**: valida a extensão em navegador real, registra evidências, executa regressão e tenta contornar os controles de forma controlada.

O princípio central é **separação de funções**: quem desenvolve não aprova sozinho a própria implementação, e o agente que coordena não substitui a validação independente.

---

## 2. Fonte de verdade

A ordem de precedência é:

1. Políticas aprovadas pela empresa em `/policies`
2. Casos de teste aprovados em `/qa`
3. Este `AGENTS.md`
4. Documentação técnica em `/docs`
5. Implementação em `/extension`

Nenhum agente pode alterar uma regra de governança apenas para fazer um teste passar.

Se houver conflito entre implementação e política, a política prevalece.

---

## 3. Estrutura esperada

```text
governanca-ia-extension/
├── extension/
├── policies/
├── tests/
├── qa/
├── reports/
├── coordination/
│   ├── requests/
│   ├── retests/
│   └── status/
├── docs/
├── Agents/
│   ├── orchestrator.md
│   ├── codex.md
│   └── work-qa.md
└── AGENTS.md
```

No Windows, `Agents/` é o diretório de agentes deste repositório. O ZIP de referência permanece dentro dele.

### Responsabilidade por diretório

**Codex**
- `/extension`
- `/tests`
- suporte técnico em `/docs`

**Work**
- `/qa`
- `/reports`
- evidências de execução em `/reports/evidence`

**Compartilhado / controlado**
- `/policies`

Alterações em `/policies` exigem aprovação humana explícita.

**Orchestrator**
- coordenação e registro do ciclo;
- roteamento entre Codex e Work;
- consolidação de relatórios em `/reports`;
- comunicação por artefatos em `/coordination`;
- escalonamento de decisões humanas.

**Canal de comunicação**

As mudanças no repositório são o canal oficial entre os agentes. Use:

- `/coordination/requests/` para tarefas e solicitações de QA;
- `/coordination/retests/` para encaminhamentos de reteste;
- `/coordination/status/` para o estado consolidado dos ciclos;
- `/qa/bugs/` para falhas estruturadas;
- `/qa/results/` para relatórios do Work.

Não considerar uma tarefa encaminhada, corrigida ou aprovada sem o artefato correspondente salvo no repositório.

---

## 4. Regras gerais

### 4.1 Não inventar política

Os agentes não devem decidir autonomamente:
- quais dados são proibidos;
- qual nível de risco deve ser atribuído;
- quando uma exceção deve ser criada;
- quando um bloqueio deve ser removido.

Caso a política seja ambígua, registrar como **POLICY-QUESTION** e solicitar decisão humana.

### 4.2 Evidência obrigatória

Todo bug aberto pelo QA deve conter, quando aplicável:

- ID do teste;
- versão da extensão;
- site testado;
- entrada utilizada;
- resultado esperado;
- resultado observado;
- status;
- severidade;
- passos para reprodução;
- evidência;
- hipótese opcional de causa.

### 4.3 Dados reais

Não usar CPF, senha, token, credencial, chave de API ou outro dado real em testes.

Usar apenas massas sintéticas ou valores explicitamente destinados a teste.

### 4.4 Segurança

Não executar ações destrutivas, excluir dados, enviar credenciais reais ou tentar acessar recursos fora do escopo autorizado.

Red Team significa testar resistência dos controles dentro do ambiente autorizado, não atacar sistemas externos.

---

## 5. Estados de teste

Todo caso deve terminar com um destes estados:

- `PASS`
- `FAIL`
- `BLOCKED`
- `NOT_TESTED`
- `POLICY_QUESTION`

---

## 6. Severidade de bugs

### CRITICAL
O controle falha e permite exposição clara de informação que deveria ser bloqueada, ou a extensão interrompe completamente o fluxo principal.

### HIGH
Falha relevante de bloqueio, captura, classificação, registro ou aplicação da política.

### MEDIUM
Comportamento incorreto com impacto limitado ou contornável.

### LOW
Problema visual, textual ou de usabilidade sem impacto material no controle.

---

## 7. Contrato Work → Orchestrator → Codex

Quando o Work encontrar uma falha, deve produzir um bug estruturado.

Formato:

```text
BUG-ID:
TEST-ID:
EXTENSION-VERSION:
SITE:
CATEGORY:
SEVERITY:

INPUT:
EXPECTED:
OBSERVED:

REPRODUCTION:
1.
2.
3.

EVIDENCE:

NOTES:
```

O Work não deve corrigir o código.

O Orchestrator deve preservar o conteúdo do bug, verificar se a expectativa está fundamentada em política ou caso aprovado e encaminhá-lo ao Codex. Não deve reescrever a expectativa para reduzir a severidade.

## 8. Contrato Codex → Orchestrator → Work

Quando o Codex corrigir uma falha, deve informar:

```text
BUG-ID:
STATUS: READY_FOR_RETEST
CHANGE-SUMMARY:
FILES-CHANGED:
TESTS-ADDED:
RISKS:
RETEST-INSTRUCTIONS:
```

O Codex não deve marcar o bug como aprovado.

O Orchestrator encaminha a correção ao Work para reteste. A aprovação de QA pertence ao Work; decisões de política, aceite de risco e rollout pertencem ao responsável humano.

As transições devem ser registradas nos arquivos de `/coordination/`, e não somente em mensagens de chat.

---

## 9. Fluxo de trabalho

```text
Política aprovada
      ↓
Orchestrator classifica e distribui
      ↓
Codex implementa
      ↓
Codex executa testes automatizados
      ↓
Build/versão testável
      ↓
Orchestrator encaminha para reteste
      ↓
Work instala/carrega a extensão
      ↓
Work executa QA funcional
      ↓
Work executa QA de política
      ↓
Work executa Red Team controlado
      ↓
PASS ───────────────→ relatório de aprovação
FAIL
  ↓
bug estruturado
  ↓
Orchestrator roteia
  ↓
Codex corrige
  ↓
READY_FOR_RETEST
  ↓
Orchestrator encaminha
  ↓
Work retesta
```

---

## 10. Critério de conclusão

Uma versão só deve ser considerada validada quando:

- testes críticos definidos para a versão foram executados;
- não existem falhas CRITICAL abertas;
- falhas HIGH estão resolvidas ou formalmente aceitas;
- casos de regressão relevantes passaram;
- relatório de QA foi gerado;
- versão testada está identificada.

O Orchestrator pode consolidar o ciclo como pronto para decisão, mas não pode substituir o `PASS` do Work nem a decisão humana exigida para política, risco ou rollout.

---

## 11. Princípio de governança

A extensão é um mecanismo de aplicação de política, não a própria política.

Desenvolvimento, teste e decisão de governança devem permanecer separados.
