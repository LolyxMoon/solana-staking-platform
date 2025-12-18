"use client";

import { useState, useEffect, useMemo } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, ComputeBudgetProgram } from "@solana/web3.js";
import { confirmTransactionPolling } from "@/lib/confirmTransaction";
import { 
  TOKEN_PROGRAM_ID, 
  TOKEN_2022_PROGRAM_ID,
  createBurnInstruction,
  createCloseAccountInstruction,
} from "@solana/spl-token";
import { 
  Flame, 
  RefreshCw, 
  CheckCircle2, 
  Loader2,
  Wallet,
  CheckSquare,
  Square,
  Sparkles
} from "lucide-react";

interface TokenAccount {
  pubkey: PublicKey;
  mint: string;
  balance: number;
  decimals: number;
  symbol: string;
  name: string;
  logoURI: string | null;
  priceUsd: number | null;
  valueUsd: number;
  rentLamports: number;
  programId: PublicKey;
  selected: boolean;
}

// Known token logos for major tokens
const KNOWN_LOGOS: Record<string, string> = {
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png", // USDC
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg", // USDT
  "So11111111111111111111111111111111111111112": "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png", // SOL
};

const RENT_PER_ACCOUNT = 0.00203;
const ACCOUNTS_PER_TX = 12;

export default function WalletCleanupPage() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  
  const [tokenAccounts, setTokenAccounts] = useState<TokenAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [statusMessage, setStatusMessage] = useState("");
  const [filter, setFilter] = useState<"all" | "empty" | "under1" | "under5" | "under10">("all");

  const fetchTokenAccounts = async () => {
    if (!publicKey) return;
    
    setLoading(true);
    setStatusMessage("Scanning wallet...");
    
    try {
      const splAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );
      
      const token2022Accounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_2022_PROGRAM_ID }
      );
      
      const allAccounts = [
        ...splAccounts.value.map(acc => ({ ...acc, programId: TOKEN_PROGRAM_ID })),
        ...token2022Accounts.value.map(acc => ({ ...acc, programId: TOKEN_2022_PROGRAM_ID })),
      ];
      
      setStatusMessage(`Found ${allAccounts.length} accounts. Fetching prices...`);
      
      const accounts: TokenAccount[] = [];
      
      for (let i = 0; i < allAccounts.length; i++) {
        const account = allAccounts[i];
        const parsed = account.account.data.parsed.info;
        const mint = parsed.mint;
        const balance = parsed.tokenAmount.uiAmount || 0;
        const decimals = parsed.tokenAmount.decimals;
        
        let symbol = mint.slice(0, 4) + "..." + mint.slice(-4);
        let name = "Unknown Token";
        let logoURI: string | null = null;
        let priceUsd: number | null = null;
        
        try {
          const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
          if (res.ok) {
            const data = await res.json();
            const bestPair = data.pairs?.sort((a: any, b: any) => 
              (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
            )[0];
            
            if (bestPair) {
              // Check if our mint is baseToken or quoteToken
              const isBase = bestPair.baseToken?.address === mint;
              const tokenData = isBase ? bestPair.baseToken : bestPair.quoteToken;
              
              if (tokenData) {
                symbol = tokenData.symbol || symbol;
                name = tokenData.name || name;
                logoURI = bestPair.info?.imageUrl || null;
                priceUsd = parseFloat(bestPair.priceUsd) || null;
                
                // If we're quoteToken, invert the price
                if (!isBase && priceUsd) {
                  priceUsd = 1 / priceUsd;
                }
              }
            }
          }
        } catch (err) {
          // Silent fail
        }
        
        accounts.push({
          pubkey: account.pubkey,
          mint,
          balance,
          decimals,
          symbol,
          name,
          logoURI,
          priceUsd,
          valueUsd: priceUsd ? balance * priceUsd : 0,
          rentLamports: Math.round(RENT_PER_ACCOUNT * 1e9),
          programId: account.programId,
          selected: false,
        });
        
        if (i % 10 === 0) {
          setStatusMessage(`Fetching prices... (${i + 1}/${allAccounts.length})`);
        }
      }
      
      accounts.sort((a, b) => {
        if (a.balance === 0 && b.balance > 0) return -1;
        if (a.balance > 0 && b.balance === 0) return 1;
        return a.valueUsd - b.valueUsd;
      });
      
      setTokenAccounts(accounts);
      setStatusMessage("");
    } catch (error) {
      console.error("Error fetching accounts:", error);
      setStatusMessage("Error scanning wallet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (publicKey) {
      fetchTokenAccounts();
    }
  }, [publicKey]);

  const filteredAccounts = useMemo(() => {
    return tokenAccounts.filter(acc => {
      switch (filter) {
        case "empty": return acc.balance === 0;
        case "under1": return acc.valueUsd < 1;
        case "under5": return acc.valueUsd < 5;
        case "under10": return acc.valueUsd < 10;
        default: return true;
      }
    });
  }, [tokenAccounts, filter]);

  const stats = useMemo(() => {
    const selected = tokenAccounts.filter(a => a.selected);
    const totalReclaimable = tokenAccounts.length * RENT_PER_ACCOUNT;
    const selectedReclaimable = selected.length * RENT_PER_ACCOUNT;
    const emptyCount = tokenAccounts.filter(a => a.balance === 0).length;
    const dustCount = tokenAccounts.filter(a => a.valueUsd > 0 && a.valueUsd < 1).length;
    
    return {
      total: tokenAccounts.length,
      selected: selected.length,
      emptyCount,
      dustCount,
      totalReclaimable,
      selectedReclaimable,
    };
  }, [tokenAccounts]);

  const toggleSelect = (pubkey: PublicKey) => {
    setTokenAccounts(prev => prev.map(acc => 
      acc.pubkey.equals(pubkey) ? { ...acc, selected: !acc.selected } : acc
    ));
  };

  const selectAllFiltered = () => {
    const filteredPubkeys = new Set(filteredAccounts.map(a => a.pubkey.toString()));
    setTokenAccounts(prev => prev.map(acc => ({
      ...acc,
      selected: filteredPubkeys.has(acc.pubkey.toString()) ? true : acc.selected
    })));
  };

  const deselectAll = () => {
    setTokenAccounts(prev => prev.map(acc => ({ ...acc, selected: false })));
  };

  const quickSelect = (type: "empty" | "under1" | "under5" | "under10") => {
    setTokenAccounts(prev => prev.map(acc => {
      let shouldSelect = false;
      switch (type) {
        case "empty": shouldSelect = acc.balance === 0; break;
        case "under1": shouldSelect = acc.valueUsd < 1; break;
        case "under5": shouldSelect = acc.valueUsd < 5; break;
        case "under10": shouldSelect = acc.valueUsd < 10; break;
      }
      return { ...acc, selected: shouldSelect };
    }));
  };

  const burnAndClose = async () => {
    if (!publicKey || !sendTransaction) return;
    
    const selected = tokenAccounts.filter(a => a.selected);
    if (selected.length === 0) return;
    
    setCleaning(true);
    setProgress({ current: 0, total: selected.length });
    
    // Split into batches
    const batches: TokenAccount[][] = [];
    for (let i = 0; i < selected.length; i += ACCOUNTS_PER_TX) {
      batches.push(selected.slice(i, i + ACCOUNTS_PER_TX));
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    // Process each batch with sendTransaction (Phantom-friendly)
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      try {
        setStatusMessage(`Processing batch ${i + 1}/${batches.length}...`);
        
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        
        const transaction = new Transaction();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;
        
        // Add compute budget instructions first (Phantom requirement)
        transaction.add(
          ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 })
        );
        
        for (const account of batch) {
          if (account.balance > 0) {
            const burnAmount = BigInt(
              Math.floor(account.balance * Math.pow(10, account.decimals))
            );
            
            transaction.add(
              createBurnInstruction(
                account.pubkey,
                new PublicKey(account.mint),
                publicKey,
                burnAmount,
                [],
                account.programId
              )
            );
          }
          
          transaction.add(
            createCloseAccountInstruction(
              account.pubkey,
              publicKey,
              publicKey,
              [],
              account.programId
            )
          );
        }
        
        setStatusMessage(`Approve batch ${i + 1}/${batches.length} in wallet...`);
        
        // Use sendTransaction - wallet handles signing internally (no malicious warning)
        const signature = await sendTransaction(transaction, connection, {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });
        
        setStatusMessage(`Confirming batch ${i + 1}/${batches.length}...`);
        
        await confirmTransactionPolling(connection, signature);
        
        successCount += batch.length;
        setProgress({ current: successCount + errorCount, total: selected.length });
        
      } catch (err: any) {
        console.error(`Batch ${i + 1} failed:`, err);
        errorCount += batch.length;
        setProgress({ current: successCount + errorCount, total: selected.length });
        
        if (err.message?.includes("User rejected")) {
          setStatusMessage("Cancelled by user");
          break;
        }
      }
    }
    
    if (successCount > 0) {
      setStatusMessage(`✅ Cleaned ${successCount} account(s)! Reclaimed ~${(successCount * RENT_PER_ACCOUNT).toFixed(4)} SOL`);
    } else if (errorCount > 0) {
      setStatusMessage("❌ Failed to clean accounts");
    }
    
    setTimeout(() => fetchTokenAccounts(), 2000);
    setCleaning(false);
  };

  if (!publicKey) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-full bg-white/[0.02] flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-10 h-10 text-gray-600" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
          <p className="text-gray-400">Connect your wallet to scan for closeable token accounts</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#fb57ff] to-purple-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Wallet Cleanup</h1>
            <p className="text-gray-400 text-sm">Burn dust tokens & reclaim SOL from empty accounts</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <p className="text-sm text-gray-400 mb-1">Total Accounts</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <p className="text-sm text-gray-400 mb-1">Empty Accounts</p>
          <p className="text-2xl font-bold text-white">{stats.emptyCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <p className="text-sm text-gray-400 mb-1">Dust (&lt;$1)</p>
          <p className="text-2xl font-bold text-white">{stats.dustCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <p className="text-sm text-gray-400 mb-1">Reclaimable</p>
          <p className="text-2xl font-bold" style={{ color: '#fb57ff' }}>~{stats.totalReclaimable.toFixed(3)} SOL</p>
        </div>
      </div>

      {/* Quick Select Buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => quickSelect("empty")} className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:border-[#fb57ff]/30 text-sm font-medium text-gray-300 hover:text-white transition-all">
          Select Empty
        </button>
        <button onClick={() => quickSelect("under1")} className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:border-[#fb57ff]/30 text-sm font-medium text-gray-300 hover:text-white transition-all">
          Select Under $1
        </button>
        <button onClick={() => quickSelect("under5")} className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:border-[#fb57ff]/30 text-sm font-medium text-gray-300 hover:text-white transition-all">
          Select Under $5
        </button>
        <button onClick={() => quickSelect("under10")} className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:border-[#fb57ff]/30 text-sm font-medium text-gray-300 hover:text-white transition-all">
          Select Under $10
        </button>
        <button onClick={selectAllFiltered} className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:border-[#fb57ff]/30 text-sm font-medium text-gray-300 hover:text-white transition-all">
          Select All
        </button>
        <button onClick={deselectAll} className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:border-red-500/30 text-sm font-medium text-gray-300 hover:text-red-400 transition-all">
          Deselect All
        </button>
        <button onClick={fetchTokenAccounts} disabled={loading} className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:border-[#fb57ff]/30 text-sm font-medium text-gray-300 hover:text-white transition-all ml-auto">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {[
          { key: "all", label: "All" },
          { key: "empty", label: "Empty" },
          { key: "under1", label: "Under $1" },
          { key: "under5", label: "Under $5" },
          { key: "under10", label: "Under $10" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              filter === key
                ? "bg-[#fb57ff]/10 border border-[#fb57ff] text-[#fb57ff]"
                : "bg-white/[0.02] border border-white/[0.05] text-gray-400 hover:border-white/[0.1]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div className="mb-4 p-3 rounded-lg bg-white/[0.02] border border-[#fb57ff]/30">
          <div className="flex items-center gap-2 text-sm" style={{ color: '#fb57ff' }}>
            {(loading || cleaning) && <Loader2 className="w-4 h-4 animate-spin" />}
            {statusMessage}
          </div>
          {cleaning && progress.total > 0 && (
            <div className="mt-2">
              <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#fb57ff] to-purple-600 transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">{progress.current} / {progress.total}</p>
            </div>
          )}
        </div>
      )}

      {/* Token Accounts List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#fb57ff' }} />
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-white/[0.02] flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Wallet is Clean!</h3>
          <p className="text-gray-400">No token accounts match this filter</p>
        </div>
      ) : (
        <div className="space-y-2 mb-6">
          {filteredAccounts.map((account) => (
            <div
              key={account.pubkey.toString()}
              onClick={() => toggleSelect(account.pubkey)}
              className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all ${
                account.selected
                  ? "bg-[#fb57ff]/10 border border-[#fb57ff]/50"
                  : "bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.1]"
              }`}
            >
              <div className="flex-shrink-0">
                {account.selected ? (
                  <CheckSquare className="w-5 h-5" style={{ color: '#fb57ff' }} />
                ) : (
                  <Square className="w-5 h-5 text-gray-600" />
                )}
              </div>

              <div className="flex items-center gap-3 flex-1 min-w-0">
                {account.logoURI ? (
                  <img 
                    src={account.logoURI} 
                    alt={account.symbol}
                    className="w-10 h-10 rounded-full"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                    <span className="text-xs font-bold text-gray-400">{account.symbol.slice(0, 2)}</span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{account.symbol}</p>
                  <p className="text-xs text-gray-500 truncate">{account.name}</p>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="font-medium text-white">
                  {account.balance === 0 ? (
                    <span className="text-gray-500">0</span>
                  ) : (
                    account.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })
                  )}
                </p>
                <p className={`text-xs ${account.valueUsd === 0 ? 'text-gray-600' : 'text-gray-400'}`}>
                  ${account.valueUsd.toFixed(2)}
                </p>
              </div>

              <div className="text-right flex-shrink-0 w-20">
                <p className="text-xs text-gray-500">Rent</p>
                <p className="text-sm font-medium" style={{ color: '#fb57ff' }}>
                  {RENT_PER_ACCOUNT.toFixed(4)} SOL
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Action Bar */}
      {stats.selected > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#060609]/95 backdrop-blur-sm border-t border-white/[0.05] lg:left-64">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-white font-semibold">{stats.selected} account(s) selected</p>
              <p className="text-sm text-gray-400">Reclaim ~{stats.selectedReclaimable.toFixed(4)} SOL</p>
            </div>
            <button
              onClick={burnAndClose}
              disabled={cleaning}
              className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(45deg, #fb57ff, #9333ea)' }}
            >
              {cleaning ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Cleaning...
                </>
              ) : (
                <>
                  <Flame className="w-5 h-5" />
                  Burn & Close
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {stats.selected > 0 && <div className="h-24" />}
    </div>
  );
}