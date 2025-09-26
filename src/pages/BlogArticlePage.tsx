import { useMemo, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { BlogPost, blogPosts } from "@/data/blogPosts";
import { ArrowLeft, ExternalLink } from "lucide-react";

interface DynamicBlogPost {
  id: string;
  title: string;
  description: string;
  type: 'video' | 'pdf' | 'link' | 'post' | 'image';
  url?: string;
  content?: string;
  fileUrl?: string;
  blogCategory?: string;
  externalLink?: string;
  createdAt: Date;
}

interface ExtendedBlogPost extends BlogPost {
  isDynamic?: boolean;
  dynamicData?: DynamicBlogPost;
}

const basePath = "/blogs-artigos"; // manter igual ao da listagem

export default function BlogArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [dynamicPosts, setDynamicPosts] = useState<DynamicBlogPost[]>([]);
  
  useEffect(() => {
    const savedBlogs = localStorage.getItem('blogs-content');
    if (savedBlogs) {
      try {
        const blogs = JSON.parse(savedBlogs);
        setDynamicPosts(blogs);
      } catch (error) {
        console.error('Erro ao carregar blogs dinâmicos:', error);
      }
    }
  }, []);

  const post = useMemo((): ExtendedBlogPost | null => {
    // Primeiro procura nos posts estáticos
    const staticPost = blogPosts.find(p => p.slug === slug);
    if (staticPost) return staticPost;
    
    // Depois procura nos posts dinâmicos
    const dynamicPost = dynamicPosts.find(p => `dynamic-${p.id}` === slug);
    if (dynamicPost) {
      // Converte post dinâmico para formato estático
      return {
        slug: `dynamic-${dynamicPost.id}`,
        title: dynamicPost.title,
        subtitle: dynamicPost.description,
        imageUrl: dynamicPost.fileUrl || '/placeholder.svg',
        imageAlt: dynamicPost.title,
        tags: [dynamicPost.blogCategory || 'Geral'],
        date: dynamicPost.createdAt.toString(),
        content: dynamicPost.content ? [dynamicPost.content] : [dynamicPost.description],
        isDynamic: true,
        dynamicData: dynamicPost
      };
    }
    
    return null;
  }, [slug, dynamicPosts]);

  if (!post) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-neutral-600 text-center">Artigo não encontrado.</p>
        <div className="text-center mt-4">
          <Link to={basePath} className="text-primary hover:underline inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar para Blogs
          </Link>
        </div>
      </section>
    );
  }

  return (
    <article className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8">
        <Link to={basePath} className="text-primary hover:underline inline-flex items-center gap-2 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Voltar para Blogs
        </Link>
        
        <h1 className="text-3xl md:text-4xl font-semibold text-neutral-900 mb-4">{post.title}</h1>
        <p className="text-lg text-neutral-600 mb-6">{post.subtitle}</p>

        <div className="flex flex-wrap gap-2 mb-6">
          {post.tags.map(t => (
            <span key={t} className="text-sm px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
              {t}
            </span>
          ))}
        </div>
      </header>

      {/* IMAGEM CONDIZENTE com o tema do post */}
      <figure className="my-8">
        <img 
          src={post.imageUrl} 
          alt={post.imageAlt || post.title} 
          className="w-full rounded-2xl shadow-lg object-cover max-h-96" 
        />
        {post.imageAlt && <figcaption className="sr-only">{post.imageAlt}</figcaption>}
      </figure>

      <section className="prose prose-lg prose-neutral max-w-none">
        {post.isDynamic && post.dynamicData ? (
          <div className="mb-8">
            {/* Renderizar conteúdo dinâmico baseado no tipo */}
            {post.dynamicData.type === 'image' && post.dynamicData.fileUrl && (
              <div className="mb-6">
                <img 
                  src={post.dynamicData.fileUrl} 
                  alt={post.dynamicData.title}
                  className="w-full rounded-lg shadow-md max-h-96 object-cover"
                />
              </div>
            )}
            
            {post.dynamicData.type === 'video' && post.dynamicData.url && (
              <div className="mb-6">
                <div className="aspect-video">
                  <iframe
                    src={post.dynamicData.url.includes('youtube.com') ? 
                      post.dynamicData.url.replace('watch?v=', 'embed/') : 
                      post.dynamicData.url}
                    className="w-full h-full rounded-lg"
                    allowFullScreen
                  />
                </div>
              </div>
            )}
            
            {post.dynamicData.type === 'pdf' && post.dynamicData.fileUrl && (
              <div className="mb-6">
                <a 
                  href={post.dynamicData.fileUrl}
                  download={post.dynamicData.title}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Baixar PDF
                </a>
              </div>
            )}
            
            {post.dynamicData.type === 'link' && post.dynamicData.url && (
              <div className="mb-6">
                <a 
                  href={post.dynamicData.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Acessar Link
                </a>
              </div>
            )}
            
            {/* Conteúdo de texto */}
            {post.dynamicData.content && (
              <div className="text-neutral-700 leading-relaxed mb-6 whitespace-pre-wrap">
                {post.dynamicData.content}
              </div>
            )}
            
            {/* Link externo se disponível */}
            {post.dynamicData.externalLink && (
              <div className="mt-8 p-6 bg-gray-50 rounded-lg border">
                <h3 className="text-lg font-semibold mb-2">Link Relacionado</h3>
                <a 
                  href={post.dynamicData.externalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  Acessar conteúdo externo
                </a>
              </div>
            )}
          </div>
        ) : (
          // Conteúdo estático
          post.content.map((para, i) => (
            <p key={i} className="text-neutral-700 leading-relaxed mb-6">{para}</p>
          ))
        )}
      </section>

      <footer className="mt-12 pt-8 border-t border-neutral-200">
        <Link to={basePath} className="text-primary hover:underline inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar para Blogs
        </Link>
      </footer>
    </article>
  );
}