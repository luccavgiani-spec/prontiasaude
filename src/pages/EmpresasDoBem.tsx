import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import CircularGallery from "@/components/bits/CircularGallery";
import { supabase } from "@/integrations/supabase/client";
import { Heart, Globe, Handshake, Users } from "lucide-react";
const EmpresasDoBem = () => {
  const [formData, setFormData] = useState({
    nomeOng: "",
    siteRedes: "",
    contato: "",
    descricao: ""
  });
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('send-form-emails', {
        body: {
          type: 'ong',
          ...formData
        }
      });
      if (error) throw error;
      alert('ONG cadastrada com sucesso! Obrigado por participar do programa.');
      setFormData({
        nomeOng: "",
        siteRedes: "",
        contato: "",
        descricao: ""
      });
    } catch (error) {
      console.error('Erro ao enviar formulário:', error);
      alert('Erro ao cadastrar ONG. Tente novamente.');
    }
  };
  return <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-primary/10 to-secondary/10">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="flex justify-center mb-6">
            <Heart className="h-16 w-16 text-primary animate-pulse" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-8">
            Empresas do Bem
          </h1>
          
          <div className="space-y-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
            <p className="animate-fade-in" style={{
            animationDelay: '0.2s'
          }}>
              Na Prontia Saúde, acreditamos que saúde vai além de consultas e tratamentos: 
              é sobre cuidar de pessoas, acolher histórias e transformar vidas. Nosso propósito 
              é democratizar o acesso à saúde de qualidade e refletir solidariedade, gerando 
              impacto positivo na sociedade.
            </p>
            
            <p className="animate-fade-in" style={{
            animationDelay: '0.4s'
          }}>
              Destinamos uma porcentagem dos lucros a ONGs que fazem a diferença. Também 
              realizamos doações mensais fixas e buscamos novas organizações para conhecer, 
              apoiar e caminhar juntas.
            </p>
            
            <p className="animate-fade-in" style={{
            animationDelay: '0.6s'
          }}>
              Cada gesto conta. Se você representa uma ONG ou conhece alguma instituição que 
              precisa de apoio, registre-a conosco. Cuidar de você também é cuidar do mundo 
              ao seu redor.
            </p>
          </div>
        </div>
      </section>

      {/* Impact Stats */}
      

      {/* Circular Gallery */}
      <section className="py-16 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              ONGs que Apoiamos
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Conheça algumas das organizações que fazem parte da nossa rede de solidariedade.</p>
          </div>
          
          <div style={{
          height: '600px',
          position: 'relative'
        }}>
            <CircularGallery bend={3} textColor="#1f2937" borderRadius={0.05} scrollEase={0.02} />
          </div>
        </div>
      </section>

      {/* Our Approach */}
      

      {/* CTA Section */}
      <section className="py-16 px-4 bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="container mx-auto max-w-4xl">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl md:text-3xl mb-4">
                Cadastre sua ONG
              </CardTitle>
              
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
                <div>
                  <Label htmlFor="nomeOng" className="text-base">Nome da ONG</Label>
                  <Input id="nomeOng" value={formData.nomeOng} onChange={e => setFormData(prev => ({
                  ...prev,
                  nomeOng: e.target.value
                }))} placeholder="Ex: Instituto Esperança" required className="mt-2" />
                </div>

                <div>
                  <Label htmlFor="siteRedes" className="text-base">Site ou Redes Sociais</Label>
                  <Input id="siteRedes" value={formData.siteRedes} onChange={e => setFormData(prev => ({
                  ...prev,
                  siteRedes: e.target.value
                }))} placeholder="www.institutoesperanca.org ou @institutoesperanca" className="mt-2" />
                </div>

                <div>
                  <Label htmlFor="contato" className="text-base">Contato (Email ou WhatsApp)</Label>
                  <Input id="contato" value={formData.contato} onChange={e => setFormData(prev => ({
                  ...prev,
                  contato: e.target.value
                }))} placeholder="contato@institutoesperanca.org ou (11) 99999-9999" required className="mt-2" />
                </div>

                <div>
                  <Label htmlFor="descricao" className="text-base">
                    Descrição da missão e atividades (opcional)
                  </Label>
                  <Textarea id="descricao" value={formData.descricao} onChange={e => setFormData(prev => ({
                  ...prev,
                  descricao: e.target.value
                }))} placeholder="Conte-nos sobre o trabalho realizado pela organização..." rows={4} className="mt-2" />
                </div>

                <div className="text-center pt-4">
                  <Button type="submit" size="lg" className="medical-button-primary text-lg px-8 py-4">
                    Cadastrar ONG
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>;
};
export default EmpresasDoBem;