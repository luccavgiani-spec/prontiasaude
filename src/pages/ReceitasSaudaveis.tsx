import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { UtensilsCrossed, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ContentItem {
  id: string;
  title: string;
  description: string;
  type: 'video' | 'pdf' | 'link' | 'post' | 'image';
  url?: string;
  content?: string;
  fileUrl?: string;
  externalLink?: string;
  createdAt: Date;
}

const ReceitasSaudaveis = () => {
  const [content, setContent] = useState<ContentItem[]>([]);

  useEffect(() => {
    const loadContent = async () => {
      const { data, error } = await supabase
        .from('admin_content')
        .select('*')
        .eq('destination', 'receitas-saudaveis')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const formattedContent = data.map(item => ({
          id: item.id,
          title: item.title || '',
          description: item.description || '',
          type: item.content_type as 'video' | 'pdf' | 'link' | 'post' | 'image',
          url: item.url || item.external_link || '',
          content: typeof item.content === 'string' ? item.content : '',
          fileUrl: item.file_url || '',
          externalLink: item.external_link || '',
          createdAt: new Date(item.created_at || Date.now())
        }));
        setContent(formattedContent);
      }
    };
    loadContent();
  }, []);

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/area-do-paciente">Área do Paciente</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Receitas Saudáveis</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="sm" asChild>
            <Link to="/area-do-paciente">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Link>
          </Button>
        </div>

        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-full mb-6">
            <UtensilsCrossed className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">Receitas Saudáveis e Cardápios</h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Bem-vindo(a) à sua cozinha de saúde e bem-estar. Aqui você encontra receitas práticas, cardápios equilibrados e dicas de alimentação que facilitam o dia a dia e cuidam da sua saúde de forma leve e deliciosa.
          </p>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {content.length > 0 ? (
            content.map((item) => (
              <Card key={item.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {item.type === 'video' && '🎥'}
                    {item.type === 'pdf' && '📋'}
                    {item.type === 'link' && '🔗'}
                    {item.type === 'post' && '🥗'}
                    {item.type === 'image' && '🖼️'}
                    {item.title}
                  </CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {item.type === 'link' && item.url && (
                    <Button asChild className="w-full">
                      <a href={item.url} target="_blank" rel="noopener noreferrer">
                        Ver Receita
                      </a>
                    </Button>
                  )}
                  {item.type === 'pdf' && item.fileUrl && (
                    <Button asChild className="w-full">
                      <a href={item.fileUrl} download={item.title + '.pdf'}>
                        Baixar Cardápio
                      </a>
                    </Button>
                  )}
                  {item.type === 'image' && item.fileUrl && (
                    <div className="w-full">
                      <img 
                        src={item.fileUrl} 
                        alt={item.title}
                        className="w-full rounded-lg object-cover max-h-64"
                      />
                    </div>
                  )}
                  {item.type === 'video' && item.url && (
                    <div className="aspect-video">
                      <iframe
                        src={item.url}
                        className="w-full h-full rounded-lg"
                        allowFullScreen
                      />
                    </div>
                  )}
                  {item.type === 'post' && item.content && (
                    <div className="prose prose-sm max-w-none">
                      <p>{item.content}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <UtensilsCrossed className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Receitas em desenvolvimento
              </h3>
              <p className="text-muted-foreground">
                Em breve você encontrará aqui receitas saudáveis e cardápios balanceados criados por nossos nutricionistas.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceitasSaudaveis;
