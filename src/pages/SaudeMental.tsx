import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Leaf, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";

interface ContentItem {
  id: string;
  title: string;
  description: string;
  type: 'video' | 'pdf' | 'link' | 'post';
  url?: string;
  content?: string;
}

const SaudeMental = () => {
  const [content, setContent] = useState<ContentItem[]>([]);

  useEffect(() => {
    // Load content from localStorage or API
    const savedContent = localStorage.getItem('saude-mental-content');
    if (savedContent) {
      setContent(JSON.parse(savedContent));
    }
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
              <BreadcrumbPage>Saúde Mental</BreadcrumbPage>
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
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-teal-600 rounded-full mb-6">
            <Leaf className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">Saúde Mental</h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Bem-vindo(a) ao seu espaço de equilíbrio e autocuidado. Aqui você encontra conteúdos, ferramentas e inspirações para fortalecer sua mente e cultivar bem-estar todos os dias. Respire fundo, explore e comece a cuidar de você agora.
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
                    {item.type === 'pdf' && '📄'}
                    {item.type === 'link' && '🔗'}
                    {item.type === 'post' && '📝'}
                    {item.title}
                  </CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {item.type === 'link' && item.url && (
                    <Button asChild className="w-full">
                      <a href={item.url} target="_blank" rel="noopener noreferrer">
                        Acessar Link
                      </a>
                    </Button>
                  )}
                  {item.type === 'pdf' && item.url && (
                    <Button asChild className="w-full">
                      <a href={item.url} target="_blank" rel="noopener noreferrer">
                        Baixar PDF
                      </a>
                    </Button>
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
              <Leaf className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Conteúdo em breve
              </h3>
              <p className="text-muted-foreground">
                Em breve você encontrará aqui materiais exclusivos sobre saúde mental e bem-estar.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SaudeMental;