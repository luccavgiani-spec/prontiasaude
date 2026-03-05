import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabaseProduction } from '@/lib/supabase-production';
import { PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, BarChart, Bar } from 'recharts';
import { DollarSign, ShoppingCart, Users, Activity, Download, TrendingUp, Percent, RefreshCw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// Data mínima para filtrar vendas (histórico desde março/2025)
const SALES_START_DATE = '2025-03-01T00:00:00.000Z';

// Emails de teste a serem ignorados nos relatórios
const TEST_EMAILS = [
  'victoria_toledo_@hotmail.com', 
  'luccavgiani@gmail.com', 
  'luccapbe420@gmail.com', 
  'sandra.toledo@atccontabil.com.br', 
  'suporte@prontiasaude.com.br', 
  'teste@clubeben.com', 
  'teste@teste.com', 
  'joao.maria.teste01@gmail.com',
  'nevescristiellis@gmail.com',
  't.giani@gmail.com',
  'cristielli@outlook.com',
];

// Função para verificar se é email de teste
const isTestEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;
  const lowerEmail = email.toLowerCase();
  
  // Verificar lista de emails de teste
  if (TEST_EMAILS.some(te => lowerEmail.includes(te.toLowerCase()))) return true;
  
  // Verificar padrões de email de teste
  if (lowerEmail.includes('+')) return true;
  if (lowerEmail.includes('@prontia.com.br')) return true;
  if (lowerEmail.includes('atccontabil')) return true;
  
  return false;
};

// Nomes abreviados dos meses em pt-BR (índice 0 = janeiro)
const MONTH_NAMES_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Formatar mês de forma determinística: "Mar/26"
const formatMonthKey = (date: Date): string => {
  const m = MONTH_NAMES_SHORT[date.getMonth()];
  const y = String(date.getFullYear()).slice(-2);
  return `${m}/${y}`;
};

// Extrair chave de ordenação numérica de "Mar/26" → 2603
const monthSortKey = (monthStr: string): number => {
  const [m, y] = monthStr.split('/');
  const mi = MONTH_NAMES_SHORT.findIndex(n => n.toLowerCase() === m.toLowerCase());
  return (parseInt(y, 10) * 100) + (mi >= 0 ? mi + 1 : 0);
};
interface MetricsData {
  totalRevenue: number;
  totalSales: number;
  totalPatients: number;
  totalAppointments: number;
  revenueByMonth: Array<{
    month: string;
    revenue: number;
  }>;
  appointmentsByPlatform: Array<{
    platform: string;
    count: number;
  }>;
  salesByType: Array<{
    type: string;
    count: number;
    revenue: number;
  }>;
  salesBySku: Array<{
    sku: string;
    name: string;
    count: number;
    revenue: number;
  }>;
  activePlans: number;
  averageTicket: number;
}

