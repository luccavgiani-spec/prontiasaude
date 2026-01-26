

## Correção: Ativação Automática de Planos Após Pagamento

### Problema Identificado

Quando um usuário **compra um plano com cartão de crédito**, o sistema atual:
1. Frontend mostra "Plano ativado!" e redireciona para `/area-do-paciente` **imediatamente**
2. O backend (`mp-webhook`) **pode falhar silenciosamente** ao criar o plano
3. O usuário fica sem plano ativo, mesmo tendo pago

**Caso específico da Brunna**:
- Pagou plano `IND_COM_ESP_1M` às 14:32
- Frontend exibiu mensagem de sucesso e redirecionou
- O `mp-webhook` **não criou o plano** (motivo desconhecido - sem logs disponíveis)
- Pagamento ficou `processed: false` no banco
- Você precisou ativar manualmente com código `PREMIUM`

### Análise de Frequência

| Email | SKU | Processado | Quando | Método |
|-------|-----|------------|--------|--------|
| brunna.caroll123@gmail.com | IND_COM_ESP_1M | ❌ NÃO | - | Manual |
| pablozampier@gmail.com | IND_COM_ESP_1M | ✅ SIM | 18h depois | reconcile-pending-payments |
| beto@cursointegral.com.br | IND_SEM_ESP_1M | ✅ SIM | 18h depois | reconcile-pending-payments |

**Conclusão**: Isso pode acontecer com outros usuários. Os planos anteriores só foram ativados porque o job de reconciliação rodou depois.

---

### Correção Proposta

#### 1. Frontend: Aguardar confirmação do backend antes de mostrar sucesso

**Arquivo**: `src/components/payment/PaymentModal.tsx`

Modificar o fluxo de cartão aprovado para planos:
- Após pagamento aprovado, **chamar `check-payment-status`** para garantir que o plano foi criado
- Só mostrar "Plano ativado!" após confirmação do backend
- Se o backend não confirmar em X tentativas, exibir mensagem orientando o usuário a aguardar

**Lógica**:
```typescript
if (isPlan) {
  // Em vez de redirecionar imediatamente, verificar se o plano foi criado
  const planConfirmed = await verifyPlanCreation(paymentId, orderId, email, sku);
  
  if (planConfirmed) {
    toast.success("✅ Plano ativado!");
    window.location.href = "/area-do-paciente";
  } else {
    toast.warning("⏳ Estamos processando seu plano...", {
      description: "Você receberá um email de confirmação em alguns minutos."
    });
    window.location.href = "/area-do-paciente";
  }
}
```

#### 2. Backend: Adicionar cadastro ClickLife no `check-payment-status`

**Arquivo**: `supabase/functions/check-payment-status/index.ts`

Após criar o plano com sucesso, cadastrar o paciente na ClickLife com o `planoId` correto (igual ao que foi feito no `mp-webhook`).

#### 3. Criar função de verificação de plano no frontend

**Arquivo**: `src/components/payment/PaymentModal.tsx`

Adicionar função que:
1. Chama `check-payment-status` para garantir processamento
2. Verifica se existe registro em `patient_plans` com o SKU correto
3. Retorna `true` apenas quando o plano está ativo no banco

---

### Alterações Técnicas

#### Arquivo 1: `src/components/payment/PaymentModal.tsx`

**A. Adicionar função de verificação de plano** (~linha 100):
```typescript
// Verificar se o plano foi criado no backend
const verifyPlanCreation = async (
  paymentId: string,
  orderId: string,
  email: string,
  sku: string,
  maxRetries = 5
): Promise<boolean> => {
  for (let i = 0; i < maxRetries; i++) {
    // Primeiro, forçar processamento via check-payment-status
    try {
      const { data: checkResult } = await supabase.functions.invoke('check-payment-status', {
        body: { payment_id: paymentId, order_id: orderId, email }
      });
      
      if (checkResult?.is_plan && checkResult?.success) {
        console.log('[verifyPlanCreation] ✅ Plano confirmado pelo check-payment-status');
        return true;
      }
    } catch (e) {
      console.warn('[verifyPlanCreation] Erro no check-payment-status:', e);
    }
    
    // Verificar diretamente no banco
    const { data: plan } = await supabase
      .from('patient_plans')
      .select('id, plan_code')
      .eq('email', email.toLowerCase())
      .eq('plan_code', sku)
      .eq('status', 'active')
      .maybeSingle();
    
    if (plan) {
      console.log('[verifyPlanCreation] ✅ Plano encontrado no banco:', plan);
      return true;
    }
    
    // Aguardar antes de tentar novamente
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.error('[verifyPlanCreation] ❌ Plano não encontrado após', maxRetries, 'tentativas');
  return false;
};
```

