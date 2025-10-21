import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { getServiceNameFromSKU } from '@/lib/sku-mapping';
import { PlayCircle, CheckCircle, XCircle, ChevronDown, Clock, AlertCircle, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TestResult {
  suite_id?: string;
  sub_id?: string;
  scenario_id: string;
  timestamp: string;
  status: 'passou' | 'falhou';
  provider?: string;
  reason?: string;
  plano_id?: number;
  response_time: number;
  request: any;
  response: any;
  error?: string;
}

const SKU_OPTIONS = [
  { value: 'ITC6534', label: 'Clínico Geral (ITC6534)' },
  { value: 'ZXW2165', label: 'Psicólogo 1 sessão (ZXW2165)' },
  { value: 'HXR8516', label: 'Psicólogo 4 sessões (HXR8516)' },
  { value: 'YME9025', label: 'Psicólogo 8 sessões (YME9025)' },
  { value: 'TQP5720', label: 'Cardiologista (TQP5720)' },
  { value: 'HGG3503', label: 'Dermatologista (HGG3503)' },
  { value: 'VHH8883', label: 'Endocrinologista (VHH8883)' },
  { value: 'CCP1566', label: 'Ginecologista (CCP1566)' },
];

// ========== UTILITÁRIOS ==========

/**
 * Gera CPF válido aleatório
 */
function generateValidCPF(): string {
  const randomDigits = () => Math.floor(Math.random() * 10);
  
  // Gera 9 dígitos aleatórios
  const digits = Array.from({ length: 9 }, randomDigits);
  
  // Calcula primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += digits[i] * (10 - i);
  }
  let firstCheck = 11 - (sum % 11);
  if (firstCheck >= 10) firstCheck = 0;
  digits.push(firstCheck);
  
  // Calcula segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += digits[i] * (11 - i);
  }
  let secondCheck = 11 - (sum % 11);
  if (secondCheck >= 10) secondCheck = 0;
  digits.push(secondCheck);
  
  return digits.join('');
}

/**
 * Gera email único com timestamp
 */
function uniqueEmail(prefix: string): string {
  const timestamp = Date.now();
  return `${prefix}+${timestamp}@prontiasaude.com.br`;
}

