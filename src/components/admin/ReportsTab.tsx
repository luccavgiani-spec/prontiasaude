import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabaseProduction } from '@/lib/supabase-production';
import { PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, BarChart, Bar } from 'recharts';
import { DollarSign, ShoppingCart, Users, Activity, Download, Calendar, TrendingUp, Percent, RefreshCw } from 'lucide-react';
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

// Ajustes mensais baseados no relatório oficial do Mercado Pago
// Usado para corrigir gaps de registros (webhooks que falharam)
// Formato: 'mes/ano' => { revenue: valor_em_centavos, sales: quantidade }
const MP_ADJUSTMENTS: Record<string, { revenue: number; sales: number }> = {
  'dez./25': { revenue: 135141, sales: 30 },   // R$ 1.351,41 - 30 vendas
  'jan./26': { revenue: 1481247, sales: 370 }, // R$ 14.812,47 - 370 vendas
};

// Normalizar valores: Produção usa amount_cents (já em centavos)
// Cloud usa amount (em reais, precisa converter)
const normalizeAmountFromSource = (amountCents: number | undefined, amountReais: number | undefined): number => {
  // Priorizar amount_cents (já em centavos) sobre amount (em reais)
  if (amountCents !== undefined && amountCents !== null) {
    return amountCents;
  }
  if (amountReais !== undefined && amountReais !== null) {
    // Assumir que valores < 1000 são em reais
    const num = Number(amountReais);
    return num >= 1000 ? num : Math.round(num * 100);
  }
  return 0;
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
  'HXR8516': 4990,
  // Psicólogo 4 sessões
  'YME9025': 4990,
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
  const [period, setPeriod] = useState('30d');
  const [recurrencePeriod, setRecurrencePeriod] = useState<number | 'all'>(30);
  const [recurrenceData, setRecurrenceData] = useState<RecurrenceData | null>(null);
  const [recurrenceLoading, setRecurrenceLoading] = useState(true);
  const [recurrenceError, setRecurrenceError] = useState<string | null>(null);
  const [allAppointments, setAllAppointments] = useState<Array<{ email: string; created_at: string; order_id?: string }>>([]);
  const [appointmentsLoaded, setAppointmentsLoaded] = useState(false);
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

  // Load all appointments once (same source as SalesTab)
  useEffect(() => {
    const loadAllAppointments = async () => {
      try {
        const { data: appointmentsData, error } = await supabaseProduction
          .from('appointments')
          .select('id, email, created_at, order_id, service_code')
          .gte('created_at', SALES_START_DATE)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Apply same filters as SalesTab: exclude test emails, require order_id, deduplicate
        const filteredData = (appointmentsData || []).filter(apt => {
          if (!apt.order_id || apt.order_id.trim() === '') return false;
          if (isTestEmail(apt.email)) return false;
          return true;
        });

        // Deduplicate by order_id
        const seen = new Map<string, boolean>();
        const uniqueData = filteredData.filter(apt => {
          const key = apt.order_id || `${apt.email}_${apt.service_code}_${apt.created_at?.slice(0, 10)}`;
          if (seen.has(key)) return false;
          seen.set(key, true);
          return true;
        });

        setAllAppointments(uniqueData);
        setAppointmentsLoaded(true);
      } catch (err) {
        console.error('Error loading appointments for recurrence:', err);
        setAppointmentsLoaded(true);
      }
    };
    loadAllAppointments();
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
          // Produção usa 'amount_cents', Cloud usa 'amount'
          const amountCents = (pp as any).amount_cents;
          const amountReais = pp.amount;
          
          // Buscar contexto do appointment se existir
          const apt = pp.order_id ? appointmentsByOrderId.get(pp.order_id) : null;
          
          salesMap.set(key, {
            id: pp.id,
            sku: sku || apt?.service_code || '',
            created_at: pp.created_at || new Date().toISOString(),
            order_id: pp.order_id,
            source: 'pending_payment',
            price: normalizeAmountFromSource(amountCents, amountReais),
            provider: apt?.provider
          });
        }
      });

      const allSales = Array.from(salesMap.values());
      
      // Agrupar vendas do banco por mês para aplicar ajustes do MP
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

      // Calcular totais com ajustes do MP
      let adjustedTotalRevenue = 0;
      let adjustedTotalSales = 0;

      // Para cada mês no banco, usar valor do MP se disponível
      Object.entries(dbSalesByMonth).forEach(([month, data]) => {
        if (MP_ADJUSTMENTS[month]) {
          adjustedTotalRevenue += MP_ADJUSTMENTS[month].revenue;
          adjustedTotalSales += MP_ADJUSTMENTS[month].sales;
        } else {
          adjustedTotalRevenue += data.revenue;
          adjustedTotalSales += data.sales;
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

      // Receita por mês (aplicando ajustes do MP)
      const revenueByMonth: Record<string, number> = {};
      
      // Primeiro, popular com dados do banco
      allSales.forEach(sale => {
        const month = new Date(sale.created_at).toLocaleDateString('pt-BR', {
          month: 'short',
          year: '2-digit'
        });
        revenueByMonth[month] = (revenueByMonth[month] || 0) + sale.price;
      });
      
      // Aplicar ajustes do MP (substituir valores do banco pelos valores reais)
      Object.entries(MP_ADJUSTMENTS).forEach(([mpMonth, data]) => {
        // Encontrar o mês correspondente no formato do banco (ex: 'dez./25' -> 'Dez./25')
        const monthCapitalized = mpMonth.charAt(0).toUpperCase() + mpMonth.slice(1);
        
        // Substituir ou adicionar o valor do MP
        if (revenueByMonth[monthCapitalized] !== undefined) {
          revenueByMonth[monthCapitalized] = data.revenue;
        } else if (revenueByMonth[mpMonth] !== undefined) {
          revenueByMonth[mpMonth] = data.revenue;
        } else {
          // Adicionar mês que não existe no banco
          revenueByMonth[monthCapitalized] = data.revenue;
        }
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