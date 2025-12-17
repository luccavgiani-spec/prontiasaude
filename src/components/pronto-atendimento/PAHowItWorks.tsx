import { PAFeatureSteps } from "./PAFeatureSteps";

const features = [
  {
    step: 'Passo 1',
    title: 'Faça seu cadastro',
    content: 'Cadastre-se em nossa plataforma de forma rápida e simples, sem burocracia.',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=300&fit=crop'
  },
  {
    step: 'Passo 2',
    title: 'Efetue o pagamento',
    content: 'Pague de forma segura e comece seu atendimento médico na mesma hora.',
    image: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400&h=300&fit=crop'
  },
  {
    step: 'Passo 3',
    title: 'Seja atendido pelo médico',
    content: 'Após o pagamento, você é automaticamente direcionado para a consulta online.',
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=300&fit=crop'
  },
];

const PAHowItWorks = () => {
  return (
    <section id="como-funciona" className="bg-gradient-to-b from-muted/30 to-background">
      <PAFeatureSteps
        features={features}
        title="Como Funciona?"
        subtitle="Atendimento médico online em 3 passos simples"
        badge="Simples e Rápido"
        autoPlayInterval={4000}
      />
    </section>
  );
};

export default PAHowItWorks;
