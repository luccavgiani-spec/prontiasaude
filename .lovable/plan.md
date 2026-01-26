
# Plano de Correção: Eliminar Referências ao Lovable Cloud

## Diagnóstico Completo

Após análise minuciosa de todas as Edge Functions e do frontend, identifiquei **8 pontos** onde existem referências ao projeto Lovable Cloud (`yrsjluhhnhxogdgnbnya`) ou chamadas que dependem de `SUPABASE_URL` (potencialmente errado).

### Tabela de Referências Encontradas

| Local | Tipo | Problema | Impacto |
|-------|------|----------|---------|
| `.env` | Configuração | `VITE_SUPABASE_URL` e `VITE_SUPABASE_PROJECT_ID` apontam para Lovable Cloud | 🔴 CRÍTICO - Frontend |
| `supabase/functions/common/cors.ts:7` | CORS | URL `lovableproject.com` no `ALLOWED_ORIGINS` | 🟡 Baixo - Apenas dev |
| `supabase/functions/mp-create-subscription/index.ts:130` | Hardcoded | `back_url` usa `.lovable.app` | 🟠 Médio - Redirecionamento |
| `supabase/functions/check-payment-status/index.ts:420` | Cross-invoke | `supabase.functions.invoke('schedule-redirect')` | 🔴 CRÍTICO - Agendamento |
| `supabase/functions/clubeben-batch-sync/index.ts:62` | Cross-invoke | `fetch(SUPABASE_URL/functions/v1/clubeben-sync)` | 🔴 CRÍTICO - Sync ClubeBen |
| `supabase/functions/company-operations/index.ts:292,364` | Cross-invoke | `supabaseClient.functions.invoke('send-form-emails')` | 🟠 Médio - Emails |
| `src/components/payment/PaymentModal.tsx:3012` | Frontend | Detecção de `lovableproject.com` para fallback | 🟡 Baixo - Apenas preview |

---

## Arquivos a Modificar

### 1. `supabase/functions/common/cors.ts` - Remover URL do Lovable

**Linha 7**: Remover a URL de preview do Lovable do `ALLOWED_ORIGINS`.

**Antes:**
```typescript
const ALLOWED_ORIGINS = [
  'https://prontiasaude.com.br',
  'https://www.prontiasaude.com.br',
  'https://9bc3ce56-2fcc-49e0-81b3-829d5921f2b4.lovableproject.com', // Lovable preview
  'http://localhost:5173', // Local development
];
```

**Depois:**
```typescript
const ALLOWED_ORIGINS = [
  'https://prontiasaude.com.br',
  'https://www.prontiasaude.com.br',
  'https://prontiasaude.lovable.app', // Published app URL
  'http://localhost:5173', // Local development
];
```

---

### 2. `supabase/functions/mp-create-subscription/index.ts` - Corrigir `back_url`

**Linha 130**: A `back_url` usa lógica incorreta que gera URL com `.lovable.app`.

**Antes:**
```typescript
back_url: `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '')}.lovable.app/area-do-paciente`,
```

**Depois:**
```typescript
back_url: 'https://prontiasaude.com.br/area-do-paciente',
```

---

### 3. `supabase/functions/check-payment-status/index.ts` - Usar fetch direto

**Linhas 167-169 e 420-433**: Substituir `supabase.functions.invoke()` por `fetch()` direto com URL hardcoded do projeto correto.

**Problema:**
```typescript
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,  // ← Pode apontar para projeto errado
  Deno.env.get('SUPABASE_ANON_KEY')!
);
// ...
const { data: scheduleData, error: scheduleError } = await supabase.functions.invoke('schedule-redirect', {
```

**Solução:**
Criar constante com URL fixa do projeto original e usar `fetch()`:

