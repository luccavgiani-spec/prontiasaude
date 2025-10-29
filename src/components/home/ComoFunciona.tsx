import { UserCheck, Calendar, Video, ArrowRight, Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import consultaImage from "@/assets/medical-team-realistic.jpg";

const passos = [
  {
    icon: UserCheck,
    titulo: "Cadastre-se",
    descricao: "Crie sua conta em poucos minutos e tenha acesso a centenas de especialistas qualificados.",
    numero: "01"
  },
  {
    icon: Calendar,
    titulo: "Agende",
    descricao: "Escolha o serviço de sua necessidade e passe pela consulta na hora após aprovação do pagamento.",
    numero: "02"
  },
  {
    icon: Video,
    titulo: "Consulte",
    descricao: "Realize sua consulta online de forma segura e receba prescrições digitais válidas.",
    numero: "03"
  }
];

export function ComoFunciona() {
  return (
    <section className="py-10 bg-gradient-to-br from-background via-primary/5 to-background overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Como Funciona
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Três passos simples para revolucionar o cuidado com sua saúde
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-center mb-16">
          {/* Passos - Layout mais dinâmico */}
          <div className="space-y-6">
            {passos.map((passo, index) => {
              const Icon = passo.icon;
              return (
                <div key={index} className="group relative">
                  <div className="medical-card p-6 hover:scale-105 transition-all duration-300">
                    <div className="flex items-center gap-6">
                      {/* Número destacado */}
                      <div className="relative">
                        <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-glow rounded-2xl flex items-center justify-center shadow-lg">
                          <span className="text-2xl font-bold text-white">{passo.numero}</span>
                        </div>
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-accent-foreground" />
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                          {passo.titulo}
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                          {passo.descricao}
                        </p>
                      </div>
                      
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Linha conectora */}
                  {index < passos.length - 1 && (
                    <div className="absolute left-8 top-full w-0.5 h-6 bg-gradient-to-b from-primary/30 to-transparent" />
                  )}
                </div>
              );
            })}
            
            {/* CTA Button */}
            <div className="pt-8 flex justify-center">
              <Link to="/servicos">
                <Button size="xl" className="medical-button-primary text-lg px-10 py-6 rounded-2xl group">
                  Começar Agora
                  <ArrowRight className="ml-3 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Imagem melhorada */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-secondary/10 to-accent/10 rounded-3xl blur-2xl scale-110" />
            <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl hover:scale-105 transition-all duration-700">
              <img 
                src={consultaImage} 
                alt="Consulta médica online profissional"
                width="1200"
                height="800"
                loading="lazy"
                decoding="async"
                style={{ aspectRatio: '3/2' }}
                className="w-full h-auto object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/30 via-transparent to-transparent" />
            </div>
          </div>
        </div>
        
        {/* Segunda seção para renovação de receita */}
        <div className="relative medical-card p-12 text-center ring-2 ring-primary shadow-[var(--shadow-medical)]">
          {/* Badge Popular */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge className="bg-primary text-primary-foreground px-3 py-1">
              <Star className="h-3 w-3 mr-1" />
              Popular
            </Badge>
          </div>
          
          <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Quer renovar sua receita?
          </h3>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Por <span className="font-bold text-primary text-2xl">R$ 29,90</span> você renova agora sua receita válida em todo o Brasil.
          </p>
          <Button size="xl" className="bg-green-600 hover:bg-green-700 text-white border-green-600 hover:border-green-700 transition-all text-lg px-12 py-6 rounded-2xl group">
            Renovar Receita
            <ArrowRight className="ml-3 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
    </section>
  );
}