"use client";
import { useState, useEffect } from "react";
import { useWallet, useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { Plus, X, Loader2, Check, AlertCircle, Code } from "lucide-react";
import { getProgram, getPDAs } from "@/lib/anchor-program";
import IntegrateModal from "@/components/IntegrateModal";
import * as anchor from "@coral-xyz/anchor";
import { findRaydiumPoolByLPToken, validateRaydiumPoolAddress } from "@/lib/raydium-api";
import { detectLPTokenDex, DexType, DexPoolInfo } from "@/lib/multi-dex-detector";
import { getDexInfo, isDexSupported } from "@/lib/liquidity-router";

const ADMIN_WALLET = new PublicKey("ecfvkqWdJiYJRyUtWvuYpPWP5faf9GBcA1K6TaDW7wS");

interface UserToken {
  mint: string;
  balance: number;
  decimals: number;
  symbol?: string;
  name?: string;
  logoURI?: string;
  programId: string;
  price?: number;
  liquidity?: number;
  marketCap?: number;
}

interface CreateLPPoolModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateLPPoolModal({ onClose, onSuccess }: CreateLPPoolModalProps) {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [poolCreationFee, setPoolCreationFee] = useState(10_000_000);
  const [userTokens, setUserTokens] = useState<UserToken[]>([]);
  const [selectedLPToken, setSelectedLPToken] = useState<UserToken | null>(null);
  const [selectedRewardToken, setSelectedRewardToken] = useState<UserToken | null>(null);
  const [createdPoolId, setCreatedPoolId] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showIntegrateModal, setShowIntegrateModal] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  
  const [poolConfig, setPoolConfig] = useState({
    rewardAmount: "1000",
    duration: "90",
    lockPeriod: "30",
  });

  const [detectedPools, setDetectedPools] = useState<DexPoolInfo[]>([]);
  const [selectedDex, setSelectedDex] = useState<DexType | null>(null);
  const [selectedPoolAddress, setSelectedPoolAddress] = useState("");
  const [dexDetectionLoading, setDexDetectionLoading] = useState(false);
  const [manualPoolAddress, setManualPoolAddress] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);

  useEffect(() => {
    if (publicKey && step === 1) {
      fetchUserTokens();
    }
  }, [publicKey, step]);

  useEffect(() => {
    const fetchFee = async () => {
      try {
        const res = await fetch("/api/admin/pool-fee");
        if (res.ok) {
          const data = await res.json();
          setPoolCreationFee(data.feeInLamports);
        }
      } catch (error) {
        console.error("Failed to fetch pool creation fee:", error);
      }
    };
    fetchFee();
  }, []);

  const fetchUserTokens = async () => {
    if (!publicKey) return;
    
    setLoading(true);
    setStatusMessage("Loading your tokens...");
    
    try {
      console.log("🔍 Fetching tokens for wallet:", publicKey.toString());
      console.log("🌐 RPC Endpoint:", connection.rpcEndpoint);
      
      const balance = await connection.getBalance(publicKey);
      console.log("💰 SOL Balance:", balance / 1_000_000_000, "SOL");
      
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );
      console.log("✅ Found", tokenAccounts.value.length, "SPL token accounts");

      const token2022Accounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_2022_PROGRAM_ID }
      );
      console.log("✅ Found", token2022Accounts.value.length, "Token-2022 accounts");

      const allAccounts = [
        ...tokenAccounts.value.map(acc => ({ ...acc, programId: "SPL Token", programIdKey: TOKEN_PROGRAM_ID.toString() })),
        ...token2022Accounts.value.map(acc => ({ ...acc, programId: "Token-2022", programIdKey: TOKEN_2022_PROGRAM_ID.toString() }))
      ];

      console.log("📊 Total accounts to process:", allAccounts.length);

      const tokens: UserToken[] = [];
      let processed = 0;

      for (const account of allAccounts) {
        try {
          const parsed = account.account.data.parsed.info;
          const tokenAmount = parsed.tokenAmount;
          
          const balance = tokenAmount.uiAmount || 0;
          const rawAmount = tokenAmount.amount;
          
          console.log(`Token ${parsed.mint}:`, {
            balance,
            rawAmount,
            decimals: tokenAmount.decimals,
            programId: account.programId
          });
          
          if (rawAmount !== "0") {
            const mint = parsed.mint;
            processed++;
            setStatusMessage(`Fetching metadata... (${processed}/${allAccounts.length})`);
            
            try {
              const response = await fetch(`/api/birdeye/token-info?address=${mint}`);
              const result = await response.json();
              
              const tokenInfo = result.fallback || result;
              
              tokens.push({
                mint,
                balance,
                decimals: tokenAmount.decimals,
                symbol: tokenInfo.symbol || "UNKNOWN",
                name: tokenInfo.name || "Unknown",
                logoURI: tokenInfo.logoURI,
                programId: account.programIdKey,
                price: tokenInfo.price,
                liquidity: tokenInfo.liquidity,
                marketCap: tokenInfo.marketCap,
              });
              
              console.log(`✅ Added token:`, tokenInfo.symbol || "UNKNOWN");
            } catch (err) {
              console.error(`❌ Failed to fetch info for ${mint}:`, err);
              tokens.push({
                mint,
                balance,
                decimals: tokenAmount.decimals,
                programId: account.programIdKey,
                symbol: "UNKNOWN",
                name: "Unknown",
              });
            }
          }
        } catch (parseError) {
          console.error("Error parsing token account:", parseError);
        }
      }

      console.log("🎉 Total tokens loaded:", tokens.length);

      // Sort by balance first, then liquidity/market cap
      tokens.sort((a, b) => {
        if (a.balance > 0 && b.balance === 0) return -1;
        if (a.balance === 0 && b.balance > 0) return 1;
        
        const aValue = a.liquidity || a.marketCap || 0;
        const bValue = b.liquidity || b.marketCap || 0;
        return bValue - aValue;
      });

      setUserTokens(tokens);
      setStatusMessage("");
    } catch (error) {
      console.error("❌ Error fetching tokens:", error);
      setStatusMessage("Error loading tokens. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-detect DEX pools when LP token is selected
  useEffect(() => {
    if (selectedLPToken && step === 2) {
      autoDetectDex();
    }
  }, [selectedLPToken, step]);

  const autoDetectDex = async () => {
    if (!selectedLPToken) return;

    setDexDetectionLoading(true);
    setDetectedPools([]);
    setSelectedDex(null);
    setSelectedPoolAddress("");
    setShowManualInput(false);

    try {
      console.log("🔍 Auto-detecting DEX for LP token:", selectedLPToken.mint);
      const pools = await detectLPTokenDex(selectedLPToken.mint);

      if (pools.length === 0) {
        setShowManualInput(true);
      } else {
        setDetectedPools(pools);
        
        // Auto-select the first pool (highest liquidity)
        const topPool = pools[0];
        setSelectedDex(topPool.dexType);
        setSelectedPoolAddress(topPool.poolAddress);

        const dexInfo = getDexInfo(topPool.dexType);
        console.log(`✅ Found ${dexInfo.displayName} pool!`);
      }
    } catch (error) {
      console.error("DEX detection error:", error);
      setShowManualInput(true);
    } finally {
      setDexDetectionLoading(false);
    }
  };

  const handleDexSelection = (pool: DexPoolInfo) => {
    setSelectedDex(pool.dexType);
    setSelectedPoolAddress(pool.poolAddress);
    setShowManualInput(false);
    setError(null);
  };

  const handleManualPoolAddressChange = (address: string) => {
    setManualPoolAddress(address);
    setSelectedPoolAddress(address);
  };

  const handleCreateLPPool = async () => {
    if (!publicKey || !signTransaction || !selectedLPToken || !selectedRewardToken || !wallet) {
      setError("Please connect your wallet and select both LP token and reward token");
      return;
    }

    setError(null);
    setLoading(true);
    
    try {
      // Setup
      const program = getProgram(wallet, connection);
      const lpTokenMintPubkey = new PublicKey(selectedLPToken.mint);
      
      // Check if pool already exists and find next available poolId
      let poolId = 0;
      let poolExists = true;

      console.log("🔍 Checking if LP pool already exists for this token...");

      while (poolExists && poolId < 50) {
        const [projectPDA] = getPDAs.project(lpTokenMintPubkey, poolId);
        
        // Check on-chain
        let onChainExists = false;
        try {
          const accountInfo = await connection.getAccountInfo(projectPDA);
          if (accountInfo !== null) {
            onChainExists = true;
            console.log(`⚠️ Pool ${poolId} exists on-chain at ${projectPDA.toString()}`);
          }
        } catch (error: any) {
          onChainExists = false;
        }
        
        // Check database
        let dbExists = false;
        try {
          const dbCheck = await fetch(`/api/lp-pools/by-token/${selectedLPToken.mint}`);
          if (dbCheck.ok) {
            const pools = await dbCheck.json();
            dbExists = pools.some((p: any) => p.poolId === poolId.toString());
          }
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
        throw new Error("Maximum number of pools (50) reached for this LP token. Please contact support.");
      }

      const [projectPDA] = getPDAs.project(lpTokenMintPubkey, poolId);
      const [stakingVaultPDA] = getPDAs.stakingVault(lpTokenMintPubkey, poolId);
      const [rewardVaultPDA] = getPDAs.rewardVault(lpTokenMintPubkey, poolId);
      
      // Detect LP token program type
      const lpMintInfo = await connection.getAccountInfo(lpTokenMintPubkey);
      if (!lpMintInfo) {
        throw new Error("LP token mint not found");
      }
      const lpTokenProgramId = lpMintInfo.owner.equals(TOKEN_2022_PROGRAM_ID) 
        ? TOKEN_2022_PROGRAM_ID 
        : TOKEN_PROGRAM_ID;
      console.log(`✅ LP token program detected: ${lpTokenProgramId.toString()}`);

      // Detect reward token program type
      const rewardTokenMintPubkey = new PublicKey(selectedRewardToken.mint);
      const rewardMintInfo = await connection.getAccountInfo(rewardTokenMintPubkey);
      if (!rewardMintInfo) {
        throw new Error("Reward token mint not found");
      }
      const rewardTokenProgramId = rewardMintInfo.owner.equals(TOKEN_2022_PROGRAM_ID) 
        ? TOKEN_2022_PROGRAM_ID 
        : TOKEN_PROGRAM_ID;
      console.log(`✅ Reward token program detected: ${rewardTokenProgramId.toString()}`);
      
      console.log(`🎯 Creating LP pool with poolId: ${poolId}`);

      // Get user's reward token account
      const userRewardTokenAccount = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { mint: rewardTokenMintPubkey }
      );
      
      if (userRewardTokenAccount.value.length === 0) {
        throw new Error("No token account found for the reward token");
      }
      
      const userRewardTokenAccountPubkey = userRewardTokenAccount.value[0].pubkey;
      
      // Verify balance
      const rewardAmount = parseFloat(poolConfig.rewardAmount);
      const userBalance = userRewardTokenAccount.value[0].account.data.parsed.info.tokenAmount.uiAmount;
      if (userBalance < rewardAmount) {
        throw new Error(`Insufficient balance. You have ${userBalance} ${selectedRewardToken.symbol} but need ${rewardAmount}`);
      }
      
      const rewardAmountWithDecimals = new anchor.BN(rewardAmount * Math.pow(10, selectedRewardToken.decimals));
      
      // Transaction 1: Payment
      setStatusMessage("Step 1/4: Processing payment...");
      console.log("💰 Transaction 1: Payment");
      const paymentTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: ADMIN_WALLET,
          lamports: poolCreationFee, // ✅ NEW - use dynamic fee
        })
      );
      
      const { blockhash } = await connection.getLatestBlockhash();
      paymentTx.recentBlockhash = blockhash;
      paymentTx.feePayer = publicKey;
      
      const signedPaymentTx = await signTransaction(paymentTx);
      const paymentSignature = await connection.sendRawTransaction(signedPaymentTx.serialize());
      await connection.confirmTransaction(paymentSignature, "confirmed");
      console.log("✅ Payment successful:", paymentSignature);

      // Transaction 2: Create Project (using LP token as the base)
      setStatusMessage("Step 2/4: Creating LP pool on-chain...");
      console.log("🏗️ Transaction 2: Create Project");
      const createProjectTx = await program.methods
        .createProject(lpTokenMintPubkey, new anchor.BN(poolId))
        .accounts({
          project: projectPDA,
          stakingVault: stakingVaultPDA,
          rewardVault: rewardVaultPDA,
          tokenMint: lpTokenMintPubkey,
          admin: publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: lpTokenProgramId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();
      console.log("✅ Project created:", createProjectTx);

      // Transaction 3: Initialize Pool (NO REFLECTIONS for LP pools)
      setStatusMessage("Step 3/4: Initializing pool parameters...");
      console.log("⚙️ Transaction 3: Initialize Pool");
      
      const initParams = {
        rateBpsPerYear: new anchor.BN(0),
        rateMode: 1,
        lockupSeconds: new anchor.BN(parseInt(poolConfig.lockPeriod) * 86400),
        poolDurationSeconds: new anchor.BN(parseInt(poolConfig.duration) * 86400),
        referrer: null,
        referrerSplitBps: null,
        enableReflections: false, // ✅ LP pools don't use reflections
        reflectionToken: null,
      };

      const initPoolAccounts: any = {
        project: projectPDA,
        stakingVault: stakingVaultPDA,
        admin: publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: lpTokenProgramId,
        // Placeholder accounts for reflections (required by program)
        reflectionTokenMint: program.programId,
        reflectionTokenAccount: program.programId,
        associatedTokenProgram: program.programId,
        reflectionTokenProgram: program.programId,
      };

      const initPoolTx = await program.methods
        .initializePool(
          lpTokenMintPubkey,
          new anchor.BN(poolId),
          initParams
        )
        .accounts(initPoolAccounts)
        .rpc();
      console.log("✅ Pool initialized:", initPoolTx);

      // Transaction 4: Deposit Rewards (reward token, not LP token)
      setStatusMessage("Step 4/4: Depositing rewards...");
      console.log("💎 Transaction 4: Deposit Rewards");
      
      const depositRewardsTx = await program.methods
        .depositRewards(
          lpTokenMintPubkey,
          new anchor.BN(poolId),
          rewardAmountWithDecimals
        )
        .accounts({
          project: projectPDA,
          rewardVault: rewardVaultPDA,
          adminTokenAccount: userRewardTokenAccountPubkey,
          tokenMintAccount: rewardTokenMintPubkey,
          admin: publicKey,
          tokenProgram: rewardTokenProgramId,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log("✅ Rewards deposited:", depositRewardsTx);

      setStatusMessage("Finalizing LP pool...");
      console.log("✅ LP Pool finalized");

      // Save to database
      setStatusMessage("Saving LP pool information...");
      
      const poolData = {
        name: selectedLPToken.name + " LP",
        symbol: selectedLPToken.symbol,
        tokenMint: selectedLPToken.mint,
        logo: selectedLPToken.logoURI,
        apr: "0",
        apy: "0",
        type: "locked",
        lockPeriod: poolConfig.lockPeriod,
        duration: poolConfig.duration, 
        rewards: selectedRewardToken.symbol,
        poolId: poolId,
        transferTaxBps: 0, // LP tokens typically don't have transfer tax
        hasSelfReflections: false,
        hasExternalReflections: false,
        externalReflectionMint: null,
        reflectionTokenSymbol: null,
        reflectionVaultAddress: null,
        isInitialized: true,
        isPaused: false,
        paymentTxSignature: paymentSignature,
        createTxSignature: createProjectTx,
        initTxSignature: initPoolTx,
        creatorWallet: publicKey.toString(),
        projectPda: projectPDA.toString(),
        poolAddress: projectPDA.toString(),
        isLPPool: true, // ✅ Mark as LP pool
        rewardTokenMint: selectedRewardToken.mint,
        rewardTokenSymbol: selectedRewardToken.symbol,
        dexType: selectedDex,
        dexPoolAddress: selectedPoolAddress,
      };

      console.log("🔍 [SAVING LP POOL TO DB]:", poolData);

      const response = await fetch("/api/lp-pools/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(poolData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save LP pool to database");
      }

      const savedPool = await response.json();
      console.log("✅ LP Pool saved to database:", savedPool);

      // Show success modal
      setCreatedPoolId(savedPool.pool.id);
      setShowSuccessModal(true);
      setStatusMessage("");
      setLoading(false);

    } catch (error: any) {
      console.error("Error creating LP pool:", error);
      setStatusMessage("");
      setError(error.message || "Failed to create LP pool. Please try again.");
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <div className={`fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto ${showSuccessModal ? 'hidden' : ''}`}>
      <div className="bg-black/90 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/[0.05]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/[0.05] sticky top-0 bg-black/90 z-10">
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ background: 'linear-gradient(45deg, white, #fb57ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            <Plus className="w-6 h-6" style={{ color: '#fb57ff' }} />
            Create LP Staking Pool
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-4 p-6 border-b border-white/[0.1]">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-[#fb57ff]' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'text-white' : 'bg-gray-700'}`} style={step >= 1 ? { background: 'linear-gradient(45deg, black, #fb57ff)' } : {}}>
              {step > 1 ? <Check className="w-5 h-5" /> : '1'}
            </div>
            <span className="text-sm font-medium hidden md:block">Select LP</span>
          </div>
          <div className="w-12 h-0.5 bg-white/[0.1]" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-[#fb57ff]' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'text-white' : 'bg-gray-700'}`} style={step >= 2 ? { background: 'linear-gradient(45deg, black, #fb57ff)' } : {}}>
              {step > 2 ? <Check className="w-5 h-5" /> : '2'}
            </div>
            <span className="text-sm font-medium hidden md:block">Rewards</span>
          </div>
          <div className="w-12 h-0.5 bg-white/[0.1]" />
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-[#fb57ff]' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'text-white' : 'bg-gray-700'}`} style={step >= 3 ? { background: 'linear-gradient(45deg, black, #fb57ff)' } : {}}>
              {step > 3 ? <Check className="w-5 h-5" /> : '3'}
            </div>
            <span className="text-sm font-medium hidden md:block">Configure</span>
          </div>
          <div className="w-12 h-0.5 bg-white/[0.1]" />
          <div className={`flex items-center gap-2 ${step >= 4 ? 'text-[#fb57ff]' : 'text-gray-500'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 4 ? 'text-white' : 'bg-gray-700'}`} style={step >= 4 ? { background: 'linear-gradient(45deg, black, #fb57ff)' } : {}}>
              4
            </div>
            <span className="text-sm font-medium hidden md:block">Confirm</span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-300 mb-1">Error</p>
                <p className="text-sm text-red-200">{error}</p>
              </div>
              <button 
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Status Message */}
        {statusMessage && (
          <div className="mx-6 mt-4 p-3 bg-white/[0.02] border border-[#fb57ff]/30 rounded-lg">
            <div className="flex items-center gap-2 text-sm" style={{ color: '#fb57ff' }}>
              <Loader2 className="w-4 h-4 animate-spin" />
              {statusMessage}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Select LP Token */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-white/[0.02] border border-white/[0.1] rounded-lg p-4">
                <p className="text-gray-300 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Select your LP token that users will stake
                </p>
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#fb57ff' }} />
                </div>
              ) : (
                <div className="grid gap-3 max-h-96 overflow-y-auto">
                  {userTokens.map((token) => (
                    <button
                      key={token.mint}
                      onClick={() => {
                        setSelectedLPToken(token);
                        setError(null);
                        setStep(2);
                      }}
                      className="flex items-center gap-4 p-4 bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] rounded-lg transition-colors text-left"
                    >
                      {token.logoURI ? (
                        <img src={token.logoURI} alt={token.symbol} className="w-12 h-12 rounded-full" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
                          <span className="text-xl font-bold">{token.symbol?.[0] || "?"}</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="font-semibold text-white">{token.name || "Unknown"}</div>
                        <div className="text-sm text-gray-400">{token.symbol}</div>
                        <div className="text-xs text-gray-500 font-mono">{token.mint.slice(0, 8)}...{token.mint.slice(-4)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-medium">{token.balance.toLocaleString()}</div>
                        {token.price && token.balance > 0 && (
                          <div className="text-xs text-gray-400">${(token.balance * token.price).toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {!loading && userTokens.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                  <p>No tokens found in your wallet</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Reward Token + DEX Pool */}
          {step === 2 && selectedLPToken && (
            <div className="space-y-4">
              <div className="bg-white/[0.02] border border-white/[0.1] rounded-lg p-4">
                <p className="text-gray-300 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Select the token you'll deposit as rewards for LP stakers
                </p>
              </div>
              
              <div className="flex items-center gap-4 p-4 bg-white/[0.02] border border-[#fb57ff]/30 rounded-lg">
                <div className="text-sm text-gray-400">LP Token Selected:</div>
                <div className="font-semibold text-white">{selectedLPToken.symbol}</div>
              </div>

              {/* DEX Pool Detection */}
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 space-y-3 relative z-20">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300">
                    DEX Pool/Pair Selection *
                  </label>
                  {dexDetectionLoading && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs" style={{ color: '#fb57ff' }}>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Detecting pools across Raydium, Meteora, and Orca...
                      </div>
                      <p className="text-xs text-gray-500">
                        ⏱️ This may take up to 8 seconds. Devnet tokens typically won't have pools.
                      </p>
                    </div>
                  )}
                </div>

                {/* Detected Pools */}
                {!dexDetectionLoading && detectedPools.length > 0 && (
                  <div className="space-y-2">
                    {detectedPools.map((pool, index) => {
                      const dexInfo = getDexInfo(pool.dexType);
                      const support = isDexSupported(pool.dexType);
                      const isSelected = selectedDex === pool.dexType && selectedPoolAddress === pool.poolAddress;

                      return (
                        <button
                          key={index}
                          onClick={() => handleDexSelection(pool)}
                          className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                            isSelected
                              ? "border-[#fb57ff] bg-[#fb57ff]/10"
                              : "border-white/[0.1] bg-white/[0.02] hover:border-white/[0.2]"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{dexInfo.icon}</span>
                              <span className="text-white font-semibold text-sm">
                                {dexInfo.displayName}
                              </span>
                              {index === 0 && (
                                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                                  Highest Liquidity
                                </span>
                              )}
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-[#fb57ff]" />
                            )}
                          </div>
                          
                          {pool.liquidity && (
                            <div className="text-xs text-gray-400 mb-1">
                              Liquidity: ${pool.liquidity.toLocaleString()}
                            </div>
                          )}
                          
                          <div className="text-xs text-gray-500 font-mono break-all">
                            {pool.poolAddress}
                          </div>

                          {!support.supported && (
                            <div className="mt-2 text-xs text-yellow-400 bg-yellow-500/10 p-2 rounded">
                              ⚠️ {support.message}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Manual Pool Address Input */}
                {(showManualInput || detectedPools.length === 0) && !dexDetectionLoading && (
                  <div className="space-y-3 bg-white/[0.02] border border-yellow-500/20 rounded-lg p-4">
                    <p className="text-sm text-yellow-400 font-medium">
                      {detectedPools.length === 0 ? "No pools auto-detected. Please enter manually:" : "Or enter manually:"}
                    </p>
                    
                    <select
                      value={selectedDex || ""}
                      onChange={(e) => setSelectedDex(e.target.value as DexType)}
                      className="w-full p-3 bg-white/[0.02] border border-white/[0.1] rounded-lg text-white focus:outline-none transition-colors"
                      style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', color: '#fff' }}
                      onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(251, 87, 255, 0.5)'}
                      onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                    >
                      <option value="" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>Select DEX Type</option>
                      <option value="raydium" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>⚡ Raydium</option>
                      <option value="meteora" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>☄️ Meteora</option>
                      <option value="orca" style={{ backgroundColor: '#1a1a1a', color: '#fff' }}>🐋 Orca</option>
                    </select>

                    <input
                      type="text"
                      value={manualPoolAddress}
                      onChange={(e) => handleManualPoolAddressChange(e.target.value)}
                      className="w-full p-3 bg-white/[0.02] border border-white/[0.1] rounded-lg text-white font-mono text-sm focus:outline-none"
                      placeholder="Enter pool/pair address..."
                    />

                    {selectedDex && (
                      <p className="text-xs text-gray-400">
                        Find pools at:{" "}
                        <a
                          href={getDexInfo(selectedDex).url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-gray-300"
                          style={{ color: '#fb57ff' }}
                        >
                          {getDexInfo(selectedDex).url}
                        </a>
                      </p>
                    )}
                  </div>
                )}

                {!showManualInput && detectedPools.length > 0 && (
                  <button
                    onClick={() => setShowManualInput(true)}
                    className="text-sm hover:underline"
                    style={{ color: '#fb57ff' }}
                  >
                    + Enter pool address manually
                  </button>
                )}
              </div>

              {/* Reward Token Selection */}
              <div className="relative z-10">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#fb57ff' }} />
                </div>
              ) : (
                <div className="grid gap-3 max-h-96 overflow-y-auto">
                  {userTokens.map((token) => (
                    <button
                      key={token.mint}
                      onClick={() => {
                        setSelectedRewardToken(token);
                        setError(null);
                        // Validate DEX selection
                        if (!selectedDex || !selectedPoolAddress) {
                          setError("Please select a DEX pool or enter pool address manually");
                          return;
                        }
                        setStep(3);
                      }}
                      className="flex items-center gap-4 p-4 bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] rounded-lg transition-colors text-left"
                    >
                      {token.logoURI ? (
                        <img src={token.logoURI} alt={token.symbol} className="w-12 h-12 rounded-full" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
                          <span className="text-xl font-bold">{token.symbol?.[0] || "?"}</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="font-semibold text-white">{token.name || "Unknown"}</div>
                        <div className="text-sm text-gray-400">{token.symbol}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-medium">{token.balance.toLocaleString()}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setError(null);
                    setStep(1);
                    setDetectedPools([]);
                    setSelectedDex(null);
                    setSelectedPoolAddress("");
                    setManualPoolAddress("");
                    setShowManualInput(false);
                  }}
                  className="flex-1 px-6 py-3 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.05] rounded-lg font-semibold transition-colors"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Configure Pool */}
          {step === 3 && selectedLPToken && selectedRewardToken && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/[0.05] rounded-lg">
                {selectedLPToken.logoURI && (
                  <img src={selectedLPToken.logoURI} alt={selectedLPToken.symbol} className="w-16 h-16 rounded-full" />
                )}
                <div className="flex-1">
                  <div className="font-bold text-xl text-white">{selectedLPToken.name} LP Pool</div>
                  <div className="text-gray-400">Rewards: {selectedRewardToken.symbol}</div>
                </div>
              </div>

              <div className="bg-white/[0.02] border border-[#fb57ff]/30 rounded-lg p-4 space-y-2">
                <p className="text-sm" style={{ color: '#fb57ff' }}>
                  💡 APY is automatically calculated based on rewards you deposit
                </p>
                <p className="text-sm text-gray-300">
                  ⚠️ Make sure you have {poolConfig.rewardAmount} {selectedRewardToken.symbol} to deposit as rewards!
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Reward Amount ({selectedRewardToken.symbol})
                </label>
                <input
                  type="number"
                  value={poolConfig.rewardAmount}
                  onChange={(e) => setPoolConfig({ ...poolConfig, rewardAmount: e.target.value })}
                  className="w-full p-3 bg-white/[0.02] border border-white/[0.1] rounded-lg text-white focus:outline-none transition-colors"
                  placeholder="1000"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Pool Duration (days)</label>
                <input
                  type="number"
                  value={poolConfig.duration}
                  onChange={(e) => setPoolConfig({ ...poolConfig, duration: e.target.value })}
                  className="w-full p-3 bg-white/[0.02] border border-white/[0.1] rounded-lg text-white focus:outline-none transition-colors"
                  placeholder="90"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Minimum Lock Period (days)</label>
                <input
                  type="number"
                  value={poolConfig.lockPeriod}
                  onChange={(e) => {
                    const value = e.target.value;
                    const duration = parseInt(poolConfig.duration);
                    const lockPeriod = parseInt(value);
                    
                    if (lockPeriod > duration) {
                      setPoolConfig({ ...poolConfig, lockPeriod: poolConfig.duration });
                    } else {
                      setPoolConfig({ ...poolConfig, lockPeriod: value });
                    }
                  }}
                  className="w-full p-3 bg-white/[0.02] border border-white/[0.1] rounded-lg text-white focus:outline-none transition-colors"
                  placeholder="30"
                  min="0"
                  max={poolConfig.duration}
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setError(null);
                    setStep(2);
                  }}
                  className="flex-1 px-6 py-3 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.05] rounded-lg font-semibold transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    setError(null);
                    setStep(4);
                  }}
                  className="flex-1 px-6 py-3 rounded-lg font-semibold transition-all"
                  style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
                >
                  Continue to Payment
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Confirm & Pay */}
          {step === 4 && selectedLPToken && selectedRewardToken && (
            <div className="space-y-6">
              <div className="bg-white/[0.02] border border-white/[0.1] rounded-lg p-4">
                <p className="text-gray-300 text-sm font-semibold mb-2">
                  ⚠️ Pool Creation Fee: {(poolCreationFee / 1_000_000_000).toFixed(3)} SOL
                </p>
                <p className="text-gray-400 text-xs">You will sign 4 transactions</p>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-6 space-y-4">
                <div className="text-center mb-4">
                  <div className="text-3xl font-bold mb-2">{selectedLPToken.symbol} LP Pool</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="text-gray-400 text-sm">LP Token:</div>
                  <div className="text-white font-medium text-sm text-right">{selectedLPToken.symbol}</div>

                  <div className="text-gray-400 text-sm">Reward Token:</div>
                  <div className="text-white font-medium text-sm text-right">{selectedRewardToken.symbol}</div>

                  <div className="text-gray-400 text-sm">Reward Amount:</div>
                  <div className="text-white font-medium text-sm text-right">{parseFloat(poolConfig.rewardAmount).toLocaleString()} {selectedRewardToken.symbol}</div>

                  <div className="text-gray-400 text-sm">Pool Duration:</div>
                  <div className="text-white font-medium text-sm text-right">{poolConfig.duration} days</div>

                  <div className="text-gray-400 text-sm">Lock Period:</div>
                  <div className="text-white font-medium text-sm text-right">
                    {poolConfig.lockPeriod} days {parseInt(poolConfig.lockPeriod) === 0 ? "(Flexible)" : ""}
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setError(null);
                    setStep(3);
                  }}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.05] rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleCreateLPPool}
                  disabled={loading}
                  className="flex-1 px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating LP Pool...
                    </>
                  ) : (
                    <>Create LP Pool</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Success Modal */}
    {showSuccessModal && createdPoolId && (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
        <div className="bg-black border-2 border-[#fb57ff] rounded-2xl max-w-md w-full p-8">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-[#fb57ff]/20 border-2 border-[#fb57ff] rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-10 h-10" style={{ color: '#fb57ff' }} />
            </div>
            <h2 className="text-3xl font-bold mb-2" style={{ 
              background: 'linear-gradient(45deg, white, #fb57ff)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent' 
            }}>
              LP Pool Created! 🎉
            </h2>
            <p className="text-gray-400">Your LP staking pool is now live</p>
          </div>

          <div className="bg-white/[0.02] border border-[#fb57ff]/20 rounded-lg p-4 mb-6">
            <p className="text-sm font-semibold mb-3" style={{ color: '#fb57ff' }}>
              🔗 Share Your LP Pool
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/lp-pool/${createdPoolId}`}
                readOnly
                className="flex-1 px-3 py-2 bg-white/[0.05] border border-white/[0.1] rounded text-sm text-white font-mono"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${typeof window !== 'undefined' ? window.location.origin : ''}/lp-pool/${createdPoolId}`);
                  setUrlCopied(true);
                  setTimeout(() => setUrlCopied(false), 2000);
                }}
                className="px-4 py-2 bg-[#fb57ff]/20 hover:bg-[#fb57ff]/30 border border-[#fb57ff]/50 rounded transition-all text-sm font-semibold min-w-[70px]"
              >
                {urlCopied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                window.open(`/lp-pool/${createdPoolId}`, '_blank');
              }}
              className="w-full px-4 py-3 bg-white/[0.05] hover:bg-white/[0.08] border border-[#fb57ff]/30 rounded-lg font-semibold transition-all hover:border-[#fb57ff] text-white"
            >
              View LP Pool
            </button>
            <button
              onClick={() => {
                onSuccess();
                onClose();
              }}
              className="w-full px-4 py-3 rounded-lg font-semibold transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(45deg, #fb57ff, black)' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}