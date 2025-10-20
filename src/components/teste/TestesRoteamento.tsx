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
import { PlayCircle, CheckCircle, XCircle, ChevronDown, Clock, AlertCircle, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';

interface TestScenario {
  id: string;
  nome: string;
  payload: {
    cpf: string;
    email: string;
    nome: string;
    telefone: string;
    especialidade: string;
    sku: string;
    horario_iso: string;
    plano_ativo: boolean;
  };
  expected: {
    provider: 'clicklife' | 'communicare';
    reason: string;
    plano_id?: number;
  };
  observacao?: string;
}

interface TestResult {
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

const CENARIOS_TESTE: TestScenario[] = [
  {
    id: 'A1',
    nome: 'Admin Override → ClickLife',
    payload: {
      cpf: '12345678900',
      email: 'teste.a1@prontiasaude.com.br',
      nome: 'Teste A1 Admin Override',
      telefone: '+5511999999991',
      especialidade: 'clinico geral',
      sku: 'ITC6534',
      horario_iso: new Date(2025, 9, 21, 14, 0).toISOString(), // segunda 14h
      plano_ativo: false
    },
    expected: {
      provider: 'clicklife',
      reason: 'admin_override'
    },
    observacao: 'Requer force_clicklife = true no admin_settings'
  },
  {
    id: 'B1',
    nome: 'Plano Ativo + Clínico Geral → ClickLife (863)',
    payload: {
      cpf: '404.166.998-71', // ✅ CPF válido
      email: 'teste.b1@prontiasaude.com.br',
      nome: 'Teste B1 Plano Ativo',
      telefone: '+5511999999992',
      especialidade: 'clinico geral',
      sku: 'ITC6534',
      horario_iso: new Date(2025, 9, 21, 14, 0).toISOString(),
      plano_ativo: true
    },
    expected: {
      provider: 'clicklife',
      reason: 'active_plan',
      plano_id: 863
    }
  },
  {
    id: 'B2',
    nome: 'Plano Ativo + Especialista → ClickLife (864)',
    payload: {
      cpf: '12345678902',
      email: 'teste.b2@prontiasaude.com.br',
      nome: 'Teste B2 Especialista',
      telefone: '+5511999999993',
      especialidade: 'Cardiologista',
      sku: 'TQP5720',
      horario_iso: new Date(2025, 9, 21, 14, 0).toISOString(),
      plano_ativo: true
    },
    expected: {
      provider: 'clicklife',
      reason: 'active_plan',
      plano_id: 864
    }
  },
  {
    id: 'C1',
    nome: 'Sem Plano + Horário Comercial + Clínico → Communicare',
    payload: {
      cpf: '404.166.998-71', // ✅ CPF válido (mesmo do B1 para simplificar)
      email: 'teste.c1@prontiasaude.com.br',
      nome: 'Teste C1 Communicare',
      telefone: '+5511999999994',
      especialidade: 'clinico geral',
      sku: 'ITC6534',
      horario_iso: new Date(2025, 9, 21, 14, 0).toISOString(), // segunda 14h
      plano_ativo: false
    },
    expected: {
      provider: 'communicare',
      reason: 'commercial_hours'
    }
  },
  {
    id: 'C2',
    nome: 'Sem Plano + Horário Comercial + Psicólogo → Communicare',
    payload: {
      cpf: '12345678904',
      email: 'teste.c2@prontiasaude.com.br',
      nome: 'Teste C2 Psicólogo',
      telefone: '+5511999999995',
      especialidade: 'psicologo_1',
      sku: 'ZXW2165',
      horario_iso: new Date(2025, 9, 21, 10, 0).toISOString(), // segunda 10h
      plano_ativo: false
    },
    expected: {
      provider: 'communicare',
      reason: 'commercial_hours'
    }
  },
  {
    id: 'C3',
    nome: 'Sem Plano + Especialidade Indisponível → ClickLife',
    payload: {
      cpf: '12345678905',
      email: 'teste.c3@prontiasaude.com.br',
      nome: 'Teste C3 Especialista',
      telefone: '+5511999999996',
      especialidade: 'Cardiologista',
      sku: 'TQP5720',
      horario_iso: new Date(2025, 9, 21, 14, 0).toISOString(),
      plano_ativo: false
    },
    expected: {
      provider: 'clicklife',
      reason: 'specialty_unavailable'
    }
  },
  {
    id: 'D1',
    nome: 'Sem Plano + Noturno → ClickLife',
    payload: {
      cpf: '279.248.818-24', // ✅ CPF válido diferente
      email: 'teste.d1@prontiasaude.com.br',
      nome: 'Teste D1 Noturno',
      telefone: '+5511999999997',
      especialidade: 'clinico geral',
      sku: 'ITC6534',
      horario_iso: new Date(2025, 9, 21, 21, 0).toISOString(), // segunda 21h
      plano_ativo: false
    },
    expected: {
      provider: 'clicklife',
      reason: 'nighttime'
    }
  },
  {
    id: 'D2',
    nome: 'Sem Plano + Sábado → ClickLife',
    payload: {
      cpf: '12345678907',
      email: 'teste.d2@prontiasaude.com.br',
      nome: 'Teste D2 Sábado',
      telefone: '+5511999999998',
      especialidade: 'clinico geral',
      sku: 'ITC6534',
      horario_iso: new Date(2025, 9, 25, 14, 0).toISOString(), // sábado 14h
      plano_ativo: false
    },
    expected: {
      provider: 'clicklife',
      reason: 'weekend'
    }
  },
  {
    id: 'D3',
    nome: 'Sem Plano + Domingo → ClickLife',
    payload: {
      cpf: '12345678908',
      email: 'teste.d3@prontiasaude.com.br',
      nome: 'Teste D3 Domingo',
      telefone: '+5511999999999',
      especialidade: 'clinico geral',
      sku: 'ITC6534',
      horario_iso: new Date(2025, 9, 26, 10, 0).toISOString(), // domingo 10h
      plano_ativo: false
    },
    expected: {
      provider: 'clicklife',
      reason: 'weekend'
    }
  }
];

const TestesRoteamento: React.FC = () => {
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [testData, setTestData] = useState({
    cpf: '12345678900',
    email: 'teste@prontiasaude.com.br',
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
        .single();
      
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

  const loadScenario = (scenarioId: string) => {
    const scenario = CENARIOS_TESTE.find(s => s.id === scenarioId);
    if (scenario) {
      setSelectedScenario(scenarioId);
      setTestData(scenario.payload);
    }
  };

  const executeTest = async () => {
    setIsExecuting(true);
    const startTime = Date.now();

    try {
      console.log('[QA Test] Executando teste:', selectedScenario || 'Manual');
      console.log('[QA Test] Request:', testData);

      const { data, error } = await supabase.functions.invoke('schedule-redirect', {
        body: testData
      });

      const responseTime = Date.now() - startTime;

      if (error) throw error;

      console.log('[QA Test] Response:', data);
      console.log(`[QA Test] Tempo de resposta: ${responseTime}ms`);

      // Validar resultado
      const scenario = CENARIOS_TESTE.find(s => s.id === selectedScenario);
      let status: 'passou' | 'falhou' = 'passou';
      
      if (scenario) {
        const providerMatch = data.provider === scenario.expected.provider;
        const reasonMatch = data.reason === scenario.expected.reason;
        const planoIdMatch = !scenario.expected.plano_id || data.plano_id === scenario.expected.plano_id;
        
        status = providerMatch && reasonMatch && planoIdMatch ? 'passou' : 'falhou';
        
        console.log('[QA Test] Validação:', {
          providerMatch,
          reasonMatch,
          planoIdMatch,
          status
        });
      }

      const result: TestResult = {
        scenario_id: selectedScenario || 'Manual',
        timestamp: new Date().toISOString(),
        status,
        provider: data.provider,
        reason: data.reason,
        plano_id: data.plano_id,
        response_time: responseTime,
        request: testData,
        response: data
      };

      setCurrentResult(result);
      setTestHistory(prev => [result, ...prev].slice(0, 10));

      if (status === 'passou') {
        toast.success('✅ Teste passou!');
      } else {
        toast.error('❌ Teste falhou - resultado divergente do esperado');
      }
    } catch (error: any) {
      console.error('[QA Test] Erro:', error);
      
      // Extrair detalhes do erro da Edge Function
      let errorDetails = error.message || 'Erro desconhecido';
      let errorContext = null;
      
      // Supabase FunctionsHttpError retorna context como Response object
      // Precisamos ler assincronamente
      if (error.context) {
        try {
          // Tentar ler como JSON primeiro
          const contextClone = error.context.clone();
          try {
            errorContext = await contextClone.json();
            console.log('[QA Test] Contexto parseado:', errorContext);
            
            // Se o contexto tiver um campo 'error', usar como mensagem principal
            if (errorContext.error) {
              errorDetails = errorContext.error;
            }
          } catch {
            // Se falhar JSON, tentar text
            const textContent = await error.context.text();
            console.log('[QA Test] Contexto (text):', textContent);
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
        scenario_id: selectedScenario || 'Manual',
        timestamp: new Date().toISOString(),
        status: 'falhou',
        response_time: responseTime,
        request: testData,
        response: errorContext, // Contexto estruturado da Edge Function
        error: errorDetails
      };

      setCurrentResult(result);
      setTestHistory(prev => [result, ...prev].slice(0, 10));
      toast.error(`Erro: ${errorDetails}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const getScenarioDetails = () => {
    return CENARIOS_TESTE.find(s => s.id === selectedScenario);
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
        {/* Configuração do Teste */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cenário Pré-Configurado</CardTitle>
              <CardDescription>Selecione um dos 12 cenários de teste</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedScenario} onValueChange={loadScenario}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cenário..." />
                </SelectTrigger>
                <SelectContent>
                  {CENARIOS_TESTE.map(scenario => (
                    <SelectItem key={scenario.id} value={scenario.id}>
                      {scenario.id}: {scenario.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {getScenarioDetails() && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Esperado:</strong>
                    <br />
                    Provider: {getScenarioDetails()!.expected.provider}
                    <br />
                    Reason: {getScenarioDetails()!.expected.reason}
                    {getScenarioDetails()!.expected.plano_id && (
                      <>
                        <br />
                        Plano ID: {getScenarioDetails()!.expected.plano_id}
                      </>
                    )}
                    {getScenarioDetails()!.observacao && (
                      <>
                        <br />
                        <span className="text-xs italic">{getScenarioDetails()!.observacao}</span>
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}
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
                disabled={isExecuting}
                className="w-full"
                size="lg"
              >
                <PlayCircle className="mr-2 h-5 w-5" />
                {isExecuting ? 'Executando...' : 'Executar Teste'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Resultado */}
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
                      
                      {/* Mostrar contexto adicional se existir */}
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
              <CardTitle>Histórico (últimos 10 testes)</CardTitle>
            </CardHeader>
            <CardContent>
              {testHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum teste executado ainda
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Horário</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Tempo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {testHistory.map((test, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-xs">{test.scenario_id}</TableCell>
                        <TableCell className="text-xs">
                          {new Date(test.timestamp).toLocaleTimeString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          {test.status === 'passou' ? (
                            <Badge variant="default" className="text-xs">✅</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">❌</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{test.provider || '-'}</TableCell>
                        <TableCell className="text-xs">{test.response_time}ms</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TestesRoteamento;
