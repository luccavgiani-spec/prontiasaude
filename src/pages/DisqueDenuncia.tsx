import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { AlertTriangle, ArrowLeft, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const DisqueDenuncia = () => {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    mensagem: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.email || !formData.mensagem) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.functions.invoke('send-form-emails', {
        body: {
          type: 'disque-denuncia',
          data: formData,
          recipients: [
            'sandra_toledo@prontiasaude.com.br',
            'victoria_toledo@prontiasaude.com.br',
            'suporte@prontiasaude.com.br'
          ]
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Denúncia enviada!",
        description: "Recebemos sua denúncia e tomaremos as providências necessárias. Sua identidade será mantida em sigilo."
      });

      // Reset form
      setFormData({
        nome: '',
        email: '',
        telefone: '',
        mensagem: ''
      });
    } catch (error) {
      console.error('Error sending form:', error);
      toast({
        title: "Erro ao enviar",
        description: "Tente novamente mais tarde ou entre em contato conosco.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-2xl mx-auto">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Início</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Disque Denúncia</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Link>
          </Button>
        </div>

        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-500 to-orange-600 rounded-full mb-6">
            <AlertTriangle className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">Disque Denúncia</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
            Este canal foi criado para reforçar nosso compromisso com um ambiente de trabalho seguro, saudável e respeitoso para todos.
          </p>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto mb-4">
            Aqui, trabalhadores, colaboradores e parceiros podem relatar de forma confidencial situações relacionadas a:
          </p>
          <ul className="text-base text-muted-foreground max-w-2xl mx-auto text-left list-disc list-inside space-y-2 mb-6">
            <li>Condições que possam representar riscos à saúde ou à segurança;</li>
            <li>Dúvidas sobre o uso de equipamentos de proteção ou sobre procedimentos de segurança;</li>
            <li>Sugestões de melhoria para o ambiente de trabalho.</li>
          </ul>
          <p className="text-base font-semibold text-foreground max-w-2xl mx-auto mb-2">
            📢 Todos os relatos são tratados com seriedade, responsabilidade e total sigilo.
          </p>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto">
            Acreditamos que a comunicação transparente é essencial para prevenir acidentes e promover o aperfeiçoamento contínuo das condições de trabalho, em conformidade com as Normas Regulamentadoras do Ministério do Trabalho, como a NR 1.
          </p>
        </div>

        <div className="bg-muted/30 rounded-lg p-6 mb-8 flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-foreground mb-2">Confidencialidade Garantida</h3>
            <p className="text-sm text-muted-foreground">
              Todas as denúncias são tratadas com absoluto sigilo. Sua identidade será protegida e apenas 
              as informações necessárias serão compartilhadas para resolução do problema.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Registrar Denúncia</CardTitle>
            <CardDescription>
              Preencha o formulário abaixo com o máximo de detalhes possível
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nome">Nome Completo *</Label>
                  <Input
                    id="nome"
                    name="nome"
                    value={formData.nome}
                    onChange={handleInputChange}
                    placeholder="Digite seu nome completo"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="seu@email.com"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="telefone">Telefone (opcional)</Label>
                <Input
                  id="telefone"
                  name="telefone"
                  type="tel"
                  value={formData.telefone}
                  onChange={handleInputChange}
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div>
                <Label htmlFor="mensagem">Descrição da Denúncia *</Label>
                <Textarea
                  id="mensagem"
                  name="mensagem"
                  value={formData.mensagem}
                  onChange={handleInputChange}
                  placeholder="Descreva detalhadamente a situação: data, horário, profissional envolvido, tipo de serviço e o que aconteceu..."
                  rows={6}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Quanto mais detalhes você fornecer, melhor poderemos investigar e resolver a situação.
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Enviando...' : 'Enviar Denúncia'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DisqueDenuncia;