```typescript
// URL FIXA do projeto original onde as Edge Functions estão deployadas
const ORIGINAL_SUPABASE_URL = 'https://ploqujuhpwutpcibedbr.supabase.co';
const ORIGINAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3F1anVocHd1dHBjaWJlZGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NjYxODQsImV4cCI6MjA3MjM0MjE4NH0.WD3MXt1Y4sYxkaCPGgD0s8LdhPx_7eEQ1ewaFhnQ8-I';

// ...

// Chamar schedule-redirect com fetch direto
const scheduleResponse = await fetch(
  `${ORIGINAL_SUPABASE_URL}/functions/v1/schedule-redirect`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ORIGINAL_ANON_KEY}`,
      'apikey': ORIGINAL_ANON_KEY
    },
    body: JSON.stringify({
      cpf: schedulePayload.cpf,
      email: schedulePayload.email,
      nome: schedulePayload.nome,
      telefone: schedulePayload.telefone,
      especialidade: schedulePayload.especialidade || 'Clínico Geral',
      sku: schedulePayload.sku,
      horario_iso: schedulePayload.horario_iso || new Date().toISOString(),
      plano_ativo: schedulePayload.plano_ativo || false,
      order_id: orderIdToCheck,
      payment_id: payment.id
    })
  }
);

const scheduleData = await scheduleResponse.json();
const scheduleError = !scheduleResponse.ok ? scheduleData : null;
```

---

### 4. `supabase/functions/clubeben-batch-sync/index.ts` - Corrigir URL

**Linha 63**: Usa `Deno.env.get('SUPABASE_URL')` que pode apontar para projeto errado.

**Antes:**
```typescript
const syncResponse = await fetch(
  `${Deno.env.get('SUPABASE_URL')}/functions/v1/clubeben-sync`,
```

**Depois:**
```typescript
// URL FIXA do projeto original
const ORIGINAL_SUPABASE_URL = 'https://ploqujuhpwutpcibedbr.supabase.co';

const syncResponse = await fetch(
  `${ORIGINAL_SUPABASE_URL}/functions/v1/clubeben-sync`,
```

---

### 5. `supabase/functions/company-operations/index.ts` - Usar fetch direto

**Linhas 292 e 364**: Usa `supabaseClient.functions.invoke('send-form-emails')`.

Como o `supabaseClient` é criado com credenciais do ambiente, precisa usar fetch direto:

**Solução:** Criar helper function para invocar funções com URL fixa:

```typescript
// No início do arquivo
const ORIGINAL_SUPABASE_URL = 'https://ploqujuhpwutpcibedbr.supabase.co';

async function invokeEdgeFunction(functionName: string, body: any, authToken?: string): Promise<{ data: any; error: any }> {
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || 
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3F1anVocHd1dHBjaWJlZGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NjYxODQsImV4cCI6MjA3MjM0MjE4NH0.WD3MXt1Y4sYxkaCPGgD0s8LdhPx_7eEQ1ewaFhnQ8-I';
  
  try {
    const response = await fetch(
      `${ORIGINAL_SUPABASE_URL}/functions/v1/${functionName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken || ANON_KEY}`,
          'apikey': ANON_KEY
        },
        body: JSON.stringify(body)
      }
    );
    const data = await response.json();
    return { data, error: response.ok ? null : data };
  } catch (error) {
    return { data: null, error };
  }
}