const TestesRoteamento: React.FC = () => {
  const [testData, setTestData] = useState({
    cpf: generateValidCPF(),
    email: uniqueEmail('teste'),
    nome: 'Usuário Teste',
    telefone: '+5511999999999',
    especialidade: 'clinico geral',
    sku: 'ITC6534',
    horario_iso: new Date().toISOString(),
    plano_ativo: false
  });
  const [currentResult, setCurrentResult] = useState<TestResult | null>(null);
  const [testHistory, setTestHistory] = useState<TestResult[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [forceClicklife, setForceClicklife] = useState(false);
  const [loadingOverride, setLoadingOverride] = useState(false);
  const [isRunningCommunicare, setIsRunningCommunicare] = useState(false);
  const [isRunningClicklife, setIsRunningClicklife] = useState(false);

  // Carregar status do force_clicklife ao montar
  useEffect(() => {
    loadForceClicklifeStatus();
  }, []);

  const loadForceClicklifeStatus = async () => {
    try {
      const { data } = await supabase
        .from('admin_settings')
        .select('value')
        .eq('key', 'force_clicklife')
        .maybeSingle();
      
      setForceClicklife(data?.value === 'true');
    } catch (error) {
      console.error('Erro ao carregar force_clicklife:', error);
    }
  };

  const toggleForceClicklife = async () => {
    setLoadingOverride(true);
    try {
      const newValue = !forceClicklife;
      const { error } = await supabase
        .from('admin_settings')
        .upsert({ 
          key: 'force_clicklife', 
          value: newValue.toString(),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setForceClicklife(newValue);
      toast.success(`Override ${newValue ? 'ativado' : 'desativado'}: ${newValue ? 'todos irão para ClickLife' : 'roteamento normal'}`);
    } catch (error) {
      console.error('Erro ao atualizar force_clicklife:', error);
      toast.error('Erro ao atualizar override');
    } finally {
      setLoadingOverride(false);
    }
  };

  const executeTest = async () => {
    setIsExecuting(true);
    const startTime = Date.now();

    try {
      console.log('[QA Test] Executando teste manual');
      console.log('[QA Test] Request:', testData);

      const { data, error } = await supabase.functions.invoke('schedule-redirect', {
        body: testData
      });

      const responseTime = Date.now() - startTime;

      if (error) throw error;

      console.log('[QA Test] Response:', data);
      console.log(`[QA Test] Tempo de resposta: ${responseTime}ms`);

      const result: TestResult = {
        scenario_id: 'Manual',
        timestamp: new Date().toISOString(),
        status: 'passou',
        provider: data.provider,
        reason: data.reason,
        plano_id: data.plano_id,
        response_time: responseTime,
        request: testData,
        response: data
      };

      setCurrentResult(result);
      setTestHistory(prev => [result, ...prev].slice(0, 20));
      toast.success('✅ Teste executado com sucesso!');
    } catch (error: any) {
      console.error('[QA Test] Erro:', error);
      
      let errorDetails = error.message || 'Erro desconhecido';
      let errorContext = null;
      
      if (error.context) {
        try {
          const contextClone = error.context.clone();
          try {
            errorContext = await contextClone.json();
            if (errorContext.error) {
              errorDetails = errorContext.error;
            }
          } catch {
            const textContent = await error.context.text();
            errorContext = { raw: textContent };
            if (textContent) {
              errorDetails = textContent;
            }
          }
        } catch (contextError) {
          console.error('[QA Test] Erro ao ler contexto:', contextError);
        }
      }
      
      const responseTime = Date.now() - startTime;
      const result: TestResult = {
        scenario_id: 'Manual',
        timestamp: new Date().toISOString(),
        status: 'falhou',
        response_time: responseTime,
        request: testData,
        response: errorContext,
        error: errorDetails
      };

      setCurrentResult(result);
      setTestHistory(prev => [result, ...prev].slice(0, 20));
      toast.error(`Erro: ${errorDetails}`);
    } finally {
      setIsExecuting(false);
    }
  };

  /**
   * SUÍTE COMMUNICARE
   * Testa especialidades disponíveis na Communicare durante horário comercial
   */
  const runCommunicareSuite = async () => {
    setIsRunningCommunicare(true);
    
    const subcases = [
      { id: 'C1', especialidade: 'clinico geral', sku: 'ITC6534', nome: 'Clínico Geral' },
      { id: 'C2', especialidade: 'psicologo_1', sku: 'ZXW2165', nome: 'Psicólogo 1 sessão' },
      { id: 'C3', especialidade: 'nutricionista', sku: 'VPN5132', nome: 'Nutricionista' },
    ];
    
    // Segunda-feira 14:00 (horário comercial em Brasília UTC-3)
    const commercialHour = new Date();
    commercialHour.setHours(17, 0, 0, 0); // 14h Brasília = 17h UTC
    const dayOfWeek = commercialHour.getDay();
    if (dayOfWeek === 0) commercialHour.setDate(commercialHour.getDate() + 1); // Se domingo → segunda
    if (dayOfWeek === 6) commercialHour.setDate(commercialHour.getDate() + 2); // Se sábado → segunda
    
    let passed = 0;
    let failed = 0;
    
    for (const subcase of subcases) {
      const cpf = generateValidCPF();
      const email = uniqueEmail(`communicare_${subcase.id.toLowerCase()}`);
      
      const payload = {
        cpf,
        email,
        nome: `Teste ${subcase.nome}`,
        telefone: '+5511999999999',
        especialidade: subcase.especialidade,
        sku: subcase.sku,
        horario_iso: commercialHour.toISOString(),
        plano_ativo: false
      };
      
      const startTime = Date.now();
      
      try {
        console.log(`[Communicare Suite] Executando ${subcase.id}: ${subcase.nome}`);
        
        const { data, error } = await supabase.functions.invoke('schedule-redirect', {
          body: payload
        });
        
        const responseTime = Date.now() - startTime;
        
        if (error) throw error;
        
        // Validar resultado
        const providerMatch = data.provider === 'communicare';
        const reasonMatch = data.reason === 'commercial_hours';
        const status = providerMatch && reasonMatch ? 'passou' : 'falhou';
        
        if (status === 'passou') {
          passed++;
        } else {
          failed++;
        }
        
        const result: TestResult = {
          suite_id: 'COMMUNICARE',
          sub_id: subcase.id,
          scenario_id: `Communicare Suite - ${subcase.nome}`,
          timestamp: new Date().toISOString(),
          status,
          provider: data.provider,
          reason: data.reason,
          response_time: responseTime,
          request: payload,
          response: data,
          error: !providerMatch ? `Esperado: communicare, Recebido: ${data.provider}` : 
                 !reasonMatch ? `Esperado reason: commercial_hours, Recebido: ${data.reason}` : undefined
        };
        
        setTestHistory(prev => [result, ...prev].slice(0, 20));
        
      } catch (error: any) {
        failed++;
        
        let errorDetails = error.message || 'Erro desconhecido';
        let errorContext = null;
        
        if (error.context) {
          try {
            const contextClone = error.context.clone();
            errorContext = await contextClone.json();
            if (errorContext.error) errorDetails = errorContext.error;
          } catch {}
        }
        
        const responseTime = Date.now() - startTime;
        const result: TestResult = {
          suite_id: 'COMMUNICARE',
          sub_id: subcase.id,
          scenario_id: `Communicare Suite - ${subcase.nome}`,
          timestamp: new Date().toISOString(),
          status: 'falhou',
          response_time: responseTime,
          request: payload,
          response: errorContext,
          error: errorDetails
        };
        
        setTestHistory(prev => [result, ...prev].slice(0, 20));
      }
    }
    
    setIsRunningCommunicare(false);
    
    if (failed === 0) {
      toast.success(`✅ Suíte Communicare: ${passed}/${subcases.length} testes passaram`);
    } else {
      toast.error(`❌ Suíte Communicare: ${failed}/${subcases.length} testes falharam`);
    }
  };

  /**
   * SUÍTE CLICKLIFE
   * Testa: admin_override, plano_ativo (863/864), noturno, fim de semana, especialidade indisponível
   */
  const runClicklifeSuite = async () => {
    setIsRunningClicklife(true);
    
    // Guardar estado atual do force_clicklife
    const originalForce = forceClicklife;
    
    // Desativar force_clicklife no início (para garantir testes limpos K2-K6)
    await supabase.from('admin_settings').upsert({ 
      key: 'force_clicklife', 
      value: 'false',
      updated_at: new Date().toISOString()
    });
    setForceClicklife(false);
    
    const subcases = [
      {
        id: 'K2',
        nome: 'Plano Ativo + Clínico (863)',
        payload: {
          especialidade: 'clinico geral',
          sku: 'ITC6534',
          horario_iso: new Date(2025, 9, 21, 17, 0).toISOString(),
          plano_ativo: true
        },
        expected: { provider: 'clicklife', reason: 'active_plan', plano_id: 863 }
      },
      {
        id: 'K3',
        nome: 'Plano Ativo + Especialista (864)',
        payload: {
          especialidade: 'Cardiologista',
          sku: 'TQP5720',
          horario_iso: new Date(2025, 9, 21, 17, 0).toISOString(),
          plano_ativo: true
        },
        expected: { provider: 'clicklife', reason: 'active_plan', plano_id: 864 }
      },
      {
        id: 'K4',
        nome: 'Horário Noturno',
        payload: {
          especialidade: 'clinico geral',
          sku: 'ITC6534',
          horario_iso: new Date(2025, 9, 22, 3, 0).toISOString(), // 00:00 Brasília (03:00 UTC)
          plano_ativo: false
        },
        expected: { provider: 'clicklife', reason: 'nighttime' }
      },
      {
        id: 'K5',
        nome: 'Fim de Semana (Sábado)',
        payload: {
          especialidade: 'clinico geral',
          sku: 'ITC6534',
          horario_iso: new Date(2025, 9, 25, 17, 0).toISOString(), // Sábado 14h
          plano_ativo: false
        },
        expected: { provider: 'clicklife', reason: 'weekend' }
      },
      {
        id: 'K6',
        nome: 'Especialidade Indisponível',
        payload: {
          especialidade: 'Cardiologista',
          sku: 'TQP5720',
          horario_iso: new Date(2025, 9, 21, 17, 0).toISOString(),
          plano_ativo: false
        },
        expected: { provider: 'clicklife', reason: 'specialty_unavailable' }
      },
      { 
        id: 'K1', 
        nome: 'Admin Override',
        setup: async () => {
          // Ativar force_clicklife temporariamente
          await supabase.from('admin_settings').upsert({ 
            key: 'force_clicklife', 
            value: 'true',
            updated_at: new Date().toISOString()
          });
          setForceClicklife(true);
        },
        payload: {
          especialidade: 'clinico geral',
          sku: 'ITC6534',
          horario_iso: new Date(2025, 9, 21, 17, 0).toISOString(), // Segunda 14h Brasília
          plano_ativo: false
        },
        expected: { provider: 'clicklife', reason: 'admin_override' }
      },
      {
        id: 'K7',
        nome: '🔐 Validação Token Integrador',
        isTokenTest: true, // Flag para tratamento especial
        setup: async () => {
          // Desativar force_clicklife antes do K7 (para não interferir no teste de token)
          await supabase.from('admin_settings').upsert({ 
            key: 'force_clicklife', 
            value: 'false',
            updated_at: new Date().toISOString()
          });
          setForceClicklife(false);
        },
        payload: null, // Não usa payload padrão
        expected: null // Validação personalizada
      }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const subcase of subcases) {
      // Setup (se houver)
      if (subcase.setup) {
        await subcase.setup();
      }
      
      // ✅ TESTE K7: Validação do Token do Integrador
      if (subcase.isTokenTest) {
        const startTime = Date.now();
        
        try {
          console.log(`[ClickLife Suite] Executando ${subcase.id}: ${subcase.nome}`);
          console.log('[ClickLife Suite] Chamando função clicklife-token-test...');
          
          const { data, error } = await supabase.functions.invoke('clicklife-token-test', {
            body: {}
          });
          
          const responseTime = Date.now() - startTime;
          
          if (error) throw error;
          
          // Validar se o token está válido
          const tokenIsValid = data.valid === true;
          const status = tokenIsValid ? 'passou' : 'falhou';
          
          if (status === 'passou') {
            passed++;
          } else {
            failed++;
          }
          
          const result: TestResult = {
            suite_id: 'CLICKLIFE',
            sub_id: subcase.id,
            scenario_id: `ClickLife Suite - ${subcase.nome}`,
            timestamp: new Date().toISOString(),
            status,
            response_time: responseTime,
            request: { test: 'token_validation' },
            response: data,
            error: !tokenIsValid ? `❌ ${data.message} - ${data.recommendation}` : undefined
          };
          
          setTestHistory(prev => [result, ...prev].slice(0, 20));
          
          // Se o token for inválido, mostrar toast de alerta
          if (!tokenIsValid) {
            toast.error(`🔴 Token do integrador INVÁLIDO! ${data.recommendation}`);
          } else {
            toast.success(`✅ Token do integrador VÁLIDO - Problema HTTP 401 NÃO está no token`);
          }
          
        } catch (error: any) {
          failed++;
          
          let errorDetails = error.message || 'Erro desconhecido';
          let errorContext = null;
          
          if (error.context) {
            try {
              const contextClone = error.context.clone();
              errorContext = await contextClone.json();
              if (errorContext.error) errorDetails = errorContext.error;
            } catch {}
          }
          
          const responseTime = Date.now() - startTime;
          const result: TestResult = {
            suite_id: 'CLICKLIFE',
            sub_id: subcase.id,
            scenario_id: `ClickLife Suite - ${subcase.nome}`,
            timestamp: new Date().toISOString(),
            status: 'falhou',
            response_time: responseTime,
            request: { test: 'token_validation' },
            response: errorContext,
            error: errorDetails
          };
          
          setTestHistory(prev => [result, ...prev].slice(0, 20));
        }
        
        continue; // Pular para próximo teste
      }
      
      // ✅ TESTES K1-K6: Fluxo normal de agendamento
      const cpf = generateValidCPF();
      const email = uniqueEmail(`clicklife_${subcase.id.toLowerCase()}`);
      
      const payload = {
        cpf,
        email,
        nome: `Teste ${subcase.nome}`,
        telefone: '+5511999999999',
        ...subcase.payload
      };
      
      const startTime = Date.now();
      
      try {
        console.log(`[ClickLife Suite] Executando ${subcase.id}: ${subcase.nome}`);
        
        const { data, error } = await supabase.functions.invoke('schedule-redirect', {
          body: payload
        });
        
        const responseTime = Date.now() - startTime;
        
        if (error) throw error;
        
        // Validar resultado
        const providerMatch = data.provider === subcase.expected.provider;
        const reasonMatch = data.reason === subcase.expected.reason;
        const planoIdMatch = !subcase.expected.plano_id || data.plano_id === subcase.expected.plano_id;
        const status = providerMatch && reasonMatch && planoIdMatch ? 'passou' : 'falhou';
        
        if (status === 'passou') {
          passed++;
        } else {
          failed++;
        }
        
        const result: TestResult = {
          suite_id: 'CLICKLIFE',
          sub_id: subcase.id,
          scenario_id: `ClickLife Suite - ${subcase.nome}`,
          timestamp: new Date().toISOString(),
          status,
          provider: data.provider,
          reason: data.reason,
          plano_id: data.plano_id,
          response_time: responseTime,
          request: payload,
          response: data,
          error: !providerMatch ? `Esperado: ${subcase.expected.provider}, Recebido: ${data.provider}` : 
                 !reasonMatch ? `Esperado reason: ${subcase.expected.reason}, Recebido: ${data.reason}` :
                 !planoIdMatch ? `Esperado plano_id: ${subcase.expected.plano_id}, Recebido: ${data.plano_id}` : undefined
        };
        
        setTestHistory(prev => [result, ...prev].slice(0, 20));
        
      } catch (error: any) {
        failed++;
        
        let errorDetails = error.message || 'Erro desconhecido';
        let errorContext = null;
        
        if (error.context) {
          try {
            const contextClone = error.context.clone();
            errorContext = await contextClone.json();
            if (errorContext.error) errorDetails = errorContext.error;
          } catch {}
        }
        
        const responseTime = Date.now() - startTime;
        const result: TestResult = {
          suite_id: 'CLICKLIFE',
          sub_id: subcase.id,
          scenario_id: `ClickLife Suite - ${subcase.nome}`,
          timestamp: new Date().toISOString(),
          status: 'falhou',
          response_time: responseTime,
          request: payload,
          response: errorContext,
          error: errorDetails
        };
        
        setTestHistory(prev => [result, ...prev].slice(0, 20));
      }
    }
    
    // Restaurar force_clicklife ao valor original
    await supabase.from('admin_settings').upsert({ 
      key: 'force_clicklife', 
      value: originalForce.toString(),
      updated_at: new Date().toISOString()
    });
    setForceClicklife(originalForce);
    
    setIsRunningClicklife(false);
    
    if (failed === 0) {
      toast.success(`✅ Suíte ClickLife: ${passed}/${subcases.length} testes passaram`);
    } else {
      toast.error(`❌ Suíte ClickLife: ${failed}/${subcases.length} testes falharam`);
    }
  };

  /**
   * TESTES DE WEBHOOK MERCADO PAGO
   * Testa se o webhook está operante e respondendo corretamente
   */
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  
  const testMercadoPagoWebhook = async (paymentMethod: 'card' | 'pix') => {
    setIsTestingWebhook(true);
    const startTime = Date.now();
    
    try {
      console.log(`[Webhook Test] Testando webhook ${paymentMethod.toUpperCase()}`);
      
      // Simular notificação do Mercado Pago
      const mockPayload = {
        action: 'payment.updated',
        data: {
          id: `test_${Date.now()}_${paymentMethod}`
        }
      };
      
      // Chamar o webhook proxy
      const response = await fetch('https://ploqujuhpwutpcibedbr.supabase.co/functions/v1/mp-webhook-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mockPayload)
      });
      
      const responseTime = Date.now() - startTime;
      const responseData = await response.text();
      
      const result: TestResult = {
        scenario_id: `Webhook MP - ${paymentMethod.toUpperCase()}`,
        timestamp: new Date().toISOString(),
        status: response.ok ? 'passou' : 'falhou',
        provider: 'mercadopago',
        response_time: responseTime,
        request: mockPayload,
        response: { status: response.status, data: responseData },
        error: !response.ok ? `HTTP ${response.status}: ${responseData}` : undefined
      };
      
      setTestHistory(prev => [result, ...prev].slice(0, 20));
      
      if (response.ok) {
        toast.success(`✅ Webhook MP ${paymentMethod.toUpperCase()} operante!`);
      } else {
        toast.error(`❌ Webhook MP ${paymentMethod.toUpperCase()} falhou!`);
      }
      
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      const result: TestResult = {
        scenario_id: `Webhook MP - ${paymentMethod.toUpperCase()}`,
        timestamp: new Date().toISOString(),
        status: 'falhou',
        response_time: responseTime,
        request: { test: 'webhook', method: paymentMethod },
        response: null,
        error: error.message || 'Erro ao testar webhook'
      };
      
      setTestHistory(prev => [result, ...prev].slice(0, 20));
      toast.error(`❌ Erro ao testar webhook: ${error.message}`);
    } finally {
      setIsTestingWebhook(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">🧪 Teste de Roteamento Inteligente</h2>
        <p className="text-muted-foreground">
          Valide os cenários de redirecionamento entre ClickLife e Communicare
        </p>
      </div>

      {/* Admin Override Panel */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              {forceClicklife ? <ToggleRight className="h-5 w-5 text-primary" /> : <ToggleLeft className="h-5 w-5" />}
              Admin Override
            </span>
            <Badge variant={forceClicklife ? "default" : "secondary"}>
              {forceClicklife ? 'ATIVO' : 'INATIVO'}
            </Badge>
          </CardTitle>
          <CardDescription>
            Força todos os agendamentos para ClickLife (ignora horário e plano)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={toggleForceClicklife}
            disabled={loadingOverride}
            variant={forceClicklife ? "destructive" : "default"}
            className="w-full"
          >
            {loadingOverride ? 'Atualizando...' : forceClicklife ? 'Desativar Override' : 'Ativar Override'}
          </Button>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Suítes Automatizadas */}
        <div className="space-y-4">
          {/* Card de Testes de Webhook MP */}
          <Card className="border-2 border-orange-500/20">
            <CardHeader>
              <CardTitle className="text-orange-600">🔔 Testes de Webhook MP</CardTitle>
              <CardDescription>
                Valida se os webhooks do Mercado Pago estão operantes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => testMercadoPagoWebhook('card')}
                disabled={isTestingWebhook || isRunningCommunicare || isRunningClicklife}
                className="w-full"
                variant="outline"
              >
                {isTestingWebhook ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testando...
                  </>
                ) : (
                  <>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Testar Webhook Cartão
                  </>
                )}
              </Button>
              <Button
                onClick={() => testMercadoPagoWebhook('pix')}
                disabled={isTestingWebhook || isRunningCommunicare || isRunningClicklife}
                className="w-full"
                variant="outline"
              >
                {isTestingWebhook ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testando...
                  </>
                ) : (
                  <>
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Testar Webhook PIX
                  </>
                )}
              </Button>
              <div className="mt-2 text-xs text-muted-foreground">
                <p>✓ Valida resposta HTTP 200</p>
                <p>✓ Simula notificação payment.updated</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-2 border-blue-500/20">
            <CardHeader>
              <CardTitle className="text-blue-600">🔵 Suíte Communicare</CardTitle>
              <CardDescription>
                Testa especialidades disponíveis na Communicare durante horário comercial
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={runCommunicareSuite}
                disabled={isRunningCommunicare || isRunningClicklife}
                className="w-full"
                size="lg"
              >
                {isRunningCommunicare ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Executando Suíte...
                  </>
                ) : (
                  <>
                    <PlayCircle className="mr-2 h-5 w-5" />
                    Rodar Suíte Communicare
                  </>
                )}
              </Button>
              <div className="mt-3 text-xs text-muted-foreground space-y-1">
                <p>✓ Clínico Geral (horário comercial)</p>
                <p>✓ Psicólogo 1 sessão (horário comercial)</p>
                <p>✓ Nutricionista (horário comercial)</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-500/20">
            <CardHeader>
              <CardTitle className="text-green-600">🟢 Suíte ClickLife</CardTitle>
              <CardDescription>
                Testa todas as regras de roteamento para ClickLife
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={runClicklifeSuite}
                disabled={isRunningCommunicare || isRunningClicklife}
                className="w-full"
                size="lg"
              >
                {isRunningClicklife ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Executando Suíte...
                  </>
                ) : (
                  <>
                    <PlayCircle className="mr-2 h-5 w-5" />
                    Rodar Suíte ClickLife
                  </>
                )}
              </Button>
              <div className="mt-3 text-xs text-muted-foreground space-y-1">
                <p>✓ Plano Ativo (863 e 864)</p>
                <p>✓ Horário Noturno</p>
                <p>✓ Fim de Semana</p>
                <p>✓ Especialidade Indisponível</p>
                <p>✓ Admin Override</p>
                <p>✓ Token Integrador</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Parâmetros Manuais</CardTitle>
              <CardDescription>Ajuste os parâmetros para testes customizados</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  value={testData.cpf}
                  onChange={(e) => setTestData({ ...testData, cpf: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={testData.email}
                  onChange={(e) => setTestData({ ...testData, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku">SKU / Especialidade</Label>
                <Select
                  value={testData.sku}
                  onValueChange={(value) => {
                    const especialidade = getServiceNameFromSKU(value);
                    setTestData({ ...testData, sku: value, especialidade });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SKU_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="horario">Horário (ISO)</Label>
                <Input
                  id="horario"
                  type="datetime-local"
                  value={new Date(testData.horario_iso).toISOString().slice(0, 16)}
                  onChange={(e) => setTestData({ ...testData, horario_iso: new Date(e.target.value).toISOString() })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="plano_ativo"
                  checked={testData.plano_ativo}
                  onCheckedChange={(checked) => setTestData({ ...testData, plano_ativo: checked as boolean })}
                />
                <Label htmlFor="plano_ativo" className="cursor-pointer">
                  Plano Ativo
                </Label>
              </div>

              <Button
                onClick={executeTest}
                disabled={isExecuting || isRunningCommunicare || isRunningClicklife}
                className="w-full"
                size="lg"
              >
                <PlayCircle className="mr-2 h-5 w-5" />
                {isExecuting ? 'Executando...' : 'Executar Teste Manual'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Resultado e Histórico */}
        <div className="space-y-4">
          {currentResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Resultado do Teste</span>
                  <Badge variant={currentResult.status === 'passou' ? 'default' : 'destructive'}>
                    {currentResult.status === 'passou' ? <CheckCircle className="mr-1 h-4 w-4" /> : <XCircle className="mr-1 h-4 w-4" />}
                    {currentResult.status.toUpperCase()}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {currentResult.error ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Erro:</strong> {currentResult.error}
                      
                      {currentResult.response && (
                        <div className="mt-3 p-3 bg-destructive/10 rounded text-xs font-mono overflow-auto max-h-60">
                          <p className="font-semibold mb-1 font-sans">Detalhes do erro:</p>
                          <pre>{JSON.stringify(currentResult.response, null, 2)}</pre>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Provider:</span>
                        <Badge>{currentResult.provider}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Reason:</span>
                        <Badge variant="outline">{currentResult.reason}</Badge>
                      </div>
                      {currentResult.plano_id && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Plano ID:</span>
                          <Badge variant="secondary">{currentResult.plano_id}</Badge>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tempo:</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {currentResult.response_time}ms
                        </span>
                      </div>
                    </div>

                    <Collapsible open={showJson} onOpenChange={setShowJson}>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" className="w-full">
                          <ChevronDown className="mr-2 h-4 w-4" />
                          Ver JSON Completo
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3">
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs font-semibold mb-1">Request:</p>
                            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                              {JSON.stringify(currentResult.request, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <p className="text-xs font-semibold mb-1">Response:</p>
                            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                              {JSON.stringify(currentResult.response, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Histórico */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico (últimos 20 testes)</CardTitle>
            </CardHeader>
            <CardContent>
              {testHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum teste executado ainda
                </p>
              ) : (
                <div className="space-y-2">
                  {testHistory.map((test, idx) => (
                    <div key={idx} className="border rounded p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {test.status === 'passou' ? (
                            <Badge variant="default" className="text-xs">✅</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">❌</Badge>
                          )}
                          <span className="font-mono text-xs font-semibold">
                            {test.suite_id ? `${test.suite_id}/${test.sub_id}` : test.scenario_id}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(test.timestamp).toLocaleTimeString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{test.scenario_id}</p>
                      {test.provider && (
                        <div className="flex items-center gap-2 text-xs">
                          <Badge variant="outline">{test.provider}</Badge>
                          <span className="text-muted-foreground">{test.reason}</span>
                          {test.plano_id && <Badge variant="secondary">Plano {test.plano_id}</Badge>}
                        </div>
                      )}
                      {test.error && (
                        <p className="text-xs text-destructive mt-1">⚠️ {test.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TestesRoteamento;