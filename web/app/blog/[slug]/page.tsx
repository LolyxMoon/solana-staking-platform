import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPostBySlug, getAllPosts, BlogPost } from "@/lib/blog-data";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Tag,
  Share2,
  Twitter,
  ChevronRight,
  BookOpen,
} from "lucide-react";

interface Props {
  params: { slug: string };
}

// Generate static params for all blog posts
export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

// Generate metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getPostBySlug(params.slug);
  
  if (!post) {
    return {
      title: "Post Not Found | StakePoint Blog",
    };
  }

  return {
    title: `${post.title} | StakePoint Blog`,
    description: post.description,
    keywords: post.keywords.join(", "),
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      authors: ["StakePoint"],
      tags: post.keywords,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

// Simple markdown-like content renderer
function renderContent(content: string) {
  const lines = content.trim().split('\n');
  const elements: JSX.Element[] = [];
  let inCodeBlock = false;
  let codeContent: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let listItems: string[] = [];
  let inList = false;

  const processLine = (line: string, index: number) => {
    // Code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={index} className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 overflow-x-auto my-4">
            <code className="text-sm text-gray-300 font-mono">{codeContent.join('\n')}</code>
          </pre>
        );
        codeContent = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeContent.push(line);
      return;
    }

    // Tables
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
      if (!cells.every(c => c.match(/^[-:]+$/))) {
        tableRows.push(cells);
      }
      return;
    } else if (inTable) {
      // Render table
      elements.push(
        <div key={index} className="overflow-x-auto my-6">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {tableRows[0]?.map((cell, i) => (
                  <th key={i} className="text-left p-3 bg-white/[0.02] border border-white/[0.05] text-sm font-semibold text-white">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.slice(1).map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="p-3 border border-white/[0.05] text-sm text-gray-400">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    }

    // Headers
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={index} className="text-2xl font-bold text-white mt-10 mb-4">
          {line.replace('## ', '')}
        </h2>
      );
      return;
    }

    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={index} className="text-xl font-bold text-white mt-8 mb-3">
          {line.replace('### ', '')}
        </h3>
      );
      return;
    }

    // List items
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      if (!inList) {
        inList = true;
        listItems = [];
      }
      listItems.push(line.trim().replace(/^[-*] /, ''));
      return;
    } else if (inList && line.trim() === '') {
      elements.push(
        <ul key={index} className="list-disc list-inside space-y-2 my-4 text-gray-400">
          {listItems.map((item, i) => (
            <li key={i}>{formatInlineText(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
      return;
    } else if (inList) {
      elements.push(
        <ul key={`list-${index}`} className="list-disc list-inside space-y-2 my-4 text-gray-400">
          {listItems.map((item, i) => (
            <li key={i}>{formatInlineText(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }

    // Numbered lists
    if (line.trim().match(/^\d+\. /)) {
      const text = line.trim().replace(/^\d+\. /, '');
      elements.push(
        <p key={index} className="text-gray-400 ml-4 my-1">
          {line.trim().match(/^\d+/)?.[0]}. {formatInlineText(text)}
        </p>
      );
      return;
    }

    // Empty lines
    if (line.trim() === '') {
      return;
    }

    // Regular paragraphs
    elements.push(
      <p key={index} className="text-gray-400 leading-relaxed my-4">
        {formatInlineText(line)}
      </p>
    );
  };

  // Format inline text (bold, links, inline code)
  function formatInlineText(text: string): React.ReactNode {
    // Handle bold text
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
      }
      // Handle inline code
      const codeParts = part.split(/(`[^`]+`)/g);
      return codeParts.map((codePart, j) => {
        if (codePart.startsWith('`') && codePart.endsWith('`')) {
          return (
            <code key={`${i}-${j}`} className="px-1.5 py-0.5 bg-white/[0.05] rounded text-[#fb57ff] text-sm font-mono">
              {codePart.slice(1, -1)}
            </code>
          );
        }
        // Handle links
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
        const linkParts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match;
        
        while ((match = linkRegex.exec(codePart)) !== null) {
          if (match.index > lastIndex) {
            linkParts.push(codePart.slice(lastIndex, match.index));
          }
          linkParts.push(
            <a 
              key={`${i}-${j}-${match.index}`} 
              href={match[2]} 
              className="text-[#fb57ff] hover:underline"
              target={match[2].startsWith('http') ? '_blank' : undefined}
              rel={match[2].startsWith('http') ? 'noopener noreferrer' : undefined}
            >
              {match[1]}
            </a>
          );
          lastIndex = match.index + match[0].length;
        }
        
        if (linkParts.length > 0) {
          if (lastIndex < codePart.length) {
            linkParts.push(codePart.slice(lastIndex));
          }
          return <span key={`${i}-${j}`}>{linkParts}</span>;
        }
        
        return codePart;
      });
    });
  }

  lines.forEach((line, index) => processLine(line, index));

  // Handle any remaining list
  if (inList && listItems.length > 0) {
    elements.push(
      <ul key="final-list" className="list-disc list-inside space-y-2 my-4 text-gray-400">
        {listItems.map((item, i) => (
          <li key={i}>{formatInlineText(item)}</li>
        ))}
      </ul>
    );
  }

  return elements;
}

export default function BlogPostPage({ params }: Props) {
  const post = getPostBySlug(params.slug);
  const allPosts = getAllPosts();

  if (!post) {
    notFound();
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Get related posts (same category, excluding current)
  const relatedPosts = allPosts
    .filter(p => p.category === post.category && p.slug !== post.slug)
    .slice(0, 3);

  const shareUrl = `https://stakepoint.app/blog/${post.slug}`;
  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(shareUrl)}`;

  return (
    <div className="min-h-screen bg-[#060609]">
      {/* Header */}
      <section className="relative border-b border-white/[0.05]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div 
            className="absolute top-0 left-1/4 w-[800px] h-[800px] rounded-full blur-3xl" 
            style={{ background: 'rgba(251, 87, 255, 0.03)' }} 
          />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 py-12">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-8">
            <Link href="/blog" className="hover:text-[#fb57ff] transition-colors flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Blog
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-400">{post.category}</span>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <span 
              className="px-3 py-1 rounded-full text-xs font-medium"
              style={{ background: 'rgba(251, 87, 255, 0.1)', color: '#fb57ff' }}
            >
              {post.category}
            </span>
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {formatDate(post.date)}
            </span>
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {post.readTime}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            {post.title}
          </h1>

          {/* Description */}
          <p className="text-lg text-gray-400">
            {post.description}
          </p>

          {/* Share */}
          <div className="flex items-center gap-3 mt-6">
            <span className="text-sm text-gray-500">Share:</span>
            <a
              href={twitterShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-white/[0.02] border border-white/[0.05] rounded-lg hover:border-[#fb57ff]/30 transition-all"
            >
              <Twitter className="w-4 h-4 text-gray-400 hover:text-[#fb57ff]" />
            </a>
          </div>
        </div>
      </section>

      {/* Content */}
      <article className="max-w-4xl mx-auto px-6 py-12">
        <div className="prose prose-invert max-w-none">
          {renderContent(post.content)}
        </div>

        {/* Keywords/Tags */}
        <div className="mt-12 pt-8 border-t border-white/[0.05]">
          <div className="flex items-center gap-2 mb-4">
            <Tag className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-500">Topics:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {post.keywords.map((keyword) => (
              <span 
                key={keyword}
                className="px-3 py-1 bg-white/[0.02] border border-white/[0.05] rounded-full text-xs text-gray-400"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      </article>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="max-w-4xl mx-auto px-6 pb-12">
          <div className="border-t border-white/[0.05] pt-12">
            <div className="flex items-center gap-2 mb-6">
              <BookOpen className="w-5 h-5" style={{ color: '#fb57ff' }} />
              <h2 className="text-xl font-bold text-white">Related Articles</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {relatedPosts.map((relatedPost) => (
                <Link 
                  key={relatedPost.slug} 
                  href={`/blog/${relatedPost.slug}`}
                  className="group p-4 bg-white/[0.02] border border-white/[0.05] rounded-lg hover:border-[#fb57ff]/30 transition-all"
                >
                  <h3 className="font-semibold text-white text-sm mb-2 group-hover:text-[#fb57ff] transition-colors line-clamp-2">
                    {relatedPost.title}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {relatedPost.readTime}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="border-t border-white/[0.05] bg-white/[0.01]">
        <div className="max-w-4xl mx-auto px-6 py-12 text-center">
          <h2 
            className="text-2xl font-bold mb-4"
            style={{ 
              background: 'linear-gradient(45deg, white, #fb57ff)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}
          >
            Start Earning Today
          </h2>
          <p className="text-gray-400 mb-6">
            Ready to put this knowledge to work? Explore our staking pools.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/pools"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all"
              style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
            >
              View Staking Pools
              <ChevronRight className="w-4 h-4" />
            </Link>
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/[0.02] border border-white/[0.05] rounded-lg font-semibold text-gray-400 hover:border-[#fb57ff]/30 transition-all"
            >
              More Articles
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
