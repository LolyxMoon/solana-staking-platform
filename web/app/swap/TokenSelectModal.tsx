"use client";

import { useState, useEffect } from "react";
import { X, Search, Sparkles, Clock, XCircle } from "lucide-react";

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

interface TokenSelectModalProps {
  featuredTokens?: Token[];
  isOpen: boolean;
  onClose: () => void;
  onSelectToken: (token: Token) => void;
  title?: string;
}

const RECENT_TOKENS_KEY = 'stakepoint_recent_tokens';
const MAX_RECENT_TOKENS = 3;

export default function TokenSelectModal({
  featuredTokens = [],
  isOpen,
  onClose,
  onSelectToken,
  title = "Select a token",
}: TokenSelectModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [allTokens, setAllTokens] = useState<Token[]>([]);
  const [recentTokens, setRecentTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dexToken, setDexToken] = useState<Token | null>(null);
  const [isFetchingDex, setIsFetchingDex] = useState(false);

  // Load recent tokens from localStorage
  useEffect(() => {
    if (isOpen) {
      try {
        const stored = localStorage.getItem(RECENT_TOKENS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setRecentTokens(parsed);
        }
      } catch (error) {
        console.error('Failed to load recent tokens:', error);
      }
    }
  }, [isOpen]);

  // Save token to recent searches
  const saveToRecentTokens = (token: Token) => {
    try {
      const stored = localStorage.getItem(RECENT_TOKENS_KEY);
      let recent: Token[] = stored ? JSON.parse(stored) : [];
      
      // Remove if already exists
      recent = recent.filter(t => t.address !== token.address);
      
      // Add to front
      recent.unshift(token);
      
      // Keep only last 5
      recent = recent.slice(0, MAX_RECENT_TOKENS);
      
      localStorage.setItem(RECENT_TOKENS_KEY, JSON.stringify(recent));
      setRecentTokens(recent);
    } catch (error) {
      console.error('Failed to save recent token:', error);
    }
  };

  // Fetch token list on mount
  useEffect(() => {
    const fetchTokens = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("https://token.jup.ag/strict");
        const data = await response.json();
        setAllTokens(data);
      } catch (error) {
        console.error("Failed to fetch tokens:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen && allTokens.length === 0) {
      fetchTokens();
    }
  }, [isOpen, allTokens.length]);

  // Fetch token from DexScreener if it looks like a Solana address
  useEffect(() => {
    const fetchTokenByAddress = async () => {
      const isSolanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(searchQuery.trim());
      
      if (!isSolanaAddress) {
        setDexToken(null);
        return;
      }

      const existingToken = allTokens.find(
        (token) => token.address.toLowerCase() === searchQuery.trim().toLowerCase()
      );

      if (existingToken) {
        setDexToken(null);
        return;
      }

      setIsFetchingDex(true);
      try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${searchQuery.trim()}`);
        const data = await response.json();
        
        const pair = data.pairs?.[0];
        if (pair) {
          setDexToken({
            address: searchQuery.trim(),
            symbol: pair.baseToken.symbol,
            name: pair.baseToken.name,
            decimals: pair.baseToken.decimals || 9,
            logoURI: pair.info?.imageUrl || undefined,
          });
        } else {
          setDexToken(null);
        }
      } catch (error) {
        console.error("Failed to fetch token:", error);
        setDexToken(null);
      } finally {
        setIsFetchingDex(false);
      }
    };

    const debounce = setTimeout(() => {
      if (searchQuery.trim()) {
        fetchTokenByAddress();
      } else {
        setDexToken(null);
      }
    }, 500);

    return () => clearTimeout(debounce);
  }, [searchQuery, allTokens]);

  // Filter tokens based on search
  const filteredTokens = allTokens.filter(
    (token) =>
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Combine filtered tokens with DexScreener token if available
  const displayTokens = dexToken 
    ? [dexToken, ...filteredTokens] 
    : filteredTokens;

  // Handle token selection
  const handleSelectToken = (token: Token) => {
    saveToRecentTokens(token);
    onSelectToken(token);
    onClose();
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery("");
    setDexToken(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl w-full max-w-[calc(100vw-24px)] sm:max-w-md max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/[0.05]">
          <h2 className="text-lg sm:text-2xl font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors text-2xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Search Bar with Clear Button */}
        <div className="p-4 sm:p-6 border-b border-white/[0.05]">
          <div className="relative">
            <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/[0.02] border border-white/[0.05] text-white rounded-lg pl-10 sm:pl-12 pr-10 sm:pr-12 py-2.5 sm:py-3 
                       focus:border-[#fb57ff] focus:outline-none 
                       placeholder-gray-500 text-sm sm:text-base min-h-[44px]"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-white/[0.05] rounded-lg transition-colors"
                aria-label="Clear search"
              >
                <XCircle className="w-5 h-5 text-gray-400 hover:text-gray-300" />
              </button>
            )}
          </div>
        </div>

        {/* Featured Tokens - Only show when not searching */}
        {featuredTokens.length > 0 && !searchQuery && (
          <div className="p-4 sm:p-6 border-b border-white/[0.05]">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <Sparkles className="w-4 h-4" style={{ color: '#fb57ff' }} />
              <span className="text-xs sm:text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Featured
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {featuredTokens.map((token) => (
                <button
                  key={token.address}
                  onClick={() => handleSelectToken(token)}
                  className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-white/[0.05] hover:bg-white/[0.08] 
                           rounded-lg transition-all hover:scale-105 min-h-[44px]"
                >
                  {token.logoURI ? (
                    <img
                      src={token.logoURI}
                      alt={token.symbol}
                      className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex-shrink-0"
                    />
                  ) : (
                    <div 
                      className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex-shrink-0" 
                      style={{ background: 'rgba(251, 87, 255, 0.2)' }}
                    />
                  )}
                  <span className="font-semibold text-white text-xs sm:text-sm truncate">
                    {token.symbol}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent Tokens - Only show when not searching */}
        {!searchQuery && recentTokens.length > 0 && (
          <div className="p-4 sm:p-6 border-b border-white/[0.05]">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-xs sm:text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Recent
              </span>
            </div>
            <div className="space-y-1">
              {recentTokens.map((token) => (
                <button
                  key={token.address}
                  onClick={() => handleSelectToken(token)}
                  className="w-full flex items-center gap-3 p-2 sm:p-3 hover:bg-white/[0.05] 
                           rounded-lg transition-all min-h-[44px]"
                >
                  {token.logoURI ? (
                    <img
                      src={token.logoURI}
                      alt={token.symbol}
                      className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex-shrink-0"
                    />
                  ) : (
                    <div 
                      className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex-shrink-0" 
                      style={{ background: 'rgba(251, 87, 255, 0.2)' }}
                    />
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-semibold text-white text-sm">
                      {token.symbol}
                    </div>
                    <div className="text-xs text-gray-400 truncate">
                      {token.name}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Token List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 sm:py-16">
              <div 
                className="w-8 h-8 sm:w-10 sm:h-10 border-4 border-t-transparent rounded-full animate-spin" 
                style={{ borderColor: '#fb57ff', borderTopColor: 'transparent' }}
              />
            </div>
          ) : displayTokens.length === 0 ? (
            <div className="text-center py-12 sm:py-16 px-4">
              {isFetchingDex ? (
                <div 
                  className="w-8 h-8 sm:w-10 sm:h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto" 
                  style={{ borderColor: '#fb57ff', borderTopColor: 'transparent' }}
                />
              ) : (
                <>
                  <p className="text-gray-400 text-sm sm:text-base">No tokens found</p>
                  <p className="text-gray-500 text-xs sm:text-sm mt-2">
                    Try searching by token name, symbol, or paste a contract address
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="p-2 sm:p-3 space-y-1">
              {displayTokens.map((token, index) => (
                <button
                  key={token.address}
                  onClick={() => handleSelectToken(token)}
                  className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-white/[0.05] 
                           rounded-lg transition-colors text-left min-h-[56px] sm:min-h-[64px]"
                >
                  {token.logoURI ? (
                    <img
                      src={token.logoURI}
                      alt={token.symbol}
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex-shrink-0"
                    />
                  ) : (
                    <div 
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex-shrink-0" 
                      style={{ background: 'rgba(251, 87, 255, 0.2)' }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-sm sm:text-base">
                      {token.symbol}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-400 truncate">
                      {token.name}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}