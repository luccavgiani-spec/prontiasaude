

# Plano: Aplicar Ajustes Mensais do Mercado Pago nos Cards de Relatórios

## Problema

O banco de dados tem gaps de registros (webhooks que falharam em Dez/2025 e Jan/2026), resultando em valores menores que o real. O Mercado Pago registrou:

| Mês | Vendas MP | Receita MP | Vendas BD | Gap |
|-----|-----------|------------|-----------|-----|
| **Dez/2025** | 30 | R$ 1.351,41 | ~3 | 27 vendas |
| **Jan/2026** | 370 | R$ 14.812,47 | ~244 | 126 vendas |
| **TOTAL** | **400** | **R$ 16.163,88** | ~247 | **153 vendas** |

## Solução: Tabela de Ajustes Mensais

Criar uma constante `MP_ADJUSTMENTS` que contém os valores **reais** do Mercado Pago para cada mês. Após calcular a receita do banco, aplicar a diferença como ajuste para que os cards e gráficos exibam os valores corretos.

---

## Alterações Técnicas

### Arquivo: `src/components/admin/ReportsTab.tsx`

#### 1. Adicionar constante MP_ADJUSTMENTS (após linha 59)

```typescript
// Ajustes mensais baseados no relatório oficial do Mercado Pago
// Usado para corrigir gaps de registros (webhooks que falharam)
// Formato: 'mes/ano' => { revenue: valor_em_centavos, sales: quantidade }
const MP_ADJUSTMENTS: Record<string, { revenue: number; sales: number }> = {
  'dez/25': { revenue: 135141, sales: 30 },  // R$ 1.351,41 - 30 vendas
  'jan/26': { revenue: 1481247, sales: 370 }, // R$ 14.812,47 - 370 vendas
};
```

#### 2. Modificar o cálculo de receita por mês (linhas 326-334)

Após calcular os valores do banco, aplicar os ajustes do MP:

```typescript
// Receita por mês (calculada do banco)
const revenueByMonthDB: Record<string, { revenue: number; sales: number }> = {};
allSales.forEach(sale => {
  const month = new Date(sale.created_at).toLocaleDateString('pt-BR', {
    month: 'short',
    year: '2-digit'
  });
  if (!revenueByMonthDB[month]) {
    revenueByMonthDB[month] = { revenue: 0, sales: 0 };
  }
  revenueByMonthDB[month].revenue += sale.price;
  revenueByMonthDB[month].sales++;
});

// Aplicar ajustes do MP (substituir valores do banco pelos valores reais)
const revenueByMonth: Record<string, number> = {};
const salesByMonth: Record<string, number> = {};

Object.entries(revenueByMonthDB).forEach(([month, data]) => {
  const monthKey = month.toLowerCase();
  if (MP_ADJUSTMENTS[monthKey]) {
    // Usar valor do MP quando disponível
    revenueByMonth[month] = MP_ADJUSTMENTS[monthKey].revenue;
    salesByMonth[month] = MP_ADJUSTMENTS[monthKey].sales;
  } else {
    // Manter valor do banco para meses sem ajuste
    revenueByMonth[month] = data.revenue;
    salesByMonth[month] = data.sales;
  }
});

// Adicionar meses do MP que não existem no banco
Object.entries(MP_ADJUSTMENTS).forEach(([mpMonth, data]) => {
  const monthFormatted = mpMonth; // já está no formato 'dez/25'
  if (!revenueByMonth[monthFormatted]) {
    revenueByMonth[monthFormatted] = data.revenue;
    salesByMonth[monthFormatted] = data.sales;
  }
});
```

#### 3. Recalcular totais usando os valores ajustados (linhas 321-324)

```typescript
// Calcular totais usando valores ajustados do MP
let adjustedTotalRevenue = 0;
let adjustedTotalSales = 0;

// Primeiro, calcular do banco
const dbTotalRevenue = allSales.reduce((sum, sale) => sum + sale.price, 0);
const dbTotalSales = allSales.length;

// Agrupar vendas do banco por mês
const dbSalesByMonth: Record<string, { revenue: number; sales: number }> = {};
allSales.forEach(sale => {
  const month = new Date(sale.created_at).toLocaleDateString('pt-BR', {
    month: 'short',
    year: '2-digit'
  }).toLowerCase();
  if (!dbSalesByMonth[month]) {
    dbSalesByMonth[month] = { revenue: 0, sales: 0 };
  }
  dbSalesByMonth[month].revenue += sale.price;
  dbSalesByMonth[month].sales++;
});

// Calcular totais: usar valores do MP para meses com ajuste, banco para outros
Object.keys(dbSalesByMonth).forEach(month => {
  if (MP_ADJUSTMENTS[month]) {
    adjustedTotalRevenue += MP_ADJUSTMENTS[month].revenue;
    adjustedTotalSales += MP_ADJUSTMENTS[month].sales;
  } else {
    adjustedTotalRevenue += dbSalesByMonth[month].revenue;
    adjustedTotalSales += dbSalesByMonth[month].sales;
  }
});

// Adicionar meses do MP que não existem no banco
Object.entries(MP_ADJUSTMENTS).forEach(([month, data]) => {
  if (!dbSalesByMonth[month]) {
    adjustedTotalRevenue += data.revenue;
    adjustedTotalSales += data.sales;
  }
});

const totalRevenue = adjustedTotalRevenue;
const totalSales = adjustedTotalSales;
const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
```

#### 4. Atualizar setMetrics para usar valores ajustados (linha 393-399)

```typescript
setMetrics({
  totalRevenue: totalRevenue / 100,  // Já usa valor ajustado
  totalSales,                         // Já usa valor ajustado
  // ... resto permanece igual
});
```

---

## Resumo das Alterações

| # | Local | Alteração |
|---|-------|-----------|
| 1 | Após linha 59 | Criar constante `MP_ADJUSTMENTS` com valores reais do MP |
| 2 | Linhas 321-324 | Recalcular `totalRevenue` e `totalSales` usando ajustes |
| 3 | Linhas 326-334 | Modificar `revenueByMonth` para usar valores do MP |
| 4 | Linhas 393-399 | Garantir que `setMetrics` use os valores ajustados |

---

## Resultado Esperado

Após as correções, os cards exibirão:

| Card | Antes (Errado) | Depois (Corrigido) |
|------|----------------|-------------------|
| Receita (Dez/2025) | ~R$ 131,70 | **R$ 1.351,41** |
| Receita (Jan/2026) | ~R$ 9.800 | **R$ 14.812,47** |
| Total Vendas | ~247 | **400** |
| Gráfico Receita/Mês | Barras baixas | Barras corretas |

---

## Vantagens desta Abordagem

1. **Simples**: Não requer importação de dados ou mudanças no banco
2. **Preciso**: Valores exatos do relatório do MP
3. **Extensível**: Fácil adicionar novos meses conforme necessário
4. **Seguro**: Não afeta outras funcionalidades (lista de vendas, webhooks, etc.)
5. **Manutenível**: Basta atualizar a constante `MP_ADJUSTMENTS` mensalmente

