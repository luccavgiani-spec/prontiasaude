

# Plano de Correção: PIX Não Funciona - Chamadas Indo para Lovable Cloud

## Diagnóstico Confirmado

### Evidência dos Logs do Lovable Cloud

```
[mp-create-payment] Price mismatch detected: { sku: "ITC6534", client_sent: 43.9, expected: 39.9 }
```

### Análise do Problema

| Componente | Estado Esperado | Estado Real |
|------------|-----------------|-------------|
| Código fonte `PaymentModal.tsx` | Busca preço do `supabaseProduction` (39.90) | ✅ Correto |
| Código fonte `invokeEdgeFunction` | Chama URL de produção | ✅ Correto |
| Build em execução | Usa código atualizado | ❌ **USA CÓDIGO ANTIGO** |
| Frontend envia | `unit_price: 39.9` | ❌ Envia `43.9` |
| Endpoint chamado | `ploqujuhpwutpcibedbr` | ❌ Chama `yrsjluhhnhxogdgnbnya` |

### Causa Raiz

O build/preview em execução **NÃO reflete o código atual**. Está usando uma versão antiga que:

1. Passa a prop `amount={4390}` diretamente (4390/100 = 43.9)
2. OU usa `supabase.functions.invoke` ao invés de `invokeEdgeFunction`

---

## Correções Necessárias

### Correção 1: Sincronizar Preço no HeroSection.tsx

**Problema:** A prop `amount={4390}` está incorreta. Mesmo que o código atual busque do DB, uma versão de fallback antiga pode usar a prop.

**Arquivo:** `src/components/home/HeroSection.tsx`

**Alteração:**
```diff
- <PaymentModal ... amount={4390} ... />
+ <PaymentModal ... amount={3990} ... />
```

### Correção 2: Adicionar Log de Debug na URL Chamada

Para confirmar que o build correto está em execução, adicionar log na função `invokeEdgeFunction`.

**Arquivo:** `src/lib/edge-functions.ts`

**Alteração:** Adicionar console.log para mostrar a URL exata sendo chamada:
```typescript
console.log("[invokeEdgeFunction] Calling:", `${EDGE_FUNCTIONS_URL}/${functionName}`);
```

---

## Resumo das Alterações

| # | Arquivo | Alteração | Motivo |
|---|---------|-----------|--------|
| 1 | `src/components/home/HeroSection.tsx` | Alterar `amount={4390}` → `amount={3990}` | Sincronizar fallback com DB |
| 2 | `src/lib/edge-functions.ts` | Adicionar log de URL | Debug para confirmar build correto |

---

## Após as Correções

1. O Lovable Cloud fará um **rebuild automático**
2. O preview usará o código atualizado
3. Você poderá ver no console: `[invokeEdgeFunction] Calling: https://ploqujuhpwutpcibedbr.supabase.co/functions/v1/mp-create-payment`
4. Se ainda aparecer logs no Lovable Cloud, significa que a função `mp-create-payment` precisa ser **removida** do Lovable Cloud para evitar conflitos

---

## Nota Importante

Se após as correções o problema persistir e os logs ainda mostrarem chamadas no Lovable Cloud, a próxima etapa será:

1. Verificar se há uma função `mp-create-payment` deployada no Lovable Cloud que precisa ser deletada
2. OU adicionar validação na própria função do Cloud para rejeitar chamadas e redirecionar para produção

