

# Plano de Correção: Painel Admin - Vendas e Relatórios

## Diagnóstico Confirmado

Após análise detalhada dos logs de rede, banco de dados e código, identifiquei **2 problemas paralelos**:

### Problema 1: Cache do PostgREST Desatualizado

O PostgREST do Supabase está cacheando o schema antigo da tabela `pending_payments`:

| Coluna no Banco (Real) | PostgREST Retorna (Cache) |
|------------------------|---------------------------|
| `patient_email` | `email` |
| `amount` | `amount_cents` |

**Evidência**: Query com `select=*` retorna Status 200 com colunas antigas, mas query com `select=amount` retorna erro 400 "column does not exist".

### Problema 2: Código Usando Colunas Inexistentes

O `ReportsTab.tsx` está fazendo queries com colunas que o PostgREST não reconhece:

| Query no Código | Problema |
|-----------------|----------|
| `select('...amount, patient_email')` | PostgREST conhece `amount_cents` e `email` |
| `select('...activated_by, email')` | Erro: `column patient_plans.activated_by does not exist` |

---

## Solução em 2 Etapas

### Etapa 1: Forçar Reload do Schema (Produção)

Execute estes comandos no **Dashboard Supabase de Produção > SQL Editor**:

```sql
-- Passo 1: Aguardar transações pendentes
SELECT pg_sleep(2);

-- Passo 2: Re-grant para invalidar cache
GRANT SELECT ON public.pending_payments TO anon;
GRANT SELECT ON public.patient_plans TO anon;
GRANT SELECT ON public.appointments TO anon;
GRANT SELECT ON public.patients TO anon;

-- Passo 3: Forçar reload
NOTIFY pgrst, 'reload schema';

-- Passo 4: Aguardar propagação
SELECT pg_sleep(3);
```

### Etapa 2: Adaptar Código para Nomes de Colunas do PostgREST

Enquanto o cache não atualiza (ou como solução permanente), ajustar o código para usar os nomes que o PostgREST reconhece:

| Arquivo | Alteração |
|---------|-----------|
| `src/components/admin/ReportsTab.tsx` | Linha 221: Usar `select=*` ao invés de colunas específicas |
| `src/components/admin/ReportsTab.tsx` | Linha 223: Remover `activated_by` da query |

**Código corrigido:**

```typescript
// Linha 220-223 (antes)
supabaseProduction.from('pending_payments')
  .select('id, sku, created_at, status, order_id, amount, patient_email')
  
supabaseProduction.from('patient_plans')
  .select('id, plan_code, created_at, status, activated_by, email')

// Linha 220-223 (depois)
supabaseProduction.from('pending_payments')
  .select('*')  // Usar * para pegar todas as colunas disponíveis
  
supabaseProduction.from('patient_plans')
  .select('id, plan_code, created_at, status, email')  // Remover activated_by
```

Também precisamos adaptar a lógica que usa as colunas para aceitar ambos os nomes:

```typescript
// Na transformação de dados
const email = pp.patient_email || pp.email;
const amount = pp.amount || pp.amount_cents;
```

---

## Arquivos a Modificar

| Arquivo | Operação | Descrição |
|---------|----------|-----------|
| `src/components/admin/ReportsTab.tsx` | Modificar | Corrigir queries e nomes de colunas |
| `src/components/admin/SalesTab.tsx` | Verificar | Já usa `select=*`, mas adaptar nomes de colunas |

---

## Por Que Isso Resolve

1. **`select=*`** evita o erro "column does not exist" porque deixa o PostgREST decidir quais colunas retornar
2. **Fallback de nomes** (`pp.patient_email || pp.email`) garante compatibilidade com cache antigo ou novo
3. **Re-grant + NOTIFY** força o PostgREST a revalidar o schema

---

## Fluxo Técnico

```text
ANTES (quebrado):
Frontend → Query com 'amount' → PostgREST (cache: 'amount_cents') → Erro 400

DEPOIS (funcionando):
Frontend → Query com '*' → PostgREST retorna 'amount_cents' 
                         → Código usa fallback (amount || amount_cents)
                         → Dados exibidos corretamente
```

---

## Ordem de Implementação

1. Você executa os comandos SQL na Produção (Etapa 1)
2. Eu modifico `ReportsTab.tsx` e `SalesTab.tsx` para usar fallbacks (Etapa 2)
3. Testamos se as 248 vendas aparecem corretamente

---

## Resumo Técnico

- **Problema**: PostgREST cacheou schema antigo com colunas renomeadas
- **Causa raiz**: Migrações de rename de colunas não propagaram para o cache da API REST
- **Solução**: Adaptar código para ser resiliente a ambos os nomes de colunas + forçar reload do schema
- **Impacto**: 248 vendas voltarão a aparecer no painel admin

