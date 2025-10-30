import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useNavigate } from "react-router-dom";
import { PlanosSection } from "@/components/home/PlanosSection";
import { 
  Check, 
  Pill, 
  Stethoscope, 
  Dumbbell, 
  Apple, 
  MapPin,
  ArrowRight,
  Gift
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const ClubeBen = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [accessing, setAccessing] = useState(false);

  const handleAccessClub = async () => {
    setAccessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Faça login",
          description: "Você precisa estar logado para acessar o Clube.",
        });
        navigate('/entrar?returnUrl=/clubeben');
        return;
      }

      const { data, error } = await supabase.functions.invoke('clubeben-auth-bridge', {
        body: { user_id: session.user.id }
      });

      if (error || !data?.redirect_url) {
        if (data?.needs_completion) {
          toast({
            title: "Complete seu cadastro",
            description: "Precisamos do seu CPF e data de nascimento.",
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
        variant: "destructive",
      });
    } finally {
      setAccessing(false);
    }
  };

  return (
    <>
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
              <Button 
                size="lg" 
                variant="outline"
                onClick={handleAccessClub}
                disabled={accessing}
              >
                {accessing ? 'Redirecionando...' : 'Acessar Clube'}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Como Funciona */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Como funciona</h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-primary">1</span>
                </div>
                <h3 className="font-semibold mb-2">Assine um plano</h3>
                <p className="text-sm text-muted-foreground">
                  Escolha o plano que mais combina com você
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-primary">2</span>
                </div>
                <h3 className="font-semibold mb-2">Acesse o clube</h3>
                <p className="text-sm text-muted-foreground">
                  Entre na sua área do paciente e clique em "Acessar Clube"
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-primary">3</span>
                </div>
                <h3 className="font-semibold mb-2">Aproveite os descontos</h3>
                <p className="text-sm text-muted-foreground">
                  Apresente seu benefício na rede credenciada
                </p>
              </CardContent>
            </Card>
          </div>
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
                <h3 className="font-semibold mb-2">Exames e Laboratoriais</h3>
                <p className="text-sm text-muted-foreground">
                  Descontos especiais em exames e procedimentos
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
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-2">Preciso de ajuda, quem eu contato?</h3>
                <p className="text-sm text-muted-foreground">
                  Para dúvidas sobre os benefícios, entre em contato diretamente com o suporte ClubeBen 
                  através do aplicativo ou site oficial.
                </p>
              </CardContent>
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
    </>
  );
};

export default ClubeBen;
