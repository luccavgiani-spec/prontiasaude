import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, Users, Moon, Sun, CheckCircle } from 'lucide-react';

// Componente para testar os 3 fluxos QA solicitados
const FluxosQA: React.FC = () => {
  const [fluxoAtivo, setFluxoAtivo] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string>('');

  const simularFluxo = (tipo: 'plano_ativo' | 'diurno_sem_plano' | 'noturno_sem_plano') => {
    setFluxoAtivo(tipo);
    
    // Simular lógica de seleção de provedor baseada no horário e plano
    let provedor = '';
    let horario = '';
    let planoStatus = '';
    
    switch (tipo) {
      case 'plano_ativo':
        provedor = 'Clicklife (plano ativo tem prioridade)';
        horario = 'Qualquer horário';
        planoStatus = 'Plano Individual ativo';
        break;
      case 'diurno_sem_plano':
        provedor = 'Communicare (07:00-19:00)';
        horario = '14:00 (horário comercial)';
        planoStatus = 'Sem plano ativo';
        break;
      case 'noturno_sem_plano':
        provedor = 'Clicklife (19:00-07:00/fins de semana)';
        horario = '21:00 (fora do horário comercial)';
        planoStatus = 'Sem plano ativo';
        break;
    }
    
    setResultado(`
      Simulação: ${tipo.replace('_', ' ').toUpperCase()}
      
      📋 Status do Plano: ${planoStatus}
      🕐 Horário simulado: ${horario}
      🏥 Provedor selecionado: ${provedor}
      
      ✅ Dados que seriam enviados para GAS:
      - user_id: sim-${Date.now()}
      - email: teste@usuario.com
      - nome: Usuário Teste
      - especialidade: CONSULTA_CLINICA
      - horario_iso: ${new Date().toISOString()}
      - plano_ativo: ${tipo === 'plano_ativo'}
      - servico: CONSULTA_CLINICA
      
      📞 Meeting Link: [Será gerado via webhook do ${provedor.split(' ')[0]}]
    `);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">QA - Testes de Integração GAS</h2>
        <p className="text-muted-foreground mb-6">
          Teste os 3 fluxos de agendamento: plano ativo, diurno sem plano, e noturno sem plano
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Fluxo 1: Plano Ativo */}
        <Card className="relative">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              Plano Ativo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              <p>• Usuário com plano Individual/Familiar</p>
              <p>• Prioridade para Clicklife</p>
              <p>• Atendimento 24h disponível</p>
            </div>
            <Badge variant="default" className="w-full justify-center">
              Clicklife (Prioritário)
            </Badge>
            <Button 
              onClick={() => simularFluxo('plano_ativo')}
              className="w-full"
              variant={fluxoAtivo === 'plano_ativo' ? 'secondary' : 'default'}
            >
              Simular Fluxo
            </Button>
          </CardContent>
        </Card>

        {/* Fluxo 2: Diurno sem Plano */}
        <Card className="relative">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5 text-yellow-500" />
              Diurno sem Plano
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              <p>• Horário: 07:00 - 19:00</p>
              <p>• Dias úteis</p>
              <p>• Sem plano ativo</p>
            </div>
            <Badge variant="secondary" className="w-full justify-center">
              Communicare (Comercial)
            </Badge>
            <Button 
              onClick={() => simularFluxo('diurno_sem_plano')}
              className="w-full"
              variant={fluxoAtivo === 'diurno_sem_plano' ? 'secondary' : 'default'}
            >
              Simular Fluxo
            </Button>
          </CardContent>
        </Card>

        {/* Fluxo 3: Noturno sem Plano */}
        <Card className="relative">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Moon className="h-5 w-5 text-purple-500" />
              Noturno sem Plano
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              <p>• Horário: 19:00 - 07:00</p>
              <p>• Fins de semana</p>
              <p>• Sem plano ativo</p>
            </div>
            <Badge variant="outline" className="w-full justify-center">
              Clicklife (Plantão)
            </Badge>
            <Button 
              onClick={() => simularFluxo('noturno_sem_plano')}
              className="w-full"
              variant={fluxoAtivo === 'noturno_sem_plano' ? 'secondary' : 'default'}
            >
              Simular Fluxo
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Resultado da Simulação */}
      {resultado && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <pre className="whitespace-pre-wrap text-sm font-mono bg-muted/30 p-3 rounded mt-2">
              {resultado}
            </pre>
          </AlertDescription>
        </Alert>
      )}

      {/* Info sobre integração */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Status da Integração
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">✅ Implementado:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• Cadastro via GAS (site-register)</li>
                <li>• Agendamento via GAS (site-schedule)</li>
                <li>• Busca de consultas (Supabase + GAS)</li>
                <li>• Webhook de sincronização (/api/sync-appointment)</li>
                <li>• Detecção automática de provedor</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">🔄 Fluxo Completo:</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>1. Usuário agenda consulta</li>
                <li>2. Sistema chama Supabase + GAS</li>
                <li>3. GAS decide provedor automaticamente</li>
                <li>4. Webhook atualiza meeting_link</li>
                <li>5. Usuário vê link na área do paciente</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FluxosQA;