// Mapeamento de preços por SKU (em centavos) - inclui serviços avulsos e planos
const SKU_PRICES: Record<string, number> = {
  // Consultas avulsas
  'ITC6534': 4390,
  // Clínico Geral
  'ZXW2165': 4990,
  // Psicólogo
  'OVM9892': 11990,
  // Laudo Psicológico
  'ULT3571': 4390,
  // Solicitação de Exames

  // Médicos Especialistas (R$89,90)
  'VHH8883': 8990,
  // Endocrinologista
  'TVQ5046': 8990,
  // Ortopedista
  'TQP5720': 8990,
  // Cardiologista
  'HGG3503': 8990,
  // Dermatologista
  'TSB0751': 8990,
  // Gastroenterologista
  'CCP1566': 8990,
  // Ginecologista
  'FKS5964': 8990,
  // Oftalmologista
  'HMG9544': 8990,
  // Pediatra
  'HME8366': 8990,
  // Otorrinolaringologista
  'QOP1101': 8990,
  // Psiquiatra
  'URO1099': 10990,
  // Urologista
  'DYY8522': 11990,
  // Médico da Família
  'LZF3879': 11990,
  // Nutrólogo
  'YZD9932': 11990,
  // Geriatria
  'PKS9388': 11990,
  // Neurologista
  'MYX5186': 11990,
  // Infectologista
  'IMU4471': 11990,
  // Imunologista
  'UDH3250': 12990,
  // Reumatologista
  'PRC6621': 12990,
  // Proctologista
  'PNE7783': 13990,
  // Pneumologista

  // Outros profissionais
  'BIR7668': 5490,
  // Personal Trainer
  'VPN5132': 6990,
  // Nutricionista
  'HXR8516': 4990,
  // Psicólogo 4 sessões
  'YME9025': 4990,
  // Psicólogo 8 sessões

  // SKUs legados
  'RZP5755': 4390,
  'consulta-clinico-geral': 4390,
  'CLK-CLINICO': 4390,
  // Planos
  'INDIVIDUAL_1M': 1990,
  'INDIVIDUAL_3M': 4990,
  'INDIVIDUAL_6M': 8990,
  'INDIVIDUAL_12M': 14990,
  'IND_SEM_ESP_1M': 1999,
  'IND_COM_ESP_1M': 2399,
  'IND_SEM_ESP_12M': 19990,
  'IND_COM_ESP_12M': 23990,
  'FAM_SEM_ESP_1M': 3499,
  'FAM_SEM_ESP_3M': 9990,
  'FAM_SEM_ESP_6M': 17990,
  'FAM_SEM_ESP_12M': 34990,
  'FAM_COM_ESP_1M': 4390,
  'FAM_COM_ESP_3M': 12990,
  'FAM_COM_ESP_6M': 23990,
  'FAM_COM_ESP_12M': 43900,
  'EMP_INDIVIDUAL': 0,
  'EMP_FAMILIAR': 0
};

// Nomes amigáveis para SKUs
const SKU_NAMES: Record<string, string> = {
  'ITC6534': 'Clínico Geral',
  'ZXW2165': 'Psicólogo',
  'OVM9892': 'Laudo Psicológico',
  'ULT3571': 'Solicitação de Exames',
  'VHH8883': 'Endocrinologista',
  'TVQ5046': 'Ortopedista',
  'TQP5720': 'Cardiologista',
  'HGG3503': 'Dermatologista',
  'TSB0751': 'Gastroenterologista',
  'CCP1566': 'Ginecologista',
  'FKS5964': 'Oftalmologista',
  'HMG9544': 'Pediatra',
  'HME8366': 'Otorrinolaringologista',
  'DYY8522': 'Médico da Família',
  'LZF3879': 'Nutrólogo',
  'YZD9932': 'Geriatria',
  'UDH3250': 'Reumatologista',
  'PKS9388': 'Neurologista',
  'MYX5186': 'Infectologista',
  'URO1099': 'Urologista',
  'IMU4471': 'Imunologista',
  'PRC6621': 'Proctologista',
  'PNE7783': 'Pneumologista',
  'BIR7668': 'Personal Trainer',
  'VPN5132': 'Nutricionista',
  'HXR8516': 'Psicólogo 4 sessões',
  'YME9025': 'Psicólogo 8 sessões',
  'QOP1101': 'Psiquiatra',
  'INDIVIDUAL_1M': 'Plano Individual 1 mês',
  'INDIVIDUAL_3M': 'Plano Individual 3 meses',
  'INDIVIDUAL_6M': 'Plano Individual 6 meses',
  'INDIVIDUAL_12M': 'Plano Individual 12 meses',
  'FAM_SEM_ESP_1M': 'Plano Familiar s/ Esp. 1 mês',
  'FAM_SEM_ESP_6M': 'Plano Familiar s/ Esp. 6 meses',
  'FAM_SEM_ESP_12M': 'Plano Familiar s/ Esp. 12 meses',
  'FAM_COM_ESP_1M': 'Plano Familiar c/ Esp. 1 mês',
  'FAM_COM_ESP_6M': 'Plano Familiar c/ Esp. 6 meses',
  'FAM_COM_ESP_12M': 'Plano Familiar c/ Esp. 12 meses'
};
const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--chart-1))'];

