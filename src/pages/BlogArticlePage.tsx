import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { blogPosts } from "@/data/blogPosts";
import { ArrowLeft } from "lucide-react";

const basePath = "/blogs-artigos"; // manter igual ao da listagem

export default function BlogArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const post = useMemo(() => blogPosts.find(p => p.slug === slug), [slug]);

  if (!post) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-neutral-600 text-center">Artigo não encontrado.</p>
        <div className="text-center mt-4">
          <Link to={basePath} className="text-primary hover:underline inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar para Blogs & Artigos
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
          Voltar para Blogs & Artigos
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
        {post.content.map((para, i) => (
          <p key={i} className="text-neutral-700 leading-relaxed mb-6">{para}</p>
        ))}
      </section>

      <footer className="mt-12 pt-8 border-t border-neutral-200">
        <Link to={basePath} className="text-primary hover:underline inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Voltar para Blogs & Artigos
        </Link>
      </footer>
    </article>
  );
}