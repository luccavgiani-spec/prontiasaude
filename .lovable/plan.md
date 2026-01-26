
# Plano: Correção do Roteamento Split-Brain no mp-webhook

## Diagnóstico Confirmado

### Problema Principal: O mp-webhook invoca schedule-redirect no projeto ERRADO

Na linha 1426-1429 do `mp-webhook`:
```typescript
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,  // ← APONTA PARA PROJETO ERRADO
  Deno.env.get('SUPABASE_ANON_KEY')!
);
```

E depois:
```typescript
await supabase.functions.invoke('schedule-redirect', {...});  // ← INVOCA NO PROJETO ERRADO
```

**Consequência**: 
- O webhook está invocando `schedule-redirect` no projeto Lovable Cloud (yrsjluhhnhxogdgnbnya)
- Esse projeto pode não ter os mesmos secrets (CLICKLIFE_AUTH_TOKEN) ou dados (admin_settings com override)
- Por isso o override ClickLife não funciona e os appointments não são criados

### Evidência dos Dados

| Hora (Brasília) | Paciente | Appointment | Provider |
|-----------------|----------|-------------|----------|
| 17:05 | htapris26 | Criado | clicklife |
| 17:17 | thiara | NÃO criado | NULL |
| 17:40 | ronielly | NÃO criado | NULL |
| 17:50 | lidiane | NÃO criado | NULL |
| 18:09 | samuel | NÃO criado | NULL |
| 18:09 | beth | NÃO criado | NULL |

A manutenção do Supabase (iniciada às 10:30 UTC) pode ter causado inconsistências nas variáveis de ambiente, mas o problema estrutural é o uso de `SUPABASE_URL` que pode apontar para diferentes projetos.

---

## Correção Necessária

### Alterar mp-webhook para usar URL FIXA

**Arquivo**: `supabase/functions/mp-webhook/index.ts`

#### Correção 1: Definir constantes fixas no topo do arquivo

Adicionar após linha 4:
```typescript
// ✅ URL FIXA do projeto original - NÃO usar Deno.env.get('SUPABASE_URL')
const ORIGINAL_SUPABASE_URL = 'https://ploqujuhpwutpcibedbr.supabase.co';
const ORIGINAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3F1anVocHd1dHBjaWJlZGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NjYxODQsImV4cCI6MjA3MjM0MjE4NH0.WD3MXt1Y4sYxkaCPGgD0s8LdhPx_7eEQ1ewaFhnQ8-I';
```

#### Correção 2: Substituir `supabase.functions.invoke` por fetch direto

Linhas 1623-1641: Alterar de:
```typescript
const result = await supabase.functions.invoke('schedule-redirect', {
  body: {...}
});
```

Para:
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
    body: JSON.stringify({
      cpf: schedulePayload.cpf,
      email: schedulePayload.email,
      nome: schedulePayload.nome,
      telefone: schedulePayload.telefone,
      sexo: schedulePayload.sexo,
      birth_date: schedulePayload.birth_date,
      especialidade: schedulePayload.especialidade || 'Clínico Geral',
      sku: schedulePayload.sku,
      horario_iso: schedulePayload.horario_iso || new Date().toISOString(),
      plano_ativo: schedulePayload.plano_ativo || false,
      order_id: payment.metadata?.order_id,
      payment_id: payment.id
    })
  }
);

const scheduleData = scheduleResponse.ok ? await scheduleResponse.json() : null;
const scheduleError = scheduleResponse.ok ? null : await scheduleResponse.text();
```

#### Correção 3: Atualizar todas as instâncias de createClient para supabaseAdmin

Substituir todas as instâncias que usam `Deno.env.get('SUPABASE_URL')` para operações de BANCO (não functions) para usar a URL fixa:

Linhas afetadas (todas as ocorrências de createClient):
- Linha 444-447 (supabaseAudit)
- Linha 594-597 
- Linha 654-657
- Linha 1127-1130
- Linha 1432-1435

**Padrão para todas**:
```typescript
const supabaseAdmin = createClient(
  ORIGINAL_SUPABASE_URL,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
```

---

## Fluxo de Teste

1. Deploy das edge functions no projeto original via CLI:
   ```bash
   supabase functions deploy mp-webhook --project-ref ploqujuhpwutpcibedbr
   supabase functions deploy schedule-redirect --project-ref ploqujuhpwutpcibedbr
   supabase functions deploy check-payment-status --project-ref ploqujuhpwutpcibedbr
   ```

2. Fazer uma compra de teste (PIX)
3. Verificar nos logs se:
   - Override foi lido corretamente
   - Appointment foi criado
   - Provider = clicklife

---

## Correção Retroativa das Vendas Órfãs

Após a correção, executar manualmente para as 5 vendas que ficaram sem appointment:

```sql
-- Consulta para verificar vendas órfãs
SELECT pp.order_id, pp.patient_email, pp.sku, pp.created_at
FROM pending_payments pp
LEFT JOIN appointments a ON a.order_id = pp.order_id
WHERE pp.status = 'approved'
  AND a.id IS NULL
  AND pp.created_at > NOW() - INTERVAL '6 hours';
```

Chamar manualmente `reconcile-pending-payments` ou criar appointments via edge function `schedule-redirect` com os dados do payment_data.

---

## Seção Técnica

### Arquivos a Modificar

| Arquivo | Linhas | Alteração |
|---------|--------|-----------|
| supabase/functions/mp-webhook/index.ts | 4-6 | Adicionar constantes ORIGINAL_SUPABASE_URL e ORIGINAL_ANON_KEY |
| supabase/functions/mp-webhook/index.ts | 444-447 | Usar ORIGINAL_SUPABASE_URL no createClient |
| supabase/functions/mp-webhook/index.ts | 594-597 | Usar ORIGINAL_SUPABASE_URL no createClient |
| supabase/functions/mp-webhook/index.ts | 654-657 | Usar ORIGINAL_SUPABASE_URL no createClient |
| supabase/functions/mp-webhook/index.ts | 1127-1130 | Usar ORIGINAL_SUPABASE_URL no createClient |
| supabase/functions/mp-webhook/index.ts | 1426-1429 | Usar ORIGINAL_SUPABASE_URL e ORIGINAL_ANON_KEY |
| supabase/functions/mp-webhook/index.ts | 1432-1435 | Usar ORIGINAL_SUPABASE_URL no createClient |
| supabase/functions/mp-webhook/index.ts | 1623-1641 | Substituir supabase.functions.invoke por fetch direto |

### Impacto

- **Baixo risco**: Apenas altera onde as funções são invocadas, não a lógica
- **Resolve**: Override ClickLife, criação de appointments, provider correto
- **Benefício colateral**: Elimina dependência de variáveis de ambiente que podem mudar

### Sobre a Manutenção do Supabase

A manutenção em andamento (Postgres restart) pode ter exacerbado o problema por:
1. Causar desconexões temporárias
2. Reiniciar pods das edge functions com variáveis de ambiente diferentes

Mas o problema estrutural (usar SUPABASE_URL dinâmico) existia antes e precisa ser corrigido independentemente da manutenção.