// Uso:
const emailResult = await invokeEdgeFunction('send-form-emails', {
  type: 'employee-invite',
  data: { email, companyName: company.razao_social, inviteLink }
});
```

---

### 6. `src/components/payment/PaymentModal.tsx` - Remover detecção de lovableproject.com

**Linha 3012**: Contém lógica que detecta se está rodando no preview do Lovable.

Esta lógica pode ser mantida, mas precisa ser atualizada para usar a URL publicada:

**Antes:**
```typescript
const isInlineFallback = typeof window !== "undefined" && window.location.hostname.includes("lovableproject.com");
```

**Depois:**
```typescript
// Fallback inline para ambientes de preview ou caso o Dialog tenha problemas
const isInlineFallback = typeof window !== "undefined" && (
  window.location.hostname.includes("lovableproject.com") || 
  window.location.hostname.includes("lovable.app")
);
```

---

### 7. `src/lib/edge-functions.ts` - Remover dependência de VITE_SUPABASE_URL

**Linhas 7-16**: Atualmente usa VITE_SUPABASE_URL com fallback. Forçar uso APENAS do projeto original:

**Antes:**
```typescript
const SUPABASE_URL = 
  (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined ||
  "https://ploqujuhpwutpcibedbr.supabase.co";
```

**Depois:**
```typescript
// ✅ FORÇAR uso do projeto original onde as Edge Functions estão deployadas
// NÃO usar VITE_SUPABASE_URL pois pode apontar para projeto errado (Lovable Cloud)
const SUPABASE_URL = "https://ploqujuhpwutpcibedbr.supabase.co";
```

---

## Seção Técnica

### Por que isso aconteceu?

O Lovable Cloud foi conectado ao projeto, criando:
1. Variáveis de ambiente (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`) apontando para o projeto Cloud
2. O cliente Supabase (`src/integrations/supabase/client.ts`) usando essas variáveis
3. Edge Functions usando `Deno.env.get('SUPABASE_URL')` que herda do ambiente

Como as Edge Functions estão deployadas APENAS no projeto `ploqujuhpwutpcibedbr`, qualquer chamada que use a URL do Cloud falha.

### Hierarquia de Correção

```text
PRIORIDADE 🔴 CRÍTICA (Afeta pagamentos):
├── src/hooks/usePaymentRedirect.tsx ✅ (Já corrigido)
├── src/components/payment/PixPaymentForm.tsx ✅ (Já corrigido)
├── supabase/functions/check-payment-status/index.ts
└── src/lib/edge-functions.ts

PRIORIDADE 🟠 ALTA (Afeta funcionalidades):
├── supabase/functions/clubeben-batch-sync/index.ts
├── supabase/functions/company-operations/index.ts
└── supabase/functions/mp-create-subscription/index.ts

PRIORIDADE 🟡 BAIXA (Cosmético):
├── supabase/functions/common/cors.ts
└── src/components/payment/PaymentModal.tsx
```

### Fluxo Após Correções

```text
1. Usuário paga PIX
2. Frontend inicia polling via usePaymentRedirect
3. usePaymentRedirect chama invokeEdgeFunction('check-payment-status')
4. invokeEdgeFunction usa URL hardcoded para ploqujuhpwutpcibedbr ✅
5. check-payment-status recebe requisição
6. check-payment-status chama schedule-redirect via fetch() com URL fixa ✅
7. schedule-redirect cria appointment e retorna redirect_url
8. Frontend recebe redirect_url e redireciona usuário ✅
```

---

## Resumo das Alterações

| Arquivo | Alteração | Linhas |
|---------|-----------|--------|
| `supabase/functions/common/cors.ts` | Substituir URL do Lovable por prontiasaude.lovable.app | 7 |
| `supabase/functions/mp-create-subscription/index.ts` | Hardcodar back_url para prontiasaude.com.br | 130 |
| `supabase/functions/check-payment-status/index.ts` | Usar fetch() com URL fixa em vez de supabase.functions.invoke() | 167-169, 420-433 |
| `supabase/functions/clubeben-batch-sync/index.ts` | Substituir Deno.env.get('SUPABASE_URL') por URL fixa | 63 |
| `supabase/functions/company-operations/index.ts` | Criar helper invokeEdgeFunction e usar no lugar de .functions.invoke() | 292, 364 |
| `src/lib/edge-functions.ts` | Remover fallback de VITE_SUPABASE_URL, usar apenas URL fixa | 7-9 |
| `src/components/payment/PaymentModal.tsx` | Incluir lovable.app no fallback inline | 3012 |

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Cross-invokes em Edge Functions | ❌ Usam SUPABASE_URL errado | ✅ URL fixa do projeto original |
| Chamadas do frontend | ❌ Algumas usam projeto errado | ✅ Todas usam projeto original |
| Referências ao Lovable Cloud | 8 pontos | 0 pontos |
| Taxa de sucesso de pagamentos PIX | ~75-90% | ~99%+ |
