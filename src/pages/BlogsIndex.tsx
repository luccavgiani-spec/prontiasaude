import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { blogPosts } from "@/data/blogPosts";

const basePath = "/blogs-artigos"; // ajuste se sua rota atual for outra

export default function BlogsIndex() {
  const allTags = useMemo(() => {
    const s = new Set<string>();
    blogPosts.forEach(p => p.tags.forEach(t => s.add(t)));
    return ["Todos", ...Array.from(s)];
  }, []);

  const [active, setActive] = useState<string>("Todos");
  const filtered = useMemo(
    () => (active === "Todos" ? blogPosts : blogPosts.filter(p => p.tags.includes(active))),
    [active]
  );

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6 text-center">
        <h1 className="text-3xl md:text-4xl font-semibold text-neutral-900">Blogs</h1>
        <p className="text-neutral-600 mt-2">Conteúdos para cuidar melhor da sua saúde</p>
      </header>

      {/* Filtros (botões que de fato filtram) */}
      <div className="flex flex-wrap gap-2 mb-8 justify-center">
        {allTags.map(tag => (
          <button
            key={tag}
            onClick={() => setActive(tag)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
              active === tag
                ? "bg-primary text-white border-primary"
                : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(post => (
          <article key={post.slug} className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden hover:shadow-lg transition-shadow">
            <img src={post.imageUrl} alt={post.imageAlt || post.title} className="h-44 w-full object-cover" />
            <div className="p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">{post.title}</h3>
              <p className="text-sm text-neutral-600 mb-3 line-clamp-2">{post.subtitle}</p>

              <div className="mb-4 flex flex-wrap gap-1">
                {post.tags.map(t => (
                  <span key={t} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {t}
                  </span>
                ))}
              </div>

              {/* "Ler artigo completo" abre página exclusiva */}
              <div className="mt-4">
                <Link
                  to={`${basePath}/${post.slug}`}
                  className="inline-flex items-center gap-2 text-primary font-medium hover:underline"
                >
                  Ler artigo completo →
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}