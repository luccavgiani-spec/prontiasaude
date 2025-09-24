import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LogoLoop from "@/components/bits/LogoLoop";
import { 
  Shield, 
  Users, 
  Clock, 
  Heart, 
  TrendingUp, 
  FileText, 
  Building2,
  CheckCircle
} from "lucide-react";

const Empresas = () => {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    empresa: "",
    colaboradores: "",
    cnpj: "",
    telefone: "",
    email: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const message = `Olá! Gostaria de receber uma proposta personalizada para minha empresa:

Nome: ${formData.nome}
Empresa: ${formData.empresa}
Número de colaboradores: ${formData.colaboradores}
CNPJ: ${formData.cnpj}
Telefone: ${formData.telefone}
Email: ${formData.email}`;

    const whatsappUrl = `https://wa.me/5511999999999?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const benefitCards = [
    {
      icon: <Clock className="h-8 w-8 text-primary" />,
      title: "Atendimento rápido e remoto",
      description: "Consultas online sem deslocamento. Reduz faltas e previne piora do quadro de saúde dos colaboradores."
    },
    {
      icon: <Heart className="h-8 w-8 text-primary" />,
      title: "Apoio contínuo à saúde mental", 
      description: "Psicólogos quinzenais e psiquiatras disponíveis. Identificação precoce de ansiedade, burnout e depressão."
    },
    {
      icon: <FileText className="h-8 w-8 text-primary" />,
      title: "Conteúdos exclusivos",
      description: "Vídeos, palestras com psicólogos, métodos de respiração, receitas alimentares e sons para dormir."
    },
    {
      icon: <Shield className="h-8 w-8 text-primary" />,
      title: "Formulários de diagnóstico e intervenção",
      description: "Identificação e gestão de riscos psicossociais conforme NR-1 (nova). Reduz risco de processos trabalhistas."
    },
    {
      icon: <Users className="h-8 w-8 text-primary" />,
      title: "Disque denúncia",
      description: "Canal seguro para reportar riscos ou situações de assédio no ambiente de trabalho."
    },
    {
      icon: <TrendingUp className="h-8 w-8 text-primary" />,
      title: "Saúde preventiva e economia",
      description: "Check-ups regulares, acompanhamento de crônicos, redução de faltas e afastamentos."
    },
    {
      icon: <Building2 className="h-8 w-8 text-primary" />,
      title: "Imagem de empresa moderna e inovadora",
      description: "Fortalece engajamento e lealdade dos funcionários. Reduz turnover e custos com reposição."
    }
  ];

  const logoItems = [
    { title: "Pagamento Seguro", node: <Shield className="h-6 w-6" /> },
    { title: "Para Todas as Idades", node: <Users className="h-6 w-6" /> },
    { title: "Médico 24h", node: <Clock className="h-6 w-6" /> },
    { title: "Atestado e Receitas Digitais", node: <FileText className="h-6 w-6" /> },
    { title: "Suporte Rápido", node: <Heart className="h-6 w-6" /> },
    { title: "Emissão de Laudos", node: <CheckCircle className="h-6 w-6" /> }
  ];

  const empresaAdvantages = [
    "Reduz afastamentos e absenteísmo",
    "Aumenta a produtividade da equipe", 
    "Consultas online sem deslocamento (direto do trabalho)",
    "Intervenção rápida em riscos psicossociais",
    "Fortalece a cultura de cuidado da empresa",
    "Sua empresa em conformidade com a NR-1",
    "Melhor custo-benefício: sem coparticipação, sem carência, sem taxas extras"
  ];

  const colaboradorAdvantages = [
    "Consultas 24 horas de onde estiver",
    "+10 especialidades para agendar",
    "Acompanhamento de doenças crônicas",
    "Apoio psicológico e emocional quando precisar",
    "Palestras, vídeos e respiração para saúde mental",
    "Descontos em exames e medicações"
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="py-16 px-4 bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Para Empresas
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Na Prontia Saúde, cuidamos da saúde do seu time como se fossem parte da nossa família. 
            Mais do que telemedicina, oferecemos um cuidado completo, com foco em prevenção e bem-estar 
            contínuo — tudo em um só lugar. Com acesso rápido a médicos, sua equipe trata antes de agravar, 
            reduzindo afastamentos e aumentando a produtividade. Estamos sempre pensando no melhor para o 
            funcionário e para a empresa.
          </p>
        </div>
      </section>

      {/* Benefits Cards */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Benefícios Exclusivos
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefitCards.slice(0, 6).map((benefit, index) => (
              <Card key={index} className="h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    {benefit.icon}
                    <CardTitle className="text-lg">{benefit.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Card centralizado - Imagem de empresa moderna e inovadora */}
          <div className="flex justify-center mt-6">
            <Card className="h-full max-w-md">
              <CardHeader>
                <div className="flex items-center gap-3">
                  {benefitCards[6].icon}
                  <CardTitle className="text-lg">{benefitCards[6].title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{benefitCards[6].description}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Logo Loop Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            Diferenciais da Plataforma
          </h2>
          <LogoLoop 
            logos={logoItems}
            speed={30}
            logoHeight={24}
            gap={20}
            pauseOnHover={true}
          />
        </div>
      </section>

      {/* Advantages Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Vantagens para sua empresa</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {empresaAdvantages.map((advantage, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{advantage}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Vantagens para os colaboradores</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {colaboradorAdvantages.map((advantage, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{advantage}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="container mx-auto max-w-4xl">
          {!showForm ? (
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-6">
                Pronto para transformar a saúde da sua equipe?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Receba uma proposta personalizada e descubra como podemos ajudar sua empresa.
              </p>
              <Button 
                size="lg"
                onClick={() => setShowForm(true)}
                className="medical-button-primary text-lg px-8 py-4"
              >
                Solicitar Contato
              </Button>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl text-center">
                  Solicite uma Proposta Personalizada
                </CardTitle>
                <CardDescription className="text-center">
                  Basta preencher o formulário para receber uma proposta personalizada, 
                  ideal para a sua empresa
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="nome">Nome e sobrenome</Label>
                      <Input
                        id="nome"
                        value={formData.nome}
                        onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="empresa">Nome da empresa</Label>
                      <Input
                        id="empresa"
                        value={formData.empresa}
                        onChange={(e) => setFormData(prev => ({ ...prev, empresa: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="colaboradores">Quantidade de colaboradores</Label>
                    <Select onValueChange={(value) => setFormData(prev => ({ ...prev, colaboradores: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-10">1 a 10</SelectItem>
                        <SelectItem value="11-50">11 a 50</SelectItem>
                        <SelectItem value="51-100">51 a 100</SelectItem>
                        <SelectItem value="101-500">101 a 500</SelectItem>
                        <SelectItem value="500+">Mais de 500</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="cnpj">CNPJ</Label>
                      <Input
                        id="cnpj"
                        value={formData.cnpj}
                        onChange={(e) => setFormData(prev => ({ ...prev, cnpj: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="telefone">Número de telefone</Label>
                      <Input
                        id="telefone"
                        type="tel"
                        value={formData.telefone}
                        onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="text-center pt-4">
                    <Button type="submit" size="lg" className="medical-button-primary px-8 py-4">
                      Solicitar contato
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Fixed Mobile CTA */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
        <Button 
          onClick={() => setShowForm(true)}
          className="w-full medical-button-primary py-3"
        >
          Solicitar contato
        </Button>
      </div>
    </div>
  );
};

export default Empresas;