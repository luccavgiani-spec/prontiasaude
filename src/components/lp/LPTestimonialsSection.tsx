import { Star } from "lucide-react";

const LPTestimonialsSection = () => {
  const testimonials = [
    {
      text: "A Prontia mudou minha vida! Consegui consultar com um médico em menos de 10 minutos, sem sair de casa. Atendimento excelente!",
      name: "Maria Silva",
      location: "São Paulo, SP",
      image:
        "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=face",
    },
    {
      text: "Minha mãe de 78 anos conseguiu fazer teleconsulta facilmente. O médico foi muito atencioso e o receituário chegou no email rapidinho.",
      name: "Carlos Santos",
      location: "Belo Horizonte, MG",
      image:
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face",
    },
    {
      text: "Com dois filhos pequenos, ir ao médico era sempre complicado. Agora resolvo consultas de pediatria pelo celular. Recomendo muito!",
      name: "Ana Oliveira",
      location: "Rio de Janeiro, RJ",
      image:
        "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face",
    },
    {
      text: "Sou caminhoneiro e a telemedicina me salvou várias vezes na estrada. Atendimento rápido e médicos qualificados.",
      name: "Roberto Ferreira",
      location: "Curitiba, PR",
      image:
        "https://images.unsplash.com/photo-1552058544-f2b08422138a?w=100&h=100&fit=crop&crop=face",
    },
    {
      text: "Finalmente um serviço de saúde acessível! O preço é justo e a qualidade do atendimento surpreende.",
      name: "Juliana Costa",
      location: "Salvador, BA",
      image:
        "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100&h=100&fit=crop&crop=face",
    },
    {
      text: "Implementei a Prontia na minha empresa e a satisfação dos funcionários aumentou muito. Menos faltas e mais produtividade.",
      name: "Fernando Lima",
      location: "Porto Alegre, RS",
      image:
        "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=100&h=100&fit=crop&crop=face",
    },
  ];

  return (
    <section className="py-12 md:py-20 bg-muted/30 overflow-hidden">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10 md:mb-14">
          <span className="text-primary font-semibold text-sm tracking-wider uppercase">
            Depoimentos
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-2">
            O que nossos pacientes dizem
          </h2>
          <p className="text-muted-foreground mt-4">
            Veja a experiência de quem já usa a Prontia Saúde.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-card rounded-xl p-6 shadow-sm border border-border/50 hover:shadow-md transition-all"
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-4 h-4 fill-yellow-400 text-yellow-400"
                  />
                ))}
              </div>

              {/* Text */}
              <p className="text-foreground/90 text-sm md:text-base mb-4 italic">
                "{testimonial.text}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <img
                  src={testimonial.image}
                  alt={testimonial.name}
                  className="w-10 h-10 rounded-full object-cover"
                  loading="lazy"
                />
                <div>
                  <p className="font-semibold text-foreground text-sm">
                    {testimonial.name}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {testimonial.location}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LPTestimonialsSection;
