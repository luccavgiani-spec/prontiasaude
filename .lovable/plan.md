
# Plano: Corrigir Split-Brain na Edge Function mp-create-payment

## Problema Identificado

A edge function `mp-create-payment` está usando `Deno.env.get('SUPABASE_URL')` para criar o cliente Supabase, o que pode apontar para o projeto errado dependendo de como os secrets estão configurados.

### Código Atual (Problemático)

```typescript
// Linha 134-137 de mp-create-payment/index.ts
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',      // ❌ Pode ser Lovable Cloud!
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);
```

### Código Correto (mp-create-subscription como referência)

```typescript
// mp-create-subscription usa URL FIXA:
const ORIGINAL_SUPABASE_URL = 'https://ploqujuhpwutpcibedbr.supabase.co';
const ORIGINAL_SERVICE_ROLE_KEY = Deno.env.get('ORIGINAL_SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAdmin = createClient(ORIGINAL_SUPABASE_URL, ORIGINAL_SERVICE_ROLE_KEY);
```

---

## Correções Necessárias

### Correção 1: Adicionar URL fixa do Supabase original

**Arquivo:** `supabase/functions/mp-create-payment/index.ts`

Após a linha 33 (após os comentários CORS), adicionar:

```typescript
// ✅ URL FIXA do projeto original - NÃO usar Deno.env.get('SUPABASE_URL')
// Isso evita o problema de split-brain onde a função roda em um projeto diferente
const ORIGINAL_SUPABASE_URL = 'https://ploqujuhpwutpcibedbr.supabase.co';
```

### Correção 2: Usar URL e KEY fixa no createClient

**Arquivo:** `supabase/functions/mp-create-payment/index.ts`

Modificar linhas 134-137:

```typescript
// DE (atual):
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// PARA (correto):
const ORIGINAL_SERVICE_ROLE_KEY = Deno.env.get('ORIGINAL_SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAdmin = createClient(
  ORIGINAL_SUPABASE_URL,
  ORIGINAL_SERVICE_ROLE_KEY
);
```

---

## Resumo das Alterações

| Arquivo | Linha | Alteração |
|---------|-------|-----------|
| mp-create-payment/index.ts | ~34 | Adicionar constante `ORIGINAL_SUPABASE_URL` |
| mp-create-payment/index.ts | 134-137 | Usar URL e KEY fixa no `createClient` |

---

## Resultado Esperado

Após a correção:
- A edge function buscará serviços no banco de dados correto (ploqujuhpwutpcibedbr)
- O SKU ITC6534 será encontrado com `active = true`
- Pagamentos PIX e Cartão funcionarão corretamente

---

## IMPORTANTE: Deploy Manual

Após eu fazer a alteração no código aqui:
1. Copie o código completo da edge function
2. Deploy manualmente no Dashboard do Supabase de Produção
3. Teste novamente a geração de PIX
