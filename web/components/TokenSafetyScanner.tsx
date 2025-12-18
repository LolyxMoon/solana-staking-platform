"use client";

import { useState } from "react";
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
  HelpCircle,
  FileCode,
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
  topHolders: { wallet: string; percentage: number; isContract?: boolean }[];
  top10Concentration: number;
  contractHeldPercentage?: number;
  holderCount: number;
  lpInfo: { burned: number; locked: number; unlocked: number; } | null;
  createdAt: Date | null;
  ageInDays: number | null;
  overallScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export default function TokenSafetyScanner() {
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

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      setResult(data.result);
    } catch (err: any) {
      setError(err.message || "Failed to analyze token");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusIcon = (status: "safe" | "warning" | "danger") => {
    switch (status) {
      case "safe":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "danger":
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };

  const getRiskBadge = (risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL") => {
    const colors = {
      LOW: "bg-green-500/20 text-green-400 border-green-500/30",
      MEDIUM: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      HIGH: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      CRITICAL: "bg-red-500/20 text-red-400 border-red-500/30",
    };
    return colors[risk];
  };

  const getLPStatus = (lpInfo: { burned: number; locked: number; unlocked: number; }) => {
    if (lpInfo.burned >= 90) return "safe";
    if (lpInfo.locked >= 90) return "safe";
    if (lpInfo.unlocked > 50) return "danger";
    return "warning";
  };

  const formatSupply = (supply: number) => {
    if (supply >= 1e12) return `${(supply / 1e12).toFixed(2)}T`;
    if (supply >= 1e9) return `${(supply / 1e9).toFixed(2)}B`;
    if (supply >= 1e6) return `${(supply / 1e6).toFixed(2)}M`;
    if (supply >= 1e3) return `${(supply / 1e3).toFixed(2)}K`;
    return supply.toFixed(2);
  };

  // Calculate wallet-only concentration (excluding contracts)
  const getWalletConcentration = () => {
    if (!result) return 0;
    return result.top10Concentration - (result.contractHeldPercentage || 0);
  };

  // Determine status based on wallet concentration, not total
  const getHolderStatus = () => {
    const walletConcentration = getWalletConcentration();
    if (walletConcentration > 50) return "danger";
    if (walletConcentration > 30) return "warning";
    return "safe";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}>
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Token Safety Scanner</h1>
          <p className="text-sm text-gray-400">Analyze any Solana token for potential risks</p>
        </div>
      </div>

      {/* Search Input */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={tokenMint}
            onChange={(e) => setTokenMint(e.target.value)}
            placeholder="Enter token mint address..."
            className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.1] rounded-lg focus:outline-none focus:border-[#fb57ff]/50 transition-colors"
            onKeyDown={(e) => e.key === "Enter" && analyzeToken()}
          />
        </div>
        <button
          onClick={analyzeToken}
          disabled={loading}
          className="px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 flex items-center gap-2"
          style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Search className="w-5 h-5" />
              Scan
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Token Header */}
          <div className="p-4 bg-white/[0.02] rounded-lg border border-white/[0.05]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {result.logoURI ? (
                  <img src={result.logoURI} alt={result.symbol} className="w-12 h-12 rounded-full" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-white/[0.1] flex items-center justify-center">
                    <Coins className="w-6 h-6 text-gray-500" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold">{result.symbol}</h2>
                    {result.isToken2022 && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                        Token-2022
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">{result.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Supply</p>
                <p className="text-lg font-semibold">{formatSupply(result.totalSupply)}</p>
              </div>
            </div>
          </div>

          {/* Safety Score */}
          <div className="p-4 bg-white/[0.02] rounded-lg border border-white/[0.05]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Safety Score</p>
                <p className={`text-4xl font-bold ${getScoreColor(result.overallScore)}`}>
                  {result.overallScore} <span className="text-lg text-gray-500">/100</span>
                </p>
              </div>
              <div className={`px-4 py-2 rounded-lg border ${getRiskBadge(result.riskLevel)}`}>
                {result.riskLevel} RISK
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Mint Authority */}
            <div className="p-4 bg-white/[0.02] rounded-lg border border-white/[0.05]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Mint Authority</span>
                </div>
                {getStatusIcon(result.mintAuthority.status)}
              </div>
              <p className={`mt-1 text-sm font-semibold ${
                result.mintAuthority.status === "safe" ? "text-green-400" : "text-red-400"
              }`}>
                {result.mintAuthority.value ? "Active ⚠️" : "Revoked ✓"}
              </p>
            </div>

            {/* Freeze Authority */}
            <div className="p-4 bg-white/[0.02] rounded-lg border border-white/[0.05]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Freeze Authority</span>
                </div>
                {getStatusIcon(result.freezeAuthority.status)}
              </div>
              <p className={`mt-1 text-sm font-semibold ${
                result.freezeAuthority.status === "safe" ? "text-green-400" : "text-red-400"
              }`}>
                {result.freezeAuthority.value ? "Active ⚠️" : "Revoked ✓"}
              </p>
            </div>

            {/* Transfer Tax */}
            <div className="p-4 bg-white/[0.02] rounded-lg border border-white/[0.05]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Transfer Tax</span>
                </div>
                {getStatusIcon(result.hasTransferTax.status)}
              </div>
              <p className={`mt-1 text-sm font-semibold ${
                result.hasTransferTax.status === "safe" ? "text-green-400" : "text-yellow-400"
              }`}>
                {result.hasTransferTax.taxBps 
                  ? `${(result.hasTransferTax.taxBps / 100).toFixed(2)}%` 
                  : "None ✓"}
              </p>
            </div>

            {/* Top Holders */}
            <div className="p-4 bg-white/[0.02] rounded-lg border border-white/[0.05]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Top 10 Holders</span>
                </div>
                {getStatusIcon(getHolderStatus())}
              </div>
              <p className={`mt-1 text-sm font-semibold ${
                getHolderStatus() === "danger" ? "text-red-400" : 
                getHolderStatus() === "warning" ? "text-yellow-400" : "text-green-400"
              }`}>
                {result.top10Concentration.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500">{result.holderCount} holders</p>
              {result.contractHeldPercentage && result.contractHeldPercentage > 0 && (
                <p className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                  <FileCode className="w-3 h-3" />
                  {result.contractHeldPercentage.toFixed(1)}% in contracts (staking/LP)
                </p>
              )}
            </div>

            {/* Token Age */}
            <div className="p-4 bg-white/[0.02] rounded-lg border border-white/[0.05]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Token Age</span>
                </div>
                {getStatusIcon(result.ageInDays !== null && result.ageInDays < 7 ? "warning" : "safe")}
              </div>
              <p className={`mt-1 text-sm font-semibold ${
                result.ageInDays !== null && result.ageInDays < 7 ? "text-yellow-400" : "text-green-400"
              }`}>
                {result.ageInDays !== null ? `${result.ageInDays} days` : "Unknown"}
              </p>
            </div>

            {/* Metadata */}
            <div className="p-4 bg-white/[0.02] rounded-lg border border-white/[0.05]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Metadata</span>
                </div>
                {getStatusIcon(result.metadataMutable.status)}
              </div>
              <p className={`mt-1 text-sm font-semibold ${
                result.metadataMutable.mutable ? "text-yellow-400" : "text-green-400"
              }`}>
                {result.metadataMutable.mutable ? "Mutable" : "Immutable ✓"}
              </p>
            </div>
          </div>

          {/* LP Status */}
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
                <div className="w-full h-3 bg-white/[0.1] rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-orange-500" 
                    style={{ width: `${result.lpInfo.burned}%` }}
                  />
                  <div 
                    className="h-full bg-green-500" 
                    style={{ width: `${result.lpInfo.locked}%` }}
                  />
                  <div 
                    className="h-full bg-red-500" 
                    style={{ width: `${result.lpInfo.unlocked}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span><Flame className="w-3 h-3 inline text-orange-500" /> Burned: <span className="text-white">{result.lpInfo.burned.toFixed(1)}%</span></span>
                  <span><Lock className="w-3 h-3 inline text-green-500" /> Locked: <span className="text-white">{result.lpInfo.locked.toFixed(1)}%</span></span>
                  <span><AlertTriangle className="w-3 h-3 inline text-red-500" /> Unlocked: <span className="text-white">{result.lpInfo.unlocked.toFixed(1)}%</span></span>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">LP information not available</p>
            )}
          </div>

          {/* Top Holders List */}
          {result.topHolders.length > 0 && (
            <div className="p-4 bg-white/[0.02] rounded-lg border border-white/[0.05]">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Top Holders</h3>
              <div className="space-y-2">
                {result.topHolders.slice(0, 5).map((holder, i) => (
                  <div key={holder.wallet} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${holder.isContract ? "text-blue-400" : i < 2 ? "text-red-400" : "text-gray-500"}`}>
                        #{i + 1}
                      </span>
                      <a 
                        href={`https://solscan.io/account/${holder.wallet}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                      >
                        {holder.wallet.slice(0, 4)}...{holder.wallet.slice(-4)}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      {holder.isContract && (
                        <span className="px-1.5 py-0.5 text-xs rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-0.5">
                          <FileCode className="w-3 h-3" />
                          Contract
                        </span>
                      )}
                    </div>
                    <span className={holder.isContract ? "text-blue-400" : i < 2 ? "text-red-400 font-semibold" : "text-gray-300"}>
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
              <ExternalLink className="w-5 h-5" />
              DexScreener
            </a>
            <a
              href={`https://rugcheck.xyz/tokens/${result.mint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-4 py-3 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] rounded-lg font-semibold text-center transition-all flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-5 h-5" />
              RugCheck
            </a>
            <button
              onClick={() => copyToClipboard(result.mint)}
              className="px-4 py-3 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] rounded-lg transition-all"
            >
              {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>

          {/* Scan Another */}
          <button
            onClick={() => {
              setResult(null);
              setTokenMint("");
            }}
            className="w-full text-center text-sm text-gray-500 hover:text-white transition-colors py-2"
          >
            Scan Another Token
          </button>
        </div>
      )}
    </div>
  );
}