// Determinar se um SKU é de plano ou serviço avulso
const isPlanSku = (sku: string): boolean => {
  return sku?.includes('_') && (sku.startsWith('INDIVIDUAL') || sku.startsWith('FAM_') || sku.startsWith('IND_') || sku.startsWith('EMP_'));
};

interface RecurrenceSummary {
  total_vendas: number;
  total_clientes: number;
  clientes_recorrentes: number;
  vendas_de_recorrentes: number;
  vendas_de_novos: number;
  percentual_recorrente: number;
}

interface RecurrenceDailyChart {
  sale_date: string;
  total: number;
  recorrentes: number;
  novos: number;
  percentual_recorrente: number;
}

interface RecurrenceTopUser {
  email: string;
  total_compras: number;
  primeira_compra: string;
  ultima_compra: string;
  dias_como_cliente: number;
}

interface RecurrenceData {
  summary: RecurrenceSummary;
  daily_chart: RecurrenceDailyChart[];
  top_users: RecurrenceTopUser[];
}

export default function ReportsTab() {
  const [loading, setLoading] = useState(true);
  const [recurrencePeriod, setRecurrencePeriod] = useState<number | 'all'>(30);
  const [recurrenceData, setRecurrenceData] = useState<RecurrenceData | null>(null);
  const [recurrenceLoading, setRecurrenceLoading] = useState(true);
  const [recurrenceError, setRecurrenceError] = useState<string | null>(null);
  const [allAppointments, setAllAppointments] = useState<Array<{ email: string; created_at: string; order_id?: string; service_code?: string; provider?: string }>>([]);
  const [appointmentsLoaded, setAppointmentsLoaded] = useState(false);
  const [totalPatients, setTotalPatients] = useState(0);
  const [activePlansCount, setActivePlansCount] = useState(0);
  const [metrics, setMetrics] = useState<MetricsData>({
    totalRevenue: 0,
    totalSales: 0,
    totalPatients: 0,
    totalAppointments: 0,
    revenueByMonth: [],
    appointmentsByPlatform: [],
    salesByType: [],
    salesBySku: [],
    activePlans: 0,
    averageTicket: 0
  });
  // Single data load: appointments (primary), patients, active plans
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      try {
        const todayStr = new Date().toISOString().split('T')[0];

        // Paginate appointments to bypass PostgREST 1000-row hard limit
        const PAGE_SIZE = 1000;
        let allRaw: any[] = [];
        let page = 0;
        while (true) {
          const { data, error } = await supabaseProduction
            .from('appointments')
            .select('id, email, created_at, order_id, service_code, provider')
            .gte('created_at', SALES_START_DATE)
            .order('created_at', { ascending: false })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
          if (error) throw error;
          allRaw = allRaw.concat(data || []);
          if (!data || data.length < PAGE_SIZE) break;
          page++;
        }

        const [patientsResult, activePlansResult] = await Promise.all([
          supabaseProduction.from('patients')
            .select('id, created_at')
            .gte('created_at', SALES_START_DATE),
          supabaseProduction.from('patient_plans')
            .select('id')
            .eq('status', 'active')
            .gte('plan_expires_at', todayStr),
        ]);

        // Same filters as SalesTab: exclude test emails, require order_id, deduplicate
        const filteredData = allRaw.filter(apt => {
          if (!apt.order_id || apt.order_id.trim() === '') return false;
          if (isTestEmail(apt.email)) return false;
          return true;
        });

        const seen = new Set<string>();
        const uniqueData = filteredData.filter(apt => {
          if (seen.has(apt.order_id)) return false;
          seen.add(apt.order_id);
          return true;
        });

        setAllAppointments(uniqueData);
        setAppointmentsLoaded(true);
        setTotalPatients(patientsResult.data?.length || 0);
        setActivePlansCount(activePlansResult.data?.length || 0);
      } catch (err) {
        console.error('Error loading data:', err);
        setAppointmentsLoaded(true);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  // Compute recurrence data locally from appointments
  useEffect(() => {
    if (!appointmentsLoaded) return;
    setRecurrenceLoading(true);
    setRecurrenceError(null);

    try {
      const now = new Date();

      // Filter by period
      const filteredByPeriod = recurrencePeriod === 'all'
        ? allAppointments
        : allAppointments.filter(apt => {
            const aptDate = new Date(apt.created_at);
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - (recurrencePeriod as number));
            return aptDate >= cutoff;
          });

      // Count purchases per email
      const emailPurchases: Record<string, string[]> = {};
      filteredByPeriod.forEach(apt => {
        const email = (apt.email || '').toLowerCase();
        if (!emailPurchases[email]) emailPurchases[email] = [];
        emailPurchases[email].push(apt.created_at);
      });

      const totalClientes = Object.keys(emailPurchases).length;
      const clientesRecorrentes = Object.values(emailPurchases).filter(dates => dates.length > 1).length;
      const vendasDeRecorrentes = Object.entries(emailPurchases)
        .filter(([_, dates]) => dates.length > 1)
        .reduce((sum, [_, dates]) => sum + dates.length, 0);
      const totalVendas = filteredByPeriod.length;
      const percentualRecorrente = totalVendas > 0 ? (vendasDeRecorrentes / totalVendas) * 100 : 0;

      // Build daily chart grouped by date
      const dailyMap: Record<string, { total: number; recorrentes: number; novos: number }> = {};
      const recurrentEmails = new Set(
        Object.entries(emailPurchases)
          .filter(([_, dates]) => dates.length > 1)
          .map(([email]) => email)
      );

      filteredByPeriod.forEach(apt => {
        const dateStr = apt.created_at.slice(0, 10);
        if (!dailyMap[dateStr]) dailyMap[dateStr] = { total: 0, recorrentes: 0, novos: 0 };
        dailyMap[dateStr].total++;
        const email = (apt.email || '').toLowerCase();
        if (recurrentEmails.has(email)) {
          dailyMap[dateStr].recorrentes++;
        } else {
          dailyMap[dateStr].novos++;
        }
      });

      const dailyChart: RecurrenceDailyChart[] = Object.entries(dailyMap)
        .map(([date, data]) => ({
          sale_date: date,
          total: data.total,
          recorrentes: data.recorrentes,
          novos: data.novos,
          percentual_recorrente: data.total > 0 ? (data.recorrentes / data.total) * 100 : 0,
        }))
        .sort((a, b) => a.sale_date.localeCompare(b.sale_date));

      // Build top users
      const topUsers: RecurrenceTopUser[] = Object.entries(emailPurchases)
        .filter(([_, dates]) => dates.length > 1)
        .map(([email, dates]) => {
          const sortedDates = dates.sort();
          const first = new Date(sortedDates[0]);
          const last = new Date(sortedDates[sortedDates.length - 1]);
          const dias = Math.floor((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24));
          return {
            email,
            total_compras: dates.length,
            primeira_compra: sortedDates[0],
            ultima_compra: sortedDates[sortedDates.length - 1],
            dias_como_cliente: dias,
          };
        })
        .sort((a, b) => b.total_compras - a.total_compras)
        .slice(0, 10);

      setRecurrenceData({
        summary: {
          total_vendas: totalVendas,
          total_clientes: totalClientes,
          clientes_recorrentes: clientesRecorrentes,
          vendas_de_recorrentes: vendasDeRecorrentes,
          vendas_de_novos: totalVendas - vendasDeRecorrentes,
          percentual_recorrente: percentualRecorrente,
        },
        daily_chart: dailyChart,
        top_users: topUsers,
      });
    } catch (err: any) {
      console.error('Error computing recurrence stats:', err);
      setRecurrenceError('Erro ao calcular dados de recorrência');
    } finally {
      setRecurrenceLoading(false);
    }
  }, [recurrencePeriod, allAppointments, appointmentsLoaded]);

  // Compute all metrics from allAppointments (same SKU_PRICES logic as SalesTab)
  useEffect(() => {
    if (!appointmentsLoaded) return;

    // Revenue per month
    const revenueByMonth: Record<string, number> = {};
    let totalRevenueCents = 0;

    allAppointments.forEach(apt => {
      const price = SKU_PRICES[apt.service_code || ''] || 0;
      const month = formatMonthKey(new Date(apt.created_at));
      revenueByMonth[month] = (revenueByMonth[month] || 0) + price;
      totalRevenueCents += price;
    });

    const totalSales = allAppointments.length;
    const averageTicketCents = totalSales > 0 ? totalRevenueCents / totalSales : 0;

    // Sales by type (Consultas vs Planos)
    const salesByTypeMap: Record<string, { count: number; revenue: number }> = {
      'Consultas Avulsas': { count: 0, revenue: 0 },
      'Planos': { count: 0, revenue: 0 },
    };
    allAppointments.forEach(apt => {
      const sku = apt.service_code || '';
      const price = SKU_PRICES[sku] || 0;
      const type = isPlanSku(sku) ? 'Planos' : 'Consultas Avulsas';
      salesByTypeMap[type].count++;
      salesByTypeMap[type].revenue += price;
    });

    // Sales by SKU (top 10)
    const salesBySkuMap: Record<string, { count: number; revenue: number }> = {};
    allAppointments.forEach(apt => {
      const sku = apt.service_code || 'Desconhecido';
      const price = SKU_PRICES[sku] || 0;
      if (!salesBySkuMap[sku]) salesBySkuMap[sku] = { count: 0, revenue: 0 };
      salesBySkuMap[sku].count++;
      salesBySkuMap[sku].revenue += price;
    });

    // Platform groups
    const platformGroups: Record<string, number> = {
      'Communicare': 0, 'ClickLife': 0, 'WhatsApp': 0, 'Outros': 0,
    };
    allAppointments.forEach(a => {
      const provider = (a.provider || '').toLowerCase();
      if (provider.includes('communicare')) platformGroups['Communicare']++;
      else if (provider.includes('clicklife')) platformGroups['ClickLife']++;
      else if (provider.includes('whatsapp')) platformGroups['WhatsApp']++;
      else if (provider) platformGroups['Outros']++;
    });

    setMetrics({
      totalRevenue: totalRevenueCents / 100,
      totalSales,
      totalPatients,
      totalAppointments: allAppointments.length,
      activePlans: activePlansCount,
      averageTicket: averageTicketCents / 100,
      revenueByMonth: Object.entries(revenueByMonth)
        .map(([month, revenue]) => ({ month, revenue: revenue / 100 }))
        .sort((a, b) => monthSortKey(a.month) - monthSortKey(b.month)),
      appointmentsByPlatform: Object.entries(platformGroups)
        .filter(([_, count]) => count > 0)
        .map(([platform, count]) => ({ platform, count })),
      salesByType: Object.entries(salesByTypeMap)
        .filter(([_, data]) => data.count > 0)
        .map(([type, data]) => ({ type, count: data.count, revenue: data.revenue / 100 })),
      salesBySku: Object.entries(salesBySkuMap)
        .map(([sku, data]) => ({ sku, name: SKU_NAMES[sku] || sku, count: data.count, revenue: data.revenue / 100 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    });
  }, [allAppointments, appointmentsLoaded, totalPatients, activePlansCount]);
  const exportCSV = () => {
    const lines = ['Relatório de Métricas Prontia', `Período: Histórico completo`, `Gerado em: ${new Date().toLocaleString('pt-BR')}`, '', 'RESUMO', `Receita Total,${metrics.totalRevenue.toFixed(2)}`, `Total de Vendas,${metrics.totalSales}`, `Ticket Médio,${metrics.averageTicket.toFixed(2)}`, `Novos Pacientes,${metrics.totalPatients}`, `Planos Ativos,${metrics.activePlans}`, `Atendimentos,${metrics.totalAppointments}`, '', 'VENDAS POR TIPO', 'Tipo,Quantidade,Receita', ...metrics.salesByType.map(t => `${t.type},${t.count},${t.revenue.toFixed(2)}`), '', 'TOP 10 SERVIÇOS/PLANOS', 'Serviço,Quantidade,Receita', ...metrics.salesBySku.map(s => `${s.name},${s.count},${s.revenue.toFixed(2)}`), '', 'ATENDIMENTOS POR PLATAFORMA', 'Plataforma,Quantidade', ...metrics.appointmentsByPlatform.map(p => `${p.platform},${p.count}`)];
    const csv = 'data:text/csv;charset=utf-8,' + lines.join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `relatorio-prontia-${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };
  if (loading) {
    return <div className="flex items-center justify-center p-12">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Carregando métricas...</p>
        </div>
      </div>;
  }
  return <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-lg font-semibold">Histórico completo</h2>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Receita</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {metrics.totalRevenue.toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">no período</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Vendas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalSales}</div>
            <p className="text-xs text-muted-foreground mt-1">total de transações</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {metrics.averageTicket.toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">por venda</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Novos Pacientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalPatients}</div>
            <p className="text-xs text-muted-foreground mt-1">cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Planos Ativos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{metrics.activePlans}</div>
            <p className="text-xs text-muted-foreground mt-1">atualmente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Atendimentos</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalAppointments}</div>
            <p className="text-xs text-muted-foreground mt-1">registrados</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receita por Mês */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Receita por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.revenueByMonth.length > 0 ? <ResponsiveContainer width="100%" height={280}>
                <BarChart data={metrics.revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis tickFormatter={v => `R$${v}`} className="text-xs" />
                  <Tooltip formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Receita']} labelFormatter={label => `Mês: ${label}`} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer> : <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                Sem dados de receita no período
              </div>}
          </CardContent>
        </Card>

        {/* Vendas por Tipo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vendas por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.salesByType.length > 0 ? <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={metrics.salesByType} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={90} label={({
                type,
                count
              }) => `${type}: ${count}`}>
                    {metrics.salesByType.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [value, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer> : <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                Sem vendas no período
              </div>}
          </CardContent>
        </Card>

        {/* Quantidade de Vendas por Serviço */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quantidade de Vendas por Serviço</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.salesBySku.length > 0 ? <ResponsiveContainer width="100%" height={280}>
                <BarChart data={metrics.salesBySku} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} className="text-xs" />
                  <Tooltip formatter={(value: number) => [value, 'Quantidade vendida']} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Vendas" />
                </BarChart>
              </ResponsiveContainer> : <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                Sem vendas no período
              </div>}
          </CardContent>
        </Card>

        {/* Atendimentos por Plataforma */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Atendimentos por Plataforma</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.appointmentsByPlatform.length > 0 ? <ResponsiveContainer width="100%" height={280}>
                <BarChart data={metrics.appointmentsByPlatform} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" />
                  <YAxis dataKey="platform" type="category" width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} name="Atendimentos" />
                </BarChart>
              </ResponsiveContainer> : <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                Sem atendimentos registrados no período
              </div>}
          </CardContent>
        </Card>

      </div>

      {/* Recorrência de Compras */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Recorrência de Compras
          </h2>
          <div className="flex gap-2">
            {[7, 14, 30, 60].map((d) => (
              <Button
                key={d}
                size="sm"
                variant={recurrencePeriod === d ? 'default' : 'outline'}
                onClick={() => setRecurrencePeriod(d)}
              >
                {d}d
              </Button>
            ))}
            <Button
              size="sm"
              variant={recurrencePeriod === 'all' ? 'default' : 'outline'}
              onClick={() => setRecurrencePeriod('all')}
            >
              Toda a Operação
            </Button>
          </div>
        </div>

        {recurrenceLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : recurrenceError ? (
          <p className="text-sm text-muted-foreground text-center py-4">{recurrenceError}</p>
        ) : recurrenceData ? (
          <>
            {/* Cards de resumo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Índice de Recorrência</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {recurrenceData.summary.percentual_recorrente.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">das vendas são de clientes recorrentes</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Clientes Recorrentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {recurrenceData.summary.clientes_recorrentes}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    de {recurrenceData.summary.total_clientes} clientes
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Vendas de Recorrentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {recurrenceData.summary.vendas_de_recorrentes}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    de {recurrenceData.summary.total_vendas} total
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Gráfico de barras empilhadas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Vendas Diárias — Novos vs Recorrentes</CardTitle>
              </CardHeader>
              <CardContent>
                {recurrenceData.daily_chart.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={[...recurrenceData.daily_chart].sort((a, b) => a.sale_date.localeCompare(b.sale_date))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="sale_date"
                        tickFormatter={(v: string) => {
                          const [y, m, d] = v.split('-');
                          return `${d}/${m}`;
                        }}
                        className="text-xs"
                      />
                      <YAxis className="text-xs" />
                      <Tooltip
                        labelFormatter={(label: string) => {
                          const [y, m, d] = label.split('-');
                          return `${d}/${m}/${y}`;
                        }}
                        formatter={(value: number, name: string) => {
                          const label = name === 'novos' ? 'Novos' : 'Recorrentes';
                          return [value, label];
                        }}
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const item = payload[0]?.payload as RecurrenceDailyChart;
                          const [y, m, d] = (label as string).split('-');
                          return (
                            <div className="bg-background border rounded-lg p-3 shadow-md text-sm">
                              <p className="font-medium mb-1">{d}/{m}/{y}</p>
                              <p>Total: <strong>{item.total}</strong></p>
                              <p className="text-orange-500">Recorrentes: <strong>{item.recorrentes}</strong></p>
                              <p className="text-blue-500">Novos: <strong>{item.novos}</strong></p>
                              <p className="text-muted-foreground">{item.percentual_recorrente.toFixed(1)}% recorrentes</p>
                            </div>
                          );
                        }}
                      />
                      <Legend />
                      <Bar dataKey="novos" stackId="a" fill="hsl(var(--chart-1))" name="Novos" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="recorrentes" stackId="a" fill="#f97316" name="Recorrentes" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    Sem dados no período
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tabela Top 10 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top 10 — Usuários Mais Recorrentes</CardTitle>
              </CardHeader>
              <CardContent>
                {recurrenceData.top_users.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead className="text-center">Nº de Compras</TableHead>
                        <TableHead className="text-center">Primeira Compra</TableHead>
                        <TableHead className="text-center">Última Compra</TableHead>
                        <TableHead className="text-center">Dias como Cliente</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recurrenceData.top_users.slice(0, 10).map((user, idx) => (
                        <TableRow key={user.email}>
                          <TableCell>
                            {idx < 3 ? (
                              <Badge variant={idx === 0 ? 'default' : 'secondary'} className={
                                idx === 0 ? 'bg-yellow-500 text-white' :
                                idx === 1 ? 'bg-gray-400 text-white' :
                                'bg-amber-700 text-white'
                              }>
                                {idx + 1}º
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">{idx + 1}</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium text-sm">{user.email}</TableCell>
                          <TableCell className="text-center font-bold">{user.total_compras}</TableCell>
                          <TableCell className="text-center text-sm">
                            {user.primeira_compra ? new Date(user.primeira_compra).toLocaleDateString('pt-BR') : '-'}
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            {user.ultima_compra ? new Date(user.ultima_compra).toLocaleDateString('pt-BR') : '-'}
                          </TableCell>
                          <TableCell className="text-center">{user.dias_como_cliente}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-center py-4">Sem dados de recorrência</p>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>;
}