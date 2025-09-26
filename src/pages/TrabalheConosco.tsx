import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Briefcase, Upload, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const TrabalheConosco = () => {
  const [formData, setFormData] = useState({
    nome: '',
    crm: '',
    contato: '',
    cpfCnpj: '',
    curriculo: null as File | null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFormData(prev => ({ ...prev, curriculo: file }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.crm || !formData.contato || !formData.cpfCnpj) {
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
          type: 'trabalhe-conosco',
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
        title: "Formulário enviado!",
        description: "Recebemos seu interesse. Entraremos em contato em breve."
      });

      // Reset form
      setFormData({
        nome: '',
        crm: '',
        contato: '',
        cpfCnpj: '',
        curriculo: null
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
              <BreadcrumbPage>Trabalhe Conosco</BreadcrumbPage>
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
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-6">
            <Briefcase className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">Trabalhe Conosco</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Faça parte da nossa equipe e ajude a transformar o futuro da saúde digital no Brasil.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Junte-se à Prontia Saúde</CardTitle>
            <CardDescription>
              Preencha o formulário abaixo com suas informações profissionais
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
                  <Label htmlFor="crm">CRM *</Label>
                  <Input
                    id="crm"
                    name="crm"
                    value={formData.crm}
                    onChange={handleInputChange}
                    placeholder="Ex: CRM/SP 123456"
                    required
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
                    placeholder="000.000.000-00"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="curriculo">Currículo</Label>
                <div className="mt-2">
                  <label htmlFor="curriculo" className="cursor-pointer">
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {formData.curriculo ? formData.curriculo.name : 'Clique para enviar seu currículo (PDF)'}
                      </p>
                    </div>
                    <input
                      id="curriculo"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Enviando...' : 'Enviar Candidatura'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TrabalheConosco;