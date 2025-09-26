import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Handshake, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const SejaNossParceiro = () => {
  const [formData, setFormData] = useState({
    nome: '',
    empresa: '',
    contato: '',
    cpfCnpj: '',
    descricao: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.contato || !formData.cpfCnpj) {
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
          type: 'seja-parceiro',
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
        title: "Proposta enviada!",
        description: "Recebemos sua proposta de parceria. Entraremos em contato em breve."
      });

      // Reset form
      setFormData({
        nome: '',
        empresa: '',
        contato: '',
        cpfCnpj: '',
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
              <BreadcrumbPage>Seja nosso parceiro</BreadcrumbPage>
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
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-teal-600 rounded-full mb-6">
            <Handshake className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">Seja nosso parceiro</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Empresas, marcas e médicos presenciais: vamos juntos revolucionar o acesso à saúde no Brasil.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Proposta de Parceria</CardTitle>
            <CardDescription>
              Conte-nos sobre sua empresa e como podemos trabalhar juntos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nome">Nome do Responsável *</Label>
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
                  <Label htmlFor="empresa">Empresa/Marca</Label>
                  <Input
                    id="empresa"
                    name="empresa"
                    value={formData.empresa}
                    onChange={handleInputChange}
                    placeholder="Nome da empresa"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contato">Contato *</Label>
                  <Input
                    id="contato"
                    name="contato"
                    value={formData.contato}
                    onChange={handleInputChange}
                    placeholder="E-mail ou telefone"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="cpfCnpj">CPF/CNPJ *</Label>
                  <Input
                    id="cpfCnpj"
                    name="cpfCnpj"
                    value={formData.cpfCnpj}
                    onChange={handleInputChange}
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="descricao">Descrição da Proposta</Label>
                <Textarea
                  id="descricao"
                  name="descricao"
                  value={formData.descricao}
                  onChange={handleInputChange}
                  placeholder="Conte-nos sobre sua empresa e como podemos trabalhar juntos..."
                  rows={4}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Enviando...' : 'Enviar Proposta'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SejaNossParceiro;