**B. Modificar fluxo de cartão aprovado para planos** (~linha 1598-1610):
```typescript
if (isPlan) {
  console.log("[Card Payment] 🎯 PLANO detectado - Verificando criação no backend...");
  
  // Aguardar confirmação do backend
  const planConfirmed = await verifyPlanCreation(paymentId, orderId, formData.email, sku);
  
  if (planConfirmed) {
    toast.success("✅ Plano ativado com sucesso!", {
      description: "Redirecionando para sua área..."
    });
  } else {
    toast.warning("⏳ Seu pagamento foi aprovado!", {
      description: "O plano será ativado em alguns minutos. Você receberá um email de confirmação.",
      duration: 8000
    });
  }
  
  setTimeout(() => {
    window.location.href = "/area-do-paciente";
  }, 2000);
  return;
}
```

#### Arquivo 2: `supabase/functions/check-payment-status/index.ts`

**A. Importar função de registro ClickLife** (ou replicar a lógica):
```typescript
// Função para registrar paciente na ClickLife
async function registerClickLifePatient(
  cpf: string,
  nome: string,
  email: string,
  telefone: string,
  planoId: number,
  sexo: string,
  dataNascimento?: string
): Promise<{ success: boolean; error?: string }> {
  // ... lógica de registro (mesma do mp-webhook)
}
```

**B. Adicionar cadastro ClickLife após criar plano** (~linha 197, após `planCreatedSuccessfully = true`):
```typescript
if (planCreatedSuccessfully) {
  // Buscar dados do paciente para cadastro ClickLife
  const { data: patientData } = await supabaseAdmin
    .from('patients')
    .select('cpf, first_name, last_name, phone_e164, gender, birth_date')
    .eq('email', patientEmail)
    .maybeSingle();
  
  if (patientData?.cpf) {
    const clickLifePlanoId = sku.includes('COM_ESP') ? 864 : 
                              sku.includes('SEM_ESP') ? 863 : 864;
    
    // Cadastrar na ClickLife
    await registerClickLifePatient(
      patientData.cpf,
      `${patientData.first_name} ${patientData.last_name}`,
      patientEmail,
      patientData.phone_e164 || '',
      clickLifePlanoId,
      patientData.gender || 'F',
      patientData.birth_date
    );
    
    // Atualizar timestamp
    await supabaseAdmin
      .from('patients')
      .update({ clicklife_registered_at: new Date().toISOString() })
      .eq('email', patientEmail);
  }
}
```

---

### Fluxo Após Correção

| Etapa | Antes | Depois |
|-------|-------|--------|
| 1. Pagamento aprovado | Mostra "Ativado!" imediatamente | Verifica backend primeiro |
| 2. Criação do plano | Depende do webhook (pode falhar) | Frontend força via check-payment-status |
| 3. Cadastro ClickLife | Só no mp-webhook | Também no check-payment-status (redundância) |
| 4. Feedback ao usuário | Sempre sucesso (mesmo sem plano) | Sucesso só após confirmação |

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/payment/PaymentModal.tsx` | Adicionar verificação de plano antes de mostrar sucesso |
| `supabase/functions/check-payment-status/index.ts` | Adicionar cadastro ClickLife após criar plano |

---

### Benefícios

1. **Elimina falhas silenciosas**: O frontend não assume sucesso sem confirmação
2. **Redundância**: Mesmo se o webhook falhar, o `check-payment-status` cria o plano
3. **Cadastro ClickLife garantido**: O paciente é cadastrado na ClickLife em qualquer cenário
4. **Melhor UX**: Usuário só vê "Ativado" quando realmente está ativado

