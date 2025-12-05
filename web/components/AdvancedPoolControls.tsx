"use client";
import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { 
  Play, 
  Pause, 
  Settings as SettingsIcon, 
  Unlock, 
  Users,
  Wallet,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Search
} from "lucide-react";
import UserWalletManager from "./UserWalletManager";
import { useAdminProgram } from "@/hooks/useAdminProgram";

interface Pool {
  id: string;
  poolId?: number;
  name: string;
  symbol: string;
  logo?: string;
  type: string;
  mintAddress?: string;
  tokenMint?: string;
  apr?: string;
  apy?: number | string;
  minStake?: number;
  maxStake?: number;
  lockPeriod?: number | string;
  rewards?: string;
  isInitialized?: boolean;
  isPaused?: boolean;
  depositsPaused?: boolean;
  withdrawalsPaused?: boolean;
  claimsPaused?: boolean;
  poolAddress?: string;
  platformFeePercent?: number;
  flatSolFee?: number;
  referralEnabled?: boolean;
  referralWallet?: string;
  referralSplitPercent?: number;
  isEmergencyUnlocked?: boolean;
  hasSelfReflections?: boolean;
  hasExternalReflections?: boolean;
  externalReflectionMint?: string;
  pairAddress?: string;
  hidden?: boolean;
  featured?: boolean;
  views?: number;
  createdAt?: string;
  transferTaxBps?: number;
}

