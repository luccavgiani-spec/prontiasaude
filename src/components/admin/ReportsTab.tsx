import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, BarChart, Bar } from 'recharts';
import { DollarSign, ShoppingCart, Users, Activity, Download, Calendar, TrendingUp } from 'lucide-react';

interface MetricsData {
  totalRevenue: number;
  totalSales: number;
  totalPatients: number;
  totalAppointments: number;
  revenueByMonth: Array<{ month: string; revenue: number }>;
  appointmentsByPlatform: Array<{ platform: string; count: number }>;
  salesByPlan: Array<{ plan: string; count: number; revenue: number }>;
  couponsByService: Array<{ service: string; count: number }>;
  activePlans: number;
}

// Mapeamento de preços por plano (em centavos)
const PLAN_PRICES: Record<string, number> = {
  'INDIVIDUAL_1M': 1490,
  'INDIVIDUAL_3M': 3990,
  'INDIVIDUAL_6M': 7490,
  'INDIVIDUAL_12M': 11990,
  'FAM_SEM_ESP_1M': 2490,
  'FAM_SEM_ESP_3M': 6990,
  'FAM_SEM_ESP_6M': 12990,
  'FAM_SEM_ESP_12M': 19990,
  'FAM_COM_ESP_1M': 3490,
  'FAM_COM_ESP_3M': 9990,
  'FAM_COM_ESP_6M': 17990,
  'FAM_COM_ESP_12M': 29990,
  'EMP_INDIVIDUAL': 0, // Empresa paga
  'EMP_FAMILIAR': 0,
};

