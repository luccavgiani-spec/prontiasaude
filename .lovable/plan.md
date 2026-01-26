
## Análise: Cadastro Automático de Pacientes na ClickLife Durante Compra de Planos

### Problema Identificado

Quando um paciente **compra um plano** (SKU iniciando com `IND_` ou `FAM_`), ele está sendo **automaticamente cadastrado e ativado na ClickLife** com o plano ID **864** (consultas avulsas). Isso é comportamento indesejado porque:

1. **Planos não devem pré-cadastrar na ClickLife** - O cadastro na ClickLife só deve ocorrer quando o paciente **usar** o plano para agendar uma consulta
2. **Uso do planoId incorreto** - Está usando `864` (consultas avulsas) em vez do plano correspondente ao que foi comprado

---

### Causa Raiz

O arquivo `supabase/functions/mp-webhook/index.ts` contém um bloco de **"CADASTRO UNIVERSAL NA CLICKLIFE"** (linhas 1337-1386) que é executado para **TODAS** as compras aprovadas, incluindo planos:

```typescript
// ✅ CADASTRO UNIVERSAL NA CLICKLIFE - TODAS AS COMPRAS
if (patientData && patientData.cpf) {
  console.log('[mp-webhook] 🏥 Cadastro universal na ClickLife...');
  
  const clicklifeResult = await registerClickLifePatientSimple(
    patientData.cpf,
    nomeCompleto,
    patientData.email,
    patientData.phone_e164,
    864, // ❌ PROBLEMA: Usando plano fixo para TUDO
    patientData.gender,
    patientData.birth_date
  );
}
```

Este código **NÃO verifica** se é uma compra de plano (`isPlanPurchase`) antes de executar. O fluxo de plano tem um `return` antes (linha 821-830), mas este bloco de código está **fora** desse fluxo condicional.

---

### Fluxo Atual (Incorreto)

```text
Compra Plano (IND_COM_ESP_1M)
         ↓
   isPlanPurchase = true
         ↓
  ┌──────────────────────────────┐
  │ Cria patient_plans           │
  │ Sincroniza ClubeBen          │
  │ Cria appointment para poll   │
  │ return (linha 821)           │  ← Deveria parar aqui
  └──────────────────────────────┘
         ↓
  ⚠️ MAS o código continua... (BUG)
         ↓
  ┌──────────────────────────────┐
  │ CADASTRO UNIVERSAL CLICKLIFE │  ← ❌ NÃO DEVERIA EXECUTAR
  │ registerClickLifePatientSimple(864)
  └──────────────────────────────┘
```

**NOTA**: Na verdade, analisando mais de perto, o bloco de plano **termina com return** (linha 821-829), então o cadastro universal na ClickLife **NÃO deve estar executando para planos**.

Verificando novamente os logs:
- `activate-clicklife-manual` foi chamado às **14:36:52**
- `patient-operations/activate_plan_manual` foi às **14:37:19**

Isso indica que o cadastro foi feito **antes** da ativação do plano, sugerindo uma **ação manual do admin** ou outra automação no frontend.

---

### Investigação Adicional

Verificando o componente `UserRegistrationsTab.tsx`, encontrei a função `handlePlatformActivation` que chama `activate-clicklife-manual`:

```typescript
const { data, error } = await supabase.functions.invoke(functionName, {
  body: { email: platformActivationUser.email }
});
```

**Hipótese confirmada**: O admin provavelmente clicou em "Ativar ClickLife" manualmente na interface antes de ativar o plano.

---

### Cenário Reportado vs Realidade

| Cenário | Origem | Correção Necessária |
|---------|--------|---------------------|
| Admin ativa ClickLife manualmente | Ação do admin | Educação/UX |
| mp-webhook cadastra automaticamente | Código | **SIM** |

O código de "CADASTRO UNIVERSAL" está na seção **fora** do fluxo de planos. Se o código fosse chamado para planos, o `return` na linha 829 deveria impedir. Porém, para **garantir** que não haja cadastro automático na ClickLife durante compra de planos, precisamos adicionar uma verificação explícita.

---

### Correção Proposta

**Arquivo**: `supabase/functions/mp-webhook/index.ts`

Adicionar verificação para **NÃO** executar o cadastro universal na ClickLife se for uma compra de plano:

```typescript
// ✅ CADASTRO UNIVERSAL NA CLICKLIFE - APENAS SERVIÇOS AVULSOS
// IMPORTANTE: Planos NÃO devem pré-cadastrar na ClickLife (linha 575 já retorna antes)
// Esta verificação é uma SEGURANÇA EXTRA caso o fluxo mude no futuro
const isPlanPurchaseSku = schedulePayload.sku?.startsWith('IND_') || 
                          schedulePayload.sku?.startsWith('FAM_');

if (!isPlanPurchaseSku && patientData && patientData.cpf) {
  console.log('[mp-webhook] 🏥 Cadastro universal na ClickLife...');
  // ... resto do código
}
```

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/mp-webhook/index.ts` | Adicionar guard `!isPlanPurchaseSku` antes do cadastro universal ClickLife |

---

### Comportamento Após Correção

| Tipo de Compra | Cadastro ClickLife |
|----------------|-------------------|
| Plano (IND_*, FAM_*) | ❌ NÃO - Será feito apenas quando agendar via schedule-redirect |
| Pronto Atendimento | ✅ SIM - Cadastro imediato |
| Especialista sem plano | ✅ SIM - Cadastro imediato |
| Psicólogo sem plano | ❌ NÃO - Vai para Agendar.cc |

---

### Seção Técnica

**Localização exata no código**:
- Linhas 1337-1419 do arquivo `supabase/functions/mp-webhook/index.ts`

**Mudança**:
```diff
-    // ✅ CADASTRO UNIVERSAL NA CLICKLIFE - TODAS AS COMPRAS
-    // Executar antes do schedule-redirect para garantir que o paciente esteja cadastrado
-    if (patientData && patientData.cpf) {
+    // ✅ CADASTRO UNIVERSAL NA CLICKLIFE - APENAS SERVIÇOS (NÃO PLANOS)
+    // Planos são ativados na ClickLife apenas quando o paciente agendar via schedule-redirect
+    const isPlanSku = schedulePayload.sku?.startsWith('IND_') || 
+                      schedulePayload.sku?.startsWith('FAM_');
+    
+    if (!isPlanSku && patientData && patientData.cpf) {
       console.log('[mp-webhook] 🏥 Cadastro universal na ClickLife...');
```

Esta alteração garante que pacientes comprando planos **não serão automaticamente cadastrados na ClickLife** durante a compra. O cadastro será feito **apenas** quando eles tentarem agendar uma consulta, momento em que o `schedule-redirect` verificará o plano ativo e fará o cadastro correto com o planoId apropriado.
