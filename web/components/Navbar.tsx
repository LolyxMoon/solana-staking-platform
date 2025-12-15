"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import WalletConnect from "@/components/WalletConnect";
import { Menu, Send, User, Copy, Check } from "lucide-react";

interface NavbarProps {
  onMenuClick: () => void;
}

interface Pool {
  id: string;
  name: string;
  symbol: string;
  logo?: string;
  liveRate?: number;
  liveRateType?: string;
  featured: boolean;
  hidden?: boolean;
}

const SPT_MINT = "6uUU2z5GBasaxnkcqiQVHa2SXL68mAXDsq1zYN5Qxrm7";

let poolsCache: { data: Pool[]; timestamp: number } | null = null;
const POOLS_CACHE_TTL = 300000; // 5 minutes

export default function Navbar({ onMenuClick }: NavbarProps) {

export default function Navbar({ onMenuClick }: NavbarProps) {
  const router = useRouter();
  const [price, setPrice] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [featuredPools, setFeaturedPools] = useState<Pool[]>([]);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${SPT_MINT}`);
        if (res.ok) {
          const data = await res.json();
          const bestPair = data.pairs?.sort((a: any, b: any) => 
            (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
          )[0];
          if (bestPair?.priceUsd) {
            setPrice(parseFloat(bestPair.priceUsd));
          }
        }
      } catch (error) {
        console.error("Failed to fetch SPT price:", error);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchFeaturedPools = async () => {
      // Check cache first
      if (poolsCache && Date.now() - poolsCache.timestamp < POOLS_CACHE_TTL) {
        const featured = poolsCache.data.filter((p: Pool) => p.featured && !p.hidden).slice(0, 5);
        setFeaturedPools(featured);
        return;
      }

      try {
        const res = await fetch("/api/pools");
        const data = await res.json();
        
        // Update cache
        poolsCache = { data, timestamp: Date.now() };
        
        const featured = data.filter((p: Pool) => p.featured && !p.hidden).slice(0, 5);
        setFeaturedPools(featured);
      } catch (error) {
        console.error("Failed to fetch featured pools:", error);
      }
    };

    fetchFeaturedPools();
    const interval = setInterval(fetchFeaturedPools, 300000); // 5 min instead of 2
    return () => clearInterval(interval);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(SPT_MINT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Duplicate pools for seamless infinite scroll
  const scrollPools = featuredPools.length > 0 ? [...featuredPools, ...featuredPools, ...featuredPools] : [];

  return (
    <nav className="fixed top-0 left-0 right-0 w-full h-16 bg-[#060609] border-b border-white/[0.05] z-50 px-4 lg:px-6 flex items-center justify-between">
      {/* Mobile Menu Button - Only visible on mobile */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-md hover:bg-white/5 transition-colors active:scale-95 z-50"
        aria-label="Toggle menu"
        type="button"
      >
        <Menu className="w-6 h-6 text-gray-400" />
      </button>

      {/* Logo + Token Info */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/[0.03] flex items-center justify-center p-1">
            <svg viewBox="0 0 24 24" className="w-full h-full" fill="none">
              <defs>
                <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#000000"/>
                  <stop offset="100%" stopColor="#fb57ff"/>
                </linearGradient>
              </defs>
              <path d="M3 4 L21 4 Q22 4 22 5 L22 7 Q22 8 21 8 L3 8 Q2 8 2 7 L2 5 Q2 4 3 4 Z" fill="url(#logoGradient)"/>
              <path d="M3 10 L21 10 Q22 10 22 11 L22 13 Q22 14 21 14 L3 14 Q2 14 2 13 L2 11 Q2 10 3 10 Z" fill="url(#logoGradient)"/>
              <path d="M3 16 L21 16 Q22 16 22 17 L22 19 Q22 21 21 21 L3 21 Q2 21 2 19 L2 17 Q2 16 3 16 Z" fill="url(#logoGradient)"/>
              <circle cx="18" cy="18.5" r="1.2" fill="#000000" opacity="0.3"/>
            </svg>
          </div>
          <h1 className="text-base font-bold text-white hidden sm:block">StakePoint</h1>
        </div>

        {/* SPT Token Info - Desktop only */}
        <div className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/[0.05] hover:border-[#fb57ff]/30 transition-all">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#fb57ff] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#fb57ff]"></span>
          </span>
          
          <span className="text-xs font-semibold text-white">$SPT</span>
          
          {price !== null && (
            <span className="text-xs text-gray-400">
              ${price < 0.0001 ? price.toFixed(8) : price < 0.01 ? price.toFixed(6) : price < 1 ? price.toFixed(4) : price.toFixed(2)}
            </span>
          )}

          <div className="h-3 w-px bg-white/[0.1]" />
          
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-white/[0.05] transition-colors"
            title="Copy Contract Address"
          >
            <span className="text-[10px] text-gray-400 font-mono">6uUU...xrm7</span>
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-gray-400 hover:text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Featured Pools Scrolling Banner - Desktop only */}
      {featuredPools.length > 0 && (
        <div className="hidden lg:flex flex-1 mx-4 h-10 overflow-hidden relative items-center">
          <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#060609] to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#060609] to-transparent z-10 pointer-events-none" />
          
          <div className="flex items-center gap-8 animate-marquee whitespace-nowrap">
            {scrollPools.map((pool, idx) => (
              <button
                key={`${pool.id}-${idx}`}
                onClick={() => router.push(`/pools?highlight=${pool.id}`)}
                className="flex items-center justify-center gap-3 h-8 px-5 rounded-full bg-white/[0.03] border border-white/[0.08] hover:border-[#fb57ff]/30 hover:bg-white/[0.06] transition-all"
              >
                {pool.logo ? (
                  <img src={pool.logo} alt={pool.symbol} className="w-5 h-5 rounded-full flex-shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg, rgba(251, 87, 255, 0.2), rgba(251, 87, 255, 0.1))', color: '#fb57ff' }}>
                    {pool.symbol.slice(0, 2)}
                  </div>
                )}
                <span className="text-sm font-medium text-white leading-none">{pool.symbol}</span>
                {pool.liveRate && pool.liveRate > 0 && (
                  <span className="text-sm font-semibold text-green-400 leading-none">
                    {pool.liveRate.toFixed(1)}%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Right Side - Social, Dashboard & Wallet */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Social Icons - Desktop only */}
        <a
          href="https://twitter.com/stakepointapp"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden lg:flex p-2 rounded-lg hover:bg-white/5 transition-colors"
          aria-label="Twitter"
        >
          <svg className="w-4 h-4 text-gray-400 hover:text-white transition-colors" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </a>
        <a
          href="https://t.me/stakepointportal"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden lg:flex p-2 rounded-lg hover:bg-white/5 transition-colors"
          aria-label="Telegram"
        >
          <Send className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
        </a>

        {/* Dashboard Link - Desktop only */}
        <Link
          href="/dashboard"
          className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
        >
          <User className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400 hover:text-white transition-colors">Dashboard</span>
        </Link>

        <WalletConnect />
      </div>
    </nav>
  );
}