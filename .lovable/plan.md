
# Plano de Correção: Bloqueio no Fluxo de Compra

## 🔍 Diagnóstico Completo

### Problema Identificado
Após análise detalhada dos logs, banco de dados e código, identifiquei **o problema principal**:

### 🚨 CAUSA RAIZ: Desconexão entre Cloud e Produção

O frontend está rodando no **Lovable Cloud** (`yrsjluhhnhxogdgnbnya`), mas:

1. **A autenticação está acontecendo no Cloud**
   - Usuários novos estão sendo criados apenas no Cloud
   - Exemplo: `avalonemartins22@gmail.com` - existe APENAS no Cloud (`existsInCloud: true, existsInProduction: false`)

2. **O PaymentModal usa `supabase.auth.getUser()` do Cloud**
   - Linha 381: `const { data: { user } } = await supabase.auth.getUser();`
   - Isso busca usuário do **Cloud** (onde ele está logado)

3. **Mas o `patients` está sendo lido do Cloud também**
   - Linha 389: `await supabase.from("patients").select("*").eq("user_id", user.id).single();`
   - O `user.id` é do Cloud, mas a tabela `patients` pode não ter dados sincronizados

4. **As Edge Functions de pagamento estão na PRODUÇÃO**
   - `mp-create-payment` está no projeto `ploqujuhpwutpcibedbr`
   - Quando o pagamento é criado, ele grava no banco de **PRODUÇÃO**

### 📊 Evidências:

| Verificação | Resultado |
|-------------|-----------|
| Último pagamento no Cloud | 27/01/2026 (3 dias atrás) |
| Logs mp-create-payment no Cloud | **Nenhum** (função não existe lá!) |
| Webhooks no Cloud | **Vazios** |
| Usuários com profile_complete=false recentes | 79 de 694 (11%) |
| Avalone Martins | `existsInCloud: true, existsInProduction: false`, profile_complete: **false** |

---

## 🔧 Problemas Específicos a Corrigir

### 1. **HeroSection e ConsultNowFloatButton usam cliente Cloud**
Os componentes que iniciam o fluxo de compra usam `supabase` (Cloud):
- Verificam `profile_complete` no Cloud
- Se perfil incompleto → redirecionam para `/completar-perfil`
- Usuários ficam em loop ou não conseguem prosseguir

### 2. **PaymentModal não considera sessão híbrida**
O modal de pagamento:
- Usa `supabase.auth.getUser()` (Cloud)
- Busca `patients` usando `user_id` do Cloud
- Usuários que logaram via Produção podem ter `user = null` aqui

### 3. **Dados de paciente podem não existir no Cloud**
- Usuários que existem apenas na Produção não têm dados no Cloud
- A query `patients.eq('user_id', user.id)` retorna vazio

---

## ✅ Plano de Correção (Ações no Supabase de Produção)

### AÇÃO 1: Verificar Edge Functions no Supabase de Produção

Você deve acessar o **Supabase de Produção** (`ploqujuhpwutpcibedbr`) e:

1. **Verificar logs de mp-create-payment:**
   ```
   Dashboard → Edge Functions → mp-create-payment → Logs
   ```
   - Procurar por erros nos últimos 3 dias
   - Verificar se há chamadas chegando

2. **Verificar pending_payments:**
   ```sql
   SELECT * FROM pending_payments 
   WHERE created_at > '2026-01-28' 
   ORDER BY created_at DESC;
   ```

3. **Verificar webhook_audit:**
   ```sql
   SELECT * FROM webhook_audit 
   WHERE received_at > '2026-01-28' 
   ORDER BY received_at DESC;
   ```

### AÇÃO 2: Verificar conectividade MP_ACCESS_TOKEN

No Supabase de Produção:
```
Dashboard → Project Settings → Edge Functions → Secrets
```

Confirmar que existe:
- `MP_ACCESS_TOKEN` (token do Mercado Pago)
- `MP_NOTIFICATION_URL` (URL do webhook)
- `SUPABASE_SERVICE_ROLE_KEY` (para escrita no banco)

---

## 🔧 Correções de Código Necessárias

### CORREÇÃO 1: PaymentModal deve usar sessão híbrida

O `PaymentModal.tsx` precisa:

```typescript
// ANTES (linha ~375-389):
const { data: { user } } = await supabase.auth.getUser();
const { data: patient } = await supabase.from("patients").select("*").eq("user_id", user.id).single();

// DEPOIS:
import { getHybridSession } from "@/lib/auth-hybrid";
import { supabaseProduction } from "@/lib/supabase-production";

const { session, environment } = await getHybridSession();
const user = session?.user;
const client = environment === 'production' ? supabaseProduction : supabase;
const { data: patient } = await client.from("patients").select("*").eq("user_id", user.id).single();
```

### CORREÇÃO 2: HeroSection deve usar sessão híbrida

```typescript
// ANTES (linha ~14-18):
const { data: { user } } = await supabase.auth.getUser();

// DEPOIS:
import { getHybridSession } from "@/lib/auth-hybrid";
const { session, environment } = await getHybridSession();
const user = session?.user;
// E usar o cliente correto para buscar dados do patient
```

### CORREÇÃO 3: ConsultNowFloatButton já usa sessão híbrida parcialmente

Verificar se está usando corretamente nas linhas onde busca `patients`.

---

## 📋 Checklist para Execução

### No Supabase de Produção (você deve fazer):

- [ ] Verificar logs de `mp-create-payment` dos últimos 3 dias
- [ ] Executar query para ver `pending_payments` recentes
- [ ] Executar query para ver `webhook_audit` recentes
- [ ] Confirmar secrets (`MP_ACCESS_TOKEN`, `MP_NOTIFICATION_URL`)
- [ ] Testar uma compra de R$ 0,01 via PIX para verificar conectividade

### Correções de Código (eu posso implementar):

- [ ] Atualizar `PaymentModal.tsx` para usar sessão híbrida
- [ ] Atualizar `HeroSection.tsx` para usar sessão híbrida
- [ ] Adicionar logs detalhados antes de chamar `invokeEdgeFunction`
- [ ] Garantir que `loadUserData()` funcione para ambos os ambientes

---

## 🎯 Resultado Esperado

Após as correções:
1. Usuários logados via Cloud OU Produção conseguem iniciar compras
2. Dados do paciente são lidos do ambiente correto
3. Edge functions são chamadas no Supabase de Produção
4. Pagamentos voltam a funcionar normalmente
