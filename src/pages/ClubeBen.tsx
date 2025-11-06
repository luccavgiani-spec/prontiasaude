import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useNavigate } from "react-router-dom";
import { PlanosSection } from "@/components/home/PlanosSection";
import { PartnersLogoGallery } from "@/components/home/PartnersLogoGallery";
import { Check, Pill, Stethoscope, Dumbbell, Apple, MapPin, ArrowRight, Gift, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
const ClubeBen = () => {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [accessing, setAccessing] = useState(false);
  const [parceiroForm, setParceiroForm] = useState({
    nomeLoja: '',
    responsavel: '',
    contato: '',
    cnpj: '',
    categoria: '',
    descricao: ''
  });
  const [isSubmittingParceiro, setIsSubmittingParceiro] = useState(false);
  const handleAccessClub = async () => {
    setAccessing(true);
    try {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Faça login",
          description: "Você precisa estar logado para acessar o Clube."
        });
        navigate('/entrar?returnUrl=/clubeben');
        return;
      }
      const {
        data,
        error
      } = await supabase.functions.invoke('clubeben-auth-bridge', {
        body: {
          user_id: session.user.id
        }
      });
      if (error || !data?.redirect_url) {
        if (data?.needs_completion) {
          toast({
            title: "Complete seu cadastro",
            description: "Precisamos do seu CPF e data de nascimento."
          });
          navigate('/completar-perfil?from=clubeben');
          return;
        }
        throw new Error('Falha ao gerar acesso');
      }
      window.location.href = data.redirect_url;
    } catch (error) {
      toast({
        title: "Erro ao acessar",
        description: "Tente novamente em instantes.",
        variant: "destructive"
      });
    } finally {
      setAccessing(false);
    }
  };
  const handleParceiroInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const {
      name,
      value
    } = e.target;
    setParceiroForm(prev => ({
      ...prev,
      [name]: value
    }));
  };
  const handleParceiroSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parceiroForm.nomeLoja || !parceiroForm.responsavel || !parceiroForm.contato || !parceiroForm.cnpj || !parceiroForm.categoria || !parceiroForm.descricao) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos.",
        variant: "destructive"
      });
      return;
    }
    setIsSubmittingParceiro(true);
    try {
      const {
        error
      } = await supabase.functions.invoke('send-form-emails', {
        body: {
          type: 'clubeben-parceiro',
          data: parceiroForm
        }
      });
      if (error) {
        throw error;
      }
      toast({
        title: "Cadastro enviado!",
        description: "Recebemos sua proposta. Entraremos em contato em breve."
      });
      setParceiroForm({
        nomeLoja: '',
        responsavel: '',
        contato: '',
        cnpj: '',
        categoria: '',
        descricao: ''
      });
    } catch (error) {
      console.error('Error sending form:', error);
      toast({
        title: "Erro ao enviar",
        description: "Tente novamente mais tarde ou entre em contato conosco.",
        variant: "destructive"
      });
    } finally {
      setIsSubmittingParceiro(false);
    }
  };
  return <>
      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-6">
              <Gift className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-primary">Benefício Exclusivo</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Cuidar da saúde ficou mais vantajoso
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8">
              Descontos exclusivos em farmácias, exames, academias e muito mais. 
              Centenas de parceiros em todo o Brasil.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link to="/planos">
                  Assinar Agora
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" onClick={handleAccessClub} disabled={accessing}>
                {accessing ? 'Redirecionando...' : 'Acessar Clube'}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Galeria de Parceiros */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Nossos parceiros</h2>
          <PartnersLogoGallery />
        </div>
      </section>

      {/* Benefícios por Categoria */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Benefícios por categoria</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card>
              <CardContent className="pt-6">
                <Pill className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-semibold mb-2">Farmácias</h3>
                <p className="text-sm text-muted-foreground">
                  Até 80% de desconto em medicamentos genéricos e similares
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <Stethoscope className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-semibold mb-2">Laboratórios</h3>
                <p className="text-sm text-muted-foreground">
                  Descontos expeciais em exames
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <Dumbbell className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-semibold mb-2">Fitness e Bem-estar</h3>
                <p className="text-sm text-muted-foreground">
                  Academias, pilates e atividades físicas com vantagens
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <Apple className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-semibold mb-2">Alimentação Saudável</h3>
                <p className="text-sm text-muted-foreground">
                  Produtos naturais e orgânicos com preços especiais
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <MapPin className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-semibold mb-2">Cobertura Nacional</h3>
                <p className="text-sm text-muted-foreground">
                  Centenas de parceiros em todo o Brasil
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <Check className="h-8 w-8 text-primary mb-4" />
                <h3 className="font-semibold mb-2">Sem Carência</h3>
                <p className="text-sm text-muted-foreground">
                  Use seus benefícios imediatamente após a ativação
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Perguntas frequentes</h2>
          
          <div className="max-w-3xl mx-auto space-y-6">
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-2">Como acesso o Clube de Benefícios?</h3>
                <p className="text-sm text-muted-foreground">
                  Após assinar um plano, acesse sua área do paciente e clique no botão "Acessar Clube de Benefícios". 
                  Você será redirecionado automaticamente com login único.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-2">Quem pode usar os benefícios?</h3>
                <p className="text-sm text-muted-foreground">
                  Todos os assinantes de planos Prontia Saúde têm acesso automático e gratuito ao ClubeBen.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-2">Como funciona o desconto?</h3>
                <p className="text-sm text-muted-foreground">
                  Ao acessar o clube, você terá um cartão digital com QR Code. Apresente na rede credenciada 
                  para garantir seus descontos na hora da compra.
                </p>
              </CardContent>
            </Card>

            <Card>
              
            </Card>
          </div>
        </div>
      </section>

      {/* Planos Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Veja os planos e ative seus benefícios</h2>
            <p className="text-muted-foreground">
              Escolha o plano ideal para você e ganhe acesso imediato ao Clube de Benefícios
            </p>
          </div>
          <PlanosSection />
        </div>
      </section>

      {/* Formulário Seja Parceiro */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
                <Store className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-3xl font-bold mb-4">Seja uma loja parceira</h2>
              <p className="text-lg text-muted-foreground">
                Faça parte do nosso clube de benefícios e ofereça descontos exclusivos para nossos assinantes
              </p>
            </div>

            <Card>
              <CardContent className="pt-6">
                <form onSubmit={handleParceiroSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="nomeLoja">Nome da Loja/Empresa *</Label>
                      <Input id="nomeLoja" name="nomeLoja" value={parceiroForm.nomeLoja} onChange={handleParceiroInputChange} placeholder="Nome da sua loja" required />
                    </div>
                    <div>
                      <Label htmlFor="responsavel">Responsável *</Label>
                      <Input id="responsavel" name="responsavel" value={parceiroForm.responsavel} onChange={handleParceiroInputChange} placeholder="Seu nome completo" required />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="contato">Contato *</Label>
                      <Input id="contato" name="contato" value={parceiroForm.contato} onChange={handleParceiroInputChange} placeholder="Email ou telefone" required />
                    </div>
                    <div>
                      <Label htmlFor="cnpj">CNPJ *</Label>
                      <Input id="cnpj" name="cnpj" value={parceiroForm.cnpj} onChange={handleParceiroInputChange} placeholder="00.000.000/0000-00" required />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="categoria">Categoria *</Label>
                    <Select value={parceiroForm.categoria} onValueChange={value => setParceiroForm(prev => ({
                    ...prev,
                    categoria: value
                  }))} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="farmacias">Farmácias e Drogarias</SelectItem>
                        <SelectItem value="laboratorios">Laboratórios e Exames</SelectItem>
                        <SelectItem value="fitness">Fitness e Bem-estar</SelectItem>
                        <SelectItem value="alimentacao">Alimentação Saudável</SelectItem>
                        <SelectItem value="varejo">Varejo e Serviços</SelectItem>
                        <SelectItem value="outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="descricao">Descreva os benefícios que deseja oferecer *</Label>
                    <Textarea id="descricao" name="descricao" value={parceiroForm.descricao} onChange={handleParceiroInputChange} placeholder="Ex: 20% de desconto em todos os produtos da loja, 15% em medicamentos genéricos..." rows={4} required />
                  </div>

                  <Button type="submit" className="w-full" size="lg" disabled={isSubmittingParceiro}>
                    {isSubmittingParceiro ? 'Enviando...' : 'Enviar Proposta de Parceria'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </>;
};
export default ClubeBen;