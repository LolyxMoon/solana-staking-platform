"use client";

import { useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { 
  ShieldCheck, 
  Search, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Users,
  Coins,
  Lock,
  Flame,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Droplets,
  HelpCircle
} from "lucide-react";

interface TokenSafetyResult {
  mint: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: number;
  logoURI: string | null;
  mintAuthority: { status: "safe" | "warning" | "danger"; value: string | null; };
  freezeAuthority: { status: "safe" | "warning" | "danger"; value: string | null; };
  isToken2022: boolean;
  hasTransferTax: { status: "safe" | "warning"; taxBps: number | null; };
  metadataMutable: { status: "safe" | "warning"; mutable: boolean; };
  topHolders: { wallet: string; percentage: number; }[];
  top10Concentration: number;
  holderCount: number;
  lpInfo: { burned: number; locked: number; unlocked: number; } | null;
  createdAt: Date | null;
  ageInDays: number | null;
  overallScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export default function TokenSafetyScanner() {
  const { connection } = useConnection();
  const [tokenMint, setTokenMint] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TokenSafetyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const analyzeToken = async () => {
    if (!tokenMint.trim()) {
      setError("Please enter a token mint address");
      return;
    }

    try {
      new PublicKey(tokenMint);
    } catch {
      setError("Invalid token mint address");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/tools/token-safety", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mint: tokenMint }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Analysis failed");
      }

      const data = await res.json();
      console.log("Token safety result:", data.result);
      console.log("LP Info:", data.result?.lpInfo);
      setResult(data.result);
    } catch (err: any) {
      setError(err.message || "Failed to analyze token");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "safe": return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "warning": return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "danger": return <XCircle className="w-5 h-5 text-red-500" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "safe": return "text-green-400";
      case "warning": return "text-yellow-400";
      case "danger": return "text-red-400";
      default: return "text-gray-400";
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "LOW": return "#22c55e";
      case "MEDIUM": return "#eab308";
      case "HIGH": return "#f97316";
      case "CRITICAL": return "#ef4444";
      default: return "#6b7280";
    }
  };

  const copyMint = () => {
    navigator.clipboard.writeText(tokenMint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatNumber = (num: number): string => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + "B";
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(2) + "K";
    return num.toLocaleString();
  };

  // Get LP status for display
  const getLPStatus = (lpInfo: { burned: number; locked: number; unlocked: number; } | null) => {
    if (!lpInfo) return "unknown";
    if (lpInfo.burned > 50 || lpInfo.locked > 50) return "safe";
    if (lpInfo.burned + lpInfo.locked > 30) return "warning";
    return "danger";
  };

  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(45deg, #22c55e, #16a34a)' }}>
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Token Safety Scanner</h2>
          <p className="text-sm text-gray-400">Free security check for any SPL token</p>
        </div>
      </div>

      {/* Input */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Token Mint Address
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={tokenMint}
              onChange={(e) => setTokenMint(e.target.value)}
              placeholder="Enter SPL token mint address..."
              className="flex-1 px-4 py-3 bg-black border border-white/[0.1] rounded-lg text-white font-mono text-sm focus:outline-none focus:border-green-500/50"
            />
            <button
              onClick={analyzeToken}
              disabled={loading || !tokenMint}
              className="px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 flex items-center gap-2"
              style={{ background: 'linear-gradient(45deg, #22c55e, #16a34a)' }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Scan Token
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="mt-6 space-y-6">
          {/* Token Info */}
          <div className="flex items-center gap-4 p-4 bg-white/[0.02] rounded-lg border border-white/[0.05]">
            {result.logoURI ? (
              <img src={result.logoURI} alt={result.symbol} className="w-12 h-12 rounded-full" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                <span className="text-sm font-bold text-gray-400">{result.symbol.slice(0, 2)}</span>
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-white text-lg">{result.symbol}</p>
                {result.isToken2022 && (
                  <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">Token-2022</span>
                )}
              </div>
              <p className="text-sm text-gray-500">{result.name}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Supply</p>
              <p className="font-semibold text-white">{formatNumber(result.totalSupply)}</p>
            </div>
          </div>

          {/* Score */}
          <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-lg border border-white/[0.05]">
            <div>
              <p className="text-sm text-gray-400">Safety Score</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-4xl font-bold">{result.overallScore}</span>
                <span className="text-2xl text-gray-500">/100</span>
              </div>
            </div>
            <div 
              className="px-4 py-2 rounded-lg font-semibold"
              style={{ 
                background: `${getRiskColor(result.riskLevel)}20`,
                color: getRiskColor(result.riskLevel),
                border: `1px solid ${getRiskColor(result.riskLevel)}50`
              }}
            >
              {result.riskLevel} RISK
            </div>
          </div>

          {/* Safety Checks Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Mint Authority */}
            <div className="p-4 bg-white/[0.02] rounded-lg border border-white/[0.05]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Mint Authority</span>
                </div>
                {getStatusIcon(result.mintAuthority.status)}
              </div>
              <p className={`text-sm font-semibold ${getStatusColor(result.mintAuthority.status)}`}>
                {result.mintAuthority.value ? "Active" : "Revoked ✓"}
              </p>
            </div>

            {/* Freeze Authority */}
            <div className="p-4 bg-white/[0.02] rounded-lg border border-white/[0.05]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Freeze Authority</span>
                </div>
                {getStatusIcon(result.freezeAuthority.status)}
              </div>
              <p className={`text-sm font-semibold ${getStatusColor(result.freezeAuthority.status)}`}>
                {result.freezeAuthority.value ? "Active" : "Revoked ✓"}
              </p>
            </div>

            {/* Transfer Tax */}
            <div className="p-4 bg-white/[0.02] rounded-lg border border-white/[0.05]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Transfer Tax</span>
                </div>
                {getStatusIcon(result.hasTransferTax.status)}
              </div>
              <p className={`text-sm font-semibold ${getStatusColor(result.hasTransferTax.status)}`}>
                {result.hasTransferTax.taxBps ? `${(result.hasTransferTax.taxBps / 100).toFixed(2)}%` : "None ✓"}
              </p>
            </div>

            {/* Top 10 Concentration */}
            <div className="p-4 bg-white/[0.02] rounded-lg border border-white/[0.05]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Top 10 Holders</span>
                </div>
                {getStatusIcon(result.top10Concentration > 50 ? "danger" : result.top10Concentration > 30 ? "warning" : "safe")}
              </div>
              <p className={`text-sm font-semibold ${
                result.top10Concentration > 50 ? "text-red-400" : 
                result.top10Concentration > 30 ? "text-yellow-400" : "text-green-400"
              }`}>
                {result.top10Concentration.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {result.holderCount.toLocaleString()} holders
              </p>
            </div>

            {/* Token Age */}
            <div className="p-4 bg-white/[0.02] rounded-lg border border-white/[0.05]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Token Age</span>
                </div>
                {getStatusIcon(result.ageInDays && result.ageInDays < 7 ? "warning" : "safe")}
              </div>
              <p className={`text-sm font-semibold ${
                result.ageInDays && result.ageInDays < 7 ? "text-yellow-400" : "text-green-400"
              }`}>
                {result.ageInDays !== null ? `${result.ageInDays} days` : "Unknown"}
              </p>
            </div>

            {/* Metadata */}
            <div className="p-4 bg-white/[0.02] rounded-lg border border-white/[0.05]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Metadata</span>
                </div>
                {getStatusIcon(result.metadataMutable.status)}
              </div>
              <p className={`text-sm font-semibold ${getStatusColor(result.metadataMutable.status)}`}>
                {result.metadataMutable.mutable ? "Mutable" : "Immutable ✓"}
              </p>
            </div>
          </div>

          {/* LP Status - ALWAYS VISIBLE */}
          <div className="p-4 bg-white/[0.02] rounded-lg border border-white/[0.05]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-gray-300">Liquidity Pool Status</h3>
              </div>
              {result.lpInfo ? (
                getStatusIcon(getLPStatus(result.lpInfo))
              ) : (
                <HelpCircle className="w-5 h-5 text-gray-500" />
              )}
            </div>
            
            {result.lpInfo ? (
              <>
                {/* LP Bar */}
                <div className="h-4 rounded-full overflow-hidden flex bg-white/[0.05] mb-3">
                  {result.lpInfo.burned > 0 && (
                    <div 
                      className="h-full bg-gradient-to-r from-orange-500 to-red-500"
                      style={{ width: `${result.lpInfo.burned}%` }}
                      title={`Burned: ${result.lpInfo.burned.toFixed(1)}%`}
                    />
                  )}
                  {result.lpInfo.locked > 0 && (
                    <div 
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                      style={{ width: `${result.lpInfo.locked}%` }}
                      title={`Locked: ${result.lpInfo.locked.toFixed(1)}%`}
                    />
                  )}
                  {result.lpInfo.unlocked > 0 && (
                    <div 
                      className="h-full bg-gradient-to-r from-gray-500 to-gray-600"
                      style={{ width: `${result.lpInfo.unlocked}%` }}
                      title={`Unlocked: ${result.lpInfo.unlocked.toFixed(1)}%`}
                    />
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Flame className="w-3 h-3 text-orange-400" />
                      <span className="text-xs text-gray-400">Burned</span>
                    </div>
                    <p className={`text-sm font-bold ${result.lpInfo.burned > 50 ? "text-green-400" : result.lpInfo.burned > 0 ? "text-orange-400" : "text-gray-500"}`}>
                      {result.lpInfo.burned.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Lock className="w-3 h-3 text-green-400" />
                      <span className="text-xs text-gray-400">Locked</span>
                    </div>
                    <p className={`text-sm font-bold ${result.lpInfo.locked > 50 ? "text-green-400" : result.lpInfo.locked > 0 ? "text-yellow-400" : "text-gray-500"}`}>
                      {result.lpInfo.locked.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <AlertTriangle className="w-3 h-3 text-red-400" />
                      <span className="text-xs text-gray-400">Unlocked</span>
                    </div>
                    <p className={`text-sm font-bold ${result.lpInfo.unlocked > 50 ? "text-red-400" : result.lpInfo.unlocked > 20 ? "text-yellow-400" : "text-green-400"}`}>
                      {result.lpInfo.unlocked.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {result.lpInfo.unlocked > 50 && (
                  <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-xs text-red-400 text-center">
                      ⚠️ High rug pull risk - majority of LP is unlocked
                    </p>
                  </div>
                )}
                {result.lpInfo.burned > 90 && (
                  <div className="mt-3 p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-xs text-green-400 text-center">
                      ✓ LP burned - cannot be rugged via liquidity removal
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-3">
                <p className="text-sm text-gray-500">LP data not available</p>
                <p className="text-xs text-gray-600 mt-1">
                  Check <a href={`https://dexscreener.com/solana/${result.mint}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">DexScreener</a> or <a href={`https://rugcheck.xyz/tokens/${result.mint}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">RugCheck</a> for LP status
                </p>
              </div>
            )}
          </div>

          {/* Top Holders */}
          {result.topHolders.length > 0 && (
            <div className="p-4 bg-white/[0.02] rounded-lg border border-white/[0.05]">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Top Holders</h3>
              <div className="space-y-2">
                {result.topHolders.slice(0, 5).map((holder, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono ${i < 3 ? "text-yellow-400" : "text-gray-500"}`}>
                        #{i + 1}
                      </span>
                      <a 
                        href={`https://solscan.io/account/${holder.wallet}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-mono text-gray-400 hover:text-white flex items-center gap-1"
                      >
                        {holder.wallet.slice(0, 4)}...{holder.wallet.slice(-4)}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <span className={`text-sm font-semibold ${
                      holder.percentage > 20 ? "text-red-400" : 
                      holder.percentage > 10 ? "text-yellow-400" : "text-gray-300"
                    }`}>
                      {holder.percentage.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <a
              href={`https://dexscreener.com/solana/${result.mint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-4 py-3 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] rounded-lg font-semibold text-center transition-all flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              DexScreener
            </a>
            <a
              href={`https://rugcheck.xyz/tokens/${result.mint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-4 py-3 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] rounded-lg font-semibold text-center transition-all flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              RugCheck
            </a>
            <button
              onClick={copyMint}
              className="px-4 py-3 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] rounded-lg font-semibold transition-all flex items-center gap-2"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* What We Check */}
      {!result && !loading && (
        <div className="mt-6 pt-6 border-t border-white/[0.05]">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">What We Check</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              "Mint Authority Status",
              "Freeze Authority Status",
              "Transfer Tax Detection",
              "Metadata Mutability",
              "Top Holder Concentration",
              "Token Age & History",
              "LP Burned/Locked Status",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-gray-400">
                <CheckCircle className="w-4 h-4 text-green-500" />
                {item}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}