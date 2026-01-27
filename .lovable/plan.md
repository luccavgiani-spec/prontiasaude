

# Plano de Correção: Aba Vendas - Usar tabela `appointments` como fonte

## Diagnóstico Confirmado

**Problema**: O código atual busca vendas da tabela `pending_payments` (22 registros total, 6 approved), quando a fonte correta de dados são os **522 registros da tabela `appointments`**.

### Código Atual (Linhas 144-149)
```typescript
const { data: pendingPaymentsData, error: ppError } = await supabaseProduction
  .from("pending_payments")  // ❌ Fonte errada!
  .select("*")
  .eq("status", "approved")  // ❌ Filtra apenas 6 registros
  .gte("created_at", SALES_START_DATE)
  .order("created_at", { ascending: false });
```

### Solução
Alterar para buscar diretamente da tabela `appointments`:
```typescript
const { data: appointmentsData, error } = await supabaseProduction
  .from("appointments")  // ✅ Fonte correta com 522 registros
  .select("*")
  .gte("created_at", SALES_START_DATE)
  .order("created_at", { ascending: false });
```

---

## Arquivos a Modificar

| Arquivo | Operação |
|---------|----------|
| `src/components/admin/SalesTab.tsx` | Modificar função `loadAppointments()` |

---

## Alterações Detalhadas

### 1. Função `loadAppointments()` (Linhas 141-211)

**Antes**: Busca `pending_payments` e depois enriquece com `appointments`

**Depois**: Busca diretamente `appointments` e mapeia os campos

```typescript
const loadAppointments = async () => {
  try {
    // ✅ Buscar diretamente da tabela appointments
    const { data: appointmentsData, error } = await supabaseProduction
      .from("appointments")
      .select("*")
      .gte("created_at", SALES_START_DATE)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Erro ao buscar appointments:", error);
      throw error;
    }

    // Transformar para formato de "venda"
    const sales = (appointmentsData || []).map(apt => ({
      id: apt.id,
      appointment_id: apt.appointment_id || `APT-${apt.id.slice(0, 8)}`,
      email: apt.email || '',
      service_code: apt.service_code || '',
      service_name: apt.service_name || getServiceNameFromSKU(apt.service_code || ''),
      start_at_local: apt.start_at_local || apt.created_at,
      duration_min: apt.duration_min || 30,
      status: apt.status || 'scheduled',
      order_id: apt.order_id,
      provider: apt.provider || 'N/A',
      redirect_url: apt.redirect_url || apt.meeting_url,
      created_at: apt.created_at,
      updated_at: apt.updated_at,
    }));

    console.log(`📊 [SalesTab] Loaded ${sales.length} vendas (fonte: appointments)`);
    setAppointments(sales);
  } catch (error) {
    console.error("Erro ao carregar vendas:", error);
    toast({
      title: "Erro ao carregar vendas",
      description: "Não foi possível carregar os dados de vendas.",
      variant: "destructive",
    });
  } finally {
    setLoading(false);
  }
};
```

---

## Mapeamento de Campos

| Campo no `appointments` | Campo na Interface |
|------------------------|-------------------|
| `id` | `id` |
| `appointment_id` | `appointment_id` |
| `email` | `email` |
| `service_code` | `service_code` |
| `service_name` | `service_name` |
| `start_at_local` | `start_at_local` |
| `duration_min` | `duration_min` |
| `status` | `status` |
| `order_id` | `order_id` |
| `provider` | `provider` |
| `redirect_url` ou `meeting_url` | `redirect_url` |
| `created_at` | `created_at` |

---

## Impacto Esperado

- **Antes**: 6 vendas (apenas `pending_payments` approved)
- **Depois**: 522 vendas (todos os `appointments` desde março/2025)

---

## Comportamento Preservado

1. **Filtros de busca**: Email, serviço, status, provider continuam funcionando
2. **Gráfico mensal**: Calcula corretamente com base nos 522 registros
3. **Exportação CSV**: Exporta todos os dados visíveis
4. **Realtime**: O canal já escuta `appointments`, então novas vendas aparecerão automaticamente
5. **KPIs**: Total, Hoje, Esta Semana - todos recalculados com os 522 registros

---

## Estrutura da Tabela `appointments` (Schema Real)

Conforme o schema fornecido, a tabela `appointments` possui:

| Coluna | Tipo | Uso |
|--------|------|-----|
| `id` | uuid | Identificador único |
| `email` | text | Email do paciente |
| `service_code` | text | SKU do serviço |
| `service_name` | text | Nome do serviço |
| `status` | text | Status do agendamento |
| `provider` | text | Provider (ClickLife, Communicare, etc.) |
| `redirect_url` | text | Link de redirecionamento |
| `meeting_url` | text | Link da reunião (fallback) |
| `created_at` | timestamp | Data de criação = data da venda |
| `order_id` | text | ID do pedido (vincula com pagamento) |

---

## Resumo Técnico

- **Problema**: Fonte de dados errada (`pending_payments` vs `appointments`)
- **Causa raiz**: O código foi implementado para depender de pagamentos, não de agendamentos
- **Solução**: Alterar query para buscar diretamente da tabela `appointments`
- **Impacto**: 522 vendas aparecerão na aba Vendas

