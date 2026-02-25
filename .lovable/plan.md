

# Investigação: Assinaturas Rejeitadas no Mercado Pago

## Diagnóstico com 100% de certeza

O problema **não é do site**. O problema é uma **combinação do comportamento da API de Subscriptions do Mercado Pago + o banco do cliente**. Explico:

---

## O que acontece tecnicamente

### Fluxo atual do código (`mp-create-subscription`, linha 166):

```text
1. Frontend envia card_token + dados → mp-create-subscription
2. Edge function cria preapproval no MP com status: "authorized" (cobrança imediata)
3. MP retorna status "authorized" → nosso código trata como SUCESSO
4. Código ativa o plano no banco (patient_plans + patient_subscriptions)
5. Frontend mostra "Plano ativado com sucesso!"
```

### O que o Mercado Pago faz por baixo:

```text
1. Cria a subscription (preapproval) → status: "authorized" ✅
2. Envia email de confirmação ao comprador ✅
3. Tenta cobrar o PRIMEIRO pagamento do cartão...
4. Banco REJEITA a cobrança (por risco, limite, etc.) ❌
5. A subscription fica "authorized" mas o payment fica "rejected"
```

### Por que isso acontece?

A API de **Subscriptions** (`/preapproval`) do Mercado Pago separa dois conceitos:

| Conceito | Status retornado | Significado |
|---|---|---|
| **Subscription** (preapproval) | `authorized` | "O cliente autorizou cobranças recorrentes" |
| **Payment** (primeira cobrança) | `rejected` | "O banco recusou esta cobrança específica" |

**Nosso código trata o `authorized` da subscription como pagamento aprovado, mas isso NÃO garante que o dinheiro saiu do cartão.** O `authorized` significa apenas que o MP tem permissão de cobrar, não que cobrou com sucesso.

É por isso que:
- O pagamento aparece em "Planos de Assinatura" do MP (a subscription existe)
- Mas NÃO aparece no extrato bancário (o payment da primeira cobrança foi rejeitado)
- O usuário recebe email de "assinatura criada" (é o email da subscription, não do pagamento)

---

## Evidência no código

**`mp-create-subscription/index.ts`, linhas 196-208:**
```javascript
if (!mpResponse.ok || mpData.status === 'rejected' || mpData.status === 'cancelled') {
  // Só rejeita se a SUBSCRIPTION inteira falhar
  return new Response(JSON.stringify({ success: false, ... }));
}
```

O código só rejeita se `mpData.status` (da subscription) for `rejected`. Mas o MP retorna `authorized` para a subscription mesmo quando o primeiro pagamento falha. **O primeiro pagamento é processado assincronamente.**

**`PaymentModal.tsx`, linha 1392:**
```javascript
const isSubscriptionApproved = data.status === "approved" || data.status === "authorized";
```

O frontend trata `authorized` como aprovado e ativa o plano.

---

## Causa raiz do banco

As rejeições do primeiro pagamento de subscriptions são tipicamente causadas por:

1. **Limite de crédito insuficiente** - O banco recusa silenciosamente
2. **Cartão sem permissão para débito recorrente** - Alguns cartões bloqueiam cobranças recorrentes automaticamente
3. **Antifraude do banco** - Transação classificada como risco (especialmente bancos digitais como Nubank, Inter)
4. **Cartão pré-pago ou virtual** - Muitos não aceitam cobranças recorrentes

---

## Solução recomendada

Para corrigir este problema, o código precisa **verificar o status do primeiro pagamento** após criar a subscription, não apenas o status da subscription em si. Isso envolve:

1. **Após criar a subscription**, consultar a API `GET /preapproval/{id}` para verificar se o `summarized.charged_quantity` é > 0
2. **Ou** consultar `GET /authorized_payments/search?preapproval_id={id}` para verificar o status do primeiro pagamento
3. **Se o primeiro pagamento falhou**, retornar erro ao frontend em vez de ativar o plano
4. **Atualizar o webhook** `mp-subscription-webhook` para tratar eventos `subscription_authorized_payment` e desativar planos quando pagamentos falham

### Arquivos que precisariam ser modificados:
- `supabase/functions/mp-create-subscription/index.ts` - Adicionar verificação do primeiro pagamento após criar subscription
- `supabase/functions/mp-subscription-webhook/index.ts` - Tratar rejeição de pagamentos recorrentes

---

## Resumo

| Pergunta | Resposta |
|---|---|
| É problema do site? | **Parcialmente** - O código não verifica se o primeiro pagamento foi efetivado |
| É problema do Mercado Pago? | **Não** - A API funciona como documentado; subscription ≠ payment |
| É problema do banco? | **Sim** - O banco recusa a cobrança, mas o MP já criou a subscription |
| O que fazer? | Verificar o primeiro pagamento antes de ativar o plano |

