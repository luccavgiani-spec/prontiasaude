

# Plano: Corrigir Campos Inválidos no PIX (additional_info)

## Problema Identificado

O erro na screenshot mostra exatamente a causa:

```
The name of the following parameters is wrong:
[additional_info.payer.address.city,
 additional_info.payer.address.federal_unit,
 additional_info.shipments.receiver_address.city]
```

### Causa Raiz

Nas correções anteriores de cartão de crédito, foram adicionados campos `city` e `federal_unit` no objeto `additional_info` (linhas 418-419 e 430-431) para melhorar a análise antifraude.

**Porém, a API do Mercado Pago para PIX NÃO aceita esses campos!**

O código atual já limpa o `payer` para PIX (linhas 456-459), mas esquece de limpar o `additional_info`, que também vai com os campos inválidos.

---

## Localização do Problema

**Arquivo:** `supabase/functions/mp-create-payment/index.ts`

- **Linhas 396-436**: O objeto `additional_info` é construído com `city` e `federal_unit`
- **Linhas 451-461**: O código limpa apenas o `payer` para PIX, mas não limpa o `additional_info`

---

## Correção Necessária

Após a linha 461 (dentro do bloco `if (paymentRequest.payment_method_id === 'pix' ...)`), adicionar código para **remover os campos inválidos do additional_info**:

```typescript
// ✅ CRÍTICO: Para PIX, remover campos não aceitos pela API do MP
paymentData.payer = {
  email: finalPayer.email,
  identification: finalPayer.identification
};

// ✅ NOVO: Também limpar additional_info para PIX (API não aceita city/federal_unit)
if (paymentData.additional_info) {
  // Remover campos inválidos do payer.address
  if (paymentData.additional_info.payer?.address) {
    delete paymentData.additional_info.payer.address.city;
    delete paymentData.additional_info.payer.address.federal_unit;
  }
  // Remover campos inválidos do shipments.receiver_address  
  if (paymentData.additional_info.shipments?.receiver_address) {
    delete paymentData.additional_info.shipments.receiver_address.city;
    delete paymentData.additional_info.shipments.receiver_address.state_name;
  }
}

console.log('[mp-create-payment] PIX payment - removidos campos inválidos do additional_info');
```

---

## Resumo da Alteração

| Arquivo | Linha | Alteração |
|---------|-------|-----------|
| mp-create-payment/index.ts | 461 (após) | Adicionar código para limpar `additional_info` em pagamentos PIX |

---

## Resultado Esperado

Após a correção:
- Pagamentos PIX voltarão a funcionar normalmente
- A API do Mercado Pago não rejeitará mais os parâmetros
- Pagamentos por cartão manterão os campos `city` e `federal_unit` para melhor análise antifraude

---

## IMPORTANTE: Deploy Manual

Esta edge function está deployada no **Supabase de Produção** (ploqujuhpwutpcibedbr).

Após eu fazer a alteração no código:
1. Você precisará copiar o código completo da edge function
2. E deployar manualmente no Dashboard do Supabase de Produção