export default function AdvancedPoolControls({ pool, onUpdate }: { pool: Pool; onUpdate: () => void }) {
  const { publicKey } = useWallet();
  const { getAuthHeaders } = useAdminAuth();
  const { connection } = useConnection();
  const {
    createProject,
    initializePool,
    depositRewards,
    setProjectReferrer,
    pauseDeposits,
    unpauseDeposits,
    pauseWithdrawals,
    unpauseWithdrawals,
    pauseClaims,
    unpauseClaims,
    pauseProject,
    unpauseProject,
    setFees,
    emergencyUnlock,
    claimUnclaimedTokens,
    getProjectInfo,
    getVaultInfo,
  } = useAdminProgram();
  
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [apy, setApy] = useState(
    pool?.apy ? (typeof pool.apy === 'string' ? parseFloat(pool.apy.replace('%', '')) : pool.apy) : 10
  );
  const [lockPeriod, setLockPeriod] = useState(
    pool?.lockPeriod ? (typeof pool.lockPeriod === 'string' ? parseInt(pool.lockPeriod) : pool.lockPeriod) : 0
  );
  const [minStake, setMinStake] = useState(pool?.minStake || 10);
  const [duration, setDuration] = useState(30);
  const [reflectionEnabled, setReflectionEnabled] = useState(false);
  const [reflectionType, setReflectionType] = useState<"self" | "external">("self");
  const [externalReflectionMint, setExternalReflectionMint] = useState("");
  const [maxStake, setMaxStake] = useState(pool?.maxStake || 10000);
  const [platformFee, setPlatformFee] = useState(pool?.platformFeePercent || 2);
  const [flatFee, setFlatFee] = useState(pool?.flatSolFee || 0.005);
  const [rewardAmount, setRewardAmount] = useState(1000);
  const [referralEnabled, setReferralEnabled] = useState(pool?.referralEnabled || false);
  const [referralWallet, setReferralWallet] = useState(pool?.referralWallet || "");
  const [referralSplit, setReferralSplit] = useState(pool?.referralSplitPercent || 50);
  const [vaultType, setVaultType] = useState<"staking" | "reward" | "reflection">("reward");
  const [claimAmount, setClaimAmount] = useState(1000);

  const tokenMint = pool?.tokenMint || pool?.mintAddress;
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [poolStatus, setPoolStatus] = useState<any>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<string | null>(null);
  const [checkingBalance, setCheckingBalance] = useState(false);
  const [rewardVaultBalance, setRewardVaultBalance] = useState<string | null>(null);
  const [checkingRewardVault, setCheckingRewardVault] = useState(false);
  const [vaultInfo, setVaultInfo] = useState<any>(null);
  const [loadingVaultInfo, setLoadingVaultInfo] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [txModal, setTxModal] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'pending';
    title: string;
    message: string;
    txSignature?: string;
  }>({
    show: false,
    type: 'pending',
    title: '',
    message: '',
  });

  const showMessage = (type: "success" | "error", message: string) => {
    if (type === "success") {
      setSuccessMsg(message);
      setTimeout(() => setSuccessMsg(null), 5000);
    } else {
      setErrorMsg(message);
      setTimeout(() => setErrorMsg(null), 7000);
    }
  };

  const showTxModal = (
    type: 'success' | 'error' | 'pending',
    title: string,
    message: string,
    txSignature?: string
  ) => {
    setTxModal({
      show: true,
      type,
      title,
      message,
      txSignature,
    });
  };

  const closeTxModal = async () => {
    const wasSuccess = txModal.type === 'success';
    
    setTxModal({
      show: false,
      type: 'pending',
      title: '',
      message: '',
    });
    
    if (wasSuccess) {
      setActiveModal(null);
      await checkPoolStatus();
      onUpdate();
    }
  };

  const syncPoolStatusToDB = async () => {
  if (!tokenMint || !pool?.id) {
    showMessage("error", "❌ Pool ID or token mint missing");
    return;
  }

  setSyncing(true);

  try {
    const info = await getProjectInfo(tokenMint, pool?.poolId ?? 0);
    
    const safeToNumber = (val: any) => {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      if (typeof val === 'object' && val.toNumber) return val.toNumber();
      if (typeof val === 'string') return parseFloat(val) || 0;
      return 0;
    };
    
    const apyBps = safeToNumber(info.rateBpsPerYear);
    const lockSeconds = safeToNumber(info.lockupSeconds);
    const isPausedValue = Boolean(info.isPaused);
    
    let reflectionTokenSymbol = null;
    let reflectionTokenDecimals = null;
    
    // ✅ FETCH REFLECTION TOKEN METADATA IF IT EXISTS
    if (info.reflectionToken && info.reflectionVault) {
      try {
        const reflectionMintPubkey = new PublicKey(info.reflectionToken.toString());
        const mintInfo = await connection.getParsedAccountInfo(reflectionMintPubkey);
        
        if (mintInfo.value && 'parsed' in mintInfo.value.data) {
          const parsedData = mintInfo.value.data.parsed;
          reflectionTokenDecimals = parsedData.info.decimals;
          
          // Try to get token symbol from metadata
          try {
            // Use Metaplex to get token metadata
            const metadataPDA = PublicKey.findProgramAddressSync(
              [
                Buffer.from('metadata'),
                new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s').toBuffer(),
                reflectionMintPubkey.toBuffer(),
              ],
              new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
            )[0];
            
            const metadataAccount = await connection.getAccountInfo(metadataPDA);
            if (metadataAccount) {
              // Parse metadata (simplified - you might need a proper parser)
              const metadata = metadataAccount.data;
              // This is a simplified extraction - proper metadata parsing would be better
              const symbolStart = 65; // Approximate offset for symbol in metadata
              const symbolBytes = metadata.slice(symbolStart, symbolStart + 10);
              const symbol = new TextDecoder().decode(symbolBytes).replace(/\0/g, '').trim();
              if (symbol) {
                reflectionTokenSymbol = symbol;
              }
            }
          } catch (metadataErr) {
            console.log('Could not fetch token metadata:', metadataErr);
          }
        }
      } catch (err) {
        console.error('Error fetching reflection token info:', err);
      }
    }
    
    const updateData = {
      id: pool.id,
      isInitialized: true,
      apy: (apyBps / 100),
      apr: (apyBps / 100).toString(),
      lockPeriod: Math.round(lockSeconds / 86400),
      isPaused: isPausedValue,
      hasExternalReflections: !!(info.reflectionToken && info.reflectionVault),
      externalReflectionMint: info.reflectionToken?.toString() || null,
      reflectionTokenAccount: info.reflectionVault?.toString() || null,
      reflectionTokenSymbol: reflectionTokenSymbol,
      reflectionTokenDecimals: reflectionTokenDecimals,
    };
    
    const response = await fetch(`/api/admin/pools`, {
      method: "PATCH",
      headers: { 
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(updateData)
    });
    
    if (!response.ok) {
      throw new Error(`Database update failed`);
    }
    
    showMessage("success", "✅ Status synced with reflection token details!");
    setTimeout(() => onUpdate(), 500);
    
  } catch (error: any) {
    showMessage("error", `❌ Sync failed: ${error.message}`);
  } finally {
    setSyncing(false);
  }
};

  const checkPoolStatus = async () => {
    setCheckingStatus(true);
    setPoolStatus(null);
    
    try {
      const mint = tokenMint || "6QJQ9BuwcvA7ELRY9zkJRoz1wEdR9mByTztezuAR1Ew3";
      
      const info = await getProjectInfo(mint, pool?.poolId ?? 0);
      
      const isActuallyInitialized = Boolean(info.isInitialized);
      
      console.log("🔍 Raw blockchain data:", {
        reflectionToken: info.reflectionToken?.toString() || "None",
        reflectionVault: info.reflectionVault?.toString() || "None",
        isInitialized: info.isInitialized,
        rateBpsPerYear: info.rateBpsPerYear?.toString(),
        lockupSeconds: info.lockupSeconds?.toString(),
        poolDurationSeconds: info.poolDurationSeconds?.toString(),
      });
      
      const safeToString = (val: any) => {
        if (!val) return "N/A";
        if (typeof val === 'object' && val.toString) return val.toString();
        return String(val);
      };
      
      const safeToNumber = (val: any) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        if (typeof val === 'object' && val.toNumber) return val.toNumber();
        if (typeof val === 'string') return parseFloat(val) || 0;
        return 0;
      };
      
      const apyBps = safeToNumber(info.rateBpsPerYear);
      const lockSeconds = safeToNumber(info.lockupSeconds);
      const durationSeconds = safeToNumber(info.poolDurationSeconds);
      const totalStaked = safeToString(info.totalStaked);
      const totalRewards = safeToString(info.totalRewardsDistributed);
      
      const depositsPaused = Boolean(info.depositsPaused);
      const withdrawalsPaused = Boolean(info.withdrawalsPaused);
      const claimsPaused = Boolean(info.claimsPaused);
      const isPaused = Boolean(info.isPaused);
      
      setPoolStatus({
        exists: true,
        admin: safeToString(info.admin),
        tokenMint: safeToString(info.tokenMint),
        apy: apyBps,
        apyPercent: (apyBps / 100).toFixed(2),
        rateMode: info.rateMode || 0,
        lockPeriod: lockSeconds,
        lockPeriodDays: (lockSeconds / 86400).toFixed(2),
        poolDuration: durationSeconds,
        poolDurationDays: (durationSeconds / 86400).toFixed(2),
        reflectionsEnabled: Boolean(info.reflectionToken || info.reflectionVault || info.enableReflections),
        totalStaked: totalStaked,
        totalRewards: totalRewards,
        referrer: info.referrer ? safeToString(info.referrer) : null,
        depositsPaused: depositsPaused,
        withdrawalsPaused: withdrawalsPaused,
        claimsPaused: claimsPaused,
        isPaused: isPaused,
        initialized: isActuallyInitialized
      });
      
      if (isActuallyInitialized) {
        showMessage("success", "✅ Pool is INITIALIZED and ready!");
      } else {
        showMessage("error", "❌ Pool account exists but is NOT initialized yet!");
      }
      
    } catch (error: any) {
      console.error("Pool status check error:", error);
      
      if (error.message?.includes("Account does not exist") || 
          error.message?.includes("Invalid account") ||
          error.message?.includes("could not find")) {
        setPoolStatus({
          exists: false,
          initialized: false,
          error: "Pool has not been initialized yet"
        });
        showMessage("error", "❌ Pool is NOT initialized. Please initialize it first.");
      } else {
        setPoolStatus({
          exists: false,
          initialized: false,
          error: error.message || "Unknown error occurred"
        });
        showMessage("error", `⚠️ Error: ${error.message}`);
      }
    } finally {
      setCheckingStatus(false);
    }
  };

  const checkStakingVaultInitialization = async () => {
    if (!tokenMint) {
      showMessage("error", "❌ No token mint set");
      return;
    }

    setCheckingStatus(true);
    
    try {
      const tokenMintPubkey = new PublicKey(tokenMint);
      const programId = new PublicKey("gLHaGJsZ6G7AXZxoDL9EsSWkRbKAWhFHi73gVfNXuzK");
      const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
      
      // Derive PDAs
      const [projectPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("project"), tokenMintPubkey.toBuffer()],
        programId
      );
      
      const [stakingVaultPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("staking_vault"), projectPDA.toBuffer()],
        programId
      );
      
      console.log("🔍 Checking Staking Vault Initialization...");
      console.log("Project PDA:", projectPDA.toString());
      console.log("Staking Vault PDA:", stakingVaultPDA.toString());
      
      // Check if account exists
      const accountInfo = await connection.getAccountInfo(stakingVaultPDA);
      
      if (!accountInfo) {
        showMessage("error", "❌ Staking vault does NOT exist. Need to run initialize_pool!");
        console.log("❌ Account does not exist on-chain");
        return;
      }
      
      console.log("✅ Account exists");
      console.log("   Owner:", accountInfo.owner.toString());
      console.log("   Data Length:", accountInfo.data.length);
      console.log("   Lamports:", accountInfo.lamports);
      
      // Check if it's owned by Token Program
      if (accountInfo.owner.toString() !== TOKEN_PROGRAM.toString()) {
        showMessage("error", `❌ Wrong owner! Expected Token Program, got: ${accountInfo.owner.toString()}`);
        console.log("❌ Account is not owned by Token Program");
        return;
      }
      
      // Check if it has correct size for token account (165 bytes)
      if (accountInfo.data.length !== 165) {
        showMessage("error", `❌ Wrong data size! Expected 165 bytes, got: ${accountInfo.data.length}`);
        console.log("❌ Account has wrong data length");
        return;
      }
      
      // Try to parse as token account
      try {
        const tokenAccount = await getAccount(connection, stakingVaultPDA);
        console.log("✅ Successfully parsed as token account");
        console.log("   Mint:", tokenAccount.mint.toString());
        console.log("   Owner:", tokenAccount.owner.toString());
        console.log("   Amount:", tokenAccount.amount.toString());
        
        showMessage("success", "✅ Staking vault IS properly initialized! You can stake now.");
        
      } catch (parseError) {
        showMessage("error", "❌ Account exists but can't be parsed as token account");
        console.log("❌ Parse error:", parseError);
      }
      
    } catch (error: any) {
      console.error("Check error:", error);
      showMessage("error", `❌ Error: ${error.message}`);
    } finally {
      setCheckingStatus(false);
    }
  };

  const debugRawAccountData = async () => {
    if (!tokenMint) {
      console.error("❌ No token mint");
      showMessage("error", "❌ No token mint set");
      return;
    }
    
    try {
      console.log("🔍 Fetching raw account data for:", tokenMint);
      
      const info = await getProjectInfo(tokenMint, pool?.poolId ?? 0);
      
      console.log("📦 FULL PROJECT INFO:", info);
      console.log("📊 KEY FIELDS:", {
        isInitialized: info.isInitialized,
        isActive: info.isActive,
        rateBpsPerYear: info.rateBpsPerYear?.toString(),
        lockupSeconds: info.lockupSeconds?.toString(),
        poolDurationSeconds: info.poolDurationSeconds?.toString(),
        admin: info.admin?.toString(),
        tokenMint: info.tokenMint?.toString(),
      });
      
      showMessage("success", "✅ Check browser console (F12) for raw data");
      
    } catch (error: any) {
      console.error("❌ Debug error:", error);
      showMessage("error", `❌ ${error.message}`);
    }
  };

    const debugVaultPDAs = async () => {
    if (!tokenMint) {
      console.error("❌ No token mint");
      showMessage("error", "❌ No token mint set");
      return;
    }
    
    try {
      console.log("🔍 TOKEN MINT:", tokenMint);
      console.log("🔢 POOL ID:", pool?.poolId ?? 0);
      
      // ✅ USE getVaultInfo() instead of manual derivation!
      const vaultInfo = await getVaultInfo(tokenMint, pool?.poolId ?? 0);
      
      console.log("\n📦 VAULT INFORMATION:");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      
      // Staking Vault
      console.log("\n💰 STAKING VAULT:");
      console.log("   Address:", vaultInfo.stakingVault.address);
      console.log("   Exists:", vaultInfo.stakingVault.exists ? "✅ YES" : "❌ NO");
      console.log("   Balance:", vaultInfo.stakingVault.balance.toLocaleString(), "tokens");
      
      // Reward Vault
      console.log("\n🎁 REWARD VAULT:");
      console.log("   Address:", vaultInfo.rewardVault.address);
      console.log("   Exists:", vaultInfo.rewardVault.exists ? "✅ YES" : "❌ NO");
      console.log("   Balance:", vaultInfo.rewardVault.balance.toLocaleString(), "tokens");
      
      // Reflection Vault
      console.log("\n✨ REFLECTION VAULT:");
      if (vaultInfo.reflectionVault.tokenMint) {
        console.log("   Token Account:", vaultInfo.reflectionVault.tokenAccount);
        console.log("   Token Mint:", vaultInfo.reflectionVault.tokenMint);
        console.log("   Exists:", vaultInfo.reflectionVault.exists ? "✅ YES" : "⚠️ NOT INITIALIZED");
        console.log("   Balance:", vaultInfo.reflectionVault.balance.toLocaleString(), "tokens");
        
        // ✅ Check actual on-chain balance
        try {
          const reflectionVaultPubkey = new PublicKey(vaultInfo.reflectionVault.tokenAccount);
          const accountInfo = await connection.getParsedAccountInfo(reflectionVaultPubkey);
          
          if (accountInfo.value) {
            console.log("   ✅ Account exists on-chain");
            console.log("   Owner:", accountInfo.value.owner.toString());
            console.log("   Lamports:", accountInfo.value.lamports);
            
            try {
              if ('parsed' in accountInfo.value.data) {
                const parsed = accountInfo.value.data.parsed.info;
                const tokenAmount = parsed.tokenAmount;
                const balance = tokenAmount.amount;
                const decimals = tokenAmount.decimals;
                const readableBalance = (Number(balance) / Math.pow(10, decimals)).toLocaleString();
                console.log("   💰 ACTUAL TOKEN BALANCE:", readableBalance, "tokens");
              } else {
                console.log("   ⚠️ Could not parse as token account: Not a parsed account");
              }
            } catch (tokenErr: any) {
              console.log("   ⚠️ Could not parse as token account:", tokenErr.message);
            }
          } else {
            console.log("   ❌ Account does NOT exist on-chain");
          }
        } catch (checkErr: any) {
          console.log("   ❌ Error checking account:", checkErr.message);
        }
      } else {
        console.log("   ❌ Not configured (reflections disabled)");
      }
      
      console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      
      if (publicKey) {
        console.log("\n📜 Your recent transactions:");
        try {
          const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 5 });
          signatures.forEach((sig, i) => {
            console.log(`   ${i + 1}. ${sig.signature.slice(0, 20)}... (${new Date(sig.blockTime! * 1000).toLocaleString()})`);
          });
        } catch (e) {
          console.log("   Could not fetch recent transactions");
        }
      }
      
      showMessage("success", "✅ Check browser console (F12) for complete vault info");
      
    } catch (error: any) {
      console.error("❌ Debug error:", error);
      showMessage("error", `❌ ${error.message}`);
    }
  };

  const loadVaultInfo = async () => {
    if (!tokenMint) {
      showMessage("error", "❌ Token mint not found");
      return;
    }

    setLoadingVaultInfo(true);
    try {
      const data = await getVaultInfo(tokenMint, pool?.poolId ?? 0);
      setVaultInfo(data);
      showMessage("success", "✅ Vault info loaded!");
    } catch (error: any) {
      console.error("Error loading vault info:", error);
      showMessage("error", `❌ Failed to load vault info: ${error.message}`);
    } finally {
      setLoadingVaultInfo(false);
    }
  };

  const checkTokenBalance = async () => {
    if (!publicKey || !tokenMint) {
      showMessage("error", "❌ Wallet or token mint missing");
      return;
    }
    
    setCheckingBalance(true);
    
    try {
      const tokenMintPubkey = new PublicKey(tokenMint);
      
      const associatedTokenAccount = await getAssociatedTokenAddress(
        tokenMintPubkey,
        publicKey
      );
      
      const accountInfo = await connection.getParsedAccountInfo(associatedTokenAccount);
      
      if (!accountInfo.value || !('parsed' in accountInfo.value.data)) {
        throw new Error("Could not parse token account");
      }
      
      const parsed = accountInfo.value.data.parsed.info;
      const tokenAmount = parsed.tokenAmount;
      
      const balance = tokenAmount.amount;
      const decimals = tokenAmount.decimals;
      const readableBalance = (Number(balance) / Math.pow(10, decimals)).toLocaleString();
      
      setTokenBalance(readableBalance);
      
      showMessage("success", `✅ Balance: ${readableBalance} tokens`);
      
    } catch (error: any) {
      console.error("Balance check error:", error);
      
      if (error.message?.includes("could not find")) {
        setTokenBalance("0");
        showMessage("error", "❌ No token account found. You need to mint tokens first!");
      } else {
        showMessage("error", `❌ Error: ${error.message}`);
      }
    } finally {
      setCheckingBalance(false);
    }
  };

  const checkRewardVaultBalance = async () => {
  if (!tokenMint) {
    showMessage("error", "❌ Token mint missing");
    return;
  }
  
  setCheckingRewardVault(true);
  
  try {
    // ✅ USE THE EXISTING getVaultInfo FUNCTION!
    const vaultInfo = await getVaultInfo(tokenMint, pool?.poolId ?? 0);
    
    const balance = vaultInfo.rewardVault.balance;
    const readableBalance = balance.toLocaleString();
    
    setRewardVaultBalance(readableBalance);
    
    showMessage("success", `✅ Reward Vault: ${readableBalance} tokens`);
    
  } catch (error: any) {
    console.error("Reward vault check error:", error);
    
    if (error.name === "TokenAccountNotFoundError" || error.message?.includes("could not find")) {
      setRewardVaultBalance("0");
      showMessage("error", "❌ Reward vault token account not found. Try depositing rewards first.");
    } else if (error.message?.includes("Invalid")) {
      showMessage("error", "❌ Invalid account. Make sure the pool is created.");
    } else {
      showMessage("error", `❌ Error: ${error.message}`);
    }
  } finally {
    setCheckingRewardVault(false);
  }
};

  const handleToggleDeposits = async () => {
    if (!publicKey || !tokenMint) {
      showMessage("error", "❌ Wallet or token mint missing");
      return;
    }
    setIsProcessing(true);
    try {
      const isPaused = pool?.depositsPaused;
      
      if (isPaused) {
        await unpauseDeposits(tokenMint, 0);
        showMessage("success", "✅ Deposits unpaused!");
      } else {
        await pauseDeposits(tokenMint, 0);
        showMessage("success", "✅ Deposits paused!");
      }
      await fetch(`/api/admin/pools`, {
        method: "PATCH",
        headers: { 
  "Content-Type": "application/json",
  ...getAuthHeaders(),
},        body: JSON.stringify({ id: pool?.id, depositsPaused: !isPaused }),
      });
      
      await checkPoolStatus();
      onUpdate();
    } catch (err: any) {
      console.error("Toggle deposits error:", err);
      showMessage("error", `❌ Failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleWithdrawals = async () => {
    if (!publicKey || !tokenMint) {
      showMessage("error", "❌ Wallet or token mint missing");
      return;
    }
    setIsProcessing(true);
    try {
      const isPaused = pool?.withdrawalsPaused;
      if (isPaused) {
        await unpauseWithdrawals(tokenMint);
        showMessage("success", "✅ Withdrawals unpaused!");
      } else {
        await pauseWithdrawals(tokenMint);
        showMessage("success", "✅ Withdrawals paused!");
      }
      await fetch(`/api/admin/pools`, {
        method: "PATCH",
        headers: { 
  "Content-Type": "application/json",
  ...getAuthHeaders(),
},        body: JSON.stringify({ id: pool?.id, withdrawalsPaused: !isPaused }),
      });
      await checkPoolStatus();
      onUpdate();
    } catch (err: any) {
      console.error("Toggle withdrawals error:", err);
      showMessage("error", `❌ Failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleClaims = async () => {
    if (!publicKey || !tokenMint) {
      showMessage("error", "❌ Wallet or token mint missing");
      return;
    }
    setIsProcessing(true);
    try {
      const isPaused = pool?.claimsPaused;
      if (isPaused) {
        await unpauseClaims(tokenMint);
        showMessage("success", "✅ Claims unpaused!");
      } else {
        await pauseClaims(tokenMint);
        showMessage("success", "✅ Claims paused!");
      }
      await fetch(`/api/admin/pools`, {
        method: "PATCH",
        headers: { 
  "Content-Type": "application/json",
  ...getAuthHeaders(),
},        body: JSON.stringify({ id: pool?.id, claimsPaused: !isPaused }),
      });
      await checkPoolStatus();
      onUpdate();
    } catch (err: any) {
      console.error("Toggle claims error:", err);
      showMessage("error", `❌ Failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleProject = async () => {
    if (!publicKey || !tokenMint) {
      showTxModal('error', 'Error', 'Wallet or token mint missing');
      return;
    }
    setIsProcessing(true);
    
    try {
      const isPaused = pool?.isPaused;
      const action = isPaused ? 'Unpausing' : 'Pausing';
      
      showTxModal('pending', `${action} Pool`, 'Please confirm the transaction in your wallet...');
      
      let txSignature;
      if (isPaused) {
        txSignature = await unpauseProject(tokenMint);
      } else {
        txSignature = await pauseProject(tokenMint);
      }
      
      await fetch(`/api/admin/pools`, {
        method: "PATCH",
        headers: { 
  "Content-Type": "application/json",
  ...getAuthHeaders(),
},        body: JSON.stringify({ id: pool?.id, isPaused: !isPaused }),
      });
      
      showTxModal('success', 'Pool Status Updated!', `Pool is now ${isPaused ? 'ACTIVE' : 'PAUSED'}`, txSignature);
      
    } catch (err: any) {
      console.error("Toggle project error:", err);
      showTxModal('error', 'Transaction Failed', err.message || 'Failed to toggle pool status');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClaimUnclaimed = async () => {
    if (!publicKey || !tokenMint) {
      showMessage("error", "❌ Wallet or token mint missing");
      return;
    }
    
    if (vaultType === "reflection") {
      if (!pool?.externalReflectionMint && !tokenMint) {
        showMessage("error", "❌ Reflection token mint not configured");
        return;
      }
    }
    
    setIsProcessing(true);
    try {
      console.log("🔍 Claiming:", {
        amount: claimAmount,
        amountLamports: claimAmount * 1_000_000_000
      });
      
      const txSig = await claimUnclaimedTokens(
        tokenMint,
        pool?.poolId ?? 0,
        vaultType,
        claimAmount * 1_000_000_000
      );
      
      console.log("✅ TX:", txSig);
      showMessage("success", `✅ Claimed ${claimAmount} tokens from ${vaultType} vault! TX: ${txSig.slice(0,8)}...`);
      setActiveModal(null);
      onUpdate();
    } catch (err: any) {
      console.error("Claim unclaimed error:", err);
      showMessage("error", `❌ Failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEmergencyUnlock = async () => {
    if (!publicKey || !tokenMint) {
      showMessage("error", "❌ Wallet or token mint missing");
      return;
    }
    setIsProcessing(true);
    try {
      await emergencyUnlock(tokenMint, pool?.poolId ?? 0);
      await fetch(`/api/admin/pools`, {
        method: "PATCH",
        headers: { 
  "Content-Type": "application/json",
  ...getAuthHeaders(),
},        body: JSON.stringify({ id: pool?.id, isEmergencyUnlocked: true, lockPeriod: 0 }),
      });
      showMessage("success", "✅ Pool emergency unlocked!");
      setActiveModal(null);
      onUpdate();
    } catch (err: any) {
      console.error("Emergency unlock error:", err);
      showMessage("error", `❌ Failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateProject = async () => {
    if (!publicKey || !tokenMint) {
      showMessage("error", "❌ Token mint address is required");
      return;
    }
    setIsProcessing(true);
    try {
      const result = await createProject(tokenMint, pool?.poolId ?? 0);
      showMessage("success", "✅ Project created!");
      await fetch(`/api/admin/pools`, {
        method: "PATCH",
        headers: { 
  "Content-Type": "application/json",
  ...getAuthHeaders(),
},        body: JSON.stringify({ id: pool?.id, projectCreated: true, projectPda: result.projectPda }),
      });
      onUpdate();
    } catch (err: any) {
      console.error("Create project error:", err);
      showMessage("error", `❌ Failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInitializePool = async () => {
    if (!publicKey || !tokenMint) {
      showMessage("error", "❌ Token mint address is required");
      return;
    }
    setIsProcessing(true);
    try {
      const txSignature = await initializePool({
        tokenMint: tokenMint,
        poolId: pool?.poolId ?? 0,
        rateBpsPerYear: apy * 100,
        rateMode: pool?.rateMode ?? (lockPeriod > 0 ? 0 : 1),  // ✅ Read from database, fallback to old logic
        lockupSeconds: lockPeriod * 86400,
        poolDurationSeconds: duration * 86400,
        referrer: referralEnabled ? referralWallet : null,
        referrerSplitBps: referralEnabled ? referralSplit * 100 : null,
        enableReflections: reflectionEnabled,
        reflectionToken: reflectionEnabled 
          ? (reflectionType === "external" ? externalReflectionMint : tokenMint)
          : null,
        poolTokenFeeBps: platformFee * 100,      // ✅ ADD THIS
        poolSolFee: flatFee * 1_000_000_000,     // ✅ ADD THIS
      });
      
      console.log("✅ Pool initialization transaction:", txSignature);
      
      showMessage("success", "✅ Transaction sent! Click 'Check Status' to verify initialization, then 'Sync to DB'");
      setActiveModal(null);
      
    } catch (err: any) {
      console.error("Initialize pool error:", err);
      showMessage("error", `❌ Failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDepositRewards = async () => {
    if (!publicKey || !tokenMint) {
      showMessage("error", "❌ Wallet or token mint missing");
      return;
    }
    
    if (rewardAmount <= 0) {
      showMessage("error", "❌ Please enter a valid amount");
      return;
    }
    
    setIsProcessing(true);
    let txSignature = "";
    
    try {
      // Fetch token decimals
      const tokenMintPubkey = new PublicKey(tokenMint);
      const mintInfo = await connection.getParsedAccountInfo(tokenMintPubkey);

      if (!mintInfo.value || !('parsed' in mintInfo.value.data)) {
        throw new Error("Could not fetch token mint info");
      }

      const decimals = mintInfo.value.data.parsed.info.decimals;
      const amountInLamports = rewardAmount * Math.pow(10, decimals);

      console.log(`💰 Depositing ${rewardAmount} tokens with ${decimals} decimals = ${amountInLamports} raw units`);
            
      showMessage("success", "📝 Sending transaction...");
      
      txSignature = await depositRewards(tokenMint, pool?.poolId ?? 0, amountInLamports);
      
      showMessage("success", `✅ Deposited ${rewardAmount.toLocaleString()} tokens! View TX: ${txSignature.slice(0, 8)}...`);
      
      setActiveModal(null);
      setRewardAmount(1000);
      
      try {
        onUpdate();
      } catch (updateErr) {
        console.error("onUpdate error (non-critical):", updateErr);
      }
      
    } catch (err: any) {
      console.error("Deposit rewards error:", err);
      
      if (txSignature) {
        showMessage("success", `✅ Transaction completed! TX: ${txSignature.slice(0, 8)}...`);
        setActiveModal(null);
        setRewardAmount(1000);
        try {
          onUpdate();
        } catch (e) {
          console.error("onUpdate error:", e);
        }
      } else {
        if (err.message?.includes("insufficient funds")) {
          showMessage("error", "❌ Insufficient token balance!");
        } else if (err.message?.includes("User rejected")) {
          showMessage("error", "❌ Transaction cancelled");
        } else {
          showMessage("error", `❌ Error: ${err.message}`);
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateFees = async () => {
    if (!publicKey) {
      showMessage("error", "❌ Wallet not connected");
      return;
    }
    setIsProcessing(true);
    try {
      await setFees(platformFee * 100, flatFee * 1_000_000_000);
      await fetch(`/api/admin/pools`, {
        method: "PATCH",
        headers: { 
  "Content-Type": "application/json",
  ...getAuthHeaders(),
},        body: JSON.stringify({ id: pool?.id, platformFeePercent: platformFee, flatSolFee: flatFee }),
      });
      showMessage("success", "✅ Fees updated!");
      setActiveModal(null);
      onUpdate();
    } catch (err: any) {
      console.error("Update fees error:", err);
      showMessage("error", `❌ Failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateReferral = async () => {
    if (!publicKey || !tokenMint) {
      showMessage("error", "❌ Wallet or token mint missing");
      return;
    }
    if (referralEnabled && !referralWallet) {
      showMessage("error", "❌ Please enter a referral wallet address");
      return;
    }
    setIsProcessing(true);
    try {
      if (referralEnabled) {
        await setProjectReferrer(tokenMint, pool?.poolId ?? 0, referralWallet, referralSplit * 100);
      } else {
        await setProjectReferrer(tokenMint, pool?.poolId ?? 0, null, 0);
      }
      await fetch(`/api/admin/pools`, {
        method: "PATCH",
        headers: { 
  "Content-Type": "application/json",
  ...getAuthHeaders(),
},        body: JSON.stringify({ 
          id: pool?.id,
          referralEnabled,
          referralWallet: referralEnabled ? referralWallet : null,
          referralSplitPercent: referralEnabled ? referralSplit : null
        }),
      });
      showMessage("success", "✅ Referral settings updated!");
      setActiveModal(null);
      onUpdate();
    } catch (err: any) {
      console.error("Update referral error:", err);
      showMessage("error", `❌ Failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {successMsg && (
        <div className="bg-green-500/20 border border-green-500/50 text-[#fb57ff] px-4 py-2 rounded-lg animate-pulse">{successMsg}</div>
      )}
      {errorMsg && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-2 rounded-lg animate-pulse">{errorMsg}</div>
      )}

      <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4 hover:bg-white/[0.04] transition-all">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-blue-300 flex items-center gap-2">
            <Search className="w-5 h-5" />
            Pool Status Checker
          </h3>
          <div className="flex gap-2">
            <button
              onClick={checkPoolStatus}
              disabled={checkingStatus || !publicKey}
              className="px-4 py-2 bg-[#fb57ff] text-white rounded-lg hover:bg-[#fb57ff]/90 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              {checkingStatus ? "Checking..." : "Check Status"}
            </button>
            
            <button
              onClick={checkStakingVaultInitialization}
              disabled={checkingStatus || !publicKey || !tokenMint}
              className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors text-sm"
              title="Check if staking vault is properly initialized"
            >
              🔧 Check Staking Vault
            </button>
            
            <button
              onClick={debugRawAccountData}
              disabled={!publicKey || !tokenMint}
              className="px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors text-sm"
              title="Debug: Show raw blockchain data in console"
            >
              🔍 Debug
            </button>
            
            <button
              onClick={debugVaultPDAs}
              disabled={!publicKey || !tokenMint}
              className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors text-sm"
              title="Debug: Show all vault PDAs"
            >
              🔍 Vaults
            </button>
            
            <button
              onClick={syncPoolStatusToDB}
              disabled={syncing || !publicKey || !poolStatus?.initialized}
              className="px-4 py-2 bg-[#fb57ff] text-white rounded-lg hover:bg-[#fb57ff]/90 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
              title="Sync blockchain status to database"
            >
              {syncing ? "Syncing..." : "Sync to DB"}
            </button>
          </div>
        </div>
        
        {poolStatus && (
          <div className="mt-3 p-4 bg-white/[0.03] rounded-lg border border-white/[0.05]">
            {poolStatus.initialized ? (
              <div className="space-y-2">
                <div className="text-green-400 font-bold text-lg mb-3 flex items-center gap-2">
                  ✅ Pool IS Initialized!
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-400">Admin:</span>
                    <div className="font-mono text-xs text-white mt-1">{poolStatus.admin.slice(0, 20)}...</div>
                  </div>
                  <div>
                    <span className="text-gray-400">APY:</span>
                    <div className="text-white mt-1">{poolStatus.apyPercent}%</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Lock Period:</span>
                    <div className="text-white mt-1">{poolStatus.lockPeriodDays} days</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Pool Duration:</span>
                    <div className="text-white mt-1">{poolStatus.poolDurationDays} days</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Reflections:</span>
                    <div className="text-white mt-1">{poolStatus.reflectionsEnabled ? "✅ Enabled" : "❌ Disabled"}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Total Staked:</span>
                    <div className="text-white mt-1">{poolStatus.totalStaked}</div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-400">Pool Status:</span>
                    <div className="text-white mt-1 text-lg font-semibold">
                      {poolStatus.isPaused ? "⏸️ Paused (All Operations)" : "✅ Active (All Operations)"}
                    </div>
                  </div>
                </div>
                <div className="mt-3 p-3 bg-green-900/20 border border-green-500/30 rounded text-[#fb57ff] text-sm">
                  <strong>✅ Next Step:</strong> Click "Sync to DB" button above to update database, then deposit rewards
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-red-400 font-bold text-lg mb-3 flex items-center gap-2">
                  ❌ Pool NOT Initialized
                </div>
                <div className="text-sm text-gray-300">
                  {poolStatus.error || "The pool account does not exist on-chain."}
                </div>
                <div className="mt-3 p-3 bg-red-900/20 border border-red-500/30 rounded text-red-300 text-sm">
                  <strong>⚠️ Action Required:</strong> Initialize the pool using the buttons below
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-[#fb57ff] flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Your Token Balance
          </h3>
          <button
            onClick={checkTokenBalance}
            disabled={checkingBalance || !publicKey}
            className="px-4 py-2 bg-[#fb57ff] text-white rounded-lg hover:bg-[#fb57ff]/90 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            {checkingBalance ? "Checking..." : "Check Balance"}
          </button>
        </div>
        
        {tokenBalance !== null && (
          <div className="mt-3 p-4 bg-white/[0.03] rounded-lg border border-white/[0.05]">
            <div className="text-center">
              <div className="text-3xl font-bold text-[#fb57ff] mb-2">
                {tokenBalance}
              </div>
              <div className="text-sm text-gray-400">
                Available Tokens
              </div>
              <div className="mt-3 text-xs text-gray-500 font-mono">
                {tokenMint?.slice(0, 20)}...
              </div>
              {tokenBalance === "0" && (
                <div className="mt-3 p-3 bg-yellow-900/20 border border-[#fb57ff]/20 rounded text-[#fb57ff] text-sm">
                  <strong>⚠️ No tokens!</strong> You need to mint tokens to your wallet first.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-[#fb57ff] flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Reward Vault Balance
          </h3>
          <button
            onClick={checkRewardVaultBalance}
            disabled={checkingRewardVault || !tokenMint}
            className="px-4 py-2 bg-[#fb57ff] text-white rounded-lg hover:bg-[#fb57ff]/90 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            {checkingRewardVault ? "Checking..." : "Check Vault"}
          </button>
        </div>
        
        {rewardVaultBalance !== null && (
          <div className="mt-3 p-4 bg-white/[0.03] rounded-lg border border-white/[0.05]">
            <div className="text-center">
              <div className="text-3xl font-bold text-[#fb57ff] mb-2">
                {rewardVaultBalance}
              </div>
              <div className="text-sm text-gray-400">
                Tokens in Reward Vault
              </div>
              {rewardVaultBalance === "0" && (
                <div className="mt-3 p-3 bg-yellow-900/20 border border-[#fb57ff]/20 rounded text-[#fb57ff] text-sm">
                  <strong>⚠️ Vault is empty!</strong> Deposit rewards using the "Add Rewards" button below.
                </div>
              )}
              {parseFloat(rewardVaultBalance.replace(/,/g, '')) > 0 && (
                <div className="mt-3 p-3 bg-green-900/20 border border-green-500/30 rounded text-[#fb57ff] text-sm">
                  <strong>✅ Vault funded!</strong> Users can now earn rewards when they stake.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* VAULT INFORMATION DISPLAY */}
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-[#fb57ff] flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Vault Information
          </h3>
          <div className="flex gap-2">
            <button
              onClick={loadVaultInfo}
              disabled={loadingVaultInfo || !tokenMint}
              className="px-4 py-2 bg-[#fb57ff] text-white rounded-lg hover:bg-[#fb57ff]/90 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              {loadingVaultInfo ? "Loading..." : "🔄 Load Vaults"}
            </button>
            <button
              onClick={async () => {
                try {
                  if (!tokenMint || !publicKey) {
                    alert("Connect wallet and select token first");
                    return;
                  }

                  // Get project info and vault info
                  const projectInfo = await getProjectInfo(tokenMint, pool?.poolId ?? 0);
                  const vaultInfoData = await getVaultInfo(tokenMint, pool?.poolId ?? 0);
                  
                  const totalStaked = projectInfo.totalStaked || 0;
                  const storedPerToken = projectInfo.reflectionPerTokenStored || 0;
                  const vaultBalance = vaultInfoData.reflectionVault.balance;
                  
                  const calculatedPerToken = totalStaked > 0 
                    ? Math.floor((vaultBalance * 1_000_000_000) / totalStaked)
                    : 0;
                  
                  const message = `
🔍 REFLECTION DEBUG:
━━━━━━━━━━━━━━━━━━━━━━━━━━
Vault Balance: ${vaultBalance} tokens
Total Staked: ${totalStaked} tokens
━━━━━━━━━━━━━━━━━━━━━━━━━━
OLD Stored Per Token: ${storedPerToken}
NEW Calculated Per Token: ${calculatedPerToken}
━━━━━━━━━━━━━━━━━━━━━━━━━━
${calculatedPerToken > storedPerToken 
  ? '✅ WILL UPDATE (new > old)' 
  : '❌ WON\'T UPDATE (new <= old)\n\nThis is why reflections show 0!\nThe contract rejects updates when\nnew value is lower than stored value.'}
                  `.trim();
                  
                  console.log(message);
                  alert(message);
                  
                } catch (error: any) {
                  console.error("Debug error:", error);
                  alert(`Error: ${error.message}`);
                }
              }}
              disabled={!tokenMint || !publicKey}
              className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors text-sm"
            >
              🔍 Debug Reflection Math
            </button>
          </div>
        </div>
        
        {loadingVaultInfo && (
          <div className="mt-3 p-4 bg-white/[0.03] rounded-lg border border-white/[0.05]">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-700 rounded"></div>
            </div>
          </div>
        )}
        
        {vaultInfo && !loadingVaultInfo && (
          <div className="mt-3 space-y-3">
            {/* Staking Vault */}
            <div className="p-4 bg-white/[0.03] rounded-lg border border-[#fb57ff]/20">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[#fb57ff] font-bold">Staking Vault</h4>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  vaultInfo.stakingVault.exists 
                    ? "bg-green-900 text-[#fb57ff]" 
                    : "bg-red-900 text-red-300"
                }`}>
                  {vaultInfo.stakingVault.exists ? "✓ Active" : "✗ Not Init"}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Address:</span>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-gray-300">
                      {vaultInfo.stakingVault.address.slice(0, 8)}...{vaultInfo.stakingVault.address.slice(-8)}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(vaultInfo.stakingVault.address);
                        showMessage("success", "📋 Copied!");
                      }}
                      className="p-1 hover:bg-gray-700 rounded text-xs"
                    >
                      📋
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                  <span className="text-gray-400">Balance:</span>
                  <span className="text-lg font-bold text-white">
                    {vaultInfo.stakingVault.balance.toLocaleString()} tokens
                  </span>
                </div>
                <a
                  href={`https://explorer.solana.com/address/${vaultInfo.stakingVault.address}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#fb57ff] hover:text-blue-300 mt-2"
                >
                  View on Explorer ↗
                </a>
              </div>
            </div>

            {/* Reward Vault */}
            <div className="p-4 bg-white/[0.03] rounded-lg border border-[#fb57ff]/20">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[#fb57ff] font-bold">Reward Vault</h4>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  vaultInfo.rewardVault.exists 
                    ? "bg-green-900 text-[#fb57ff]" 
                    : "bg-red-900 text-red-300"
                }`}>
                  {vaultInfo.rewardVault.exists ? "✓ Active" : "✗ Not Init"}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Address:</span>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-gray-300">
                      {vaultInfo.rewardVault.address.slice(0, 8)}...{vaultInfo.rewardVault.address.slice(-8)}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(vaultInfo.rewardVault.address);
                        showMessage("success", "📋 Copied!");
                      }}
                      className="p-1 hover:bg-gray-700 rounded text-xs"
                    >
                      📋
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                  <span className="text-gray-400">Balance:</span>
                  <span className="text-lg font-bold text-white">
                    {vaultInfo.rewardVault.balance.toLocaleString()} tokens
                  </span>
                </div>
                <a
                  href={`https://explorer.solana.com/address/${vaultInfo.rewardVault.address}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#fb57ff] hover:text-[#fb57ff] mt-2"
                >
                  View on Explorer ↗
                </a>
              </div>
            </div>

            {/* Reflection Vault */}
            <div className="p-4 bg-white/[0.03] rounded-lg border border-[#fb57ff]/20">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[#fb57ff] font-bold">Reflection Vault</h4>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  vaultInfo.reflectionVault.exists 
                    ? "bg-green-900 text-[#fb57ff]"
                    : vaultInfo.reflectionVault.tokenMint
                    ? "bg-yellow-900 text-[#fb57ff]"
                    : "bg-gray-700 text-gray-400"
                }`}>
                  {vaultInfo.reflectionVault.exists 
                    ? "✓ Active"
                    : vaultInfo.reflectionVault.tokenMint
                    ? "⚠ Configured"
                    : "Not Configured"}
                </span>
              </div>
              {vaultInfo.reflectionVault.tokenMint ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Address:</span>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-gray-300">
                        {vaultInfo.reflectionVault.tokenAccount.slice(0, 8)}...{vaultInfo.reflectionVault.tokenAccount.slice(-8)}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(vaultInfo.reflectionVault.tokenAccount);
                          showMessage("success", "📋 Copied!");
                        }}
                        className="p-1 hover:bg-gray-700 rounded text-xs"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Token Mint:</span>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-gray-300">
                        {vaultInfo.reflectionVault.tokenMint.slice(0, 8)}...{vaultInfo.reflectionVault.tokenMint.slice(-8)}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(vaultInfo.reflectionVault.tokenMint);
                          showMessage("success", "📋 Copied!");
                        }}
                        className="p-1 hover:bg-gray-700 rounded text-xs"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                  
                  {/* ✅ IMPROVED BALANCE DISPLAY WITH DECIMALS & SYMBOL */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                    <span className="text-gray-400">Balance:</span>
                    <div className="text-right">
                      <div className="text-lg font-bold text-[#fb57ff]">
                        {vaultInfo.reflectionVault.balance.toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: vaultInfo.reflectionVault.decimals || 9,
                        })}
                        {vaultInfo.reflectionVault.symbol && (
                          <span className="text-sm ml-1">{vaultInfo.reflectionVault.symbol}</span>
                        )}
                      </div>
                      {vaultInfo.reflectionVault.decimals && (
                        <div className="text-xs text-gray-500 mt-1">
                          ({vaultInfo.reflectionVault.decimals} decimals)
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {vaultInfo.reflectionVault.exists && (
                   <a 
                      href={`https://explorer.solana.com/address/${vaultInfo.reflectionVault.tokenAccount}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[#fb57ff] hover:text-[#fb57ff] mt-2"
                    >
                      View on Explorer ↗
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  This pool does not have reflection rewards configured.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* FORCE RE-INIT BANNER - Shows when pool is initialized but may have vault issues */}
      {pool?.isInitialized && (
        <div className="bg-orange-900/30 border-2 border-orange-500/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-orange-300 mb-1 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                🔧 Staking Vault Issue?
              </h4>
              <p className="text-sm text-gray-400">
                If you're getting "AccountNotInitialized" errors, click to re-run initialization with fixed vault accounts.
              </p>
            </div>
            <button
              onClick={async () => {
                if (!publicKey || !tokenMint) {
                  showMessage("error", "❌ Wallet or token mint missing");
                  return;
                }
                
                const confirmed = window.confirm(
                  "⚠️ Re-initialize pool with FIXED vault accounts?\n\n" +
                  "This will properly create the staking vault.\n\n" +
                  "APY: " + apy + "%\n" +
                  "Lock: " + lockPeriod + " days\n" +
                  "Duration: " + duration + " days\n\n" +
                  "Continue?"
                );
                
                if (!confirmed) return;
                
                setIsProcessing(true);
                showTxModal('pending', 'Re-Initializing Pool', 'Fixing staking vault initialization...');
                
                try {
                  const tx = await initializePool({
                    tokenMint: tokenMint,
                    rateBpsPerYear: apy * 100,
                    rateMode: lockPeriod > 0 ? 0 : 1,
                    lockupSeconds: lockPeriod * 86400,
                    poolDurationSeconds: duration * 86400,
                    referrer: referralEnabled ? referralWallet : null,
                    referrerSplitBps: referralEnabled ? referralSplit * 100 : null,
                    enableReflections: reflectionEnabled,
                    reflectionToken: reflectionEnabled 
                      ? (reflectionType === "external" ? externalReflectionMint : tokenMint)
                      : null,
                  });
                  
                  showTxModal('success', 'Pool Re-Initialized!', 'Click "🔧 Check Staking Vault" to verify, then try staking again', tx);
                  setTimeout(() => {
                    checkPoolStatus();
                    checkStakingVaultInitialization();
                  }, 2000);
                  
                } catch (err: any) {
                  console.error("Re-init error:", err);
                  
                  if (err.message?.includes("already in use") || err.message?.includes("already initialized")) {
                    showTxModal('error', 'Already Initialized', 'Pool may already be properly initialized. Click "🔧 Check Staking Vault" to verify.');
                  } else {
                    showTxModal('error', 'Re-initialization Failed', err.message);
                  }
                } finally {
                  setIsProcessing(false);
                }
              }}
              disabled={isProcessing}
              className="px-6 py-3 bg-[#fb57ff] hover:bg-[#fb57ff]/90 rounded-lg font-semibold disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              🔧 Fix Vault Init
            </button>
          </div>
        </div>
      )}

      <div className="bg-white/[0.04] rounded-lg p-4 text-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <span className="text-gray-400">Status:</span>
            <span className="ml-2 font-semibold">
              {pool?.isInitialized ? (pool?.isPaused ? "⏸️ Paused" : "✅ Active") : "⚠️ Not Initialized"}
            </span>
          </div>
          <div>
            <span className="text-gray-400">APY:</span>
            <span className="ml-2 font-semibold">{pool?.apy || apy}%</span>
          </div>
          <div>
            <span className="text-gray-400">Lock:</span>
            <span className="ml-2 font-semibold">{pool?.lockPeriod || lockPeriod} days</span>
          </div>
          <div>
            <span className="text-gray-400">Token:</span>
            <span className="ml-2 font-semibold text-xs">
              {tokenMint ? `${tokenMint.slice(0, 4)}...${tokenMint.slice(-4)}` : "Not Set"}
            </span>
          </div>
        </div>
        {!tokenMint && (
          <div className="mt-2 bg-yellow-500/20 border border-yellow-500/50 rounded p-2 text-[#fb57ff] text-xs">
            ⚠️ Warning: No token mint address set.
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {!pool?.isInitialized && (
          <>
            <button
              onClick={handleCreateProject}
              disabled={isProcessing}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-[#fb57ff] hover:bg-[#fb57ff]/90 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              1. Create Project
            </button>
            <button
              onClick={() => setActiveModal("initialize")}
              disabled={isProcessing}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-[#fb57ff] hover:bg-[#fb57ff]/90 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              2. Init Pool
            </button>
          </>
        )}

        <button
          onClick={handleToggleProject}
          disabled={isProcessing}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm transition-colors disabled:opacity-50 ${
            pool?.isPaused ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {pool?.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          {pool?.isPaused ? "Unpause" : "Pause"} All
        </button>

        <button
          onClick={() => setActiveModal("depositRewards")}
          disabled={isProcessing}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          <DollarSign className="w-4 h-4" />
          Add Rewards
        </button>

        <button
          onClick={() => setActiveModal("fees")}
          disabled={isProcessing}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-[#fb57ff] hover:bg-[#fb57ff]/90 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          <SettingsIcon className="w-4 h-4" />
          Fees
        </button>

        <button
          onClick={() => setActiveModal("referral")}
          disabled={isProcessing}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-[#fb57ff] hover:bg-[#fb57ff]/90 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          <Users className="w-4 h-4" />
          Referral
        </button>
        
        <button
          onClick={() => setActiveModal("unlock")}
          disabled={isProcessing || pool?.isEmergencyUnlocked}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm transition-colors disabled:opacity-50 ${
            pool?.isEmergencyUnlocked ? "bg-gray-600 cursor-not-allowed" : "bg-[#fb57ff] hover:bg-[#fb57ff]/90"
          }`}
        >
          <Unlock className="w-4 h-4" />
          Unlock
        </button>

        <button
          onClick={() => setActiveModal("claimUnclaimed")}
          disabled={isProcessing}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          <Wallet className="w-4 h-4" />
          Claim Unclaimed
        </button>
      </div>

{activeModal && (
  <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 p-4">
    <div className="bg-white/[0.03] p-6 rounded-xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
      
     {activeModal === "initialize" && (
  <>
    <h2 className="text-xl font-bold mb-4">🚀 Step 2: Initialize Pool</h2>
    <div className="bg-blue-500/10 border border-[#fb57ff]/20 rounded p-3 mb-4">
      <p className="text-blue-300 text-xs">
        ℹ️ After clicking Initialize, use "Check Status" to verify, then "Sync to DB"
      </p>
    </div>
    <div className="bg-yellow-500/10 border border-[#fb57ff]/20 rounded p-3 mb-4">
      <p className="text-[#fb57ff] text-xs">
        ⚠️ Min/Max stake are UI-only validations.
      </p>
    </div>
    <div className="space-y-3 mb-6">
      <div>
        <label className="block text-sm text-gray-400 mb-1">APY (%)</label>
        <input
          type="number"
          step="0.1"
          value={apy}
          onChange={(e) => setApy(Number(e.target.value))}
          className="w-full p-2 rounded bg-white/[0.02] text-white border border-gray-700"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">Lock Period (days)</label>
        <input
          type="number"
          value={lockPeriod}
          onChange={(e) => setLockPeriod(Number(e.target.value))}
          className="w-full p-2 rounded bg-white/[0.02] text-white border border-gray-700"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">Duration (days)</label>
        <input
          type="number"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-full p-2 rounded bg-white/[0.02] text-white border border-gray-700"
        />
      </div>

      {/* ✅ NEW: Pool Fee Settings */}
      <div className="border-t border-white/[0.05] pt-3 mt-3">
        <h3 className="text-sm font-semibold text-[#fb57ff] mb-2">💰 Pool Fee Settings</h3>
        <p className="text-xs text-gray-400 mb-3">These fees apply only to this pool</p>
        <div className="space-y-2">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Token Fee (%)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="10"
              value={platformFee}
              onChange={(e) => setPlatformFee(Number(e.target.value))}
              className="w-full p-2 rounded bg-white/[0.02] text-white border border-gray-700"
            />
            <p className="text-xs text-gray-500 mt-1">Applied to deposits and withdrawals</p>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">SOL Fee (per transaction)</label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={flatFee}
              onChange={(e) => setFlatFee(Number(e.target.value))}
              className="w-full p-2 rounded bg-white/[0.02] text-white border border-gray-700"
            />
            <p className="text-xs text-gray-500 mt-1">Applied to all operations</p>
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.05] pt-3">
        <p className="text-xs text-gray-400 mb-2">UI Validation Only:</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Min</label>
            <input
              type="number"
              value={minStake}
              onChange={(e) => setMinStake(Number(e.target.value))}
              className="w-full p-2 rounded bg-white/[0.02] text-white border border-gray-700"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Max</label>
            <input
              type="number"
              value={maxStake}
              onChange={(e) => setMaxStake(Number(e.target.value))}
              className="w-full p-2 rounded bg-white/[0.02] text-white border border-gray-700"
            />
          </div>
        </div>
      </div>
      <div className="border-t border-white/[0.05] pt-3">
        <label className="flex items-center gap-2 cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={referralEnabled}
            onChange={(e) => setReferralEnabled(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">Enable Referral</span>
        </label>
        {referralEnabled && (
          <div className="space-y-2">
            <input
              type="text"
              value={referralWallet}
              onChange={(e) => setReferralWallet(e.target.value)}
              placeholder="Referrer wallet"
              className="w-full p-2 rounded bg-white/[0.02] text-white border border-gray-700 text-xs"
            />
            <input
              type="number"
              value={referralSplit}
              onChange={(e) => setReferralSplit(Number(e.target.value))}
              placeholder="Split %"
              className="w-full p-2 rounded bg-white/[0.02] text-white border border-gray-700"
            />
          </div>
        )}
      </div>
      <div className="border-t border-white/[0.05] pt-3">
        <label className="flex items-center gap-2 cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={reflectionEnabled}
            onChange={(e) => setReflectionEnabled(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm">Enable Reflections</span>
        </label>
        {reflectionEnabled && (
          <div className="space-y-2">
            <select
              value={reflectionType}
              onChange={(e) => setReflectionType(e.target.value as "self" | "external")}
              className="w-full p-2 rounded bg-white/[0.02] text-white border border-gray-700 text-sm"
            >
              <option value="self">Self</option>
              <option value="external">External</option>
            </select>
            {reflectionType === "external" && (
              <input
                type="text"
                value={externalReflectionMint}
                onChange={(e) => setExternalReflectionMint(e.target.value)}
                placeholder="Token mint"
                className="w-full p-2 rounded bg-white/[0.02] text-white border border-gray-700 text-xs"
              />
            )}
          </div>
        )}
      </div>
    </div>
    <div className="flex gap-3">
      <button
        onClick={handleInitializePool}
        disabled={isProcessing}
        className="flex-1 px-4 py-2 bg-[#fb57ff] hover:bg-[#fb57ff]/90 rounded disabled:opacity-50"
      >
        {isProcessing ? "⏳ Initializing..." : "Initialize"}
      </button>
      <button
        onClick={() => setActiveModal(null)}
        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
      >
        Cancel
      </button>
    </div>
  </>
)}

      {activeModal === "depositRewards" && (
        <>
          <h2 className="text-xl font-bold mb-4">💰 Deposit Rewards</h2>
          {isProcessing && (
            <div className="mb-4 p-3 bg-white/[0.02] border border-white/[0.05] rounded text-gray-300 text-sm">
              ⏳ Processing transaction... Please wait and check your wallet.
            </div>
          )}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Amount (tokens)</label>
              <input
                type="number"
                value={rewardAmount}
                onChange={(e) => setRewardAmount(Number(e.target.value))}
                disabled={isProcessing}
                className="w-full p-2 rounded bg-white/[0.02] text-white border border-gray-700 disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 mt-1">
                Will deposit: {(rewardAmount * 1_000_000_000).toLocaleString()} lamports
              </p>
            </div>
            {tokenBalance && (
              <div className="p-3 bg-green-900/20 border border-green-500/30 rounded text-[#fb57ff] text-sm">
                💰 Your balance: {tokenBalance} tokens
              </div>
            )}
            {pool?.transferTaxBps > 0 && (
              <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded text-yellow-300 text-sm">
                ⚠️ This token has a {(pool.transferTaxBps / 100).toFixed(1)}% transfer tax.
                Depositing {rewardAmount} will result in ~{(rewardAmount * (1 - pool.transferTaxBps / 10000)).toFixed(4)} tokens in the vault.
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDepositRewards}
              disabled={isProcessing || rewardAmount <= 0}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? "⏳ Processing..." : "💰 Deposit"}
            </button>
            <button 
              onClick={() => {
                setActiveModal(null);
                setRewardAmount(1000);
              }}
              disabled={isProcessing}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {activeModal === "fees" && (
        <>
          <h2 className="text-xl font-bold mb-4">💰 Fee Settings</h2>
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Token Fee (%)</label>
              <input
                type="number"
                step="0.1"
                value={platformFee}
                onChange={(e) => setPlatformFee(Number(e.target.value))}
                className="w-full p-2 rounded bg-white/[0.02] text-white border border-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Flat SOL Fee</label>
              <input
                type="number"
                step="0.001"
                value={flatFee}
                onChange={(e) => setFlatFee(Number(e.target.value))}
                className="w-full p-2 rounded bg-white/[0.02] text-white border border-gray-700"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleUpdateFees}
              disabled={isProcessing}
              className="flex-1 px-4 py-2 bg-[#fb57ff] hover:bg-[#fb57ff]/90 rounded disabled:opacity-50"
            >
              {isProcessing ? "⏳ Updating..." : "Update"}
            </button>
            <button onClick={() => setActiveModal(null)} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded">
              Cancel
            </button>
          </div>
        </>
      )}

      {activeModal === "referral" && (
        <>
          <h2 className="text-xl font-bold mb-4">👥 Referral Settings</h2>
          <div className="space-y-4 mb-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={referralEnabled}
                onChange={(e) => setReferralEnabled(e.target.checked)}
                className="w-5 h-5"
              />
              <span>Enable Referral</span>
            </label>
            {referralEnabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Wallet</label>
                  <input
                    type="text"
                    value={referralWallet}
                    onChange={(e) => setReferralWallet(e.target.value)}
                    className="w-full p-2 rounded bg-white/[0.02] text-white border border-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Split (%)</label>
                  <input
                    type="number"
                    value={referralSplit}
                    onChange={(e) => setReferralSplit(Number(e.target.value))}
                    className="w-full p-2 rounded bg-white/[0.02] text-white border border-gray-700"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleUpdateReferral}
              disabled={isProcessing}
              className="flex-1 px-4 py-2 bg-[#fb57ff] hover:bg-[#fb57ff]/90 rounded disabled:opacity-50"
            >
              {isProcessing ? "⏳ Updating..." : "Update"}
            </button>
            <button onClick={() => setActiveModal(null)} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded">
              Cancel
            </button>
          </div>
        </>
      )}

      {activeModal === "unlock" && (
        <>
          <h2 className="text-xl font-bold mb-4">🔓 Emergency Unlock</h2>
          <p className="text-gray-300 mb-6">Remove all time locks.</p>
          <div className="flex gap-3">
            <button
              onClick={handleEmergencyUnlock}
              disabled={isProcessing}
              className="flex-1 px-4 py-2 bg-[#fb57ff] hover:bg-[#fb57ff]/90 rounded disabled:opacity-50"
            >
              {isProcessing ? "⏳ Unlocking..." : "Unlock"}
            </button>
            <button onClick={() => setActiveModal(null)} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded">
              Cancel
            </button>
          </div>
        </>
      )}

      {activeModal === "claimUnclaimed" && (
        <>
          <h2 className="text-xl font-bold mb-4">💰 Claim Unclaimed</h2>
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Vault</label>
              <select
                value={vaultType}
                onChange={(e) => setVaultType(e.target.value as any)}
                className="w-full p-2 rounded bg-white/[0.02] text-white border border-gray-700"
              >
                <option value="staking">Staking</option>
                <option value="reward">Reward</option>
                <option value="reflection">Reflection</option>
              </select>
            </div>
            {vaultType === "reflection" && (
              <div className="bg-blue-500/10 border border-[#fb57ff]/20 rounded p-3">
                <p className="text-blue-300 text-xs">
                  ℹ️ Reflection vault: {pool?.externalReflectionMint ? "External token" : "Self token"}
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Amount</label>
              <input
                type="number"
                value={claimAmount}
                onChange={(e) => setClaimAmount(Number(e.target.value))}
                className="w-full p-2 rounded bg-white/[0.02] text-white border border-gray-700"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClaimUnclaimed}
              disabled={isProcessing}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
            >
              {isProcessing ? "⏳ Claiming..." : "Claim"}
            </button>
            <button onClick={() => setActiveModal(null)} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded">
              Cancel
            </button>
          </div>
        </>
      )}

    </div>
  </div>
)}

{txModal.show && (
  <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-[60] p-4">
    <div className="bg-white/[0.03] p-6 rounded-xl shadow-2xl w-full max-w-md border-2 border-white/[0.05]">
      {txModal.type === 'pending' && (
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h3 className="text-xl font-bold text-[#fb57ff] mb-2">{txModal.title}</h3>
          <p className="text-gray-300">{txModal.message}</p>
        </div>
      )}

      {txModal.type === 'success' && (
        <div className="text-center">
          <div className="bg-green-500/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-green-400 mb-2">{txModal.title}</h3>
          <p className="text-gray-300 mb-4">{txModal.message}</p>
          
          {txModal.txSignature && (
            <div className="bg-white/[0.02] p-3 rounded-lg mb-4">
              <p className="text-xs text-gray-400 mb-1">Transaction Signature:</p>
              <p className="text-xs font-mono text-[#fb57ff] break-all">{txModal.txSignature}</p>
              <a
                href={`https://explorer.solana.com/tx/${txModal.txSignature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#fb57ff] hover:text-blue-300 text-xs underline mt-2 inline-block"
              >
                View on Solana Explorer →
              </a>
            </div>
          )}
          
          <button
            onClick={closeTxModal}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      )}

      {txModal.type === 'error' && (
        <div className="text-center">
          <div className="bg-red-500/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-red-400 mb-2">{txModal.title}</h3>
          <p className="text-gray-300 mb-4">{txModal.message}</p>
          
          <button
            onClick={closeTxModal}
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </div>
  </div>
)}
</div>
);
}