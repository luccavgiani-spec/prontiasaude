import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Thermometer,
  Brain,
  Heart,
  Moon,
  Pill,
  FileCheck,
  Droplet,
  Flower2,
  HelpCircle,
} from "lucide-react";

const LPTelemedicineSection = () => {
  const navigate = useNavigate();

  const cases = [
    {
      icon: Thermometer,
      title: "Gripes e Resfriados",
      description: "Febre, coriza, dor de garganta e mal-estar geral",
    },
    {
      icon: Brain,
      title: "Dores de Cabeça",
      description: "Enxaquecas, cefaléias tensionais e dores recorrentes",
    },
    {
      icon: Heart,
      title: "Problemas Digestivos",
      description: "Náuseas, azia, refluxo e desconforto abdominal",
    },
    {
      icon: Moon,
      title: "Insônia e Ansiedade",
      description: "Dificuldade para dormir, estresse e nervosismo",
    },
    {
      icon: Pill,
      title: "Renovação de Receitas",
      description: "Medicamentos de uso contínuo e tratamentos em andamento",
    },
    {
      icon: FileCheck,
      title: "Atestados Médicos",
      description: "Para trabalho, escola, academia e viagens",
    },
    {
      icon: Droplet,
      title: "Infecções Urinárias",
      description: "Ardência, urgência e desconforto ao urinar",
    },
    {
      icon: Flower2,
      title: "Alergias e Rinite",
      description: "Espirros, coceira, congestão nasal e irritação",
    },
    {
      icon: HelpCircle,
      title: "Orientação Médica",
      description: "Dúvidas sobre sintomas, exames e tratamentos",
    },
  ];

  return (
    <section className="py-12 md:py-20 bg-background">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10 md:mb-14">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Atendemos Você em{" "}
            <span className="text-primary">Qualquer Situação</span>
          </h2>
          <p className="text-muted-foreground mt-4 text-base md:text-lg max-w-2xl mx-auto">
            Mais de <strong>80% dos casos</strong> podem ser resolvidos por
            telemedicina. Veja se o seu está na lista:
          </p>
        </div>

        {/* Cases Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {cases.map((item, index) => (
            <div
              key={index}
              className="bg-card rounded-xl p-5 md:p-6 shadow-sm hover:shadow-md transition-all duration-300 border border-border/50 hover:border-primary/30 group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground text-lg mb-1">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {item.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-10 md:mt-14 space-y-4">
          <Button
            onClick={() => navigate("/entrar")}
            size="lg"
            className="bg-[#E85D3F] hover:bg-[#d04e32] text-white font-bold text-lg px-10 py-6 rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
          >
            Iniciar Consulta Agora - R$ 39,90
          </Button>
          <p className="text-xs text-muted-foreground">
            Em caso de emergência grave, procure um pronto-socorro imediatamente.
          </p>
        </div>
      </div>
    </section>
  );
};

export default LPTelemedicineSection;
