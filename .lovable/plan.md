

# Plano: Corrigir Card de Receita Usando Dados do MP como Fonte Verdadeira

## Valores Oficiais do Mercado Pago (Planilha Anexada)

| Mês | Vendas | Receita |
|-----|--------|---------|
| **Dez/2025** | 30 | R$ 1.351,41 |
| **Jan/2026** | 370 | R$ 14.812,47 |
| **TOTAL** | **400** | **R$ 16.163,88** |

---

## Diagnóstico do Problema Atual

O ReportsTab.tsx atualmente combina dados de 3 fontes:
1. `appointments` (usa preços fixos da tabela SKU_PRICES)
2. `pending_payments` com status `approved` (valores reais pagos)
3. `patient_plans` (usa preços fixos)

### Problemas identificados:

1. **Appointments usam preços de tabela, não valores reais**: Ignora descontos de cupom
2. **Unidades mistas no `amount`**: Alguns valores em centavos (>=1000), outros em reais (<1000)
3. **Filtros de teste incompletos**: Faltam emails como `nevescristiellis@gmail.com`, `t.giani@gmail.com`
4. **Sem filtro por nome**: Usuários internos com emails pessoais não são excluídos

---

## Solução Proposta

Usar **apenas `pending_payments` com status `approved`** como fonte de verdade para receita, aplicando:

1. Normalização de valores (centavos vs reais)
2. Filtros completos de emails de teste
3. Filtros por nome de usuários internos
4. Vinculação com appointments para contexto (provider, service_code)

---

## Alterações Técnicas

### Arquivo: `src/components/admin/ReportsTab.tsx`

#### 1. Atualizar TEST_EMAILS (linha 14)

Adicionar emails faltantes à lista de teste:

```typescript
const TEST_EMAILS = [
  'victoria_toledo_@hotmail.com', 
  'luccavgiani@gmail.com', 
  'luccapbe420@gmail.com', 
  'sandra.toledo@atccontabil.com.br', 
  'suporte@prontiasaude.com.br', 
  'teste@clubeben.com', 
  'teste@teste.com', 
  'joao.maria.teste01@gmail.com',
  // NOVOS
  'nevescristiellis@gmail.com',
  't.giani@gmail.com',
];

// Nomes de usuários internos a excluir
const TEST_NAMES = ['lucca', 'victoria toledo', 'sandra toledo', 'tulio giani', 'tulio'];
```

#### 2. Atualizar função isTestEmail (linhas 17-21)

Incluir verificação de padrões adicionais:

```typescript
const isTestEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;
  const lowerEmail = email.toLowerCase();
  
  // Verificar lista de emails de teste
  if (TEST_EMAILS.some(te => lowerEmail.includes(te.toLowerCase()))) return true;
  
  // Verificar padrões de email de teste
  if (lowerEmail.includes('+')) return true;  // Aliases como user+test@gmail.com
  if (lowerEmail.includes('@prontia.com.br')) return true;
  if (lowerEmail.includes('atccontabil')) return true;
  
  return false;
};
```

#### 3. Criar função isTestName (após isTestEmail)

```typescript
const isTestName = (name: string | null | undefined): boolean => {
  if (!name) return false;
  const lowerName = name.toLowerCase();
  return TEST_NAMES.some(tn => lowerName.includes(tn));
};
```

#### 4. Criar função normalizeAmount (após isTestName)

```typescript
// Normalizar valores: valores >= 1000 assumidos como centavos
// valores < 1000 assumidos como reais e convertidos para centavos
const normalizeAmount = (amount: number | null | undefined): number => {
  if (!amount) return 0;
  const num = Number(amount);
  return num >= 1000 ? num : Math.round(num * 100);
};
```

#### 5. Atualizar filtro de pendingPayments (linhas 231-235)

Adicionar filtro por nome:

```typescript
const pendingPayments = (pendingPaymentsResult.data || []).filter(pp => {
  const email = pp.patient_email || (pp as any).email;
  const name = pp.patient_name || '';
  return !isTestEmail(email) && !isTestName(name);
});
```

#### 6. Refatorar cálculo de vendas (linhas 250-305)

Usar `pending_payments` como fonte principal de receita:

```typescript
// Combinar vendas usando pending_payments como fonte de verdade para valores
interface UnifiedSale {
  id: string;
  sku: string;
  created_at: string;
  order_id: string | null;
  source: 'pending_payment';
  price: number; // Em centavos
  provider?: string;
}

const salesMap = new Map<string, UnifiedSale>();

// Criar mapa de appointments por order_id para obter contexto (provider, service_code)
const appointmentsByOrderId = new Map<string, any>();
appointments.forEach(apt => {
  if (apt.order_id) {
    appointmentsByOrderId.set(apt.order_id, apt);
  }
});

// Usar APENAS pending_payments aprovados como fonte de receita
pendingPayments.forEach(pp => {
  const key = pp.order_id || pp.payment_id || `pp-${pp.id}`;
  if (!salesMap.has(key)) {
    const sku = pp.sku || '';
    const amount = pp.amount ?? (pp as any).amount_cents;
    
    // Buscar contexto do appointment se existir
    const apt = pp.order_id ? appointmentsByOrderId.get(pp.order_id) : null;
    
    salesMap.set(key, {
      id: pp.id,
      sku: sku || apt?.service_code || '',
      created_at: pp.created_at || new Date().toISOString(),
      order_id: pp.order_id,
      source: 'pending_payment',
      price: normalizeAmount(amount),
      provider: apt?.provider
    });
  }
});

const allSales = Array.from(salesMap.values());
```

#### 7. Remover adição de appointments e patient_plans separadamente

A lógica atual que adiciona appointments e patient_plans separadamente será removida, já que usaremos apenas pending_payments como fonte de verdade para receita.

---

## Resumo das Alterações

| # | Local | Alteração |
|---|-------|-----------|
| 1 | Linha 14 | Adicionar `nevescristiellis@gmail.com`, `t.giani@gmail.com` ao TEST_EMAILS |
| 2 | Após linha 14 | Criar array `TEST_NAMES` |
| 3 | Linhas 17-21 | Atualizar `isTestEmail()` com padrões `+`, `@prontia.com.br`, `atccontabil` |
| 4 | Após linha 21 | Criar função `isTestName()` |
| 5 | Após linha 21 | Criar função `normalizeAmount()` |
| 6 | Linhas 231-235 | Adicionar filtro `isTestName()` ao pendingPayments |
| 7 | Linhas 250-305 | Refatorar para usar APENAS pending_payments como fonte de receita |

---

## Resultado Esperado

Após as correções, os cards exibirão valores congruentes com o relatório do MP:

| Card | Antes (Errado) | Depois (Corrigido) |
|------|----------------|-------------------|
| Receita (Dez/2025) | ~R$ 1.000 inflacionado | ~R$ 1.351,41 |
| Receita (Jan/2026) | ~R$ 9.500 subestimado | ~R$ 14.812,47 |
| Total Vendas | Inflacionado | 400 (Dez+Jan) |

---

## Observação Importante

A precisão dependerá de quantos pagamentos do MP estão registrados em `pending_payments`. Se houver gaps (pagamentos que não geraram registro), haverá pequena diferença. A planilha do MP é a fonte verdadeira; o dashboard refletirá o que está no banco.

