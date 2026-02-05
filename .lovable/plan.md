
# Plano: Reescrever patient-operations e Eliminar Chamadas ao Cloud

## Diagnóstico Confirmado

### Problema 1: Erro 500 `null value in column "id"`
**Localização:** `supabase/functions/patient-operations/index.ts` linha 2048
**Causa:** O `INSERT` não gera UUID para a coluna `id`:
```ts
.insert({
  user_id,
  email: email || null,
  profile_complete: false
  // ❌ FALTA: id: crypto.randomUUID()
})
```

### Problema 2: Chamadas ao Cloud em vez de Produção
**Localização:** `src/lib/patients.ts` linha 29
```ts
const invokeFunction = environment === 'production' 
  ? invokeEdgeFunction 
  : invokeCloudEdgeFunction;  // ❌ Chama Cloud quando ambiente = 'cloud'
```

O Network confirma: `Sb-Project-Ref: yrsjluhhnhxogdgnbnya` (Cloud)

---

## Arquivos que Serão Modificados

| # | Arquivo | Motivo |
|---|---------|--------|
| 1 | `supabase/functions/patient-operations/index.ts` | Adicionar `id: crypto.randomUUID()` no INSERT |
| 2 | `src/lib/patients.ts` | Forçar **SEMPRE** usar `invokeEdgeFunction` (Produção) |
| 3 | `src/lib/edge-functions.ts` | Adicionar origins do Preview na lista de CORS do header |

---

## Alterações Detalhadas

### 1. patient-operations/index.ts (Backend)

**Linhas 2046-2052** - Adicionar geração explícita de UUID:

```ts
// ANTES
.insert({
  user_id,
  email: email || null,
  profile_complete: false
})

// DEPOIS
.insert({
  id: crypto.randomUUID(),  // ✅ Gerar UUID explicitamente
  user_id,
  email: email || null,
  profile_complete: false
})
```

---

### 2. src/lib/patients.ts (Frontend)

**Objetivo:** Eliminar toda lógica de roteamento Cloud/Produção. SEMPRE chamar Produção.

**Alterações principais:**

```ts
// ANTES (linha 29)
const invokeFunction = environment === 'production' 
  ? invokeEdgeFunction 
  : invokeCloudEdgeFunction;

// DEPOIS - Remover completamente essa lógica
// SEMPRE usar invokeEdgeFunction (que aponta para Produção)
```

**Nova versão simplificada de `ensurePatientRow`:**
```ts
export async function ensurePatientRow(userId: string) {
  console.log('[ensurePatientRow] Chamando PRODUÇÃO para user_id:', userId);
  
  const { session } = await getHybridSession();
  const userEmail = session?.user?.email;
  
  const { data, error } = await invokeEdgeFunction('patient-operations', {
    body: {
      operation: 'ensure_patient',
      user_id: userId,
      email: userEmail
    }
  });
  
  if (error) {
    console.error('[ensurePatientRow] Edge function error:', error);
    throw new Error(error.message || 'Falha ao garantir registro do paciente');
  }
  
  return true;
}
```

**Simplificar `upsertPatientBasic`:**
- Remover parâmetro `environment` do `ensurePatientRow`
- Manter apenas `invokeEdgeFunction` (nunca `invokeCloudEdgeFunction`)
- Manter lógica de `getHybridSession` apenas para obter o `userId` e `email`

---

### 3. src/lib/edge-functions.ts (Frontend)

Adicionar os origins do Preview na lista de headers permitidos (para debug):

```ts
// Linha 57 - Adicionar log do origin para debug
console.log(`[invokeEdgeFunction] target=production function=${functionName} origin=${window?.location?.origin}`);
```

---

## Fluxo Após as Alterações

```text
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO SIMPLIFICADO                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Frontend (Preview/Publicado)                                   │
│       │                                                         │
│       ▼                                                         │
│  src/lib/patients.ts                                            │
│       │                                                         │
│       ▼                                                         │
│  invokeEdgeFunction()  ────────────────────────────────►        │
│       │                                                         │
│       ▼                                                         │
│  https://ploqujuhpwutpcibedbr.supabase.co/functions/v1/         │
│  patient-operations                                             │
│       │                                                         │
│       ▼                                                         │
│  Supabase PRODUÇÃO (banco real)                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Verificação de CORS (já corrigido anteriormente)

O arquivo `patient-operations/index.ts` já tem CORS dinâmico corrigido:
- Linha 14-16: `isLovablePreviewOrigin()` aceita `https://id-preview--*.lovable.app`
- Linha 18-28: `getCorsHeaders()` retorna origin correto baseado na requisição

---

## Passos de Implementação

1. **Atualizar `src/lib/patients.ts`**
   - Remover import de `invokeCloudEdgeFunction`
   - Simplificar `ensurePatientRow` para usar apenas `invokeEdgeFunction`
   - Simplificar `upsertPatientBasic` para usar apenas `invokeEdgeFunction`

2. **Atualizar `supabase/functions/patient-operations/index.ts`**
   - Adicionar `id: crypto.randomUUID()` na linha 2048

3. **Após as alterações:**
   - Copiar o arquivo `patient-operations/index.ts` completo
   - Fazer deploy manual no Supabase Dashboard → Edge Functions → patient-operations
   - Testar edição de perfil na Área do Paciente

---

## Critérios de Sucesso

1. ✅ Network mostra requisições para `ploqujuhpwutpcibedbr` (não `yrsjluhhnhxogdgnbnya`)
2. ✅ Erro 500 `null value in column "id"` desaparece
3. ✅ Edição de perfil salva com sucesso (status 200)
4. ✅ Logs da função aparecem no Supabase Dashboard

---

## Não Será Alterado

- Lógica de autenticação (`auth-hybrid.ts`)
- Integrações ClickLife, Communicare, Mercado Pago
- Regras de redirecionamento (`schedule-redirect`)
- Componentes de UI
- Qualquer outro arquivo não listado acima
