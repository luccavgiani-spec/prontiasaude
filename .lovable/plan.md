
# Correcao: Dois bugs em patient-operations

## Problema 1: `ReferenceError: body is not defined`
- **Linha 2444**: O bloco `catch` referencia `body?.operation`, mas `body` e declarado dentro do `try` (linha 641) e nao e acessivel no `catch`.
- Isso faz o proprio error handler crashar, escondendo o erro real.

## Problema 2: Checagem de "already exists" nao funciona
- **Linha 711**: O codigo faz `authError.message.includes("already exists")` mas a mensagem real do Supabase e `"A user with this email address has already been registered"`.
- Como `"already exists"` nao esta na mensagem, o erro e lancado (throw) ao inves de ser tratado, causando o 500.

## Solucao

### Arquivo: `supabase/functions/patient-operations/index.ts`

**1. Linha 711 - Corrigir a checagem de erro de usuario existente:**

De:
```typescript
if (authError && !authError.message.includes("already exists")) {
```
Para:
```typescript
if (authError && !authError.message.includes("already") && !authError.message.includes("already exists")) {
```

Mais robusto: usar `.includes("already")` que cobre tanto "already exists" quanto "already been registered".

**2. Linhas 2439-2444 - Mover `body` para escopo acessivel ou remover referencia:**

Declarar uma variavel `let operationName` antes do try, e setar ela apos o parse do body. No catch, usar `operationName` ao inves de `body?.operation`.

### Resumo das alteracoes

| Linha | Antes | Depois |
|-------|-------|--------|
| 711 | `!authError.message.includes("already exists")` | `!authError.message.includes("already")` |
| ~639 (antes do try) | (nada) | `let operationName = 'unknown';` |
| ~642 (apos parse body) | (nada) | `operationName = body.operation;` |
| 2444 | `console.error("Operation:", body?.operation);` | `console.error("Operation:", operationName);` |

Nenhum outro arquivo sera alterado.
