import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabaseProduction } from '@/lib/supabase-production';
import { PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, BarChart, Bar } from 'recharts';
import { DollarSign, ShoppingCart, Users, Activity, Download, Calendar, TrendingUp, Percent } from 'lucide-react';
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
];

// Nomes de usuários internos a excluir
const TEST_NAMES = ['lucca', 'victoria toledo', 'sandra toledo', 'tulio giani', 'tulio'];

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

// Função para verificar se é nome de teste
const isTestName = (name: string | null | undefined): boolean => {
  if (!name) return false;
  const lowerName = name.toLowerCase();
  return TEST_NAMES.some(tn => lowerName.includes(tn));
};

// Normalizar valores: valores >= 1000 assumidos como centavos
// valores < 1000 assumidos como reais e convertidos para centavos
const normalizeAmount = (amount: number | null | undefined): number => {
  if (!amount) return 0;
  const num = Number(amount);
  return num >= 1000 ? num : Math.round(num * 100);
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
  'ZXW2165': 3999,
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
  'DYY8522': 8990,
  // Médico da Família
  'LZF3879': 8990,
  // Nutrólogo
  'YZD9932': 8990,
  // Geriatria
  'UDH3250': 8990,
  // Reumatologista
  'PKS9388': 8990,
  // Neurologista
  'MYX5186': 8990,
  // Infectologista

  // Outros profissionais
  'BIR7668': 5490,
  // Personal Trainer
  'VPN5132': 6990,
  // Nutricionista
  'HXR8516': 3999,
  // Psicólogo 4 sessões
  'YME9025': 3999,
  // Psicólogo 8 sessões
  'QOP1101': 8990,
  // Psiquiatra

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
export default function ReportsTab() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');
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
  useEffect(() => {
    loadMetrics();
  }, [period]);
  const getDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();
    if (period === '7d') startDate.setDate(startDate.getDate() - 7);else if (period === '30d') startDate.setDate(startDate.getDate() - 30);else if (period === '90d') startDate.setDate(startDate.getDate() - 90);else if (period === '365d') startDate.setDate(startDate.getDate() - 365);else if (period === 'all') return {
      startDate: new Date(SALES_START_DATE),
      endDate
    };
    return {
      startDate,
      endDate
    };
  };
  const loadMetrics = async () => {
    setLoading(true);
    try {
      // Usar cliente de Produção diretamente (RLS permite SELECT público)
      const {
        startDate,
        endDate
      } = getDateRange();
      const startISO = startDate.toISOString();
      const endISO = endDate.toISOString();
      const todayStr = new Date().toISOString().split('T')[0];

      // Buscar dados em paralelo de TODAS as fontes de vendas (PRODUÇÃO)
      const [appointmentsResult, pendingPaymentsResult, plansResult, patientsResult, activePlansResult] = await Promise.all([
      // Appointments - consultas avulsas (usar * para evitar erros de cache PostgREST)
      supabaseProduction.from('appointments').select('*').gte('created_at', startISO).lte('created_at', endISO),
      // Pending payments aprovados (usar * para compatibilidade com cache)
      supabaseProduction.from('pending_payments').select('*').eq('status', 'approved').gte('created_at', startISO).lte('created_at', endISO),
      // Patient plans para contagem de planos (usar * para evitar erros de coluna inexistente)
      supabaseProduction.from('patient_plans').select('*').gte('created_at', startISO).lte('created_at', endISO),
      // Pacientes novos
      supabaseProduction.from('patients').select('id, created_at').gte('created_at', startISO).lte('created_at', endISO),
      // Planos ativos
      supabaseProduction.from('patient_plans').select('id').eq('status', 'active').gte('plan_expires_at', todayStr)]);

      // Filtrar emails de teste de todas as fontes de vendas (fallback para nomes de colunas antigos/novos)
      const appointments = (appointmentsResult.data || []).filter(apt => !isTestEmail(apt.email));
      const pendingPayments = (pendingPaymentsResult.data || []).filter(pp => {
        // Fallback: PostgREST pode retornar 'email' (cache antigo) ou 'patient_email' (schema atual)
        const email = pp.patient_email || (pp as any).email;
        const name = pp.patient_name || '';
        return !isTestEmail(email) && !isTestName(name);
      });
      const plans = (plansResult.data || []).filter(plan => !isTestEmail(plan.email));
      const patients = patientsResult.data || [];
      const activePlansCount = activePlansResult.data?.length || 0;

      // Combinar vendas usando APENAS pending_payments como fonte de verdade para receita
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
      const appointmentsByOrderId = new Map<string, typeof appointments[0]>();
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
      const totalSales = allSales.length;
      const totalRevenue = allSales.reduce((sum, sale) => sum + sale.price, 0);
      const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

      // Receita por mês
      const revenueByMonth: Record<string, number> = {};
      allSales.forEach(sale => {
        const month = new Date(sale.created_at).toLocaleDateString('pt-BR', {
          month: 'short',
          year: '2-digit'
        });
        revenueByMonth[month] = (revenueByMonth[month] || 0) + sale.price;
      });

      // Vendas por tipo (Consultas vs Planos)
      const salesByTypeMap: Record<string, {
        count: number;
        revenue: number;
      }> = {
        'Consultas Avulsas': {
          count: 0,
          revenue: 0
        },
        'Planos': {
          count: 0,
          revenue: 0
        }
      };
      allSales.forEach(sale => {
        const type = isPlanSku(sale.sku) ? 'Planos' : 'Consultas Avulsas';
        salesByTypeMap[type].count++;
        salesByTypeMap[type].revenue += sale.price;
      });

      // Vendas por SKU (top 10)
      const salesBySkuMap: Record<string, {
        count: number;
        revenue: number;
      }> = {};
      allSales.forEach(sale => {
        const sku = sale.sku || 'Desconhecido';
        if (!salesBySkuMap[sku]) {
          salesBySkuMap[sku] = {
            count: 0,
            revenue: 0
          };
        }
        salesBySkuMap[sku].count++;
        salesBySkuMap[sku].revenue += sale.price;
      });

      // Atendimentos por plataforma
      const platformGroups: Record<string, number> = {
        'Communicare': 0,
        'ClickLife': 0,
        'WhatsApp': 0,
        'Outros': 0
      };
      appointments.forEach(a => {
        const provider = (a.provider || '').toLowerCase();
        if (provider.includes('communicare')) {
          platformGroups['Communicare']++;
        } else if (provider.includes('clicklife')) {
          platformGroups['ClickLife']++;
        } else if (provider.includes('whatsapp')) {
          platformGroups['WhatsApp']++;
        } else if (provider) {
          platformGroups['Outros']++;
        }
      });

      setMetrics({
        totalRevenue: totalRevenue / 100,
        totalSales,
        totalPatients: patients.length,
        totalAppointments: appointments.length,
        activePlans: activePlansCount,
        averageTicket: averageTicket / 100,
        revenueByMonth: Object.entries(revenueByMonth).map(([month, revenue]) => ({
          month,
          revenue: revenue / 100
        })).sort((a, b) => {
          const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
          const [monthA, yearA] = a.month.split('/');
          const [monthB, yearB] = b.month.split('/');
          if (yearA !== yearB) return yearA.localeCompare(yearB);
          return months.indexOf(monthA.toLowerCase()) - months.indexOf(monthB.toLowerCase());
        }),
        appointmentsByPlatform: Object.entries(platformGroups).filter(([_, count]) => count > 0).map(([platform, count]) => ({
          platform,
          count
        })),
        salesByType: Object.entries(salesByTypeMap).filter(([_, data]) => data.count > 0).map(([type, data]) => ({
          type,
          count: data.count,
          revenue: data.revenue / 100
        })),
        salesBySku: Object.entries(salesBySkuMap).map(([sku, data]) => ({
          sku,
          name: SKU_NAMES[sku] || sku,
          count: data.count,
          revenue: data.revenue / 100
        })).sort((a, b) => b.count - a.count).slice(0, 10)
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };
  const exportCSV = () => {
    const lines = ['Relatório de Métricas Prontia', `Período: ${period === '7d' ? '7 dias' : period === '30d' ? '30 dias' : period === '90d' ? '90 dias' : period === 'all' ? 'Histórico completo' : '365 dias'}`, `Gerado em: ${new Date().toLocaleString('pt-BR')}`, '', 'RESUMO', `Receita Total,${metrics.totalRevenue.toFixed(2)}`, `Total de Vendas,${metrics.totalSales}`, `Ticket Médio,${metrics.averageTicket.toFixed(2)}`, `Novos Pacientes,${metrics.totalPatients}`, `Planos Ativos,${metrics.activePlans}`, `Atendimentos,${metrics.totalAppointments}`, '', 'VENDAS POR TIPO', 'Tipo,Quantidade,Receita', ...metrics.salesByType.map(t => `${t.type},${t.count},${t.revenue.toFixed(2)}`), '', 'TOP 10 SERVIÇOS/PLANOS', 'Serviço,Quantidade,Receita', ...metrics.salesBySku.map(s => `${s.name},${s.count},${s.revenue.toFixed(2)}`), '', 'ATENDIMENTOS POR PLATAFORMA', 'Plataforma,Quantidade', ...metrics.appointmentsByPlatform.map(p => `${p.platform},${p.count}`)];
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
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-48">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="365d">Último ano</SelectItem>
              <SelectItem value="all">Histórico completo</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
    </div>;
}