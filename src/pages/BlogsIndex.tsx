import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { blogPosts } from "@/data/blogPosts";
import { supabase } from "@/integrations/supabase/client";

const basePath = "/blogs-artigos";

interface DynamicBlogPost {
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
  createdAt: Date;
}

export default function BlogsIndex() {
  const [dynamicPosts, setDynamicPosts] = useState<DynamicBlogPost[]>([]);

  useEffect(() => {
    const loadContent = async () => {
      const { data, error } = await supabase
        .from('admin_content')
        .select('*')
        .eq('destination', 'blog')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const formattedPosts = data.map(item => ({
          id: item.id,
          title: item.title,
          description: item.description || '',
          type: item.content_type as 'video' | 'pdf' | 'link' | 'post' | 'image',
          url: item.url || item.external_link || '',
          content: item.content || '',
          fileUrl: item.file_url || '',
          destination: item.destination,
          blogCategory: item.blog_category || '',
          createdAt: new Date(item.created_at)
        }));
        setDynamicPosts(formattedPosts);
      }
    };
    loadContent();
  }, []);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    blogPosts.forEach(p => p.tags.forEach(t => s.add(t)));
    // Add dynamic posts categories
    dynamicPosts.forEach(p => {
      if (p.blogCategory) s.add(p.blogCategory);
    });
    return ["Todos", ...Array.from(s)];
  }, [dynamicPosts]);
  
  const [active, setActive] = useState<string>("Todos");
  
  // Combine static and dynamic posts
  const allPosts = useMemo(() => {
    const staticPosts = blogPosts;
    const dynamicPostsFormatted = dynamicPosts.map(post => ({
      slug: `dynamic-${post.id}`,
      title: post.title,
      subtitle: post.description,
      imageUrl: post.fileUrl || '/placeholder.svg',
      imageAlt: post.title,
      tags: post.blogCategory ? [post.blogCategory] : [],
      date: new Date(post.createdAt).toISOString(),
      content: post.content ? [post.content] : []
    }));
    return [...staticPosts, ...dynamicPostsFormatted];
  }, [dynamicPosts]);
  
  const filtered = useMemo(() => 
    active === "Todos" ? allPosts : allPosts.filter(p => p.tags.includes(active)), 
    [active, allPosts]
  );

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6 text-center">
        <h1 className="text-3xl md:text-4xl font-semibold text-neutral-900">Blog</h1>
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
          <article
            key={post.slug}
            className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden hover:shadow-lg transition-shadow"
          >
            <img
              src={post.imageUrl}
              alt={post.imageAlt || post.title}
              className="h-44 w-full object-cover"
            />
            <div className="p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">{post.title}</h3>
              <p className="text-sm text-neutral-600 mb-3 line-clamp-2">{post.subtitle}</p>

              <div className="mb-4 flex flex-wrap gap-1">
                {post.tags.map(t => (
                  <span
                    key={t}
                    className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20"
                  >
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
