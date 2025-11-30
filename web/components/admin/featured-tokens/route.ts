"use client";

import { useState, useEffect } from "react";
import { Sparkles, Plus, X, Search, TrendingUp } from "lucide-react";
import Image from "next/image";

interface FeaturedToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  order: number;
  enabled: boolean;
}

export default function FeaturedTokensManager() {
  const [featuredTokens, setFeaturedTokens] = useState<FeaturedToken[]>([]);
  const [allTokens, setAllTokens] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load featured tokens from config
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Load current featured tokens
        const configRes = await fetch("/api/admin/featured-tokens");
        if (configRes.ok) {
          const data = await configRes.json();
          setFeaturedTokens(data.featuredTokens || []);
        }

        // Load all available tokens from Jupiter
        const tokensRes = await fetch("https://token.jup.ag/strict");
        const tokens = await tokensRes.json();
        setAllTokens(tokens);
      } catch (error) {
        console.error("Failed to load tokens:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Save featured tokens
  const saveFeaturedTokens = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/featured-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featuredTokens }),
      });

      if (response.ok) {
        alert("Featured tokens saved successfully! ✅");
      } else {
        throw new Error("Failed to save");
      }
    } catch (error) {
      console.error("Failed to save featured tokens:", error);
      alert("Failed to save featured tokens ❌");
    } finally {
      setSaving(false);
    }
  };

  // Add token to featured list
  const addToken = (token: any) => {
    const newFeaturedToken: FeaturedToken = {
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      logoURI: token.logoURI,
      order: featuredTokens.length,
      enabled: true,
    };
    setFeaturedTokens([...featuredTokens, newFeaturedToken]);
    setShowAddModal(false);
    setSearchQuery("");
  };

  // Remove token from featured list
  const removeToken = (address: string) => {
    setFeaturedTokens(
      featuredTokens
        .filter((t) => t.address !== address)
        .map((t, idx) => ({ ...t, order: idx }))
    );
  };

  // Toggle token enabled status
  const toggleToken = (address: string) => {
    setFeaturedTokens(
      featuredTokens.map((t) =>
        t.address === address ? { ...t, enabled: !t.enabled } : t
      )
    );
  };

  // Move token up in order
  const moveUp = (index: number) => {
    if (index === 0) return;
    const newTokens = [...featuredTokens];
    [newTokens[index - 1], newTokens[index]] = [
      newTokens[index],
      newTokens[index - 1],
    ];
    setFeaturedTokens(newTokens.map((t, idx) => ({ ...t, order: idx })));
  };

  // Move token down in order
  const moveDown = (index: number) => {
    if (index === featuredTokens.length - 1) return;
    const newTokens = [...featuredTokens];
    [newTokens[index], newTokens[index + 1]] = [
      newTokens[index + 1],
      newTokens[index],
    ];
    setFeaturedTokens(newTokens.map((t, idx) => ({ ...t, order: idx })));
  };

  // Filter tokens for search
  const filteredTokens = allTokens.filter(
    (token) =>
      (token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.address.toLowerCase().includes(searchQuery.toLowerCase())) &&
      !featuredTokens.some((ft) => ft.address === token.address)
  );

  if (loading) {
    return <div className="text-center py-8">Loading tokens...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-yellow-500" />
          <h2 className="text-2xl font-bold">Featured Tokens</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Token
          </button>
          <button
            onClick={saveFeaturedTokens}
            disabled={saving}
            className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
              saving
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-500 hover:bg-green-600 text-white"
            }`}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-500/10 border border-blue-500 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <TrendingUp className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-200 font-semibold">
              Featured Tokens on Swap Page
            </p>
            <p className="text-blue-300 text-sm">
              These tokens will appear in the "Featured" section on the swap
              page. Users can quickly access them without searching.
            </p>
          </div>
        </div>
      </div>

      {/* Featured Tokens List */}
      {featuredTokens.length === 0 ? (
        <div className="text-center py-12 bg-gray-800 rounded-lg border-2 border-dashed border-gray-600">
          <Sparkles className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-400 mb-4">No featured tokens yet</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="text-purple-400 hover:text-purple-300"
          >
            Add your first featured token →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {featuredTokens.map((token, index) => (
            <div
              key={token.address}
              className={`bg-gray-800 rounded-lg p-4 flex items-center gap-4 ${
                !token.enabled ? "opacity-50" : ""
              }`}
            >
              {/* Token Info */}
              <div className="flex items-center gap-3 flex-1">
                {token.logoURI && (
                  <Image
                    src={token.logoURI}
                    alt={token.symbol}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                )}
                <div>
                  <div className="font-semibold text-white flex items-center gap-2">
                    {token.symbol}
                    {!token.enabled && (
                      <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded">
                        Disabled
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-400">{token.name}</div>
                  <div className="text-xs text-gray-500 font-mono">
                    {token.address.slice(0, 8)}...{token.address.slice(-8)}
                  </div>
                </div>
              </div>

              {/* Order Controls */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400 w-8 text-center">
                  #{index + 1}
                </span>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className={`p-1 rounded ${
                      index === 0
                        ? "text-gray-600 cursor-not-allowed"
                        : "text-gray-400 hover:text-white hover:bg-gray-700"
                    }`}
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveDown(index)}
                    disabled={index === featuredTokens.length - 1}
                    className={`p-1 rounded ${
                      index === featuredTokens.length - 1
                        ? "text-gray-600 cursor-not-allowed"
                        : "text-gray-400 hover:text-white hover:bg-gray-700"
                    }`}
                  >
                    ▼
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleToken(token.address)}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    token.enabled
                      ? "bg-green-500/20 text-green-300 hover:bg-green-500/30"
                      : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                  }`}
                >
                  {token.enabled ? "Enabled" : "Disabled"}
                </button>
                <button
                  onClick={() => removeToken(token.address)}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Token Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">
                Add Featured Token
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSearchQuery("");
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, symbol, or address..."
                className="w-full bg-gray-800 text-white rounded-lg pl-10 pr-4 py-3 outline-none border border-gray-700 focus:border-purple-500"
                autoFocus
              />
            </div>

            {/* Token List */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {filteredTokens.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  {searchQuery
                    ? "No tokens found"
                    : "Start typing to search for tokens"}
                </div>
              ) : (
                filteredTokens.map((token) => (
                  <button
                    key={token.address}
                    onClick={() => addToken(token)}
                    className="w-full flex items-center gap-3 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    {token.logoURI && (
                      <Image
                        src={token.logoURI}
                        alt={token.symbol}
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    )}
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-white">
                        {token.symbol}
                      </div>
                      <div className="text-sm text-gray-400">{token.name}</div>
                      <div className="text-xs text-gray-500 font-mono">
                        {token.address}
                      </div>
                    </div>
                    <Plus className="w-5 h-5 text-purple-400" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}