import { PATestimonialsColumn } from "./PATestimonialsColumn";
import { motion } from "motion/react";
import { BadgeCheck } from "lucide-react";

const testimonials = [
  {
    text: "A Prontia mudou minha vida! Consegui consultar com um médico em menos de 10 minutos, sem sair de casa. Atendimento excelente!",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=face",
    name: "Maria Silva",
    role: "São Paulo, SP",
  },
  {
    text: "Minha mãe de 78 anos conseguiu fazer teleconsulta facilmente. O médico foi muito atencioso e o receituário chegou no email rapidinho.",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=face",
    name: "Carlos Santos",
    role: "Belo Horizonte, MG",
  },
  {
    text: "Com dois filhos pequenos, ir ao médico era sempre complicado. Agora resolvo consultas de pediatria pelo celular. Recomendo muito!",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&crop=face",
    name: "Ana Oliveira",
    role: "Rio de Janeiro, RJ",
  },
  {
    text: "Sou caminhoneiro e a telemedicina me salvou várias vezes na estrada. Atendimento rápido e médicos qualificados.",
    image: "https://images.unsplash.com/photo-1552058544-f2b08422138a?w=100&h=100&fit=crop&crop=face",
    name: "Roberto Ferreira",
    role: "Curitiba, PR",
  },
  {
    text: "Finalmente um serviço de saúde acessível! O preço é justo e a qualidade do atendimento surpreende.",
    image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100&h=100&fit=crop&crop=face",
    name: "Juliana Costa",
    role: "Salvador, BA",
  },
  {
    text: "Implementei a Prontia na minha empresa e a satisfação dos funcionários aumentou muito. Menos faltas e mais produtividade.",
    image: "https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=100&h=100&fit=crop&crop=face",
    name: "Fernando Lima",
    role: "Porto Alegre, RS",
  },
  {
    text: "Moro em cidade pequena sem especialistas. Com a Prontia, consegui consultar com cardiologista sem viajar 200km.",
    image: "https://images.unsplash.com/photo-1548142813-c348350df52b?w=100&h=100&fit=crop&crop=face",
    name: "Lucia Mendes",
    role: "Santo Amaro, MA",
  },
  {
    text: "O app é muito fácil de usar e os médicos explicam tudo com paciência. Me sinto bem cuidada mesmo à distância.",
    image: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=100&h=100&fit=crop&crop=face",
    name: "Patricia Alves",
    role: "Recife, PE",
  },
  {
    text: "Atendimento humanizado e eficiente. Recebi o diagnóstico correto e já estou me recuperando. Obrigado Prontia!",
    image: "https://images.unsplash.com/photo-1600486913747-55e5470d6f40?w=100&h=100&fit=crop&crop=face",
    name: "Bruno Rodrigues",
    role: "Fortaleza, CE",
  },
];

const firstColumn = testimonials.slice(0, 3);
const secondColumn = testimonials.slice(3, 6);
const thirdColumn = testimonials.slice(6, 9);

const PATestimonialsSection = () => {
  return (
    <section className="bg-background py-20 relative">
      <div className="container z-10 mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className="flex flex-col items-center justify-center max-w-[540px] mx-auto"
        >
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
            <BadgeCheck className="w-4 h-4" />
            Depoimentos
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tighter mt-5 text-center">
            O que nossos pacientes dizem
          </h2>
          <p className="text-center mt-5 text-muted-foreground">Veja a experiência de quem já usa a Prontia Saúde.</p>
        </motion.div>

        <div className="flex justify-center gap-6 mt-10 [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)] max-h-[740px] overflow-hidden">
          <PATestimonialsColumn testimonials={firstColumn} duration={15} />
          <PATestimonialsColumn testimonials={secondColumn} className="hidden md:block" duration={19} />
          <PATestimonialsColumn testimonials={thirdColumn} className="hidden lg:block" duration={17} />
        </div>
      </div>
    </section>
  );
};

export default PATestimonialsSection;
