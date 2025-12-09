"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import WalletConnect from "@/components/WalletConnect";
import { Menu, Send, User, Copy, Check } from "lucide-react";

interface NavbarProps {
  onMenuClick: () => void;
}

const SPT_MINT = "6uUU2z5GBasaxnkcqiQVHa2SXL68mAXDsq1zYN5Qxrm7";

export default function Navbar({ onMenuClick }: NavbarProps) {
  const [price, setPrice] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

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

  const handleCopy = () => {
    navigator.clipboard.writeText(SPT_MINT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
      <div className="flex items-center gap-3">
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
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.02] border border-white/[0.05] hover:border-[#fb57ff]/30 transition-all">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#fb57ff] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#fb57ff]"></span>
          </span>
          
          <span className="text-[11px] font-semibold text-white">$SPT</span>
          
          {price !== null && (
            <span className="text-[11px] text-gray-400">
              ${price < 0.0001 ? price.toFixed(8) : price < 0.01 ? price.toFixed(6) : price < 1 ? price.toFixed(4) : price.toFixed(2)}
            </span>
          )}
          
          <button
            onClick={handleCopy}
            className="p-0.5 rounded hover:bg-white/[0.05] transition-colors"
            title="Copy Contract Address"
          >
            {copied ? (
              <Check className="w-3 h-3 text-green-400" />
            ) : (
              <Copy className="w-3 h-3 text-gray-500 hover:text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Right Side - Social, Dashboard & Wallet */}
      <div className="flex items-center gap-2">
        {/* Social Icons - Desktop only */}
        
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