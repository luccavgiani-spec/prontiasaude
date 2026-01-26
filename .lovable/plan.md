
## Correção: Cadastro na ClickLife ao Comprar ou Ativar Planos

### Problema Identificado

1. **Alteração anterior INCORRETA**: Eu adicionei um guard que **impedia** o cadastro na ClickLife para planos, mas na verdade:
   - Quando um usuário **compra um plano** → DEVE cadastrar na ClickLife com o planoId correto
   - Quando o admin **ativa manualmente via Painel** → DEVE cadastrar na ClickLife com o planoId correto

2. **Estado atual**: 
   - O fluxo de compra de plano no `mp-webhook` **termina com return** (linha 821) e **não cadastra na ClickLife**
   - A ativação manual via `activate_plan_manual` em `patient-operations` também **não cadastra na ClickLife**
   - A minha alteração anterior apenas adicionou um guard redundante (que agora está errado)

---

### Correção Necessária

#### 1. Reverter a alteração anterior no `mp-webhook`
- Remover o guard `!isPlanSku` que adicionei
- Restaurar o comportamento original

#### 2. Adicionar cadastro ClickLife no fluxo de compra de plano
- **Arquivo**: `supabase/functions/mp-webhook/index.ts`
- **Localização**: Dentro do bloco `if (isPlanPurchase)` (linhas 579-829), **antes do return**
- **Lógica**: 
  - Determinar o `planoId` correto baseado no SKU do plano:
    - `IND_COM_ESP_*` ou `FAM_COM_ESP_*` → planoId **864** (com especialistas)
    - `IND_SEM_ESP_*` ou `FAM_SEM_ESP_*` → planoId **863** (sem especialistas)
  - Chamar a função de cadastro na ClickLife com o planoId correto

#### 3. Adicionar cadastro ClickLife na ativação manual de plano
- **Arquivo**: `supabase/functions/patient-operations/index.ts`
- **Localização**: Operação `activate_plan_manual` (linha ~1155), **após criar o plano**
- **Lógica**: Mesma lógica de mapeamento de planoId

---

### Mapeamento de PlanoId ClickLife

| Tipo de Plano | SKUs | ClickLife PlanoId |
|---------------|------|-------------------|
| **Com Especialistas** | `IND_COM_ESP_*`, `FAM_COM_ESP_*` | **864** |
| **Sem Especialistas** | `IND_SEM_ESP_*`, `FAM_SEM_ESP_*` | **863** |
| **Empresarial** | `EMPRESA_*` | **864** |
| **Serviço Avulso** | Outros SKUs | **864** (padrão atual) |

---

### Alterações Técnicas

#### Arquivo 1: `supabase/functions/mp-webhook/index.ts`

**A. Reverter guard na linha ~1337-1343:**
```diff
-    // ✅ CADASTRO UNIVERSAL NA CLICKLIFE - APENAS SERVIÇOS (NÃO PLANOS)
-    // Planos são ativados na ClickLife apenas quando o paciente agendar via schedule-redirect
-    // Esta verificação é uma SEGURANÇA EXTRA caso o fluxo mude no futuro
-    const isPlanSku = schedulePayload.sku?.startsWith('IND_') || 
-                      schedulePayload.sku?.startsWith('FAM_');
-    
-    if (!isPlanSku && patientData && patientData.cpf) {
+    // ✅ CADASTRO UNIVERSAL NA CLICKLIFE - TODAS AS COMPRAS
+    // Executar para garantir que o paciente esteja cadastrado
+    if (patientData && patientData.cpf) {
```

**B. Adicionar cadastro ClickLife no fluxo de plano (antes do return ~linha 792-819):**

Adicionar função helper para determinar planoId:
```typescript
// Helper para determinar planoId correto baseado no SKU do plano
function getClickLifePlanIdFromSku(sku: string): number {
  // Planos com especialistas → 864
  if (sku.includes('COM_ESP')) return 864;
  // Planos empresariais → 864
  if (sku.startsWith('EMPRESA_')) return 864;
  // Planos sem especialistas → 863
  if (sku.includes('SEM_ESP')) return 863;
  // Default para serviços avulsos → 864
  return 864;
}
```

