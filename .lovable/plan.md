
# Plano de Correção: Split-Brain nas Edge Functions

## Resumo Executivo

Após análise detalhada do código, identifiquei que **duas edge functions ainda usam `Deno.env.get('SUPABASE_URL')`** em vez da URL fixa do projeto original, o que causa o problema de "split-brain" onde as funções podem tentar se conectar ao projeto Lovable Cloud errado.

## Problemas Identificados

### 1. `check-payment-status/index.ts` (Parcialmente Corrigido)

**Linhas 172-180** - Os clientes Supabase internos usam URL dinâmica:
```typescript
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,  // ❌ ERRADO
  Deno.env.get('SUPABASE_ANON_KEY')!
);

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,  // ❌ ERRADO
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
```

### 2. `reconcile-pending-payments/index.ts` (Não Corrigido)

**Linhas 49-52** - Cliente Supabase principal:
```typescript
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,  // ❌ ERRADO
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
```

**Linhas 398-399** - Chamada para schedule-redirect:
```typescript
const scheduleResponse = await fetch(
  `${Deno.env.get('SUPABASE_URL')}/functions/v1/schedule-redirect`,  // ❌ ERRADO
```

## Correções Necessárias

### Correção 1: `check-payment-status/index.ts`

Alterar linhas 172-180 para usar a URL fixa já definida no topo do arquivo:

```typescript
const supabase = createClient(
  ORIGINAL_SUPABASE_URL,
  ORIGINAL_ANON_KEY
);

const supabaseAdmin = createClient(
  ORIGINAL_SUPABASE_URL,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
```

### Correção 2: `reconcile-pending-payments/index.ts`

**Passo 1** - Adicionar constantes fixas no topo (após linha 2):
```typescript
// URL FIXA do projeto original para evitar split-brain
const ORIGINAL_SUPABASE_URL = 'https://ploqujuhpwutpcibedbr.supabase.co';
const ORIGINAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3F1anVocHd1dHBjaWJlZGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NjYxODQsImV4cCI6MjA3MjM0MjE4NH0.WD3MXt1Y4sYxkaCPGgD0s8LdhPx_7eEQ1ewaFhnQ8-I';
```

**Passo 2** - Alterar linha 49-52:
```typescript
const supabase = createClient(
  ORIGINAL_SUPABASE_URL,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
```

**Passo 3** - Alterar linhas 398-408:
```typescript
const scheduleResponse = await fetch(
  `${ORIGINAL_SUPABASE_URL}/functions/v1/schedule-redirect`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ORIGINAL_ANON_KEY}`,
      'apikey': ORIGINAL_ANON_KEY
    },
    body: JSON.stringify(enrichedPayload)
  }
);
```

## Vendas Órfãs para Reprocessar

Após a correção, será necessário reprocessar 5 vendas que ficaram sem appointment:

| Paciente | Email | SKU | Data |
|----------|-------|-----|------|
| Beth | bethaguiar1@hotmail.com | ITC6534 | 26/01 21:09 |
| Samuel | samuellopodeamaral@gmail.com | QOP1101 | 26/01 21:09 |
| Lidiane | decastroandradelidiane@gmail.com | ITC6534 | 26/01 20:50 |
| Ronielly | roniellycostapereira@gmail.com | ITC6534 | 26/01 20:40 |
| Thiara | thiaraferreiraasilva300@gmail.com | ITC6534 | 26/01 20:17 |

## Fluxo de Implementação

1. **Aplicar correções** nos dois arquivos
2. **Deploy automático** via Lovable (agora conectado ao Supabase correto)
3. **Executar reconciliação** para as vendas órfãs
4. **Verificar logs** do `schedule-redirect` para confirmar que o override ClickLife está funcionando

## Seção Técnica

### Arquivos a Modificar

| Arquivo | Linhas | Alteração |
|---------|--------|-----------|
| `supabase/functions/check-payment-status/index.ts` | 172-180 | Substituir `Deno.env.get('SUPABASE_URL')` por `ORIGINAL_SUPABASE_URL` |
| `supabase/functions/reconcile-pending-payments/index.ts` | 2-3 | Adicionar constantes `ORIGINAL_SUPABASE_URL` e `ORIGINAL_ANON_KEY` |
| `supabase/functions/reconcile-pending-payments/index.ts` | 49-52 | Usar `ORIGINAL_SUPABASE_URL` no createClient |
| `supabase/functions/reconcile-pending-payments/index.ts` | 398-408 | Substituir URL dinâmica por `ORIGINAL_SUPABASE_URL` e headers corretos |

### Impacto

- **Baixo risco**: Apenas altera URLs de conexão
- **Resolve**: Split-brain que causava falhas no processamento
- **Benefício**: Todas as funções apontarão consistentemente para o projeto correto

### Nota sobre Deploy

Com a conexão ao Lovable Cloud desabilitada e apenas o Supabase conectado, as edge functions serão deployadas automaticamente para o projeto `ploqujuhpwutpcibedbr` quando você aprovar este plano.
