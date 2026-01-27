import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Clock, Play, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { invokeEdgeFunction } from '@/lib/edge-functions';

interface TestResult {
  name: string;
  status: 'idle' | 'running' | 'passed' | 'failed';
  duration?: number;
  response?: any;
  error?: string;
  timestamp?: string;
}

const TestesPagamentoMP = () => {
  const [results, setResults] = useState<TestResult[]>([
    { name: 'Teste 1: Cartão Rejeitado (Alto Risco)', status: 'idle' },
    { name: 'Teste 2: Cartão Rejeitado (Saldo Insuficiente)', status: 'idle' },
    { name: 'Teste 3: Cartão Aprovado (Controle)', status: 'idle' },
    { name: 'Teste 4: Erro Técnico Simulado', status: 'idle' },
  ]);
  
  const [expandedTest, setExpandedTest] = useState<number | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);

  const updateTestResult = (index: number, update: Partial<TestResult>) => {
    setResults(prev => prev.map((r, i) => i === index ? { ...r, ...update } : r));
  };

  // Teste 1: Cartão rejeitado por alto risco
  const runTest1 = async () => {
    const startTime = Date.now();
    updateTestResult(0, { status: 'running', error: undefined });
    
    try {
      const testPayload = {
        items: [
          {
            id: 'TEST_REJECTION_HIGH_RISK',
            title: 'Teste Rejeição Alto Risco',
            quantity: 1,
            unit_price: 10.00
          }
        ],
        payer: {
          email: 'test_user_rejected@testuser.com',
          first_name: 'Test',
          last_name: 'User',
          identification: {
            type: 'CPF',
            number: '12345678909'
          }
        },
        payment_method_id: 'master',
        token: 'test_card_token_rejected',
        installments: 1,
        metadata: {
          test_scenario: 'cc_rejected_high_risk'
        }
      };

      console.log('[Teste 1] Enviando payload:', testPayload);
      
      const { data, error } = await invokeEdgeFunction('mp-create-payment', {
        body: testPayload
      });

      const duration = Date.now() - startTime;
      
      console.log('[Teste 1] Resposta recebida:', { data, error, duration });

      // Validações
      const validations = {
        httpStatus: !error, // Se não há erro, significa HTTP 200
        hasStatus: data?.status === 'rejected',
        hasStatusDetail: !!data?.status_detail,
        hasPaymentId: !!data?.payment_id,
        responseTime: duration < 3000
      };

      const allPassed = Object.values(validations).every(v => v);

      updateTestResult(0, {
        status: allPassed ? 'passed' : 'failed',
        duration,
        response: { data, error, validations },
        timestamp: new Date().toISOString(),
        error: allPassed ? undefined : 'Validações falharam - veja detalhes expandindo o teste'
      });

    } catch (err: any) {
      updateTestResult(0, {
        status: 'failed',
        duration: Date.now() - startTime,
        error: err.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  // Teste 2: Cartão rejeitado por saldo insuficiente
  const runTest2 = async () => {
    const startTime = Date.now();
    updateTestResult(1, { status: 'running', error: undefined });
    
    try {
      const testPayload = {
        items: [
          {
            id: 'TEST_REJECTION_INSUFFICIENT',
            title: 'Teste Rejeição Saldo Insuficiente',
            quantity: 1,
            unit_price: 10.00
          }
        ],
        payer: {
          email: 'test_user_92@testuser.com',
          first_name: 'Test',
          last_name: 'User',
          identification: {
            type: 'CPF',
            number: '12345678909'
          }
        },
        payment_method_id: 'master',
        token: 'test_card_token_insufficient',
        installments: 1,
        metadata: {
          test_scenario: 'cc_rejected_insufficient_amount'
        }
      };

      console.log('[Teste 2] Enviando payload:', testPayload);
      
      const { data, error } = await invokeEdgeFunction('mp-create-payment', {
        body: testPayload
      });

      const duration = Date.now() - startTime;
      
      console.log('[Teste 2] Resposta recebida:', { data, error, duration });

      const validations = {
        httpStatus: !error,
        hasStatus: data?.status === 'rejected',
        hasStatusDetail: !!data?.status_detail,
        hasPaymentId: !!data?.payment_id,
        responseTime: duration < 3000
      };

      const allPassed = Object.values(validations).every(v => v);

      updateTestResult(1, {
        status: allPassed ? 'passed' : 'failed',
        duration,
        response: { data, error, validations },
        timestamp: new Date().toISOString(),
        error: allPassed ? undefined : 'Validações falharam'
      });

    } catch (err: any) {
      updateTestResult(1, {
        status: 'failed',
        duration: Date.now() - startTime,
        error: err.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  // Teste 3: Cartão aprovado (controle)
  const runTest3 = async () => {
    const startTime = Date.now();
    updateTestResult(2, { status: 'running', error: undefined });
    
    try {
      const testPayload = {
        items: [
          {
            id: 'TEST_APPROVED',
            title: 'Teste Aprovação',
            quantity: 1,
            unit_price: 10.00
          }
        ],
        payer: {
          email: 'test_user_approved@testuser.com',
          first_name: 'APRO',
          last_name: 'User',
          identification: {
            type: 'CPF',
            number: '12345678909'
          }
        },
        payment_method_id: 'master',
        token: 'test_card_token_approved',
        installments: 1,
        metadata: {
          test_scenario: 'approved'
        }
      };

      console.log('[Teste 3] Enviando payload:', testPayload);
      
      const { data, error } = await invokeEdgeFunction('mp-create-payment', {
        body: testPayload
      });

      const duration = Date.now() - startTime;
      
      console.log('[Teste 3] Resposta recebida:', { data, error, duration });

      const validations = {
        httpStatus: !error,
        hasStatus: data?.status === 'approved',
        hasPaymentId: !!data?.payment_id,
        responseTime: duration < 3000
      };

      const allPassed = Object.values(validations).every(v => v);

      updateTestResult(2, {
        status: allPassed ? 'passed' : 'failed',
        duration,
        response: { data, error, validations },
        timestamp: new Date().toISOString(),
        error: allPassed ? undefined : 'Validações falharam'
      });

    } catch (err: any) {
      updateTestResult(2, {
        status: 'failed',
        duration: Date.now() - startTime,
        error: err.message,
        timestamp: new Date().toISOString()
      });
    }
  };

  // Teste 4: Erro técnico simulado
  const runTest4 = async () => {
    const startTime = Date.now();
    updateTestResult(3, { status: 'running', error: undefined });
    
    try {
      const testPayload = {
        items: [
          {
            id: 'INVALID_SKU_SHOULD_CAUSE_ERROR',
            title: 'Teste Erro Técnico',
            quantity: 1,
            unit_price: 999999.99
          }
        ],
        payer: {
          email: 'invalid@invalid',
          first_name: '',
          last_name: '',
          identification: {
            type: 'CPF',
            number: '00000000000'
          }
        },
        payment_method_id: 'invalid',
        token: '',
        installments: 0
      };

      console.log('[Teste 4] Enviando payload inválido:', testPayload);
      
      const { data, error } = await invokeEdgeFunction('mp-create-payment', {
        body: testPayload
      });

      const duration = Date.now() - startTime;
      
      console.log('[Teste 4] Resposta recebida:', { data, error, duration });

      // Para erro técnico, esperamos que error exista
      const validations = {
        hasError: !!error,
        responseTime: duration < 5000
      };

      const allPassed = Object.values(validations).every(v => v);

      updateTestResult(3, {
        status: allPassed ? 'passed' : 'failed',
        duration,
        response: { data, error, validations },
        timestamp: new Date().toISOString(),
        error: allPassed ? undefined : 'Esperava erro técnico mas não recebeu'
      });

    } catch (err: any) {
      // Neste caso, um catch é esperado
      updateTestResult(3, {
        status: 'passed',
        duration: Date.now() - startTime,
        response: { error: err.message },
        timestamp: new Date().toISOString()
      });
    }
  };

  const runAllTests = async () => {
    setIsRunningAll(true);
    await runTest1();
    await new Promise(resolve => setTimeout(resolve, 500));
    await runTest2();
    await new Promise(resolve => setTimeout(resolve, 500));
    await runTest3();
    await new Promise(resolve => setTimeout(resolve, 500));
    await runTest4();
    setIsRunningAll(false);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'running':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    const variants: Record<TestResult['status'], any> = {
      passed: 'default',
      failed: 'destructive',
      running: 'secondary',
      idle: 'outline'
    };
    
    return (
      <Badge variant={variants[status]}>
        {status === 'passed' ? 'Passou' : status === 'failed' ? 'Falhou' : status === 'running' ? 'Executando...' : 'Aguardando'}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Testes de Pagamento Mercado Pago</h2>
          <p className="text-muted-foreground mt-1">
            Validação automatizada do fluxo de rejeições e aprovações
          </p>
        </div>
        <Button 
          onClick={runAllTests} 
          disabled={isRunningAll}
          size="lg"
        >
          {isRunningAll ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Executando...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Executar Todos
            </>
          )}
        </Button>
      </div>

      <Alert>
        <AlertDescription>
          <strong>⚠️ Importante:</strong> Estes testes simulam cenários de pagamento sem realizar cobranças reais. 
          Os resultados validam apenas a comunicação entre frontend e edge function.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {results.map((result, index) => (
          <Card key={index} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {getStatusIcon(result.status)}
                  <div>
                    <CardTitle className="text-base">{result.name}</CardTitle>
                    {result.timestamp && (
                      <CardDescription className="text-xs mt-1">
                        Executado em: {new Date(result.timestamp).toLocaleString('pt-BR')}
                      </CardDescription>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {result.duration && (
                    <Badge variant="outline" className="font-mono">
                      {result.duration}ms
                    </Badge>
                  )}
                  {getStatusBadge(result.status)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.error && (
                <Alert variant="destructive">
                  <AlertDescription className="text-sm">{result.error}</AlertDescription>
                </Alert>
              )}
              
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    if (index === 0) runTest1();
                    if (index === 1) runTest2();
                    if (index === 2) runTest3();
                    if (index === 3) runTest4();
                  }}
                  disabled={result.status === 'running' || isRunningAll}
                >
                  {result.status === 'running' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Play className="mr-2 h-3 w-3" />
                      Executar Teste
                    </>
                  )}
                </Button>
                
                {result.response && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setExpandedTest(expandedTest === index ? null : index)}
                  >
                    {expandedTest === index ? (
                      <>
                        <ChevronUp className="mr-2 h-3 w-3" />
                        Ocultar Detalhes
                      </>
                    ) : (
                      <>
                        <ChevronDown className="mr-2 h-3 w-3" />
                        Ver Detalhes
                      </>
                    )}
                  </Button>
                )}
              </div>

              {expandedTest === index && result.response && (
                <div className="mt-3 p-3 bg-muted rounded-md">
                  <h4 className="font-semibold text-sm mb-2">Detalhes da Resposta</h4>
                  <pre className="text-xs overflow-auto max-h-96 bg-background p-3 rounded border">
                    {JSON.stringify(result.response, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Critérios de Validação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">✅ Teste 1 & 2 (Rejeições)</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• HTTP status = 200</li>
                <li>• response.status = 'rejected'</li>
                <li>• response.status_detail existe</li>
                <li>• Tempo de resposta {'<'} 3s</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">✅ Teste 3 (Aprovado)</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• HTTP status = 200</li>
                <li>• response.status = 'approved'</li>
                <li>• response.payment_id existe</li>
                <li>• Tempo de resposta {'<'} 3s</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">✅ Teste 4 (Erro Técnico)</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Exceção capturada</li>
                <li>• response.error existe</li>
                <li>• Tempo de resposta {'<'} 5s</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TestesPagamentoMP;
