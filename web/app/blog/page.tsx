"use client";

import { useState } from "react";
import Link from "next/link";
import { getAllPosts, getFeaturedPosts, BlogPost } from "@/lib/blog-data";
import {
  BookOpen,
  Calendar,
  Clock,
  ArrowRight,
  Search,
  Tag,
  Sparkles,
  ChevronRight,
} from "lucide-react";

export default function BlogPage() {
  const allPosts = getAllPosts();
  const featuredPosts = getFeaturedPosts();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = [...new Set(allPosts.map(post => post.category))];

  const filteredPosts = allPosts.filter(post => {
    const matchesSearch = 
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = !selectedCategory || post.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-[#060609]">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-white/[0.05]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div 
            className="absolute top-0 left-1/4 w-[800px] h-[800px] rounded-full blur-3xl" 
            style={{ background: 'rgba(251, 87, 255, 0.05)' }} 
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-16 lg:py-24">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.02] border border-white/[0.05] mb-6">
              <BookOpen className="w-4 h-4" style={{ color: '#fb57ff' }} />
              <span className="text-sm text-gray-400">StakePoint Blog</span>
            </div>
            
            <h1 
              className="text-4xl lg:text-5xl font-bold mb-4"
              style={{ 
                background: 'linear-gradient(45deg, white, #fb57ff)', 
                WebkitBackgroundClip: 'text', 
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              Learn About Solana Staking
            </h1>
            
            <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
              Guides, tutorials, and insights to help you maximize your staking rewards on Solana.
            </p>

            {/* Search Bar */}
            <div className="max-w-xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/[0.02] border border-white/[0.05] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#fb57ff]/30 transition-all"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              !selectedCategory 
                ? 'bg-[#fb57ff]/20 text-[#fb57ff] border border-[#fb57ff]/30' 
                : 'bg-white/[0.02] text-gray-400 border border-white/[0.05] hover:border-[#fb57ff]/30'
            }`}
          >
            All Posts
          </button>
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedCategory === category 
                  ? 'bg-[#fb57ff]/20 text-[#fb57ff] border border-[#fb57ff]/30' 
                  : 'bg-white/[0.02] text-gray-400 border border-white/[0.05] hover:border-[#fb57ff]/30'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      {/* Featured Posts */}
      {!searchQuery && !selectedCategory && featuredPosts.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 pb-12">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-5 h-5" style={{ color: '#fb57ff' }} />
            <h2 className="text-xl font-bold text-white">Featured Articles</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {featuredPosts.slice(0, 2).map((post) => (
              <Link 
                key={post.slug} 
                href={`/blog/${post.slug}`}
                className="group"
              >
                <article 
                  className="h-full p-6 bg-white/[0.02] border border-white/[0.05] rounded-xl hover:bg-white/[0.04] hover:border-[#fb57ff]/30 transition-all"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span 
                      className="px-3 py-1 rounded-full text-xs font-medium"
                      style={{ background: 'rgba(251, 87, 255, 0.1)', color: '#fb57ff' }}
                    >
                      {post.category}
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(post.date)}
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-3 group-hover:text-[#fb57ff] transition-colors">
                    {post.title}
                  </h3>
                  
                  <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                    {post.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {post.readTime}
                    </span>
                    <span 
                      className="flex items-center gap-1 text-sm font-medium group-hover:gap-2 transition-all"
                      style={{ color: '#fb57ff' }}
                    >
                      Read More
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* All Posts */}
      <section className="max-w-7xl mx-auto px-6 pb-20">
        <div className="flex items-center gap-2 mb-6">
          <BookOpen className="w-5 h-5" style={{ color: '#fb57ff' }} />
          <h2 className="text-xl font-bold text-white">
            {searchQuery || selectedCategory ? 'Search Results' : 'All Articles'}
          </h2>
          <span className="text-sm text-gray-500">({filteredPosts.length})</span>
        </div>

        {filteredPosts.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No articles found matching your search.</p>
            <button 
              onClick={() => { setSearchQuery(''); setSelectedCategory(null); }}
              className="mt-4 text-[#fb57ff] hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map((post) => (
              <Link 
                key={post.slug} 
                href={`/blog/${post.slug}`}
                className="group"
              >
                <article 
                  className="h-full p-5 bg-white/[0.02] border border-white/[0.05] rounded-lg hover:bg-white/[0.04] hover:border-[#fb57ff]/30 transition-all flex flex-col"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span 
                      className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide"
                      style={{ background: 'rgba(251, 87, 255, 0.1)', color: '#fb57ff' }}
                    >
                      {post.category}
                    </span>
                  </div>
                  
                  <h3 className="text-base font-bold text-white mb-2 group-hover:text-[#fb57ff] transition-colors line-clamp-2">
                    {post.title}
                  </h3>
                  
                  <p className="text-gray-400 text-sm mb-4 line-clamp-2 flex-grow">
                    {post.description}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-white/[0.05]">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(post.date)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {post.readTime}
                    </span>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* CTA Section */}
      <section className="border-t border-white/[0.05] bg-white/[0.01]">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <h2 
            className="text-2xl lg:text-3xl font-bold mb-4"
            style={{ 
              background: 'linear-gradient(45deg, white, #fb57ff)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}
          >
            Ready to Start Staking?
          </h2>
          <p className="text-gray-400 mb-6">
            Put your knowledge into action. Explore our staking pools and start earning today.
          </p>
          <Link
            href="/pools"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all"
            style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
          >
            <Sparkles className="w-4 h-4" />
            Explore Pools
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
