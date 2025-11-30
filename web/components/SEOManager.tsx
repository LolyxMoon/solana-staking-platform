"use client";

import { useState, useEffect } from "react";
import { Globe, Save, Trash2, Plus, Eye, RefreshCw } from "lucide-react";

interface SEOData {
  id: string;
  page: string;
  title: string;
  description: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  canonicalUrl?: string;
  updatedAt: string;
  createdAt: string;
}

interface SEOManagerProps {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export default function SEOManager({ onSuccess, onError }: SEOManagerProps) {
  const [seoData, setSeoData] = useState<SEOData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [form, setForm] = useState({
    page: "",
    title: "",
    description: "",
    keywords: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    twitterCard: "summary_large_image",
    twitterTitle: "",
    twitterDescription: "",
    twitterImage: "",
    canonicalUrl: "",
  });

  useEffect(() => {
    fetchSEOData();
  }, []);

  const fetchSEOData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/seo");
      if (!res.ok) throw new Error("Failed to fetch SEO data");
      const data = await res.json();
      setSeoData(data);
    } catch (error: any) {
      onError?.(error.message || "Failed to load SEO data");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPage = (seo: SEOData) => {
    setSelectedPage(seo.page);
    setIsCreating(false);
    setForm({
      page: seo.page,
      title: seo.title,
      description: seo.description,
      keywords: seo.keywords || "",
      ogTitle: seo.ogTitle || "",
      ogDescription: seo.ogDescription || "",
      ogImage: seo.ogImage || "",
      twitterCard: seo.twitterCard || "summary_large_image",
      twitterTitle: seo.twitterTitle || "",
      twitterDescription: seo.twitterDescription || "",
      twitterImage: seo.twitterImage || "",
      canonicalUrl: seo.canonicalUrl || "",
    });
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setSelectedPage(null);
    setForm({
      page: "",
      title: "",
      description: "",
      keywords: "",
      ogTitle: "",
      ogDescription: "",
      ogImage: "",
      twitterCard: "summary_large_image",
      twitterTitle: "",
      twitterDescription: "",
      twitterImage: "",
      canonicalUrl: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.page || !form.title || !form.description) {
      onError?.("Page, title, and description are required");
      return;
    }

    try {
      const method = isCreating ? "POST" : "PATCH";
      const res = await fetch("/api/seo", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save SEO data");
      }

      onSuccess?.(
        isCreating
          ? "✅ SEO data created successfully!"
          : "✅ SEO data updated successfully!"
      );
      fetchSEOData();
      setIsCreating(false);
      setSelectedPage(form.page);
    } catch (error: any) {
      onError?.(error.message || "Failed to save SEO data");
    }
  };

  const handleDelete = async (page: string) => {
    if (!confirm(`Are you sure you want to delete SEO data for "${page}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/seo?page=${page}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete SEO data");

      onSuccess?.("✅ SEO data deleted successfully!");
      fetchSEOData();
      setSelectedPage(null);
      handleCreateNew();
    } catch (error: any) {
      onError?.(error.message || "Failed to delete SEO data");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="w-8 h-8 text-blue-400" />
          <div>
            <h2 className="text-2xl font-bold">SEO Management</h2>
            <p className="text-gray-400 text-sm">
              Manage SEO metadata for your pages
            </p>
          </div>
        </div>
        <button
          onClick={handleCreateNew}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-500 hover:to-purple-500 transition-all"
        >
          <Plus className="w-5 h-5" />
          New Page
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pages List */}
        <div className="lg:col-span-1 bg-slate-900/50 backdrop-blur border border-slate-700 rounded-xl p-4 space-y-2">
          <h3 className="text-lg font-semibold mb-4">Pages ({seoData.length})</h3>
          
          {seoData.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No SEO data yet</p>
              <p className="text-sm">Create your first page</p>
            </div>
          ) : (
            <div className="space-y-2">
              {seoData.map((seo) => (
                <button
                  key={seo.id}
                  onClick={() => handleSelectPage(seo)}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    selectedPage === seo.page
                      ? "bg-blue-600/30 border-2 border-blue-500"
                      : "bg-slate-800/50 border border-slate-700 hover:bg-slate-800"
                  }`}
                >
                  <p className="font-semibold capitalize">{seo.page}</p>
                  <p className="text-sm text-gray-400 truncate">{seo.title}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Updated: {new Date(seo.updatedAt).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Form */}
        <div className="lg:col-span-2 bg-slate-900/50 backdrop-blur border border-slate-700 rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-4">
                {isCreating ? "Create New SEO Entry" : "Edit SEO Data"}
              </h3>
            </div>

            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-blue-400">Basic Information</h4>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Page Identifier * (e.g., "landing", "dashboard")
                </label>
                <input
                  type="text"
                  value={form.page}
                  onChange={(e) => setForm({ ...form, page: e.target.value })}
                  disabled={!isCreating}
                  required
                  className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Page Title * (50-60 characters recommended)
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  maxLength={70}
                  className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-blue-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {form.title.length}/70 characters
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Meta Description * (150-160 characters recommended)
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  required
                  maxLength={200}
                  rows={3}
                  className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-blue-500 focus:outline-none resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {form.description.length}/200 characters
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  value={form.keywords}
                  onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                  placeholder="solana, staking, defi, rewards"
                  className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Canonical URL
                </label>
                <input
                  type="url"
                  value={form.canonicalUrl}
                  onChange={(e) =>
                    setForm({ ...form, canonicalUrl: e.target.value })
                  }
                  placeholder="https://yoursite.com/page"
                  className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Open Graph */}
            <div className="space-y-4 border-t border-slate-700 pt-4">
              <h4 className="text-lg font-semibold text-blue-400">Open Graph (Facebook)</h4>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">OG Title</label>
                <input
                  type="text"
                  value={form.ogTitle}
                  onChange={(e) => setForm({ ...form, ogTitle: e.target.value })}
                  placeholder="Defaults to page title if empty"
                  className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  OG Description
                </label>
                <textarea
                  value={form.ogDescription}
                  onChange={(e) =>
                    setForm({ ...form, ogDescription: e.target.value })
                  }
                  placeholder="Defaults to meta description if empty"
                  rows={2}
                  className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  OG Image URL (1200x630 recommended)
                </label>
                <input
                  type="url"
                  value={form.ogImage}
                  onChange={(e) => setForm({ ...form, ogImage: e.target.value })}
                  placeholder="https://yoursite.com/og-image.jpg"
                  className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Twitter */}
            <div className="space-y-4 border-t border-slate-700 pt-4">
              <h4 className="text-lg font-semibold text-blue-400">Twitter Card</h4>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">Card Type</label>
                <select
                  value={form.twitterCard}
                  onChange={(e) =>
                    setForm({ ...form, twitterCard: e.target.value })
                  }
                  className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="summary">Summary</option>
                  <option value="summary_large_image">Summary Large Image</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Twitter Title
                </label>
                <input
                  type="text"
                  value={form.twitterTitle}
                  onChange={(e) =>
                    setForm({ ...form, twitterTitle: e.target.value })
                  }
                  placeholder="Defaults to page title if empty"
                  className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Twitter Description
                </label>
                <textarea
                  value={form.twitterDescription}
                  onChange={(e) =>
                    setForm({ ...form, twitterDescription: e.target.value })
                  }
                  placeholder="Defaults to meta description if empty"
                  rows={2}
                  className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Twitter Image URL
                </label>
                <input
                  type="url"
                  value={form.twitterImage}
                  onChange={(e) =>
                    setForm({ ...form, twitterImage: e.target.value })
                  }
                  placeholder="https://yoursite.com/twitter-image.jpg"
                  className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-slate-700">
              <button
                type="submit"
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-500 hover:to-purple-500 transition-all font-medium"
              >
                <Save className="w-5 h-5" />
                {isCreating ? "Create SEO Entry" : "Update SEO Data"}
              </button>
              
              {!isCreating && selectedPage && (
                <button
                  type="button"
                  onClick={() => handleDelete(selectedPage)}
                  className="px-6 py-3 bg-red-600/20 border border-red-600 text-red-400 rounded-lg hover:bg-red-600/30 transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}