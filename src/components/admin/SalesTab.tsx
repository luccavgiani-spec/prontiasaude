import { useEffect, useState, useMemo } from "react";
import { getServiceNameFromSKU } from "@/lib/sku-mapping";
import { supabaseProduction } from "@/lib/supabase-production";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Copy, Search, Download, DollarSign, Calendar, TrendingUp, BarChart3, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { format, startOfDay, startOfWeek, isAfter, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, getDaysInMonth, isSameMonth, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

// 🔒 Data mínima para filtrar vendas (histórico completo desde março/2025)
const SALES_START_DATE = '2025-03-01T00:00:00.000Z';

// 💰 Mapeamento de SKUs para preços em centavos
const SKU_PRICES: Record<string, number> = {
  // Consultas avulsas (SKUs atuais)
  'ITC6534': 4390,      // Clínico Geral
  'ZXW2165': 3999,      // Psicólogo
  'OVM9892': 11990,     // Laudo Psicológico
  'ULT3571': 4390,      // Solicitação de Exames
  
  // MÉDICOS ESPECIALISTAS (R$89,90)
  'VHH8883': 8990,      // Endocrinologista
  'TVQ5046': 8990,      // Ortopedista
  'TQP5720': 8990,      // Cardiologista
  'HGG3503': 8990,      // Dermatologista
  'TSB0751': 8990,      // Gastroenterologista
  'CCP1566': 8990,      // Ginecologista
  'FKS5964': 8990,      // Oftalmologista
  'HMG9544': 8990,      // Pediatra
  'HME8366': 8990,      // Otorrinolaringologista
  'DYY8522': 8990,      // Médico da Família
  'LZF3879': 8990,      // Nutrólogo
  'YZD9932': 8990,      // Geriatria
  'UDH3250': 8990,      // Reumatologista
  'PKS9388': 8990,      // Neurologista
  'MYX5186': 8990,      // Infectologista
  
  // OUTROS PROFISSIONAIS
  'BIR7668': 5490,      // Personal Trainer (R$54,90)
  'VPN5132': 6990,      // Nutricionista (R$69,90)
  'HXR8516': 3999,      // Psicólogo 4 sessões
  'YME9025': 3999,      // Psicólogo 8 sessões
  'QOP1101': 8990,      // Psiquiatra
  
  // SKUs legados (dados históricos)
  'RZP5755': 4390,      // Clínico (variante)
  'consulta-clinico-geral': 4390,
  'CLK-CLINICO': 4390,
  
  // Planos mensais
  'IND_SEM_ESP_1M': 1999,
  'IND_COM_ESP_1M': 2399,
  'FAM_SEM_ESP_1M': 3499,
  'FAM_COM_ESP_1M': 4390,
  
  // Planos anuais
  'IND_SEM_ESP_12M': 19990,
  'IND_COM_ESP_12M': 23990,
  'FAM_SEM_ESP_12M': 34990,
  'FAM_COM_ESP_12M': 43900,
};

interface Appointment {
  id: string;
  appointment_id: string;
  email: string;
  user_id?: string;
  service_code: string;
  service_name?: string;
  start_at_local: string;
  duration_min: number;
  status: string;
  order_id?: string;
  teams_join_url?: string;
  teams_meeting_id?: string;
  provider?: string;
  redirect_url?: string;
  created_at: string;
  updated_at: string;
}

interface DailyChartData {
  day: number;
  dayLabel: string;
  sales: number;
  revenue: number;
}

// 🛡️ Helper para formatação segura de datas (evita crash com null/undefined)
const safeFormatDate = (dateString: string | null | undefined, formatStr: string = "dd/MM/yyyy HH:mm"): string => {
  if (!dateString) return "-";
  try {
    return format(parseISO(dateString), formatStr, { locale: ptBR });
  } catch {
    return "-";
  }
};

const SalesTab = () => {
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [filterService, setFilterService] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProvider, setFilterProvider] = useState("all");
  
  // 📅 Estado para seleção de mês no card de desempenho
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // 📆 Gerar lista de meses disponíveis (desde Mar/2025)
  const availableMonths = useMemo(() => {
    const months: { value: string; label: string }[] = [];
    const now = new Date();
    const startDate = new Date(2025, 2, 1); // Mar 2025

    for (let i = 0; i < 24; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      if (date < startDate) break;
      
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      months.push({ 
        value, 
        label: label.charAt(0).toUpperCase() + label.slice(1) 
      });
    }
    return months;
  }, []);

  const loadAppointments = async () => {
    try {
      // ✅ Buscar diretamente da tabela appointments (fonte correta com 522+ registros)
      const { data: appointmentsData, error } = await supabaseProduction
        .from("appointments")
        .select("*")
        .gte("created_at", SALES_START_DATE)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Erro ao buscar appointments:", error);
        throw error;
      }

      // Transformar appointments para formato de "venda"
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
      } as Appointment));

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

  useEffect(() => {
    loadAppointments();

    const channel = supabase
      .channel("appointments-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "appointments",
        },
        (payload) => {
          toast({
            title: "Nova venda registrada!",
            description: `Serviço: ${payload.new.service_name || payload.new.service_code}`,
          });
          loadAppointments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 📊 Análise mensal comparativa
  const monthlyAnalysis = useMemo(() => {
    const now = new Date();
    
    // Usar o mês selecionado
    const [year, month] = selectedMonth.split('-').map(Number);
    const selectedDate = new Date(year, month - 1, 15);
    const isCurrentMonth = isSameMonth(selectedDate, now);
    
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    const daysInMonth = getDaysInMonth(selectedDate);
    
    // Se é o mês atual, usa o dia atual; senão, usa todos os dias do mês
    const dayOfMonth = isCurrentMonth ? now.getDate() : daysInMonth;

    // Vendas do mês selecionado
    const monthSales = appointments.filter(apt => {
      const aptDate = parseISO(apt.created_at);
      return isSameMonth(aptDate, selectedDate);
    });

    // Receita do mês
    const monthRevenue = monthSales.reduce((sum, apt) => {
      const price = SKU_PRICES[apt.service_code] || 0;
      return sum + price;
    }, 0);

    // Média diária do mês selecionado
    const avgDailySales = dayOfMonth > 0 ? monthSales.length / dayOfMonth : 0;
    
    // Vendas de hoje (só relevante se for o mês atual)
    const todaySales = isCurrentMonth 
      ? appointments.filter(apt => isAfter(parseISO(apt.created_at), startOfDay(now))).length
      : 0;
    const todayRevenue = isCurrentMonth 
      ? appointments.filter(apt => isAfter(parseISO(apt.created_at), startOfDay(now)))
          .reduce((sum, apt) => sum + (SKU_PRICES[apt.service_code] || 0), 0)
      : 0;
    
    // Projeção mensal (só faz sentido para o mês atual)
    const projectedMonthlySales = isCurrentMonth 
      ? Math.round(avgDailySales * daysInMonth)
      : monthSales.length;
    const projectedMonthlyRevenue = isCurrentMonth && dayOfMonth > 0
      ? (monthRevenue / dayOfMonth) * daysInMonth 
      : monthRevenue;
    
    // Comparação com mês anterior
    const prevMonthDate = new Date(year, month - 2, 15);
    const prevMonthSales = appointments.filter(apt => {
      const aptDate = parseISO(apt.created_at);
      return isSameMonth(aptDate, prevMonthDate);
    });
    const prevMonthRevenue = prevMonthSales.reduce((sum, apt) => sum + (SKU_PRICES[apt.service_code] || 0), 0);
    
    // Dados para o gráfico por dia
    const daysOfMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const dailyData: DailyChartData[] = daysOfMonth.map((day, index) => {
      const daySales = monthSales.filter(apt => isSameDay(parseISO(apt.created_at), day));
      const dayRevenue = daySales.reduce((sum, apt) => sum + (SKU_PRICES[apt.service_code] || 0), 0);
      return {
        day: index + 1,
        dayLabel: format(day, 'dd', { locale: ptBR }),
        sales: daySales.length,
        revenue: dayRevenue / 100,
      };
    });

    // Melhor e pior dia
    const sortedDays = [...dailyData].filter(d => d.sales > 0).sort((a, b) => b.sales - a.sales);
    const bestDay = sortedDays[0] || null;
    const worstDay = sortedDays[sortedDays.length - 1] || null;

    return {
      currentMonthSales: monthSales.length,
      currentMonthRevenue: monthRevenue / 100,
      avgDailySales,
      todaySales,
      todayRevenue: todayRevenue / 100,
      projectedMonthlySales,
      projectedMonthlyRevenue: projectedMonthlyRevenue / 100,
      prevMonthTotal: prevMonthSales.length,
      prevMonthRevenue: prevMonthRevenue / 100,
      dailyData: isCurrentMonth ? dailyData.filter(d => d.day <= dayOfMonth) : dailyData,
      bestDay,
      worstDay,
      monthName: format(selectedDate, 'MMMM', { locale: ptBR }),
      year: format(selectedDate, 'yyyy'),
      isCurrentMonth,
    };
  }, [appointments, selectedMonth]);

  const filteredAppointments = appointments.filter((apt) => {
    if (searchEmail && !apt.email.toLowerCase().includes(searchEmail.toLowerCase())) return false;
    if (filterService !== "all" && apt.service_code !== filterService) return false;
    if (filterStatus !== "all" && apt.status !== filterStatus) return false;
    if (filterProvider !== "all" && apt.provider !== filterProvider) return false;
    return true;
  });

  const totalSales = appointments.length;
  const salesToday = appointments.filter(
    (apt) => isAfter(parseISO(apt.created_at), startOfDay(new Date()))
  ).length;
  const salesThisWeek = appointments.filter(
    (apt) => isAfter(parseISO(apt.created_at), startOfWeek(new Date(), { locale: ptBR }))
  ).length;
  const salesByProvider = appointments.reduce((acc, apt) => {
    const provider = apt.provider || "Desconhecido";
    acc[provider] = (acc[provider] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const uniqueServices = Array.from(new Set(appointments.map((apt) => apt.service_code)));

  const handleCopyLink = (url: string, serviceName: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copiado!",
      description: `Link de ${serviceName} copiado para a área de transferência.`,
    });
  };

  const simplifyUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname + urlObj.hash;
      const shortPath = path.length > 20 ? '...' + path.slice(-15) : path;
      return urlObj.hostname + shortPath;
    } catch {
      return url.length > 30 ? url.slice(0, 15) + '...' + url.slice(-15) : url;
    }
  };

  const exportCSV = () => {
    const headers = [
      "Email",
      "Serviço",
      "Código",
      "Data Agendamento",
      "Status",
      "Provider",
      "Order ID",
      "Data Venda",
      "Link Redirecionamento",
    ];
    const rows = filteredAppointments.map((apt) => [
      apt.email,
      apt.service_name || "-",
      apt.service_code,
      safeFormatDate(apt.start_at_local),
      apt.status,
      apt.provider || "-",
      apt.order_id || "-",
      safeFormatDate(apt.created_at),
      apt.redirect_url || apt.teams_join_url || "-",
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `vendas_${format(new Date(), "yyyy-MM-dd_HHmm")}.csv`;
    link.click();

    toast({
      title: "Exportação concluída",
      description: `${filteredAppointments.length} vendas exportadas.`,
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      scheduled: "default",
      completed: "secondary",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  const getProviderBadge = (provider?: string) => {
    if (!provider) return <Badge variant="outline">Desconhecido</Badge>;
    return (
      <Badge variant={provider.toLowerCase().includes("clicklife") ? "default" : "secondary"}>
        {provider}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Carregando vendas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSales}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas Hoje</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesToday}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas Esta Semana</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesThisWeek}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Por Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs space-y-1">
              {Object.entries(salesByProvider).map(([provider, count]) => (
                <div key={provider} className="flex justify-between">
                  <span className="text-muted-foreground">{provider}:</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 📊 Card de Análise Comparativa Mensal */}
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Desempenho Mensal</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[180px] h-8">
                  <SelectValue placeholder="Selecionar mês" />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map(month => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="outline" className="text-xs whitespace-nowrap">
                {monthlyAnalysis.isCurrentMonth ? 'Tempo real' : 'Histórico'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Métricas principais */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
            {/* 1. Receita do Mês */}
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Receita do Mês</p>
              <p className="text-xl font-bold text-primary">
                R$ {monthlyAnalysis.currentMonthRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            
            {/* 2. Vendas do Mês */}
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Vendas do Mês</p>
              <p className="text-xl font-bold">{monthlyAnalysis.currentMonthSales}</p>
            </div>
            
            {/* 3. Vendas de Hoje */}
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Vendas de Hoje</p>
              <p className="text-xl font-bold">{monthlyAnalysis.todaySales}</p>
              <p className="text-xs text-muted-foreground">
                R$ {monthlyAnalysis.todayRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            
            {/* 4. Projeção Mensal + Comparativo */}
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Projeção Mensal</p>
              <p className="text-xl font-bold">{monthlyAnalysis.projectedMonthlySales} vendas</p>
              <p className="text-xs text-muted-foreground">
                ~R$ {monthlyAnalysis.projectedMonthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <div className="flex items-center gap-1 mt-1 border-t border-muted pt-1">
                {monthlyAnalysis.projectedMonthlySales >= monthlyAnalysis.prevMonthTotal ? (
                  <ArrowUpRight className="h-3 w-3 text-green-500" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 text-red-500" />
                )}
                <p className="text-xs text-muted-foreground">
                  vs {monthlyAnalysis.prevMonthTotal} mês anterior
                </p>
              </div>
            </div>
            
            {/* 5. Hoje vs Média Diária */}
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">Hoje vs Média</p>
              <div className="flex items-center gap-1">
                {monthlyAnalysis.todaySales >= monthlyAnalysis.avgDailySales ? (
                  <ArrowUpRight className="h-4 w-4 text-green-500" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-500" />
                )}
                <p className={`text-xl font-bold ${monthlyAnalysis.todaySales >= monthlyAnalysis.avgDailySales ? 'text-green-500' : 'text-red-500'}`}>
                  {monthlyAnalysis.todaySales} / {monthlyAnalysis.avgDailySales.toFixed(1)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {monthlyAnalysis.todaySales >= monthlyAnalysis.avgDailySales 
                  ? `+${(monthlyAnalysis.todaySales - monthlyAnalysis.avgDailySales).toFixed(1)} acima`
                  : `${(monthlyAnalysis.todaySales - monthlyAnalysis.avgDailySales).toFixed(1)} abaixo`
                }
              </p>
            </div>
          </div>

          {/* Gráfico de Histograma */}
          <div className="bg-muted/30 rounded-lg p-4">
            <p className="text-sm font-medium mb-4">Vendas por Dia do Mês</p>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyAnalysis.dailyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="dayLabel" 
                    tick={{ fontSize: 10 }} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }} 
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border rounded-lg shadow-lg p-2">
                            <p className="text-xs font-medium">Dia {label}</p>
                            <p className="text-xs text-primary">{payload[0].value} vendas</p>
                            <p className="text-xs text-muted-foreground">
                              R$ {(payload[0].payload.revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine 
                    y={monthlyAnalysis.avgDailySales} 
                    stroke="hsl(var(--primary))" 
                    strokeDasharray="5 5"
                    strokeWidth={2}
                  />
                  <Bar 
                    dataKey="sales" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                    maxBarSize={30}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-primary"></div>
                <span>Vendas do dia</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-0.5 bg-primary" style={{ borderStyle: 'dashed' }}></div>
                <span>Média diária ({monthlyAnalysis.avgDailySales.toFixed(1)}/dia)</span>
              </div>
            </div>
          </div>

          {/* Destaques do mês */}
          {(monthlyAnalysis.bestDay || monthlyAnalysis.worstDay) && (
            <div className="grid gap-4 grid-cols-2">
              {monthlyAnalysis.bestDay && (
                <div className="flex items-center gap-3 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="p-2 bg-green-500/20 rounded-full">
                    <ArrowUpRight className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Melhor dia</p>
                    <p className="text-sm font-medium">
                      Dia {monthlyAnalysis.bestDay.day} - {monthlyAnalysis.bestDay.sales} vendas
                    </p>
                  </div>
                </div>
              )}
              {monthlyAnalysis.worstDay && monthlyAnalysis.bestDay?.day !== monthlyAnalysis.worstDay?.day && (
                <div className="flex items-center gap-3 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                  <div className="p-2 bg-orange-500/20 rounded-full">
                    <ArrowDownRight className="h-4 w-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Menor movimento</p>
                    <p className="text-sm font-medium">
                      Dia {monthlyAnalysis.worstDay.day} - {monthlyAnalysis.worstDay.sales} vendas
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por email..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={filterService} onValueChange={setFilterService}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os serviços" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os serviços</SelectItem>
                {uniqueServices.map((service) => (
                  <SelectItem key={service} value={service}>
                    {service}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterProvider} onValueChange={setFilterProvider}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os providers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os providers</SelectItem>
                <SelectItem value="ClickLife">ClickLife</SelectItem>
                <SelectItem value="Communicare">Communicare</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end mt-4">
            <Button onClick={exportCSV} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Vendas */}
      <Card>
        <CardHeader>
          <CardTitle>
            Vendas ({filteredAppointments.length} {filteredAppointments.length === 1 ? "registro" : "registros"})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Data Agendamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Link da Consulta</TableHead>
                  <TableHead>Data Venda</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAppointments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Nenhuma venda encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAppointments.map((apt) => (
                    <TableRow key={apt.id}>
                      <TableCell className="font-medium">{apt.email}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{apt.service_name || "-"}</div>
                          <div className="text-xs text-muted-foreground">{apt.service_code}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {safeFormatDate(apt.start_at_local)}
                      </TableCell>
                      <TableCell>{getStatusBadge(apt.status)}</TableCell>
                      <TableCell>{getProviderBadge(apt.provider)}</TableCell>
                      <TableCell>
                        {(apt.redirect_url || apt.teams_join_url) ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px]" title={apt.redirect_url || apt.teams_join_url}>
                              {simplifyUrl(apt.redirect_url || apt.teams_join_url || "")}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                handleCopyLink(
                                  apt.redirect_url || apt.teams_join_url || "",
                                  apt.service_name || apt.service_code
                                )
                              }
                              className="h-6 w-6 p-0"
                              title="Copiar link completo"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {safeFormatDate(apt.created_at)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesTab;
