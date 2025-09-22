import { ArrowLeft, BookOpen, Calendar, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

// Mock data para artigos - em produção viria de uma API/CMS
const artigos = [
  {
    id: 1,
    titulo: "Como funciona a telemedicina: guia completo",
    resumo: "Entenda todos os aspectos da consulta médica online e como ela pode facilitar o seu cuidado com a saúde.",
    categoria: "Telemedicina",
    autor: "Dr. João Silva",
    dataPublicacao: "15 de Nov, 2024",
    tempoLeitura: "5 min",
    imagem: "/api/placeholder/400/250"
  },
  {
    id: 2,
    titulo: "Atestado médico digital: validade e benefícios",
    resumo: "Saiba tudo sobre a validade legal dos atestados médicos digitais e como utilizá-los corretamente.",
    categoria: "Documentação",
    autor: "Dra. Maria Santos",
    dataPublicacao: "12 de Nov, 2024",
    tempoLeitura: "3 min",
    imagem: "/api/placeholder/400/250"
  },
  {
    id: 3,
    titulo: "Renovação de receitas: quando é possível fazer online",
    resumo: "Descubra em quais situações você pode renovar suas receitas médicas através de consulta online.",
    categoria: "Receitas",
    autor: "Dr. Carlos Oliveira",
    dataPublicacao: "10 de Nov, 2024",
    tempoLeitura: "4 min",
    imagem: "/api/placeholder/400/250"
  },
  {
    id: 4,
    titulo: "Psicologia online: como funcionam as consultas",
    resumo: "Entenda o processo das consultas psicológicas online e seus benefícios para a saúde mental.",
    categoria: "Psicologia",
    autor: "Psic. Ana Costa",
    dataPublicacao: "8 de Nov, 2024",
    tempoLeitura: "6 min",
    imagem: "/api/placeholder/400/250"
  },
  {
    id: 5,
    titulo: "Planos de saúde digital: vale a pena?",
    resumo: "Análise completa dos benefícios dos planos de saúde digital e como escolher o melhor para você.",
    categoria: "Planos",
    autor: "Dr. Roberto Lima",
    dataPublicacao: "5 de Nov, 2024",
    tempoLeitura: "7 min",
    imagem: "/api/placeholder/400/250"
  },
  {
    id: 6,
    titulo: "Cuidados com a saúde mental no trabalho remoto",
    resumo: "Dicas essenciais para manter o bem-estar psicológico durante o trabalho em casa.",
    categoria: "Saúde Mental",
    autor: "Psic. Fernando Alves",
    dataPublicacao: "3 de Nov, 2024",
    tempoLeitura: "5 min",
    imagem: "/api/placeholder/400/250"
  }
];

const categorias = ["Todas", "Telemedicina", "Documentação", "Receitas", "Psicologia", "Planos", "Saúde Mental"];

export default function BlogsArtigos() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header com navegação */}
      <div className="bg-background/80 backdrop-blur-sm border-b border-border/50 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Blogs</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Introdução */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Conteúdo de qualidade sobre saúde
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Artigos escritos por profissionais especializados para te ajudar a entender melhor 
            sobre telemedicina, cuidados com a saúde e muito mais.
          </p>
        </div>

        {/* Filtros por categoria */}
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {categorias.map((categoria) => (
            <Button
              key={categoria}
              variant={categoria === "Todas" ? "default" : "outline"}
              size="sm"
              className="rounded-full"
            >
              {categoria}
            </Button>
          ))}
        </div>

        {/* Grid de artigos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {artigos.map((artigo) => (
            <Card key={artigo.id} className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 overflow-hidden">
              <div className="aspect-video bg-gradient-to-r from-primary/10 to-secondary/10 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                <Badge 
                  variant="secondary" 
                  className="absolute top-3 left-3 bg-primary text-primary-foreground"
                >
                  {artigo.categoria}
                </Badge>
              </div>
              
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                  {artigo.titulo}
                </CardTitle>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {artigo.resumo}
                </p>
              </CardHeader>
              
              <CardFooter className="pt-0 flex-col items-start gap-3">
                <div className="flex items-center gap-4 text-xs text-muted-foreground w-full">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {artigo.autor}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {artigo.dataPublicacao}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {artigo.tempoLeitura}
                  </div>
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                >
                  Ler artigo completo
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Call to action para mais conteúdo */}
        <div className="text-center mt-16 p-8 bg-gradient-to-r from-primary/5 via-secondary/5 to-accent/5 rounded-2xl border border-border/50">
          <h3 className="text-2xl font-bold text-foreground mb-4">
            Precisa de atendimento médico?
          </h3>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Além de conteúdo de qualidade, oferecemos consultas médicas online 
            com profissionais qualificados. Cuide da sua saúde agora!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-primary hover:bg-primary/90" asChild>
              <Link to="/servicos">
                Ver Serviços
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/planos">
                Conhecer Planos
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}