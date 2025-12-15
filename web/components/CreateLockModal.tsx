"use client";

import { useState, useEffect } from "react";
import { X, Lock, AlertCircle, Loader2, Search, ChevronDown } from "lucide-react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { useStakingProgram } from "@/hooks/useStakingProgram";
import { useAdminProgram } from "@/hooks/useAdminProgram";

interface CreateLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface TokenInfo {
  mint: string;
  balance: number;
  decimals: number;
  symbol?: string;
  name?: string;
  logoURI?: string;
  price?: number;
  liquidity?: number;
  marketCap?: number;
  programId?: string;
}

export default function CreateLockModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateLockModalProps) {
  const { publicKey, wallet } = useWallet();
  const { connection } = useConnection();
  const { stake } = useStakingProgram();
  const { initializePool, createProject } = useAdminProgram();
  const [userTokens, setUserTokens] = useState<TokenInfo[]>([]);
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [tokenSearchQuery, setTokenSearchQuery] = useState("");
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [amount, setAmount] = useState("");
  const [customDays, setCustomDays] = useState("");
  const [selectedDuration, setSelectedDuration] = useState<number | "custom" | "">("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  // Fetch user's tokens when modal opens
  useEffect(() => {
    if (isOpen && publicKey) {
      fetchUserTokens();
    }
  }, [isOpen, publicKey]);

  // Helper: Wait for project account to exist and be fully initialized on-chain
  const waitForProjectAccount = async (tokenMint: string, poolId: number, walletAdapter: any, maxRetries = 30) => {
    const { getProgram } = await import("@/lib/anchor-program");
    const { getPDAs } = await import("@/lib/anchor-program");
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        if (!walletAdapter) throw new Error("Wallet not found");

        const program = getProgram(walletAdapter, connection);
        const tokenMintPubkey = new PublicKey(tokenMint);
        const [projectPDA] = getPDAs.project(tokenMintPubkey, poolId);
        
        // ✅ Try to actually FETCH and DESERIALIZE the project account
        // This ensures it's not just created, but fully initialized and readable
        // Use "confirmed" commitment for faster confirmation
        const projectData = await program.account.project.fetch(projectPDA, "confirmed");
        
        // Verify it has the expected data
        if (projectData && 
            projectData.tokenMint.toString() === tokenMint &&
            projectData.poolId.toNumber() === poolId &&
            projectData.admin) {
          console.log(`✅ Project account fully initialized and verified after ${i + 1} attempts`);
          console.log(`   - Token Mint: ${projectData.tokenMint.toString()}`);
          console.log(`   - Pool ID: ${projectData.poolId.toString()}`);
          console.log(`   - Admin: ${projectData.admin.toString()}`);
          return true;
        }
      } catch (err: any) {
        console.log(`⏳ Attempt ${i + 1}/${maxRetries}: Project not fully initialized yet... (${err.message || 'checking'})`);
      }
      
      // Wait 1 second before next attempt (increased from 500ms)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error("Project account not fully initialized after multiple attempts. Please try again.");
  };

  const fetchUserTokens = async () => {
    if (!publicKey) return;
    
    setIsLoadingTokens(true);
    setStatusMessage("Fetching your tokens...");

    try {
      // Fetch regular SPL tokens
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );
      console.log("✅ Found", tokenAccounts.value.length, "SPL token accounts");

      // Fetch Token-2022 tokens
      const token2022Accounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_2022_PROGRAM_ID }
      );
      console.log("✅ Found", token2022Accounts.value.length, "Token-2022 accounts");

      const allAccounts = [
        ...tokenAccounts.value.map(acc => ({ ...acc, programId: "SPL Token", programIdKey: TOKEN_PROGRAM_ID.toString() })),
        ...token2022Accounts.value.map(acc => ({ ...acc, programId: "Token-2022", programIdKey: TOKEN_2022_PROGRAM_ID.toString() }))
      ];

      console.log(`📊 Total accounts to process: ${allAccounts.length}`);

      const tokens: TokenInfo[] = [];
      let processed = 0;

      for (const account of allAccounts) {
        try {
          if (!account?.account?.data?.parsed?.info) {
            continue;
          }

          const tokenAmount = account.account.data.parsed.info.tokenAmount;
          const mint = account.account.data.parsed.info.mint;
          const balance = tokenAmount?.uiAmount || 0;

          if (balance > 0) {
            processed++;
            setStatusMessage(`Fetching metadata... (${processed}/${allAccounts.filter(a => (a.account.data.parsed.info.tokenAmount?.uiAmount || 0) > 0).length})`);

            // Use DexScreener API
            try {
              const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
              const data = await response.json();

              if (data.pairs && data.pairs.length > 0) {
                // Find the Solana pair with highest liquidity
                const solanaPairs = data.pairs.filter((p: any) => p.chainId === "solana");
                const bestPair = solanaPairs.sort((a: any, b: any) => 
                  (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
                )[0] || data.pairs[0];

                // Get token info from the pair
                const tokenInfo = bestPair.baseToken.address.toLowerCase() === mint.toLowerCase() 
                  ? bestPair.baseToken 
                  : bestPair.quoteToken;

                tokens.push({
                  mint,
                  balance,
                  decimals: tokenAmount.decimals,
                  symbol: tokenInfo.symbol || "UNKNOWN",
                  name: tokenInfo.name || "Unknown Token",
                  logoURI: bestPair.info?.imageUrl || undefined,
                  programId: account.programIdKey,
                  price: parseFloat(bestPair.priceUsd) || undefined,
                  liquidity: bestPair.liquidity?.usd || undefined,
                  marketCap: bestPair.marketCap || undefined,
                });
                console.log(`✅ DexScreener: ${tokenInfo.symbol}`);
              } else {
                // No pairs found - token might be new or have no liquidity
                tokens.push({
                  mint,
                  balance,
                  decimals: tokenAmount.decimals,
                  symbol: `${mint.slice(0, 4)}...${mint.slice(-4)}`,
                  name: "Unknown Token",
                  logoURI: undefined,
                  programId: account.programIdKey,
                });
                console.log(`⚠️ No DexScreener data for: ${mint}`);
              }
            } catch (err) {
              console.error(`❌ DexScreener error for ${mint}:`, err);
              tokens.push({
                mint,
                balance,
                decimals: tokenAmount.decimals,
                symbol: `${mint.slice(0, 4)}...${mint.slice(-4)}`,
                name: "Unknown Token",
                logoURI: undefined,
                programId: account.programIdKey,
              });
            }
          }
        } catch (parseError) {
          console.error("Error parsing token account:", parseError);
        }
      }

      console.log("🎉 Total tokens loaded:", tokens.length);

      // Sort by balance value (price * balance), then by balance
      tokens.sort((a, b) => {
        const aValue = (a.price || 0) * a.balance;
        const bValue = (b.price || 0) * b.balance;
        if (bValue !== aValue) return bValue - aValue;
        return b.balance - a.balance;
      });

      setUserTokens(tokens);
      setStatusMessage("");
    } catch (error) {
      console.error("Error fetching tokens:", error);
      setError("Failed to load your tokens");
    } finally {
      setIsLoadingTokens(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // ✅ Check wallet connection first
    if (!publicKey || !wallet) {
      setError("Please connect your wallet first");
      return;
    }

    if (!selectedToken) {
      setError("Please select a token");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    // Calculate final lock duration in seconds
    let finalDuration: number;
    if (selectedDuration === "custom") {
      if (!customDays || parseInt(customDays) <= 0) {
        setError("Please enter valid number of days");
        return;
      }
      finalDuration = parseInt(customDays) * 86400; // days to seconds
    } else if (typeof selectedDuration === "number") {
      finalDuration = selectedDuration;
    } else {
      setError("Please select a lock duration");
      return;
    }

    setIsCreating(true);
    setStatusMessage("Preparing lock transaction...");

    try {
      setStatusMessage("Finding available pool slot...");
      
      // For locks, ALWAYS create a new unique pool (no reusing)
      const poolsResponse = await fetch(`/api/pools/by-token/${selectedToken.mint}`);
      const existingPools = poolsResponse.ok ? await poolsResponse.json() : [];

      // Don't look for matching pool - each lock gets its own pool
      let matchingPool = null;
      
      // Track the actual poolId we'll use
      let usedPoolId: number;
      
      if (matchingPool) {
        // Pool with this lockup already exists for this token, verify it on-chain
        setStatusMessage("Verifying existing pool...");
        const { getProgram, getPDAs } = await import("@/lib/anchor-program");
        const walletForVerify = wallet.adapter;
        const program = getProgram(walletForVerify, connection);
        const tokenMintPubkey = new PublicKey(selectedToken.mint);
        
        try {
          // Verify the project exists on-chain with correct token mint
          const [projectPDA] = getPDAs.project(tokenMintPubkey, matchingPool.poolId);
          const projectData = await program.account.project.fetch(projectPDA);
          
          if (projectData.tokenMint.toString() === selectedToken.mint && 
              projectData.lockupSeconds.toNumber() === finalDuration) {
            usedPoolId = matchingPool.poolId;
            console.log(`✅ Verified existing pool on-chain - poolId: ${usedPoolId}, lockup: ${finalDuration}s`);
          } else {
            console.warn(`⚠️ Pool mismatch on-chain, finding new poolId...`);
            matchingPool = null; // Force creation of new pool
          }
        } catch (error) {
          console.warn(`⚠️ Pool ${matchingPool.poolId} not found on-chain, finding new poolId...`);
          matchingPool = null; // Force creation of new pool
        }
      }
      
      if (!matchingPool) {
        // Need to find next available poolId (check both on-chain AND database)
        const { getProgram } = await import("@/lib/anchor-program");
        const { getPDAs } = await import("@/lib/anchor-program");
        const walletForCheck = wallet.adapter;
        const program = getProgram(walletForCheck, connection);
        const tokenMintPubkey = new PublicKey(selectedToken.mint);
        
        let poolId = 1000;
        let poolExists = true;
        
        console.log("🔍 Finding next available poolId...");
        
        while (poolExists && poolId < 2000) { // Max 100 pools per token
          const [projectPDA] = getPDAs.project(tokenMintPubkey, poolId);
          
          // Check on-chain
          let onChainExists = false;
          try {
            await program.account.project.fetch(projectPDA);
            onChainExists = true;
          } catch (error) {
            // Pool doesn't exist on-chain
          }
          
          // Check database
          let dbExists = false;
          try {
            dbExists = existingPools.some((p: any) => p.poolId === poolId);
          } catch (error) {
            console.log("⚠️ Could not check database, continuing...");
          }
          
          if (onChainExists || dbExists) {
            console.log(`⚠️ Pool ${poolId} already exists (onChain: ${onChainExists}, db: ${dbExists}), trying next...`);
            poolId++;
          } else {
            console.log(`✅ Found available poolId: ${poolId}`);
            poolExists = false;
          }
        }
        
        if (poolExists) {
          throw new Error("Maximum number of pools (100) reached for this token.");
        }
        
        usedPoolId = poolId;
      }
      
      // If no matching pool exists, we need to create one
      if (!matchingPool) {
        try {
          // Step 1: Create project
          setStatusMessage("Creating lock pool on-chain...");
          await createProject(selectedToken.mint, usedPoolId);
          console.log("✅ Project created with poolId:", usedPoolId);
          
           // Step 1.5: Wait for project account to be queryable
           setStatusMessage("Confirming project account...");
           await waitForProjectAccount(selectedToken.mint, usedPoolId, wallet.adapter);
           
           // Step 2: Initialize pool with lockup
          setStatusMessage("Initializing pool with lockup...");
          await initializePool({
            tokenMint: selectedToken.mint,
            poolId: usedPoolId,
            rateBpsPerYear: 0, // No rewards for locks
            rateMode: 0, // Fixed rate
            lockupSeconds: finalDuration,
            poolDurationSeconds: finalDuration, // ✅ Set to lockup duration (not 0)
            referrer: null,
            referrerSplitBps: null,
            enableReflections: false,
            reflectionToken: null,
            poolTokenFeeBps: 0,
            poolSolFee: 0,
          });
          console.log("✅ Pool initialized with lockup");
          
          // Sync pool to database
          const syncResponse = await fetch("/api/pools/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tokenMint: selectedToken.mint,
              poolId: usedPoolId,
              name: selectedToken.name || selectedToken.symbol,
              symbol: selectedToken.symbol || "UNKNOWN",
              logo: selectedToken.logoURI,
              type: "locked",
              lockPeriod: finalDuration,
            }),
          });
          
          if (syncResponse.ok) {
            matchingPool = await syncResponse.json();
            console.log("✅ Pool synced to database");
          }
        } catch (createError: any) {
          console.error("Pool creation error:", createError);
          throw new Error(`Failed to create lock pool: ${createError.message}`);
        }
      }
      
      console.log(`🎯 Using poolId ${usedPoolId} for staking transaction`);
      setStatusMessage("Locking tokens on-chain...");
      
      // Execute stake transaction (this locks the tokens)
      const amountInTokens = parseFloat(amount) * Math.pow(10, selectedToken.decimals);
      const tx = await stake(selectedToken.mint, amountInTokens, usedPoolId, undefined);
      
      if (!tx) {
        throw new Error("Transaction failed");
      }
      
      console.log("✅ Tokens locked on-chain:", tx);
      
      setStatusMessage("Saving lock details...");
      
      // Calculate lock ID based on timestamp
      const lockId = Date.now();
      
      // Get the stake PDA using the correct poolId
      const { getPDAs: getPDAsForStake } = await import("@/lib/anchor-program");
      const tokenMintPubkeyForStake = new PublicKey(selectedToken.mint);
      const [projectPDAForStake] = getPDAsForStake.project(tokenMintPubkeyForStake, usedPoolId);
      const [stakePDA] = getPDAsForStake.userStake(projectPDAForStake, publicKey);
      
      // Save to database
      const response = await fetch("/api/locks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lockId,
          tokenMint: selectedToken.mint,
          name: selectedToken.name || selectedToken.symbol,
          symbol: selectedToken.symbol || "UNKNOWN",
          amount: parseFloat(amount),
          lockDuration: finalDuration,
          creatorWallet: publicKey.toString(),
          poolAddress: matchingPool?.poolAddress || null,
          stakePda: stakePDA.toString(),
          poolId: usedPoolId,
          logo: selectedToken.logoURI || null,
        }),
      });

      if (!response.ok) {
        console.warn("Failed to save lock to database, but tokens are locked on-chain");
      }

      setStatusMessage("Lock created successfully! ✅");

      // Reset form
      setSelectedToken(null);
      setAmount("");
      setCustomDays("");
      setSelectedDuration("");

      setTimeout(() => {
      onSuccess();
      onClose();
      }, 1000);
    } catch (err: any) {
      console.error("Error creating lock:", err);
      setError(err.message || "Failed to create lock");
    } finally {
      setIsCreating(false);
      setTimeout(() => setStatusMessage(""), 2000);
    }
  };

  if (!isOpen) return null;

  const filteredTokens = userTokens.filter((token) => {
    if (!tokenSearchQuery) return true;
    const query = tokenSearchQuery.toLowerCase();
    return (
      token.symbol?.toLowerCase().includes(query) ||
      token.name?.toLowerCase().includes(query) ||
      token.mint.toLowerCase().includes(query)
    );
  });

  const lockDurationOptions = [
    { label: "1 Day", value: 86400 },
    { label: "7 Days", value: 604800 },
    { label: "30 Days", value: 2592000 },
    { label: "90 Days", value: 7776000 },
    { label: "180 Days", value: 15552000 },
    { label: "365 Days", value: 31536000 },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-black/90 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/[0.05]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/[0.05] sticky top-0 bg-black/90 z-10">
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ background: 'linear-gradient(45deg, white, #fb57ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            <Lock className="w-6 h-6" style={{ color: '#fb57ff' }} />
            Create Token Lock
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Info Box */}
          <div className="bg-white/[0.02] border border-white/[0.1] rounded-lg p-4 mb-6">
            <p className="text-gray-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Lock your tokens securely for a specified duration. Locked tokens cannot be withdrawn until the unlock time.
            </p>
          </div>

          {/* Loading status */}
          {statusMessage && (
            <div className="mb-6 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-blue-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                {statusMessage}
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-red-400">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Token Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Token *
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTokenSelector(!showTokenSelector)}
                  disabled={isLoadingTokens}
                  className="w-full p-3 bg-white/[0.02] border border-white/[0.1] rounded-lg text-white focus:outline-none transition-colors flex items-center justify-between hover:border-[#fb57ff]/50"
                >
                  {selectedToken ? (
                    <div className="flex items-center gap-3">
                      {selectedToken.logoURI ? (
                        <img src={selectedToken.logoURI} alt={selectedToken.symbol} className="w-6 h-6 rounded-full" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#fb57ff] to-purple-600" />
                      )}
                      <div className="text-left">
                        <p className="font-semibold">{selectedToken.symbol}</p>
                        <p className="text-xs text-gray-400">Balance: {selectedToken.balance.toLocaleString()}</p>
            </div>
              </div>
                  ) : (
                    <span className="text-gray-400">
                      {isLoadingTokens ? "Loading tokens..." : "Choose a token"}
                    </span>
                  )}
                  <ChevronDown className={`w-5 h-5 transition-transform ${showTokenSelector ? "rotate-180" : ""}`} />
                </button>

                {/* Token Dropdown */}
                {showTokenSelector && !isLoadingTokens && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-black border border-white/[0.1] rounded-lg shadow-xl z-20 max-h-80 overflow-hidden">
                    {/* Search */}
                    <div className="p-3 border-b border-white/[0.1]">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                          value={tokenSearchQuery}
                          onChange={(e) => setTokenSearchQuery(e.target.value)}
                          placeholder="Search tokens..."
                          className="w-full pl-10 pr-3 py-2 bg-white/[0.05] border border-white/[0.1] rounded-lg text-white text-sm focus:outline-none focus:border-[#fb57ff]/50"
                />
              </div>
            </div>

                    {/* Token List */}
                    <div className="max-h-60 overflow-y-auto">
                      {filteredTokens.length === 0 ? (
                        <div className="p-4 text-center text-gray-400 text-sm">
                          No tokens found
                        </div>
                      ) : (
                        filteredTokens.map((token) => (
                          <button
                            key={token.mint}
                            type="button"
                            onClick={() => {
                              setSelectedToken(token);
                              setShowTokenSelector(false);
                              setTokenSearchQuery("");
                            }}
                            className="w-full p-3 flex items-center gap-3 hover:bg-white/[0.05] transition-colors border-b border-white/[0.05] text-left"
                          >
                            {token.logoURI ? (
                              <img src={token.logoURI} alt={token.symbol} className="w-8 h-8 rounded-full" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#fb57ff] to-purple-600" />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-white">{token.symbol}</p>
                                <span 
                                  className="text-xs px-2 py-0.5 rounded"
                                  style={{ 
                                    backgroundColor: token.programId?.includes("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") ? 'rgba(96, 165, 250, 0.1)' : 'rgba(251, 87, 255, 0.1)',
                                    color: token.programId?.includes("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") ? '#60a5fa' : '#fb57ff'
                                  }}
                                >
                                  {token.programId?.includes("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") ? "SPL" : "2022"}
                                </span>
                              </div>
                              <p className="text-xs text-gray-400">{token.name}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-white">{token.balance.toLocaleString()}</p>
                              {token.price && (
                                <p className="text-xs text-gray-400">${(token.balance * token.price).toFixed(2)}</p>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Amount to Lock *
              </label>
              <div className="relative">
              <input
                type="number"
                step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                  className="w-full p-3 bg-white/[0.02] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#fb57ff]/50 transition-colors"
                required
              />
                {selectedToken && selectedToken.balance > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(selectedToken.balance.toString())}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#fb57ff] hover:underline"
                  >
                    MAX
                  </button>
                )}
              </div>
              {selectedToken && (
                <p className="text-xs text-gray-400 mt-1">
                  Available: {selectedToken.balance.toLocaleString()} {selectedToken.symbol}
                </p>
              )}
            </div>

            {/* Lock Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Lock Duration *
              </label>
              <div className="grid grid-cols-3 gap-3 mb-3">
                {lockDurationOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedDuration(option.value)}
                    className={`p-3 rounded-lg border transition-colors ${
                      selectedDuration === option.value
                        ? "border-[#fb57ff] bg-[#fb57ff]/10 text-white"
                        : "border-white/[0.1] bg-white/[0.02] text-gray-400 hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="font-semibold text-sm">{option.label}</div>
                  </button>
                ))}
            </div>

              {/* Custom Duration */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedDuration("custom")}
                  className={`px-4 py-2 rounded-lg border transition-colors ${
                    selectedDuration === "custom"
                      ? "border-[#fb57ff] bg-[#fb57ff]/10 text-white"
                      : "border-white/[0.1] bg-white/[0.02] text-gray-400 hover:bg-white/[0.05]"
                  }`}
                >
                  Custom
                </button>
                {selectedDuration === "custom" && (
                  <div className="flex-1 flex items-center gap-2">
              <input
                      type="number"
                      min="1"
                      value={customDays}
                      onChange={(e) => setCustomDays(e.target.value)}
                      placeholder="Enter days"
                      className="flex-1 p-2 bg-white/[0.02] border border-white/[0.1] rounded-lg text-white focus:outline-none focus:border-[#fb57ff]/50 transition-colors"
                    />
                    <span className="text-gray-400 text-sm">days</span>
                  </div>
                )}
              </div>
            </div>

            {/* Info about lock */}
            <div className="bg-white/[0.02] border border-[#fb57ff]/30 rounded-lg p-4">
              <p className="text-sm" style={{ color: '#fb57ff' }}>
                💡 Your tokens will be locked and cannot be withdrawn until the lock period expires
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isCreating}
                className="flex-1 px-6 py-3 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.05] rounded-lg font-semibold transition-colors disabled:opacity-50"
                onMouseEnter={(e) => !isCreating && (e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.3)')}
                onMouseLeave={(e) => !isCreating && (e.currentTarget.style.borderColor = '')}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating || !publicKey || !selectedToken}
                className="flex-1 px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
                onMouseEnter={(e) => !isCreating && (e.currentTarget.style.background = 'linear-gradient(45deg, #fb57ff, black)')}
                onMouseLeave={(e) => !isCreating && (e.currentTarget.style.background = 'linear-gradient(45deg, black, #fb57ff)')}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating Lock...
                  </>
                ) : (
                  "Create Lock"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