Adicionar cadastro antes do return no fluxo de plano (~linha 792):
```typescript
// ✅ CADASTRAR NA CLICKLIFE AO COMPRAR PLANO
if (patientData?.cpf) {
  console.log('[mp-webhook] 🏥 Cadastrando paciente na ClickLife (compra de plano)...');
  
  const planoId = getClickLifePlanIdFromSku(schedulePayload.sku);
  const nomeCompleto = `${patientData.first_name} ${patientData.last_name}`;
  
  const clicklifeResult = await registerClickLifePatientSimple(
    patientData.cpf,
    nomeCompleto,
    patientData.email || schedulePayload.email,
    patientData.phone_e164 || '',
    planoId,
    patientData.gender || 'F',
    patientData.birth_date
  );
  
  if (clicklifeResult.success) {
    console.log('[mp-webhook] ✅ Paciente cadastrado na ClickLife (plano) com planoId:', planoId);
    await supabaseAdmin
      .from('patients')
      .update({ clicklife_registered_at: new Date().toISOString() })
      .eq('email', patientData.email || schedulePayload.email);
  } else {
    console.warn('[mp-webhook] ⚠️ Falha no cadastro ClickLife (plano):', clicklifeResult.error);
  }
}
```

#### Arquivo 2: `supabase/functions/patient-operations/index.ts`

Adicionar cadastro ClickLife na operação `activate_plan_manual` (~linha 1155, após registrar métrica):

```typescript
// ✅ CADASTRAR NA CLICKLIFE AO ATIVAR PLANO MANUALMENTE
console.log('[activate_plan_manual] 🏥 Cadastrando paciente na ClickLife...');

// Buscar dados completos do paciente para cadastro ClickLife
const { data: patientFull } = await supabase
  .from('patients')
  .select('cpf, first_name, last_name, phone_e164, gender, birth_date')
  .eq('email', patient_email)
  .single();

if (patientFull?.cpf) {
  // Determinar planoId baseado no plan_code
  const planoId = plan_code.includes('COM_ESP') ? 864 : 
                  plan_code.includes('SEM_ESP') ? 863 : 
                  plan_code.startsWith('EMPRESA_') ? 864 : 864;
  
  // Chamar edge function de ativação ClickLife
  const { data: clicklifeResult, error: clicklifeError } = await supabase.functions.invoke('activate-clicklife-manual', {
    body: { 
      email: patient_email,
      plan_id: planoId
    }
  });
  
  if (clicklifeError) {
    console.warn('[activate_plan_manual] ⚠️ Falha no cadastro ClickLife:', clicklifeError);
  } else {
    console.log('[activate_plan_manual] ✅ Paciente cadastrado na ClickLife com planoId:', planoId);
  }
} else {
  console.warn('[activate_plan_manual] ⚠️ Paciente sem CPF, não foi possível cadastrar na ClickLife');
}
```

---

### Fluxo Após Correção

| Cenário | Cadastro ClickLife | PlanoId |
|---------|-------------------|---------|
| Compra plano IND_COM_ESP_1M | ✅ Automático | 864 |
| Compra plano IND_SEM_ESP_1M | ✅ Automático | 863 |
| Compra plano FAM_COM_ESP_3M | ✅ Automático | 864 |
| Admin ativa plano manualmente | ✅ Automático | Baseado no plan_code |
| Compra Pronto Atendimento | ✅ Automático (já funcionava) | 864 |
| Compra Especialista avulso | ✅ Automático (já funcionava) | 864 |

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/mp-webhook/index.ts` | 1) Reverter guard 2) Adicionar cadastro ClickLife no fluxo de plano |
| `supabase/functions/patient-operations/index.ts` | Adicionar cadastro ClickLife na operação `activate_plan_manual` |

---

### Deploy

Após as alterações, será necessário fazer deploy das edge functions:
- `mp-webhook`
- `patient-operations`
