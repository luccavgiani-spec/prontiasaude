import { motion } from "motion/react";
import {
  Thermometer,
  Brain,
  Apple,
  Moon,
  Pill,
  FileText,
  Droplets,
  Wind,
  Stethoscope,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";

const useCases = [
  {
    icon: Thermometer,
    title: "Gripes e Resfriados",
    description: "Febre, coriza, dor de garganta e mal-estar geral"
  },
  {
    icon: Brain,
    title: "Dores de Cabeça",
    description: "Enxaquecas, cefaléias tensionais e dores recorrentes"
  },
  {
    icon: Apple,
    title: "Problemas Digestivos",
    description: "Náuseas, azia, refluxo e desconforto abdominal"
  },
  {
    icon: Moon,
    title: "Insônia e Ansiedade",
    description: "Dificuldade para dormir, estresse e nervosismo"
  },
  {
    icon: Pill,
    title: "Renovação de Receitas",
    description: "Medicamentos de uso contínuo e tratamentos em andamento"
  },
  {
    icon: FileText,
    title: "Atestados Médicos",
    description: "Para trabalho, escola, academia e viagens"
  },
  {
    icon: Droplets,
    title: "Infecções Urinárias",
    description: "Ardência, urgência e desconforto ao urinar"
  },
  {
    icon: Wind,
    title: "Alergias e Rinite",
    description: "Espirros, coceira, congestão nasal e irritação"
  },
  {
    icon: Stethoscope,
    title: "Orientação Médica",
    description: "Dúvidas sobre sintomas, exames e tratamentos"
  }
];

const PATelemedicineSection = () => {
  return (
    <section className="hidden md:block py-16 bg-muted/30">
      <div className="container">
        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Atendemos Você em{" "}
            <span className="text-primary">Qualquer Situação</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Mais de <strong className="text-foreground">80% dos casos</strong> podem ser resolvidos por telemedicina.
            Veja se o seu está na lista:
          </p>
        </motion.div>

        {/* Use Cases Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-5xl mx-auto mb-10">
          {useCases.map((useCase, index) => (
            <motion.div
              key={index}
              className="bg-background rounded-xl p-5 shadow-sm border border-border/50 hover:shadow-lg hover:border-primary/30 transition-all duration-300 group cursor-default"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <useCase.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-foreground mb-1">
                    {useCase.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {useCase.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Button 
            className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-lg px-8 py-6 mb-4" 
            size="lg" 
            asChild
          >
            <a href="/entrar">Iniciar Consulta Agora - R$ 39,90</a>
          </Button>

          {/* Disclaimer */}
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <AlertTriangle className="w-4 h-4 text-accent" />
            <span>
              Em caso de emergência grave, procure um pronto-socorro imediatamente.
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default PATelemedicineSection;
