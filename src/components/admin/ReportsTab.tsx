import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { DollarSign, ShoppingCart, Users, Activity, Download } from 'lucide-react';

interface MetricsData {
  totalRevenue: number;
  totalSales: number;
  totalPatients: number;
  totalAppointments: number;
  revenueByMonth: Array<{ month: string; revenue: number }>;
  appointmentsByPlatform: Array<{ platform: string; count: number }>;
  salesByPlan: Array<{ plan: string; count: number }>;
  couponsByService: Array<{ service: string; count: number }>;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export default function ReportsTab() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');
  const [platform, setPlatform] = useState('all');
  const [metrics, setMetrics] = useState<MetricsData>({
    totalRevenue: 0,
    totalSales: 0,
    totalPatients: 0,
    totalAppointments: 0,
    revenueByMonth: [],
    appointmentsByPlatform: [],
    salesByPlan: [],
    couponsByService: [],
  });

  useEffect(() => {
    loadMetrics();
  }, [period, platform]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Calcular datas
      const endDate = new Date();
      const startDate = new Date();
      if (period === '7d') startDate.setDate(startDate.getDate() - 7);
      else if (period === '30d') startDate.setDate(startDate.getDate() - 30);
      else if (period === '90d') startDate.setDate(startDate.getDate() - 90);

      // ✅ Buscar dados reais das tabelas
      const { data: plans } = await supabase
        .from('patient_plans')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      const { data: patients } = await supabase
        .from('patients')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      // ✅ Buscar métricas da tabela metrics
      const { data, error } = await supabase.functions.invoke('metrics-manager', {
        body: {
          operation: 'read',
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          platform: platform !== 'all' ? platform : undefined
        }
      });

      const metricsData = (!error && data?.metrics) ? data.metrics : [];
      const sales = metricsData.filter((m: any) => m.metric_type === 'sale');
      const appointments = metricsData.filter((m: any) => m.metric_type === 'appointment');

      // ✅ Combinar dados reais com métricas
      const totalSales = sales.length;  // Usa tabela metrics (vendas reais)
      const totalPatients = patients?.length || 0;
      const totalRevenue = sales.reduce((acc: number, m: any) => acc + (m.amount_cents || 0), 0) / 100 || (totalSales * 14.90);
      const totalAppointments = appointments.length;

      // Receita por mês (baseada em planos reais)
      const revenueByMonth: Record<string, number> = {};
      plans?.forEach((p: any) => {
        const month = new Date(p.created_at).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        revenueByMonth[month] = (revenueByMonth[month] || 0) + 14.90;
      });

      // Atendimentos por plataforma (3 categorias: Communicare, ClickLife, WhatsApp)
      const platformGroups = {
        'Communicare': 0,
        'ClickLife': 0,
        'WhatsApp': 0
      };
      
      appointments.forEach((m: any) => {
        const provider = (m.platform || '').toLowerCase();
        
        if (provider === 'communicare' || provider === 'agendar_cc') {
          platformGroups['Communicare']++;
        } else if (
          provider === 'clicklife' || 
          provider === 'whatsapp_manual' || 
          provider === 'plan_purchase'
        ) {
          platformGroups['ClickLife']++;
        } else if (
          provider === 'whatsapp' || 
          provider === 'whatsapp_laudos' || 
          provider === 'whatsapp_exames'
        ) {
          platformGroups['WhatsApp']++;
        }
      });

      // Vendas por plano (baseada em planos reais)
      const salesByPlan: Record<string, number> = {};
      plans?.forEach((p: any) => {
        const plan = p.plan_code || 'N/A';
        salesByPlan[plan] = (salesByPlan[plan] || 0) + 1;
      });

      // Cupons utilizados por serviço/plano
      const { data: couponUses } = await supabase
        .from('coupon_uses')
        .select('service_or_plan_name')
        .gte('used_at', startDate.toISOString())
        .lte('used_at', endDate.toISOString());
      
      const couponsByService: Record<string, number> = {};
      couponUses?.forEach((c: any) => {
        const service = c.service_or_plan_name || 'Outros';
        couponsByService[service] = (couponsByService[service] || 0) + 1;
      });

      setMetrics({
        totalRevenue,
        totalSales,
        totalPatients,
        totalAppointments,
        revenueByMonth: Object.entries(revenueByMonth).map(([month, revenue]) => ({ month, revenue })),
        appointmentsByPlatform: Object.entries(platformGroups).map(([platform, count]) => ({ platform, count })),
        salesByPlan: Object.entries(salesByPlan).map(([plan, count]) => ({ plan, count })),
        couponsByService: Object.entries(couponsByService).map(([service, count]) => ({ service, count })),
      });
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    // Implementar exportação CSV
    const csv = 'data:text/csv;charset=utf-8,Relatório de Métricas\n';
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `relatorio-${new Date().toISOString()}.csv`);
    link.click();
  };

  if (loading) {
    return <div className="p-8 text-center">Carregando métricas...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>

          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Plataformas</SelectItem>
              <SelectItem value="clicklife">ClickLife</SelectItem>
              <SelectItem value="communicare">Communicare</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalSales}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pacientes Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalPatients}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Atendimentos</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalAppointments}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Receita por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics.revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke={COLORS[0]} name="Receita (R$)" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Atendimentos por Plataforma</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={metrics.appointmentsByPlatform} dataKey="count" nameKey="platform" cx="50%" cy="50%" outerRadius={80} label>
                  {metrics.appointmentsByPlatform.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Plano</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={metrics.salesByPlan} dataKey="count" nameKey="plan" cx="50%" cy="50%" outerRadius={80} label>
                  {metrics.salesByPlan.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cupons Utilizados */}
        <Card>
          <CardHeader>
            <CardTitle>Cupons Utilizados por Serviço/Plano</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.couponsByService.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={metrics.couponsByService}
                    dataKey="count"
                    nameKey="service"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry) => `${entry.service}: ${entry.count}`}
                  >
                    {metrics.couponsByService.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Nenhum cupom utilizado no período selecionado
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
