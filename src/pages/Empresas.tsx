import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LogoLoop from "@/components/bits/LogoLoop";
import { supabase } from "@/integrations/supabase/client";
import { trackLead } from "@/lib/meta-tracking";
import { Shield, Users, Clock, Heart, TrendingUp, FileText, Building2, CheckCircle } from "lucide-react";
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
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Track Lead event for business proposal form
    trackLead({
      content_name: 'Proposta Empresarial',
    });
    
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('send-form-emails', {
        body: {
          type: 'empresa',
          ...formData
        }
      });
      if (error) throw error;
      alert('Solicitação enviada com sucesso! Nossa equipe entrará em contato em breve.');
      setFormData({
        nome: "",
        empresa: "",
        colaboradores: "",
        cnpj: "",
        telefone: "",
        email: ""
      });
      setShowForm(false);
    } catch (error) {
      console.error('Erro ao enviar formulário:', error);
      alert('Erro ao enviar solicitação. Tente novamente.');
    }
  };
  const benefitCards = [{
    icon: <Clock className="h-8 w-8 text-primary" />,
    title: "Atendimento rápido e remoto",
    description: "Consultas online e sem deslocamento. Reduz piora do quadro de saúde dos colaboradores, reduzindo as faltas e aumentando a produtividade."
  }, {
    icon: <Heart className="h-8 w-8 text-primary" />,
    title: "Apoio contínuo à saúde mental",
    description: "Psicólogos quinzenais e psiquiatras disponíveis. Identificação precoce de ansiedade, burnout e depressão."
  }, {
    icon: <FileText className="h-8 w-8 text-primary" />,
    title: "Conteúdos exclusivos",
    description: "Vídeos, palestras com psicólogos, métodos de respiração, receitas alimentares e músicas relaxantes."
  }, {
    icon: <Shield className="h-8 w-8 text-primary" />,
    title: "Formulários de diagnóstico e intervenção",
    description: "Identificação e gestão de riscos psicossociais conforme NR-1 (nova). Reduz risco de processos trabalhistas."
  }, {
    icon: <Users className="h-8 w-8 text-primary" />,
    title: "Disque denúncia",
    description: "Canal seguro para reportar riscos ou situações de assédio no ambiente de trabalho."
  }, {
    icon: <TrendingUp className="h-8 w-8 text-primary" />,
    title: "Saúde preventiva e economia",
    description: "Check-ups regulares e acompanhamento de doenças crônicas, levando à redução de faltas e afastamentos."
  }, {
    icon: <Building2 className="h-8 w-8 text-primary" />,
    title: "Bem estar corporativo",
    description: "Fortalece engajamento e lealdade dos funcionários. Reduz turnover e custos com novas contratações e treinamentos."
  }];
  const logoItems = [{
    title: "Pagamento Seguro",
    node: <Shield className="h-6 w-6" />
  }, {
    title: "Para Todas as Idades",
    node: <Users className="h-6 w-6" />
  }, {
    title: "Médico 24h",
    node: <Clock className="h-6 w-6" />
  }, {
    title: "Suporte Rápido",
    node: <Heart className="h-6 w-6" />
  }, {
    title: "Emissão de Laudos",
    node: <CheckCircle className="h-6 w-6" />
  }];
  const empresaAdvantages = ["Reduz afastamentos e absenteísmo", "Aumenta a produtividade da equipe", "Consultas online sem deslocamento (direto do trabalho)", "Intervenção rápida em riscos psicossociais", "Fortalece a cultura de cuidado da empresa", "Sua empresa em conformidade com a NR-1", "Melhor custo-benefício: sem coparticipação, sem carência, sem taxas extras"];
  const colaboradorAdvantages = ["Consultas 24 horas de onde estiver", "+10 especialidades sob agendamento", "Acompanhamento de doenças crônicas", "Apoio psicológico e emocional quando precisar", "Palestras e vídeos para saúde mental", "Desconto em exames e medicamentos", "Planos de benefícios com descontos exclusivos em várias lojas do Brasil."];
  return <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="py-16 px-4 bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Para Empresas
          </h1>
          <h2 className="text-xl md:text-2xl text-primary font-semibold mb-6">
            Quem cuida da sua equipe, cuida do futuro da sua empresa
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-8">
            Um programa de saúde corporativa bem estruturado traz benefícios tanto para a empresa quanto para os colaboradores. 
            Ele atua na prevenção, acompanhamento e bem-estar dos funcionários, o que impacta diretamente em produtividade e custos.
          </p>
          <Button size="lg" onClick={() => setShowForm(true)} className="medical-button-primary text-lg px-8 py-4">
            Solicitar Contato
          </Button>
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
                  {empresaAdvantages.map((advantage, index) => <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{advantage}</span>
                    </li>)}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Vantagens para os colaboradores</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {colaboradorAdvantages.map((advantage, index) => <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{advantage}</span>
                    </li>)}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Cards */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          
          
          {/* Mobile version - Original grid */}
          <div className="md:hidden grid gap-6">
            {benefitCards.map((benefit, index) => <Card key={index} className="h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    {benefit.icon}
                    <CardTitle className="text-lg">{benefit.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>)}
          </div>
          
          {/* Desktop version - LogoLoop */}
          <div className="hidden md:block">
            <LogoLoop logos={benefitCards.map(card => ({
            title: card.title,
            node: <Card className="w-80 h-48">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        {card.icon}
                        <CardTitle className="text-lg">{card.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground text-sm">{card.description}</p>
                    </CardContent>
                  </Card>
          }))} speed={40} logoHeight={192} gap={20} pauseOnHover={true} />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="container mx-auto max-w-4xl">
          {!showForm ? <div className="text-center">
              <h2 className="text-3xl font-bold mb-6">
                Pronto para transformar a saúde da sua equipe?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">Receba uma proposta personalizada e eleve sua empresa a um novo patamar.</p>
              <Button size="lg" onClick={() => setShowForm(true)} className="medical-button-primary text-lg px-8 py-4">
                Solicitar Contato
              </Button>
            </div> : <Card>
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
                      <Input id="nome" value={formData.nome} onChange={e => setFormData(prev => ({
                    ...prev,
                    nome: e.target.value
                  }))} required />
                    </div>
                    <div>
                      <Label htmlFor="empresa">Nome da empresa</Label>
                      <Input id="empresa" value={formData.empresa} onChange={e => setFormData(prev => ({
                    ...prev,
                    empresa: e.target.value
                  }))} required />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="colaboradores">Quantidade de colaboradores</Label>
                    <Select onValueChange={value => setFormData(prev => ({
                  ...prev,
                  colaboradores: value
                }))}>
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
                      <Input id="cnpj" value={formData.cnpj} onChange={e => setFormData(prev => ({
                    ...prev,
                    cnpj: e.target.value
                  }))} required />
                    </div>
                    <div>
                      <Label htmlFor="telefone">Número de telefone</Label>
                      <Input id="telefone" type="tel" value={formData.telefone} onChange={e => setFormData(prev => ({
                    ...prev,
                    telefone: e.target.value
                  }))} required />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" value={formData.email} onChange={e => setFormData(prev => ({
                  ...prev,
                  email: e.target.value
                }))} required />
                  </div>

                  <div className="text-center pt-4">
                    <Button type="submit" size="lg" className="medical-button-primary px-8 py-4">
                      Solicitar contato
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>}
        </div>
      </section>

      {/* Why Choose Section */}
      <section className="py-16 px-4 bg-gradient-to-br from-primary/10 to-secondary/10">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Por que escolher a Prontia Saúde?
          </h2>
          <div className="space-y-4 text-base md:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            <p>
              Na Prontia Saúde, cuidamos da saúde do seu time como se fossem parte da nossa família. 
              Mais do que telemedicina, oferecemos um cuidado completo, com foco em prevenção e bem-estar contínuo – tudo em um só lugar.
            </p>
            <p>
              Com acesso rápido a médicos, sua equipe consegue tratar antes de agravar qualquer problema, 
              reduzindo afastamentos prolongados e garantindo mais saúde e produtividade no dia a dia.
            </p>
            <p className="font-medium text-primary">
              Estamos sempre pensando no melhor para o funcionário e para a empresa.
            </p>
          </div>
        </div>
      </section>

      {/* Fixed Mobile CTA */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
        <Button onClick={() => setShowForm(true)} className="w-full medical-button-primary py-3">
          Solicitar contato
        </Button>
      </div>
    </div>;
};
export default Empresas;