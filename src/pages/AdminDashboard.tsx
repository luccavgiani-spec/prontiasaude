import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Upload, FileText, Video, Link as LinkIcon, MessageSquare, LogOut, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ContentItem {
  id: string;
  title: string;
  description: string;
  type: 'video' | 'pdf' | 'link' | 'post' | 'image';
  url?: string;
  content?: string;
  file?: File;
  fileUrl?: string;
  destination: string;
  blogCategory?: string;
  externalLink?: string;
  createdAt: Date;
}

const AdminDashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [contentForm, setContentForm] = useState({
    title: '',
    description: '',
    type: 'post' as 'video' | 'pdf' | 'link' | 'post' | 'image',
    url: '',
    content: '',
    file: null as File | null,
    fileUrl: '',
    destination: '',
    blogCategory: '',
    externalLink: ''
  });
  const [publishedContent, setPublishedContent] = useState<ContentItem[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAdminAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/admin/login');
        return;
      }

      // Check if user has admin role
      const { data: roleData, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin')
        .single();

      if (error || !roleData) {
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para acessar esta página.",
          variant: "destructive"
        });
        await supabase.auth.signOut();
        navigate('/admin/login');
        return;
      }

      setIsAuthenticated(true);
      loadPublishedContent();
    };

    checkAdminAccess();
  }, [navigate, toast]);

  const loadPublishedContent = () => {
    const destinations = ['saude-mental-content', 'livros-content', 'playlists-content', 'receitas-content'];
    const allContent: ContentItem[] = [];

    destinations.forEach(dest => {
      const content = localStorage.getItem(dest);
      if (content) {
        const parsed = JSON.parse(content);
        allContent.push(...parsed.map((item: any) => ({
          ...item,
          destination: dest.replace('-content', '').replace('-', ' ')
        })));
      }
    });

    setPublishedContent(allContent);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setContentForm(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Convert file to base64 for permanent storage
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setContentForm(prev => ({ ...prev, file, fileUrl: base64 }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setContentForm(prev => ({ ...prev, [name]: value }));
  };

  const handlePublish = () => {
    if (!contentForm.title || !contentForm.description || !contentForm.destination) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha título, descrição e destino.",
        variant: "destructive"
      });
      return;
    }

    if (contentForm.type === 'link' && !contentForm.url) {
      toast({
        title: "URL obrigatória",
        description: "Para conteúdo tipo link, a URL é obrigatória.",
        variant: "destructive"
      });
      return;
    }

    if (contentForm.type === 'video' && !contentForm.url) {
      toast({
        title: "URL obrigatória",
        description: "Para vídeos, a URL é obrigatória.",
        variant: "destructive"
      });
      return;
    }

    if ((contentForm.type === 'pdf' || contentForm.type === 'image') && !contentForm.file) {
      toast({
        title: "Arquivo obrigatório",
        description: "Para PDFs e imagens, é necessário fazer upload do arquivo.",
        variant: "destructive"
      });
      return;
    }

    if (contentForm.type === 'post' && !contentForm.content) {
      toast({
        title: "Conteúdo obrigatório",
        description: "Para posts, o conteúdo é obrigatório.",
        variant: "destructive"
      });
      return;
    }

    const newContent: ContentItem = {
      id: Date.now().toString(),
      title: contentForm.title,
      description: contentForm.description,
      type: contentForm.type,
      url: contentForm.url,
      content: contentForm.content,
      file: contentForm.file,
      fileUrl: contentForm.fileUrl,
      destination: contentForm.destination,
      blogCategory: contentForm.blogCategory,
      externalLink: contentForm.externalLink,
      createdAt: new Date()
    };

    // Save to appropriate destination
    let storageKey = '';
    switch (contentForm.destination) {
      case 'saude-mental':
        storageKey = 'saude-mental-content';
        break;
      case 'livros':
        storageKey = 'livros-content';
        break;
      case 'playlists':
        storageKey = 'playlists-content';
        break;
      case 'receitas-saudaveis':
        storageKey = 'receitas-saudaveis-content';
        break;
      case 'blog':
        storageKey = 'blog-content';
        break;
    }

    if (storageKey) {
      const existingContent = localStorage.getItem(storageKey);
      const contentArray = existingContent ? JSON.parse(existingContent) : [];
      contentArray.push(newContent);
      localStorage.setItem(storageKey, JSON.stringify(contentArray));

      toast({
        title: "Conteúdo publicado!",
        description: "O conteúdo foi adicionado com sucesso."
      });

      // Reset form
      setContentForm({
        title: '',
        description: '',
        type: 'post',
        url: '',
        content: '',
        file: null,
        fileUrl: '',
        destination: '',
        blogCategory: '',
        externalLink: ''
      });

      // Reload content
      loadPublishedContent();
    }
  };

  const handleDeleteContent = (id: string, destination: string) => {
    let storageKey = `${destination.replace(' ', '-')}-content`;
    const existingContent = localStorage.getItem(storageKey);
    if (existingContent) {
      const contentArray = JSON.parse(existingContent);
      const filteredContent = contentArray.filter((item: ContentItem) => item.id !== id);
      localStorage.setItem(storageKey, JSON.stringify(filteredContent));
      
      toast({
        title: "Conteúdo removido",
        description: "O conteúdo foi removido com sucesso."
      });
      
      loadPublishedContent();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Painel Administrativo
            </h1>
            <p className="text-muted-foreground">
              Gerencie o conteúdo do site e teste integrações
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>

        <Tabs defaultValue="conteudo" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="conteudo">Gerenciar Conteúdo</TabsTrigger>
            <TabsTrigger value="testes">Testes de Roteamento</TabsTrigger>
          </TabsList>

          <TabsContent value="conteudo">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Content Creation Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Adicionar Conteúdo
              </CardTitle>
              <CardDescription>
                Crie e publique novo conteúdo para o site
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  name="title"
                  value={contentForm.title}
                  onChange={handleInputChange}
                  placeholder="Título do conteúdo"
                />
              </div>

              <div>
                <Label htmlFor="description">Descrição *</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={contentForm.description}
                  onChange={handleInputChange}
                  placeholder="Descrição breve"
                  rows={3}
                />
              </div>

              <div>
                <Label>Tipo de Conteúdo *</Label>
                <Select value={contentForm.type} onValueChange={(value) => handleSelectChange('type', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="post">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Post/Texto
                      </div>
                    </SelectItem>
                    <SelectItem value="video">
                      <div className="flex items-center gap-2">
                        <Video className="h-4 w-4" />
                        Vídeo
                      </div>
                    </SelectItem>
                    <SelectItem value="image">
                      <div className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Imagem
                      </div>
                    </SelectItem>
                    <SelectItem value="pdf">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        PDF
                      </div>
                    </SelectItem>
                    <SelectItem value="link">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="h-4 w-4" />
                        Link Externo
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(contentForm.type === 'video' || contentForm.type === 'link') && (
                <div>
                  <Label htmlFor="url">{contentForm.type === 'link' ? 'URL Externa *' : 'URL do Vídeo *'}</Label>
                  <Input
                    id="url"
                    name="url"
                    value={contentForm.url}
                    onChange={handleInputChange}
                    placeholder="https://..."
                  />
                </div>
              )}

              {(contentForm.type === 'pdf' || contentForm.type === 'image') && (
                <div>
                  <Label htmlFor="file">{contentForm.type === 'pdf' ? 'Arquivo PDF *' : 'Arquivo de Imagem *'}</Label>
                  <Input
                    id="file"
                    type="file"
                    accept={contentForm.type === 'pdf' ? '.pdf' : 'image/*'}
                    onChange={handleFileChange}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
                  />
                  {contentForm.fileUrl && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Arquivo selecionado: {contentForm.file?.name}
                    </p>
                  )}
                </div>
              )}

              {contentForm.type === 'post' && (
                <div>
                  <Label htmlFor="content">Conteúdo *</Label>
                  <Textarea
                    id="content"
                    name="content"
                    value={contentForm.content}
                    onChange={handleInputChange}
                    placeholder="Conteúdo do post..."
                    rows={4}
                  />
                </div>
              )}

              {/* Link Externo - para todos os tipos */}
              <div>
                <Label htmlFor="externalLink">Link Externo (opcional)</Label>
                <Input
                  id="externalLink"
                  name="externalLink"
                  type="url"
                  value={contentForm.externalLink}
                  onChange={handleInputChange}
                  placeholder="https://exemplo.com"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Link para redirecionamento externo quando o usuário clicar no conteúdo
                </p>
              </div>

              <div>
                <Label>Destino *</Label>
                <Select value={contentForm.destination} onValueChange={(value) => handleSelectChange('destination', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha onde publicar" />
                  </SelectTrigger>
                  <SelectContent>
                  <SelectItem value="receitas-saudaveis">Receitas Saudáveis</SelectItem>
                  <SelectItem value="playlists">Playlists</SelectItem>
                  <SelectItem value="livros">Livros</SelectItem>
                  <SelectItem value="blog">Blog</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {contentForm.destination === 'blog' && (
                <div>
                  <Label>Categoria do Blog</Label>
                  <Select value={contentForm.blogCategory} onValueChange={(value) => handleSelectChange('blogCategory', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Telemedicina">Telemedicina</SelectItem>
                      <SelectItem value="Cuidados">Cuidados</SelectItem>
                      <SelectItem value="Receitas">Receitas</SelectItem>
                      <SelectItem value="Digital">Digital</SelectItem>
                      <SelectItem value="Atestados">Atestados</SelectItem>
                      <SelectItem value="Trabalho">Trabalho</SelectItem>
                      <SelectItem value="Prevenção">Prevenção</SelectItem>
                      <SelectItem value="Saúde">Saúde</SelectItem>
                      <SelectItem value="Emergência">Emergência</SelectItem>
                      <SelectItem value="Urgência">Urgência</SelectItem>
                      <SelectItem value="Saúde Mental">Saúde Mental</SelectItem>
                      <SelectItem value="Bem-estar">Bem-estar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button onClick={handlePublish} className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                Publicar Conteúdo
              </Button>
            </CardContent>
          </Card>

          {/* Published Content List */}
          <Card>
            <CardHeader>
              <CardTitle>Conteúdos Publicados</CardTitle>
              <CardDescription>
                Gerencie os conteúdos já publicados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {publishedContent.length > 0 ? (
                  publishedContent.map((item) => (
                    <div key={item.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold">{item.title}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteContent(item.id, item.destination)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                      
                      {/* Preview do conteúdo */}
                      {item.type === 'image' && item.fileUrl && (
                        <div className="mt-2">
                          <img src={item.fileUrl} alt={item.title} className="w-full h-32 object-cover rounded" />
                        </div>
                      )}
                      {item.type === 'video' && item.url && (
                        <div className="mt-2 aspect-video bg-muted rounded flex items-center justify-center">
                          <span className="text-sm">🎥 Vídeo: {item.url}</span>
                        </div>
                      )}
                      {item.type === 'pdf' && item.fileUrl && (
                        <div className="mt-2 p-2 bg-muted rounded">
                          <span className="text-sm">📄 PDF: {item.file?.name || 'Arquivo'}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center mt-2">
                        <div className="flex gap-2">
                          <Badge variant="secondary">
                            {item.type === 'video' && '🎥 Vídeo'}
                            {item.type === 'pdf' && '📄 PDF'}
                            {item.type === 'link' && '🔗 Link'}
                            {item.type === 'post' && '📝 Post'}
                            {item.type === 'image' && '🖼️ Imagem'}
                          </Badge>
                          <Badge variant="outline">{item.destination}</Badge>
                          {item.blogCategory && (
                            <Badge variant="outline">{item.blogCategory}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhum conteúdo publicado ainda
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
            </div>
          </TabsContent>

          <TabsContent value="testes">
            <TestesRoteamento />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;