import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export default function RedirectFlowMap() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mapa Visual - Lógica de Redirecionamento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Início */}
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="px-4 py-2">
            📥 Requisição de Agendamento Recebida
          </Badge>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Decisão 1: Admin Override */}
        <div className="ml-4 border-l-2 border-border pl-6 space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <Badge variant="outline" className="px-3 py-1.5">1️⃣</Badge>
            </div>
            <div className="flex-1 space-y-2">
              <div className="font-medium">ADMIN OVERRIDE? (force_clicklife)</div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm">SIM</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge className="bg-slate-100 text-slate-900 border-slate-300">
                  CLICKLIFE (empresaId: 9083 | planoId: 863/864)
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-sm">NÃO</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* Decisão 2: Plano Ativo */}
          <div className="ml-4 border-l-2 border-border pl-6 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <Badge variant="outline" className="px-3 py-1.5">2️⃣</Badge>
              </div>
              <div className="flex-1 space-y-2">
                <div className="font-medium">PLANO ATIVO? (plano_ativo = true)</div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">SIM</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge className="bg-slate-100 text-slate-900 border-slate-300">
                    CLICKLIFE (planoId: 864 p/ especialistas)
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-sm">NÃO</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>

            {/* Decisão 3: Fim de Semana */}
            <div className="ml-4 border-l-2 border-border pl-6 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <Badge variant="outline" className="px-3 py-1.5">3️⃣</Badge>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="font-medium">FIM DE SEMANA? (Sábado/Domingo)</div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm">SIM</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Badge className="bg-slate-100 text-slate-900 border-slate-300">
                      CLICKLIFE (planoId: 863)
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-sm">NÃO</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </div>

              {/* Decisão 4: Horário Noturno */}
              <div className="ml-4 border-l-2 border-border pl-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <Badge variant="outline" className="px-3 py-1.5">4️⃣</Badge>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="font-medium">HORÁRIO NOTURNO? (&lt;08h ou &gt;18h)</div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm">SIM</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <Badge className="bg-slate-100 text-slate-900 border-slate-300">
                        CLICKLIFE (planoId: 863)
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="text-sm">NÃO</span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                {/* Decisão 5: Especialidade Disponível */}
                <div className="ml-4 border-l-2 border-border pl-6 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <Badge variant="outline" className="px-3 py-1.5">5️⃣</Badge>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="font-medium">ESPECIALIDADE DISPONÍVEL NA COMMUNICARE?</div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-red-600" />
                        <span className="text-sm">NÃO</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <Badge className="bg-slate-100 text-slate-900 border-slate-300">
                          CLICKLIFE (planoId: 863)
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm">SIM</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <Badge className="bg-blue-50 text-blue-900 border-blue-300">
                          COMMUNICARE (padrão)
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Observação */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
          <p className="text-sm text-foreground">
            📌 <strong>Observação:</strong> todos os serviços de renovação de receitas e solicitação de exames são sempre direcionados ao fluxo automatizado do ManyChat.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