const PLAN_NAMES: Record<string, string> = {
  'INDIVIDUAL_1M': 'Individual 1 mês',
  'INDIVIDUAL_3M': 'Individual 3 meses',
  'INDIVIDUAL_6M': 'Individual 6 meses',
  'INDIVIDUAL_12M': 'Individual 12 meses',
  'FAM_SEM_ESP_1M': 'Familiar s/ Esp. 1 mês',
  'FAM_SEM_ESP_3M': 'Familiar s/ Esp. 3 meses',
  'FAM_SEM_ESP_6M': 'Familiar s/ Esp. 6 meses',
  'FAM_SEM_ESP_12M': 'Familiar s/ Esp. 12 meses',
  'FAM_COM_ESP_1M': 'Familiar c/ Esp. 1 mês',
  'FAM_COM_ESP_3M': 'Familiar c/ Esp. 3 meses',
  'FAM_COM_ESP_6M': 'Familiar c/ Esp. 6 meses',
  'FAM_COM_ESP_12M': 'Familiar c/ Esp. 12 meses',
  'EMP_INDIVIDUAL': 'Empresarial Individual',
  'EMP_FAMILIAR': 'Empresarial Familiar',
};

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

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
    salesByPlan: [],
    couponsByService: [],
    activePlans: 0,
  });

  useEffect(() => {
    loadMetrics();
  }, [period]);

  const getDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();
    if (period === '7d') startDate.setDate(startDate.getDate() - 7);
    else if (period === '30d') startDate.setDate(startDate.getDate() - 30);
    else if (period === '90d') startDate.setDate(startDate.getDate() - 90);
    else if (period === '365d') startDate.setDate(startDate.getDate() - 365);
    return { startDate, endDate };
  };

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { startDate, endDate } = getDateRange();
      const startISO = startDate.toISOString();
      const endISO = endDate.toISOString();
      const todayStr = new Date().toISOString().split('T')[0];

      // Buscar dados em paralelo
      const [plansResult, patientsResult, appointmentsResult, couponUsesResult, activePlansResult] = await Promise.all([
        supabase
          .from('patient_plans')
          .select('id, plan_code, created_at, status, activated_by')
          .gte('created_at', startISO)
          .lte('created_at', endISO),
        supabase
          .from('patients')
          .select('id, created_at')
          .gte('created_at', startISO)
          .lte('created_at', endISO),
        supabase
          .from('appointments')
          .select('id, provider, created_at, status')
          .gte('created_at', startISO)
          .lte('created_at', endISO),
        supabase
          .from('coupon_uses')
          .select('id, service_or_plan_name, created_at')
          .gte('created_at', startISO)
          .lte('created_at', endISO),
        supabase
          .from('patient_plans')
          .select('id')
          .eq('status', 'active')
          .gte('plan_expires_at', todayStr),
      ]);

      const plans = plansResult.data || [];
      const patients = patientsResult.data || [];
      const appointments = appointmentsResult.data || [];
      const couponUses = couponUsesResult.data || [];
      const activePlansCount = activePlansResult.data?.length || 0;

      // Calcular vendas (apenas planos não-empresariais que foram pagos)
      const paidPlans = plans.filter(p => 
        !p.plan_code?.startsWith('EMP_') && 
        p.activated_by !== 'admin_manual'
      );
      const totalSales = paidPlans.length;

      // Calcular receita total
      let totalRevenue = 0;
      paidPlans.forEach(p => {
        const price = PLAN_PRICES[p.plan_code] || 0;
        totalRevenue += price;
      });

      // Receita por mês
      const revenueByMonth: Record<string, number> = {};
      paidPlans.forEach(p => {
        const month = new Date(p.created_at).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        const price = PLAN_PRICES[p.plan_code] || 0;
        revenueByMonth[month] = (revenueByMonth[month] || 0) + price;
      });

      // Vendas por plano
      const salesByPlanMap: Record<string, { count: number; revenue: number }> = {};
      paidPlans.forEach(p => {
        const planCode = p.plan_code || 'Outros';
        if (!salesByPlanMap[planCode]) {
          salesByPlanMap[planCode] = { count: 0, revenue: 0 };
        }
        salesByPlanMap[planCode].count++;
        salesByPlanMap[planCode].revenue += PLAN_PRICES[planCode] || 0;
      });

      // Atendimentos por plataforma
      const platformGroups: Record<string, number> = {
        'Communicare': 0,
        'ClickLife': 0,
        'WhatsApp': 0,
        'Outros': 0,
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

      // Cupons por serviço
      const couponsByServiceMap: Record<string, number> = {};
      couponUses.forEach(c => {
        const service = c.service_or_plan_name || 'Outros';
        couponsByServiceMap[service] = (couponsByServiceMap[service] || 0) + 1;
      });

      setMetrics({
        totalRevenue: totalRevenue / 100, // Converter centavos para reais
        totalSales,
        totalPatients: patients.length,
        totalAppointments: appointments.length,
        activePlans: activePlansCount,
        revenueByMonth: Object.entries(revenueByMonth)
          .map(([month, revenue]) => ({ month, revenue: revenue / 100 }))
          .sort((a, b) => {
            // Ordenar por data
            const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
            const [monthA, yearA] = a.month.split('/');
            const [monthB, yearB] = b.month.split('/');
            if (yearA !== yearB) return yearA.localeCompare(yearB);
            return months.indexOf(monthA.toLowerCase()) - months.indexOf(monthB.toLowerCase());
          }),
        appointmentsByPlatform: Object.entries(platformGroups)
          .filter(([_, count]) => count > 0)
          .map(([platform, count]) => ({ platform, count })),
        salesByPlan: Object.entries(salesByPlanMap)
          .map(([plan, data]) => ({
            plan: PLAN_NAMES[plan] || plan,
            count: data.count,
            revenue: data.revenue / 100,
          }))
          .sort((a, b) => b.count - a.count),
        couponsByService: Object.entries(couponsByServiceMap)
          .map(([service, count]) => ({ service, count }))
          .sort((a, b) => b.count - a.count),
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const lines = [
      'Relatório de Métricas Prontia',
      `Período: ${period === '7d' ? '7 dias' : period === '30d' ? '30 dias' : period === '90d' ? '90 dias' : '365 dias'}`,
      `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
      '',
      'RESUMO',
      `Receita Total,${metrics.totalRevenue.toFixed(2)}`,
      `Total de Vendas,${metrics.totalSales}`,
      `Novos Pacientes,${metrics.totalPatients}`,
      `Planos Ativos,${metrics.activePlans}`,
      `Atendimentos,${metrics.totalAppointments}`,
      '',
      'VENDAS POR PLANO',
      'Plano,Quantidade,Receita',
      ...metrics.salesByPlan.map(p => `${p.plan},${p.count},${p.revenue.toFixed(2)}`),
      '',
      'ATENDIMENTOS POR PLATAFORMA',
      'Plataforma,Quantidade',
      ...metrics.appointmentsByPlatform.map(p => `${p.platform},${p.count}`),
    ];

    const csv = 'data:text/csv;charset=utf-8,' + lines.join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `relatorio-prontia-${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Carregando métricas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-44">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="365d">Último ano</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Receita</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {metrics.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
            <p className="text-xs text-muted-foreground mt-1">planos vendidos</p>
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
            {metrics.revenueByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={metrics.revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis tickFormatter={(v) => `R$${v}`} className="text-xs" />
                  <Tooltip 
                    formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Receita']}
                    labelFormatter={(label) => `Mês: ${label}`}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                Sem dados de receita no período
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vendas por Plano */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vendas por Plano</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.salesByPlan.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={metrics.salesByPlan}
                    dataKey="count"
                    nameKey="plan"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ plan, count }) => `${count}`}
                  >
                    {metrics.salesByPlan.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [value, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                Sem vendas no período
              </div>
            )}
          </CardContent>
        </Card>

        {/* Atendimentos por Plataforma */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Atendimentos por Plataforma</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.appointmentsByPlatform.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={metrics.appointmentsByPlatform} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" />
                  <YAxis dataKey="platform" type="category" width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} name="Atendimentos" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                Sem atendimentos registrados no período
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cupons Utilizados */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cupons Utilizados</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.couponsByService.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={metrics.couponsByService}
                    dataKey="count"
                    nameKey="service"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ service, count }) => `${count}`}
                  >
                    {metrics.couponsByService.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                Nenhum cupom utilizado no período
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
