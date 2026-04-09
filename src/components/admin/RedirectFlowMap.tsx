import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowRight, CheckCircle2, ChevronDown, AlertTriangle, Zap, Clock, FileText, Moon } from "lucide-react";
import { useState } from "react";

export default function RedirectFlowMap() {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    exceptions: true,
    mainFlow: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Mapa Visual - Lógica Completa de Redirecionamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Início do Fluxo */}
        <div className="flex items-center gap-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800">
          <Badge variant="default" className="px-4 py-2 text-base">
            📥 Pagamento Aprovado — Serviço Avulso (sem plano ativo)
          </Badge>
        </div>

        {/* EXCEÇÕES PRIORITÁRIAS */}
        <Collapsible open={expandedSections.exceptions} onOpenChange={() => toggleSection("exceptions")}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full hover:opacity-70 transition-opacity">
            <div className="flex items-center gap-2 flex-1 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span className="font-semibold text-amber-900 dark:text-amber-100">
                🚨 EXCEÇÕES PRIORITÁRIAS (Bypass de Todas as Regras)
              </span>
              <ChevronDown
                className={`h-5 w-5 ml-auto transition-transform ${expandedSections.exceptions ? "rotate-180" : ""}`}
              />
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-4 mt-4 ml-6 border-l-4 border-amber-300 dark:border-amber-700 pl-6">
            {/* Exceção 1: SKUs de Plano */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Badge variant="destructive" className="px-3 py-1.5">
                  ⛔ GUARD
                </Badge>
                <span className="font-medium">É SKU de PLANO? (IND_* / FAM_*)</span>
              </div>
              <div className="ml-8 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-red-600" />
                <span className="text-sm">SIM</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge variant="destructive" className="text-xs">
                  ❌ Erro 400 → Redirecionar para /area-do-paciente
                </Badge>
              </div>
              <div className="ml-8 text-xs text-muted-foreground">
                💡 Planos não devem chamar schedule-redirect (são processados via assinatura)
              </div>
            </div>

            {/* Exceção 2: Laudos Psicológicos */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Badge className="bg-green-100 text-green-900 border-green-300 px-3 py-1.5">📱 WhatsApp</Badge>
                <span className="font-medium">É Laudo Psicológico? (OVM9892)</span>
              </div>
              <div className="ml-8 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm">SIM (SEMPRE)</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge className="bg-green-100 text-green-900 border-green-300">
                  📱 WhatsApp Dedicado (5511933359187)
                </Badge>
              </div>
              <div className="ml-8 text-xs text-muted-foreground">
                🎯 Independente de plano, horário ou qualquer outra regra
              </div>
            </div>

            {/* Exceção 3: Receitas SEM plano */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Badge className="bg-green-100 text-green-900 border-green-300 px-3 py-1.5">📱 WhatsApp</Badge>
                <span className="font-medium">É Receita SEM plano? (RZP5755)</span>
              </div>
              <div className="ml-8 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm">SIM + SEM plano</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge className="bg-green-100 text-green-900 border-green-300">
                  📱 WhatsApp Suporte (5511933359187)
                </Badge>
              </div>
            </div>

            {/* Exceção 4: Exames SEM plano */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Badge className="bg-green-100 text-green-900 border-green-300 px-3 py-1.5">📱 WhatsApp</Badge>
                <span className="font-medium">É Exame SEM plano? (ULT3571)</span>
              </div>
              <div className="ml-8 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm">SIM + SEM plano</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge className="bg-green-100 text-green-900 border-green-300">
                  📱 WhatsApp Suporte (5511933359187)
                </Badge>
              </div>
            </div>

            {/* Exceção 5: Médicos Especialistas (SEMPRE WhatsApp) */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Badge className="bg-green-100 text-green-900 border-green-300 px-3 py-1.5">📱 WhatsApp</Badge>
                <span className="font-medium">É Médico Especialista? (18 SKUs)</span>
              </div>
              <div className="ml-8 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm">SIM (SEMPRE)</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge className="bg-green-100 text-green-900 border-green-300">📱 WhatsApp 0800 (5508000008780)</Badge>
              </div>
              <div className="ml-8 text-xs text-muted-foreground">
                🩺 Pediatra, Cardiologista, Ginecologista, Dermatologista, Gastroenterologista, Otorrino, Ortopedista,
                Oftalmologista, Endocrinologista, Psiquiatra, Urologista, Neurologista, Nutrólogo, Infectologista,
                Imunologista, Médico da Família, Geriatra, Reumatologista
              </div>
            </div>

            {/* Exceção 6: Psicólogo SEM plano */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Badge className="bg-green-100 text-green-900 border-green-300 px-3 py-1.5">📱 WhatsApp</Badge>
                <span className="font-medium">É Psicólogo SEM plano ativo? (ZXW2165/HXR8516/YME9025)</span>
              </div>
              <div className="ml-8 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm">SIM + SEM plano</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge className="bg-green-100 text-green-900 border-green-300">📱 WhatsApp 0800 (5508000008780)</Badge>
              </div>
              <div className="ml-8 text-xs text-muted-foreground">
                🧠 Psicólogo sem plano ativo sempre vai para WhatsApp
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* FLUXO PADRÃO */}
        <Collapsible open={expandedSections.mainFlow} onOpenChange={() => toggleSection("mainFlow")}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full hover:opacity-70 transition-opacity">
            <div className="flex items-center gap-2 flex-1 bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
              <Zap className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-blue-900 dark:text-blue-100">
                🔄 FLUXO PADRÃO (Decisões Hierárquicas)
              </span>
              <ChevronDown
                className={`h-5 w-5 ml-auto transition-transform ${expandedSections.mainFlow ? "rotate-180" : ""}`}
              />
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-6 mt-4">
            {/* Decisão 1: Admin Override Global */}
            <div className="ml-4 border-l-2 border-border pl-6 space-y-3">
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="px-3 py-1.5">
                  1️⃣
                </Badge>
                <div className="flex-1 space-y-2">
                  <div className="font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    ADMIN OVERRIDE GLOBAL? (force_clicklife)
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    🎯 <strong>Caso de uso:</strong> Testes, manutenção Communicare, redirecionar TUDO para ClickLife
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm">SIM (qualquer SKU)</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Badge className="bg-slate-100 text-slate-900 border-slate-300">
                      🏥 CLICKLIFE emergência (empresaId: 9083)
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-sm">NÃO</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </div>

              {/* Decisão 2: Override PA ClickLife */}
              <div className="ml-4 border-l-2 border-border pl-6 space-y-3">
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="px-3 py-1.5">
                    2️⃣
                  </Badge>
                  <div className="flex-1 space-y-2">
                    <div className="font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      OVERRIDE PA ATIVO? (force_clicklife_pronto_atendimento) + SKU = ITC6534?
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      🎯 <strong>Caso de uso:</strong> Forçar clínico geral para ClickLife Pronto Atendimento
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm">SIM + SKU = ITC6534</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <Badge className="bg-slate-100 text-slate-900 border-slate-300">
                        🏥 CLICKLIFE PA (planoId: 863)
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="text-sm">NÃO</span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                {/* Decisão 3: Plano Ativo no Banco */}
                <div className="ml-4 border-l-2 border-border pl-6 space-y-3">
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="px-3 py-1.5">
                      3️⃣
                    </Badge>
                    <div className="flex-1 space-y-2">
                      <div className="font-medium">PLANO ATIVO NO BANCO? (patient_plans)</div>
                      <div className="text-xs text-muted-foreground mb-2">
                        Verifica se o paciente possui plano ativo em <code>patient_plans</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm">SIM</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <Badge className="bg-slate-100 text-slate-900 border-slate-300">
                          🏥 CLICKLIFE (plano ativo — 863/864)
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="text-sm">NÃO</span>
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>

                  {/* Decisão 4: Hora BRT < 7h */}
                  <div className="ml-4 border-l-2 border-border pl-6 space-y-3">
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="px-3 py-1.5">
                        4️⃣
                      </Badge>
                      <div className="flex-1 space-y-2">
                        <div className="font-medium flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          HORA BRT &lt; 7h? (00h00–06h59, UTC-3)
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-blue-500 mt-0.5" />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">SIM</span>
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              <Badge className="bg-indigo-50 text-indigo-900 border-indigo-300">
                                <Moon className="h-3 w-3 mr-1 inline" />
                                OUT OF HOURS
                              </Badge>
                            </div>
                            <div className="ml-2 text-xs text-muted-foreground space-y-0.5 bg-indigo-50 dark:bg-indigo-950/30 p-2 rounded border border-indigo-200 dark:border-indigo-800">
                              <p>• <strong>status:</strong> out_of_hours</p>
                              <p>• <strong>Frontend:</strong> tela especial + botão WhatsApp</p>
                              <p>• <strong>ITC6534:</strong> "Comprei clínico geral, email: [email]"</p>
                              <p>• <strong>Demais SKUs:</strong> "Comprei [especialidade] e gostaria de agendar"</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span className="text-sm">NÃO (07h00–23h59)</span>
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>

                    {/* Decisão 5: SKU = ITC6534 */}
                    <div className="ml-4 border-l-2 border-border pl-6 space-y-3">
                      <div className="flex items-start gap-3">
                        <Badge variant="outline" className="px-3 py-1.5">
                          5️⃣
                        </Badge>
                        <div className="flex-1 space-y-2">
                          <div className="font-medium">SKU = ITC6534? (Clínico Geral)</div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium">SIM</span>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <Badge className="bg-blue-50 text-blue-900 border-blue-300">
                              💙 COMMUNICARE (fila)
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="text-sm">NÃO (outros SKUs)</span>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <Badge className="bg-green-100 text-green-900 border-green-300">
                              📱 WhatsApp 5511933359187
                            </Badge>
                          </div>
                          <div className="ml-8 text-xs text-muted-foreground">
                            Mensagem: "Acabei de comprar [especialidade] e gostaria de agendar"
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Legenda de Providers */}
        <Alert>
          <AlertDescription>
            <div className="space-y-3">
              <p className="font-semibold mb-2">📌 Legenda de Providers:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge className="bg-slate-100 text-slate-900 border-slate-300">🏥 ClickLife</Badge>
                  <span>Telemedicina com auto-login (empresaId: 9083)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-50 text-blue-900 border-blue-300">💙 Communicare</Badge>
                  <span>Plataforma interna com SSO via JWT</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-900 border-green-300">📱 WhatsApp</Badge>
                  <span>Atendimento manual via WhatsApp Business</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-indigo-50 text-indigo-900 border-indigo-300">🌙 Out of Hours</Badge>
                  <span>Fora do horário comercial (00h–06h59 BRT)</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                ⚙️ Override disponível em: <strong>Admin → Configurações → Forçar Pronto Atendimento → ClickLife</strong>
              </p>
            </div>
          </AlertDescription>
        </Alert>

        {/* Itens Removidos do Fluxo Antigo */}
        <div className="p-4 bg-muted/20 rounded-lg border border-dashed border-muted-foreground/30">
          <p className="font-semibold mb-2 text-muted-foreground text-sm">
            🗑️ Removido do fluxo anterior:
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li className="line-through">❌ Verificação de fim de semana → ClickLife</li>
            <li className="line-through">❌ Verificação de horário noturno (≥19h) → ClickLife</li>
            <li className="line-through">❌ Override force_communicare_clinico</li>
            <li className="line-through">❌ Verificação de especialidade disponível na Communicare</li>
            <li className="line-through">❌ Fallback ClickLife em horário noturno/fim de semana</li>
          </ul>
        </div>

        {/* Tabela de Resumo SKUs */}
        <div className="mt-6 p-4 bg-muted/30 rounded-lg border">
          <p className="font-semibold mb-3">📊 Resumo de SKUs por Categoria:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium mb-1">🩺 Clínico Geral:</p>
              <p className="text-xs text-muted-foreground">ITC6534 → Communicare (horário comercial) ou Out of Hours</p>
            </div>
            <div>
              <p className="font-medium mb-1">🧠 Psicologia:</p>
              <p className="text-xs text-muted-foreground">ZXW2165, HXR8516, YME9025</p>
            </div>
            <div>
              <p className="font-medium mb-1">👨‍⚕️ Médicos Especialistas (18 SKUs):</p>
              <p className="text-xs text-muted-foreground">
                TQP5720, HGG3503, VHH8883, TSB0751, CCP1566, FKS5964, TVQ5046, HMG9544, HME8366, DYY8522, QOP1101,
                LZF3879, YZD9932, UDH3250, PKS9388, MYX5186, ZXW2165, HXR8516
              </p>
            </div>
            <div>
              <p className="font-medium mb-1">📄 Laudos/Receitas/Exames:</p>
              <p className="text-xs text-muted-foreground">OVM9892, RZP5755, ULT3571</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
