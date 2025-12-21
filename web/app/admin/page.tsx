"use client";

import { confirmTransactionPolling } from "@/lib/confirmTransaction";
import { useState, useEffect, useMemo } from "react";
import { useWallet, useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { isAdmin } from "@/lib/adminAuth";
import AdvancedPoolControls from "@/components/AdvancedPoolControls";
import { useToast } from "@/components/ToastContainer";
import { getProgram, getPDAs } from "@/lib/anchor-program";
import { useAdminProgram } from "@/hooks/useAdminProgram";
import { useAdminAuth } from "@/hooks/useAdminAuth"; // ✅ ADD THIS
import SEOManager from "@/components/SEOManager";
import { authFetch } from "@/lib/authFetch";
import PopUpAdManager from "@/components/admin/PopUpAdManager";
import TelegramBotControl from "@/components/TelegramBotControl";
import {
  ChevronDown,
  ChevronUp,
  Search,
  Plus,
  BarChart3,
  Settings,
  Eye,
  Calendar,
  TrendingUp,
  Pause,
  Play,
  CheckSquare,
  Square,
  ShieldAlert,
  Lock,
  Zap,
  Globe,
  ArrowDownUp,
  Droplet,
  DollarSign,
  Activity,
  Users,
  Wallet,
  RefreshCw,
  Sparkles,
  X,
  KeyRound,
  Loader2
} from "lucide-react";

interface FeaturedToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  order: number;
  enabled: boolean;
}

export default function AdminPage() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { showSuccess, showError } = useToast();
  const { updateFeeCollector } = useAdminProgram();

  // ✅ ADD: Use the admin auth hook for signature verification
  const { 
    isAuthenticated, 
    isLoading: authLoading, 
    error: authError, 
    login, 
    logout 
  } = useAdminAuth();

  const userIsAdmin = connected && publicKey ? isAdmin(publicKey.toString()) : false;

  // Platform state
  const [platformInitialized, setPlatformInitialized] = useState<boolean | null>(null);
  const [showInitModal, setShowInitModal] = useState(false);
  const [initForm, setInitForm] = useState({
    platformTokenFeeBps: "250", // 2.5%
    platformSolFee: "1000000", // 0.001 SOL in lamports
    feeCollector: "",
  });
  const [showFeeCollectorModal, setShowFeeCollectorModal] = useState(false);
  const [newFeeCollector, setNewFeeCollector] = useState("");
  const [tokenMintForFeeCollector, setTokenMintForFeeCollector] = useState("");
  const [creatingTokenAccount, setCreatingTokenAccount] = useState(false);
  const [showPoolFeeModal, setShowPoolFeeModal] = useState(false);
  const [poolCreationFee, setPoolCreationFee] = useState("0.01");
  const [savingPoolFee, setSavingPoolFee] = useState(false);

  // ✅ Swap Configuration State
  const [swapConfig, setSwapConfig] = useState({
    swapEnabled: true,
    platformFeePercentage: 1.0,
    maxSlippage: 50,
    priorityFee: 0.0001
  });
  const [savingSwapConfig, setSavingSwapConfig] = useState(false);

  // ✅ Featured Tokens State
  const [featuredTokens, setFeaturedTokens] = useState<FeaturedToken[]>([]);
  const [allTokens, setAllTokens] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddTokenModal, setShowAddTokenModal] = useState(false);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [savingFeaturedTokens, setSavingFeaturedTokens] = useState(false);

  // Helper function to safely format numbers
  const formatNumber = (value: number | undefined | null): string => {
    return (value || 0).toLocaleString();
  };

  const [form, setForm] = useState({
    // Basic token info
    name: "",
    symbol: "",
    logo: "",
    mintAddress: "",
    pairAddress: "",
    poolId: 0,
    
    // Rate configuration
    rateMode: 0 as 0 | 1,  // 0 = Fixed APY, 1 = Variable/Dynamic
    
    // Fixed APY mode fields
    fixedApyPercent: "15",  // e.g., "15" for 15% APY
    
    // Variable mode fields
    rewardAmount: "1000",
    poolDuration: "90",  // days
    
    // Common fields
    lockPeriod: "0",  // days, "0" for unlocked/flexible
    type: "unlocked",
    
    // Display fields (legacy)
    apr: "",
    apy: "",
    rewards: "",
    
    // Reflections
    hasSelfReflections: false,
    hasExternalReflections: false,
    externalReflectionMint: "",
    
    // Transfer tax
    transferTaxPercent: "0",
  });

  const [pools, setPools] = useState<any[]>([]);
  const [editingPool, setEditingPool] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [poolSearchQuery, setPoolSearchQuery] = useState("");
  const [expandedPools, setExpandedPools] = useState<Set<string>>(new Set());

  const [activeTab, setActiveTab] = useState<"dashboard" | "pools" | "create" | "seo" | "swap" | "popups" | "telegram">("dashboard");

  const [selectedPools, setSelectedPools] = useState<Set<string>>(new Set());

  // ✅ Login state for button
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // ✅ Handle admin login with signature
  const handleAdminLogin = async () => {
    setIsLoggingIn(true);
    try {
      const success = await login();
      if (success) {
        showSuccess("✅ Admin authentication successful!");
      } else {
        showError("❌ Authentication failed. Please try again.");
      }
    } catch (error: any) {
      showError(`❌ ${error.message || "Authentication failed"}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // ✅ Handle logout
  const handleLogout = () => {
    logout();
    showSuccess("🔓 Logged out successfully");
  };

  // ✅ Load Swap Configuration
  const loadSwapConfig = async () => {
    try {
      const res = await authFetch("/api/admin/config");
      if (res.ok) {
        const data = await res.json();
        setSwapConfig({
          swapEnabled: data.swapEnabled ?? true,
          platformFeePercentage: data.platformFeePercentage ?? 1.0,
          maxSlippage: data.maxSlippage ?? 50,
          priorityFee: data.priorityFee ?? 0.0001
        });
      }
    } catch (error) {
      console.error("Failed to load swap config:", error);
    }
  };

  // ✅ Save Swap Configuration
  const handleSaveSwapConfig = async () => {
  setSavingSwapConfig(true);
  try {
    // ✅ CONVERT PERCENTAGES TO BASIS POINTS (BPS)
    const platformFeeBps = Math.floor(swapConfig.platformFeePercentage * 100); // 1% → 100 BPS
    const maxSlippageBps = Math.floor(swapConfig.maxSlippage * 100); // 50% → 5000 BPS
    
    console.log('💾 Saving swap config:', {
      display: {
        platformFeePercentage: swapConfig.platformFeePercentage + '%',
        maxSlippage: swapConfig.maxSlippage + '%',
      },
      saved: {
        platformFeeBps: platformFeeBps + ' BPS',
        maxSlippageBps: maxSlippageBps + ' BPS',
      }
    });
    
    const res = await authFetch("/api/swap/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        swapEnabled: swapConfig.swapEnabled,
        platformFeeBps: platformFeeBps,
        maxSlippageBps: maxSlippageBps,
        treasuryWallet: "Hc1Wk7NDPNjxT5qaSaPEJzMEtUhE3ZqXe2yQB6TQpbFb", // Your treasury wallet
      }),
    });

    if (!res.ok) throw new Error("Failed to save swap config");

    showSuccess("✅ Swap configuration saved successfully!");
    loadSwapConfig();
  } catch (error: any) {
    showError(`❌ ${error.message || "Failed to save swap config"}`);
  } finally {
    setSavingSwapConfig(false);
  }
  };

  // Load Pool Creation Fee
  const loadPoolCreationFee = async () => {
    try {
      const res = await authFetch("/api/admin/pool-fee");
      if (res.ok) {
        const data = await res.json();
        setPoolCreationFee((data.feeInLamports / 1_000_000_000).toString());
      }
    } catch (error) {
      console.error("Failed to load pool creation fee:", error);
    }
  };

  // Save Pool Creation Fee
  const handleSavePoolCreationFee = async () => {
    setSavingPoolFee(true);
    try {
      const feeInLamports = Math.floor(parseFloat(poolCreationFee) * 1_000_000_000);
      
      if (feeInLamports < 0) {
        throw new Error("Fee must be positive");
      }
      
      const res = await authFetch("/api/admin/pool-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feeInLamports }),
      });

      if (!res.ok) throw new Error("Failed to save pool creation fee");

      showSuccess("✅ Pool creation fee updated successfully!");
      setShowPoolFeeModal(false);
      loadPoolCreationFee();
    } catch (error: any) {
      showError(`❌ ${error.message || "Failed to save pool creation fee"}`);
    } finally {
      setSavingPoolFee(false);
    }
  };

  const loadFeaturedTokens = async () => {
    setLoadingTokens(true);
    try {
      const configRes = await authFetch("/api/admin/featured-tokens");
      if (configRes.ok) {
        const data = await configRes.json();
        setFeaturedTokens(data.featuredTokens || []);
      }

      // Use your API route
      console.log("Loading tokens from API...");
      const tokensRes = await authFetch("/api/swap/tokens");

      if (!tokensRes.ok) {
        throw new Error("Failed to fetch tokens");
      }

      const tokens = await tokensRes.json();
      console.log(`✅ Loaded ${tokens.length} tokens`);

      setAllTokens(Array.isArray(tokens) ? tokens : []);

    } catch (error) {
      console.error("Failed to load tokens:", error);
      setAllTokens([]);
    } finally {
      setLoadingTokens(false);
    }
  };

  const searchTokens = async (query: string) => {
    if (!query) {
      setAllTokens([]);
      return;
    }

    setLoadingTokens(true);
    try {
      const res = await authFetch(`/api/swap/tokens?q=${encodeURIComponent(query)}`);
      const tokens = await res.json();
      setAllTokens(Array.isArray(tokens) ? tokens : []);
    } catch (error) {
      console.error("Search error:", error);
      setAllTokens([]);
    } finally {
      setLoadingTokens(false);
    }
  };
  // ✅ Save Featured Tokens
  const handleSaveFeaturedTokens = async () => {
    setSavingFeaturedTokens(true);
    try {
      const response = await authFetch("/api/admin/featured-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featuredTokens }),
      });

      if (!response.ok) throw new Error("Failed to save");

      showSuccess("✅ Featured tokens saved successfully!");
    } catch (error) {
      showError("❌ Failed to save featured tokens");
    } finally {
      setSavingFeaturedTokens(false);
    }
  };

  // ✅ Add Token to Featured List
  const addToken = (token: any) => {
    const newFeaturedToken: FeaturedToken = {
      address: token.id,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      logoURI: token.icon,
      order: featuredTokens.length,
      enabled: true,
    };
    setFeaturedTokens([...featuredTokens, newFeaturedToken]);
    setShowAddTokenModal(false);
    setSearchQuery("");
  };

  // ✅ Remove Token
  const removeToken = (address: string) => {
    setFeaturedTokens(
      featuredTokens
        .filter((t) => t.address !== address)
        .map((t, idx) => ({ ...t, order: idx }))
    );
  };

  // ✅ Toggle Token Enabled Status
  const toggleToken = (address: string) => {
    setFeaturedTokens(
      featuredTokens.map((t) =>
        t.address === address ? { ...t, enabled: !t.enabled } : t
      )
    );
  };

  // ✅ Move Token Up
  const moveTokenUp = (index: number) => {
    if (index === 0) return;
    const newTokens = [...featuredTokens];
    [newTokens[index - 1], newTokens[index]] = [
      newTokens[index],
      newTokens[index - 1],
    ];
    setFeaturedTokens(newTokens.map((t, idx) => ({ ...t, order: idx })));
  };

  // ✅ Move Token Down
  const moveTokenDown = (index: number) => {
    if (index === featuredTokens.length - 1) return;
    const newTokens = [...featuredTokens];
    [newTokens[index], newTokens[index + 1]] = [
      newTokens[index + 1],
      newTokens[index],
    ];
    setFeaturedTokens(newTokens.map((t, idx) => ({ ...t, order: idx })));
  };

  // ✅ Filter tokens for search
  const filteredTokens = allTokens.filter(
    (token) =>
      (token.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        token.id?.toLowerCase().includes(searchQuery.toLowerCase())) &&
      !featuredTokens.some((ft) => ft.address === token.id)
  );

  // ✅ Load swap data on mount
  useEffect(() => {
    if (userIsAdmin && isAuthenticated && activeTab === "swap") {
      loadSwapConfig();
      loadFeaturedTokens();
    }
  }, [userIsAdmin, isAuthenticated, activeTab]);

  // Load pool creation fee on mount
  useEffect(() => {
    if (userIsAdmin && isAuthenticated) {
      loadPoolCreationFee();
    }
  }, [userIsAdmin, isAuthenticated]);

  // ✅ FIXED: Check if platform is initialized - ONCE on mount only
  useEffect(() => {
    let isMounted = true;

    const checkPlatformInit = async () => {
      if (!wallet || !connection) return;

      // Prevent running if already checked
      if (platformInitialized !== null) return;

      try {
        console.log("🔍 Checking platform initialization (ONCE)...");
        const program = getProgram(wallet, connection);
        const [platformPDA] = getPDAs.platformConfig();
        console.log("Checking platform at:", platformPDA.toString());

        // Fetch the platform account
        const platformAccount = await program.account.platform.fetch(platformPDA);
        console.log("Platform account data:", platformAccount);
        console.log("Is initialized:", platformAccount.isInitialized);

        // Platform exists and is initialized
        if (isMounted) {
          setPlatformInitialized(true);
        }
      } catch (error: any) {
        console.log("Platform check error:", error.message);
        console.log("Platform not found - needs initialization");
        if (isMounted) {
          setPlatformInitialized(false);
        }
      }
    };

    if (userIsAdmin && isAuthenticated && wallet && platformInitialized === null) {
      checkPlatformInit();
    }

    return () => {
      isMounted = false;
    };
  }, [userIsAdmin, isAuthenticated, wallet]);

  useEffect(() => {
    if (userIsAdmin && isAuthenticated && publicKey) {
      showSuccess(`Welcome, Admin! (${publicKey.toString().slice(0, 8)}...)`);
    }
  }, [userIsAdmin, isAuthenticated, publicKey]);

  // ✅ Load pools when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      refreshPoolsData();
    }
  }, [isAuthenticated]);

  // Define refreshPools function before it's used
  const refreshPoolsData = async () => {
    try {
      const res = await authFetch("/api/admin/pools");
      const data = await res.json();

      // If there are expanded pools, collapse them first
      const currentExpanded = Array.from(expandedPools);
      if (currentExpanded.length > 0) {
        setExpandedPools(new Set());
      }

      // Update pools data
      setPools(data);

      // Re-expand after state has settled
      if (currentExpanded.length > 0) {
        setTimeout(() => {
          setExpandedPools(new Set(currentExpanded));
        }, 150);
      }
    } catch (error) {
      console.error("Failed to fetch pools:", error);
    }
  };

  // ✅ useMemo hooks must be before any returns
  const stats = useMemo(() => {
    const total = pools.length;
    const active = pools.filter(p => !p.isPaused && !p.hidden).length;
    const paused = pools.filter(p => p.isPaused).length;
    const hidden = pools.filter(p => p.hidden).length;
    const featured = pools.filter(p => p.featured).length;
    const initialized = pools.filter(p => p.isInitialized).length;
    const totalViews = pools.reduce((sum, p) => sum + (p.views || 0), 0);

    return { total, active, paused, hidden, featured, initialized, totalViews };
  }, [pools]);

  const filteredPools = useMemo(() => {
    if (!poolSearchQuery) return pools;

    const query = poolSearchQuery.toLowerCase();
    return pools.filter(pool =>
      pool.name.toLowerCase().includes(query) ||
      pool.symbol.toLowerCase().includes(query) ||
      pool.id.toLowerCase().includes(query)
    );
  }, [pools, poolSearchQuery]);

  // Initialize Platform
  const handleInitializePlatform = async () => {
    if (!wallet || !publicKey || !initForm.feeCollector) {
      showError("❌ Please fill in all required fields");
      return;
    }

    try {
      const program = getProgram(wallet, connection);
      const [platformPDA] = getPDAs.platformConfig();

      const feeCollectorPubkey = new PublicKey(initForm.feeCollector);
      const platformTokenFeeBps = parseInt(initForm.platformTokenFeeBps);
      const platformSolFee = parseInt(initForm.platformSolFee);

      console.log("Initializing with:", {
        platformPDA: platformPDA.toString(),
        platformTokenFeeBps,
        platformSolFee,
        feeCollector: feeCollectorPubkey.toString(),
        admin: publicKey.toString()
      });

      const tx = await program.methods
        .initialize(
          new anchor.BN(platformTokenFeeBps),
          new anchor.BN(platformSolFee)
        )
        .accounts({
          platform: platformPDA,
          feeCollector: feeCollectorPubkey,
          admin: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      showSuccess(`✅ Platform initialized! TX: ${tx.slice(0, 8)}...`);
      setPlatformInitialized(true);
      setShowInitModal(false);
      setInitForm({
        platformTokenFeeBps: "250",
        platformSolFee: "1000000",
        feeCollector: "",
      });
    } catch (error: any) {
      console.error("Initialize platform error:", error);
      showError(`❌ ${error.message || "Failed to initialize platform"}`);
    }
  };

  // Update Fee Collector
  const handleUpdateFeeCollector = async () => {
    if (!newFeeCollector) {
      showError("❌ Please enter a valid fee collector address");
      return;
    }

    try {
      console.log("🔄 Updating fee collector to:", newFeeCollector);
      const tx = await updateFeeCollector(newFeeCollector);
      showSuccess(`✅ Fee collector updated! TX: ${tx.slice(0, 8)}...`);
      setShowFeeCollectorModal(false);
      setNewFeeCollector("");
    } catch (error: any) {
      console.error("Update fee collector error:", error);
      showError(`❌ ${error.message || "Failed to update fee collector"}`);
    }
  };

  // Create Token Account for Fee Collector
  const handleCreateTokenAccount = async () => {
    if (!publicKey || !wallet) {
      showError("❌ Please connect your wallet");
      return;
    }
    if (!tokenMintForFeeCollector) {
      showError("❌ Please enter token mint address");
      return;
    }

    setCreatingTokenAccount(true);
    try {
      const tokenMint = new PublicKey(tokenMintForFeeCollector);
      const feeCollector = new PublicKey("66oZ17EyWhmRXPYpuVpoojvmaz3AZWAaewekTWqJFhfB");

      const ata = await getAssociatedTokenAddress(tokenMint, feeCollector);
      console.log("🔍 Token Account Address:", ata.toString());

      const accountInfo = await connection.getAccountInfo(ata);
      if (accountInfo) {
        showSuccess("✅ Token account already exists!");
        setCreatingTokenAccount(false);
        return;
      }

      console.log("⚙️ Creating token account...");
      const ix = createAssociatedTokenAccountInstruction(publicKey, ata, feeCollector, tokenMint);
      const tx = new Transaction().add(ix);

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("finalized");
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const signed = await wallet.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 3
      });

      console.log("📤 Transaction sent:", sig);

      await confirmTransactionPolling(connection, sig);

      showSuccess(`✅ Token account created! TX: ${sig.slice(0, 8)}...`);
      console.log("✅ Full signature:", sig);
      console.log("✅ Token Account:", ata.toString());
    } catch (error: any) {
      console.error("Error:", error);
      if (error.message?.includes("already been processed")) {
        showSuccess("✅ Token account created successfully!");
      } else {
        showError(`❌ ${error.message || "Failed to create token account"}`);
      }
    } finally {
      setCreatingTokenAccount(false);
    }
  };

  // ============================================================
  // 🛡️ SECURITY GATE 1: Wallet not connected
  // ============================================================
  if (!connected || !publicKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-6">
        <div className="max-w-md w-full bg-gray-800/50 border-2 border-red-500/50 rounded-2xl p-8 text-center">
          <Lock className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">Admin Access Required</h1>
          <p className="text-gray-400 mb-6">
            Please connect your wallet to access the admin panel
          </p>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-yellow-300 text-sm">
              ⚠️ Only authorized wallets can access this area
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // 🛡️ SECURITY GATE 2: Wallet not in admin list
  // ============================================================
  if (!userIsAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-6">
        <div className="max-w-md w-full bg-gray-800/50 border-2 border-red-500/50 rounded-2xl p-8 text-center">
          <ShieldAlert className="w-16 h-16 text-red-400 mx-auto mb-4 animate-pulse" />
          <h1 className="text-3xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400 mb-6">
            Your wallet is not authorized to access the admin panel
          </p>

          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 mb-6">
            <p className="text-xs text-gray-500 mb-1">Connected Wallet:</p>
            <p className="text-gray-300 font-mono text-sm break-all">
              {publicKey.toString()}
            </p>
          </div>

          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <p className="text-red-300 text-sm font-semibold mb-2">
              🚫 Unauthorized Access
            </p>
            <p className="text-red-400 text-xs">
              This incident has been logged. If you believe this is an error, please contact the administrator.
            </p>
          </div>

          <button
            onClick={() => window.location.href = "/"}
            className="mt-6 w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-all"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // 🛡️ SECURITY GATE 3: Admin wallet but not authenticated (signature required)
  // ============================================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-6">
        <div className="max-w-md w-full bg-gray-800/50 border-2 border-blue-500/50 rounded-2xl p-8 text-center">
          <KeyRound className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">Verify Ownership</h1>
          <p className="text-gray-400 mb-6">
            Sign a transaction to prove you own this admin wallet
          </p>

          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 mb-6">
            <p className="text-xs text-gray-500 mb-1">Admin Wallet:</p>
            <p className="text-green-400 font-mono text-sm break-all">
              {publicKey.toString()}
            </p>
          </div>

          {authError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <p className="text-red-400 text-sm">{authError}</p>
            </div>
          )}

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
            <p className="text-blue-300 text-sm">
              🔐 This verification creates a signed transaction (not broadcast) to prove wallet ownership. 
              Your wallet will prompt you to sign.
            </p>
          </div>

          <button
            onClick={handleAdminLogin}
            disabled={isLoggingIn || authLoading}
            className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoggingIn || authLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <KeyRound className="w-5 h-5" />
                Verify & Access Admin
              </>
            )}
          </button>

          <button
            onClick={() => window.location.href = "/"}
            className="mt-4 w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-all"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // ✅ AUTHENTICATED ADMIN - Show admin panel
  // ============================================================

  const refreshPools = refreshPoolsData;

  const toggleExpand = (poolId: string) => {
    setExpandedPools(prev => {
      const newSet = new Set(prev);
      if (newSet.has(poolId)) {
        newSet.delete(poolId);
      } else {
        newSet.add(poolId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedPools(new Set(filteredPools.map(p => p.id)));
  };

  const collapseAll = () => {
    setExpandedPools(new Set());
  };

  const toggleSelectPool = (poolId: string) => {
    setSelectedPools(prev => {
      const newSet = new Set(prev);
      if (newSet.has(poolId)) {
        newSet.delete(poolId);
      } else {
        newSet.add(poolId);
      }
      return newSet;
    });
  };

  const selectAllFiltered = () => {
    setSelectedPools(new Set(filteredPools.map(p => p.id)));
  };

  const deselectAll = () => {
    setSelectedPools(new Set());
  };

  const bulkHide = async () => {
    const promises = Array.from(selectedPools).map(id =>
      authFetch(`/api/admin/pools/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: true }),
      })
    );

    try {
      await Promise.all(promises);
      showSuccess(`✅ Hidden ${selectedPools.size} pools`);
      refreshPools();
      deselectAll();
    } catch (err) {
      showError("❌ Failed to hide pools");
    }
  };

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value
    });
  };

  const verifyPair = async () => {
    if (!form.pairAddress) {
      alert("⚠️ No pair address provided. You can manually fill in the token details.");
      return;
    }
    try {
      const res = await authFetch(
        `https://api.dexscreener.com/latest/dex/pairs/solana/${form.pairAddress}`
      );
      const data = await res.json();
      const pair = data.pairs?.[0] || data.pair;
      if (pair) {
        setForm((prev) => ({
          ...prev,
          name: pair.baseToken?.name || prev.name,
          symbol: pair.baseToken?.symbol || prev.symbol,
          logo: pair.info?.imageUrl || pair.baseToken?.logoURI || prev.logo,
          mintAddress: pair.baseToken?.address || prev.mintAddress,
        }));
        alert("✅ Token info loaded from pair!");
      } else {
        alert("❌ Pair not found. Enter details manually.");
      }
    } catch (err) {
      console.error("Verify pair error:", err);
      alert("❌ Failed to verify pair. Enter details manually.");
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      const url = editingPool
        ? `/api/admin/pools/${editingPool.id}`
        : "/api/admin/pools";
      const method = editingPool ? "PATCH" : "POST";

      // Calculate values based on rate mode
      const lockupSeconds = parseInt(form.lockPeriod || "0") * 86400;
      const poolDurationSeconds = parseInt(form.poolDuration || "90") * 86400;
      
      const rateBpsPerYear = form.rateMode === 0 
        ? Math.round(parseFloat(form.fixedApyPercent || "0") * 100)
        : 0;

      const payload = editingPool ? {
        // EDITING - UI fields only
        name: form.name,
        symbol: form.symbol,
        logo: form.logo,
        pairAddress: form.pairAddress,
        rewards: form.rewards,
        hasSelfReflections: form.hasSelfReflections,
        hasExternalReflections: form.hasExternalReflections,
        externalReflectionMint: form.externalReflectionMint,
      } : {
        // CREATING - Full payload
        name: form.name,
        symbol: form.symbol,
        logo: form.logo,
        tokenMint: form.mintAddress,
        pairAddress: form.pairAddress,
        poolId: form.poolId,
        rateMode: form.rateMode,
        rateBpsPerYear: rateBpsPerYear,
        rewardAmount: form.rateMode === 1 ? form.rewardAmount : null,
        poolDurationSeconds: form.rateMode === 1 ? poolDurationSeconds : null,
        lockupSeconds: lockupSeconds,
        lockPeriod: form.lockPeriod,
        type: parseInt(form.lockPeriod || "0") > 0 ? "locked" : "unlocked",
        apy: form.rateMode === 0 ? `${form.fixedApyPercent}%` : "Dynamic",
        apr: form.rateMode === 0 ? `${form.fixedApyPercent}%` : "Dynamic",
        rewards: form.symbol,
        transferTaxBps: parseFloat(form.transferTaxPercent || "0") * 100,
        hasSelfReflections: form.hasSelfReflections,
        hasExternalReflections: form.hasExternalReflections,
        externalReflectionMint: form.hasExternalReflections ? form.externalReflectionMint : null,
        isInitialized: false,
        isPaused: false,
        hidden: false,
        featured: false,
      };

      console.log("📤 Submitting pool:", payload);

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save pool");
      }

      const updatedPool = await res.json();

      if (editingPool) {
        setPools((prev) =>
          prev.map((p) => (p.id === updatedPool.id ? updatedPool : p))
        );
        setEditingPool(null);
        showSuccess("✅ Pool UI information updated successfully!");
        setActiveTab("pools");
      } else {
        setPools((prev) => [...prev, updatedPool]);
        showSuccess("✅ Pool created! Now initialize it using Advanced Pool Controls.");
        setActiveTab("pools");
      }

      // Reset form
      setForm({
        name: "",
        symbol: "",
        logo: "",
        mintAddress: "",
        pairAddress: "",
        poolId: 0,
        rateMode: 0 as 0 | 1,
        fixedApyPercent: "15",
        rewardAmount: "1000",
        poolDuration: "90",
        lockPeriod: "0",
        type: "unlocked",
        apr: "",
        apy: "",
        rewards: "",
        hasSelfReflections: false,
        hasExternalReflections: false,
        externalReflectionMint: "",
        transferTaxPercent: "0",
      });
    } catch (err: any) {
      console.error("Submit error:", err);
      showError(`❌ ${err.message || "Error creating/updating pool"}`);
    }
  };

  const handleEdit = (pool: any) => {
    setEditingPool(pool);
    setForm({
      name: pool.name || "",
      symbol: pool.symbol || "",
      logo: pool.logo || "",
      mintAddress: pool.mintAddress || pool.tokenMint || "",
      pairAddress: pool.pairAddress || "",
      poolId: pool.poolId || 0,
      rateMode: pool.rateMode || 0,
      fixedApyPercent: pool.rateBpsPerYear 
        ? (pool.rateBpsPerYear / 100).toString() 
        : (pool.apy?.toString().replace('%', '') || "15"),
      rewardAmount: pool.rewardAmount || "1000",
      poolDuration: pool.poolDurationSeconds 
        ? (pool.poolDurationSeconds / 86400).toString() 
        : "90",
      lockPeriod: pool.lockPeriod?.toString() || "0",
      type: pool.type || "unlocked",
      apr: pool.apr || "",
      apy: pool.apy?.toString() || "",
      rewards: pool.rewards || "",
      hasSelfReflections: pool.hasSelfReflections || false,
      hasExternalReflections: pool.hasExternalReflections || false,
      externalReflectionMint: pool.externalReflectionMint || "",
      transferTaxPercent: pool.transferTaxBps 
        ? (pool.transferTaxBps / 100).toString() 
        : "0",
    });
    setActiveTab("create");
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await authFetch(`/api/admin/pools/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete pool");
      setPools((prev) => prev.filter((p) => p.id !== id));
      showSuccess("✅ Pool deleted");
    } catch (err) {
      showError("❌ Error deleting pool");
    }
  };

  const handleToggle = async (id: string, field: string) => {
    try {
      const pool = pools.find((p) => p.id === id);
      if (!pool) return;
      const res = await authFetch(`/api/admin/pools/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: !pool[field] }),
      });
      if (!res.ok) throw new Error("Failed to update pool");
      const updated = await res.json();
      setPools((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (err) {
      showError(`❌ Error toggling ${field}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#060609] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ✅ ADD: Header with logout button */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Admin Dashboard
            </h1>
            <p className="text-gray-400 mt-1">Manage your staking pools & platform</p>
          </div>
          <div className="flex items-center gap-3">
            {/* ✅ Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-all text-sm"
            >
              <Lock className="w-4 h-4" />
              Logout
            </button>
            <button
              onClick={() => setActiveTab("create")}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-black to-[#fb57ff] rounded-lg hover:from-[#fb57ff]/90 hover:to-[#fb57ff]/70 transition-all"
            >
              <Plus className="w-5 h-5" />
              New Pool
            </button>
          </div>
        </div>

        <div className="flex gap-2 border-b border-white/[0.05] overflow-x-auto">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-all whitespace-nowrap ${activeTab === "dashboard"
                ? "text-[#fb57ff] border-b-2 border-[#fb57ff]"
                : "text-gray-400 hover:text-gray-300"
              }`}
          >
            <BarChart3 className="w-5 h-5" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("pools")}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-all whitespace-nowrap ${activeTab === "pools"
                ? "text-[#fb57ff] border-b-2 border-blue-400"
                : "text-gray-400 hover:text-gray-300"
              }`}
          >
            <Settings className="w-5 h-5" />
            Manage Pools
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-all whitespace-nowrap ${activeTab === "create"
                ? "text-[#fb57ff] border-b-2 border-blue-400"
                : "text-gray-400 hover:text-gray-300"
              }`}
          >
            <Plus className="w-5 h-5" />
            {editingPool ? "Edit Pool" : "Create Pool"}
          </button>
          <button
            onClick={() => setActiveTab("swap")}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-all whitespace-nowrap ${activeTab === "swap"
                ? "text-[#fb57ff] border-b-2 border-blue-400"
                : "text-gray-400 hover:text-gray-300"
              }`}
          >
            <ArrowDownUp className="w-5 h-5" />
            Swap & Tokens
          </button>
          <button
            onClick={() => setActiveTab("seo")}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-all whitespace-nowrap ${activeTab === "seo"
                ? "text-[#fb57ff] border-b-2 border-blue-400"
                : "text-gray-400 hover:text-gray-300"
              }`}
          >
            <Globe className="w-5 h-5" />
            SEO
          </button>
          <button
            onClick={() => setActiveTab("popups")}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-all whitespace-nowrap ${activeTab === "popups"
                ? "text-[#fb57ff] border-b-2 border-blue-400"
                : "text-gray-400 hover:text-gray-300"
              }`}
          >
            <Sparkles className="w-5 h-5" />
            Pop-Ups
          </button>
          <button
            onClick={() => setActiveTab("telegram")}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-all whitespace-nowrap ${activeTab === "telegram"
                ? "text-[#fb57ff] border-b-2 border-blue-400"
                : "text-gray-400 hover:text-gray-300"
              }`}
          >
            <Activity className="w-5 h-5" />
            Telegram Bot
          </button>
        </div>

        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {platformInitialized === false && (
              <div className="bg-gradient-to-r from-yellow-900/50 to-orange-900/50 backdrop-blur border border-yellow-500/50 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <Zap className="w-8 h-8 text-yellow-400 flex-shrink-0 animate-pulse" />
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold mb-2 text-yellow-200">
                      🚀 Platform Not Initialized
                    </h2>
                    <p className="text-yellow-100 mb-4">
                      Before you can create and manage pools, you need to initialize the platform with fee settings.
                    </p>
                    <button
                      onClick={() => setShowInitModal(true)}
                      className="px-6 py-3 bg-gradient-to-r from-black to-[#fb57ff] rounded-lg hover:from-[#fb57ff]/90 hover:to-[#fb57ff]/70 transition-all font-semibold flex items-center gap-2"
                    >
                      <Zap className="w-5 h-5" />
                      Initialize Platform Now
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Total Pools</span>
                  <Settings className="w-5 h-5 text-[#fb57ff]" />
                </div>
                <p className="text-3xl font-bold text-white">{stats.total}</p>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Active Pools</span>
                  <Play className="w-5 h-5 text-green-400" />
                </div>
                <p className="text-3xl font-bold text-white">{stats.active}</p>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Paused</span>
                  <Pause className="w-5 h-5 text-yellow-400" />
                </div>
                <p className="text-3xl font-bold text-white">{stats.paused}</p>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Featured</span>
                  <TrendingUp className="w-5 h-5 text-[#fb57ff]" />
                </div>
                <p className="text-3xl font-bold text-white">{stats.featured}</p>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Hidden</span>
                  <Eye className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-3xl font-bold text-white">{stats.hidden}</p>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Initialized</span>
                  <CheckSquare className="w-5 h-5 text-[#fb57ff]" />
                </div>
                <p className="text-3xl font-bold text-white">{stats.initialized}</p>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5 md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Total Views</span>
                  <Eye className="w-5 h-5 text-[#fb57ff]" />
                </div>
                <p className="text-3xl font-bold text-white">{stats.totalViews.toLocaleString()}</p>
              </div>
            </div>

            {/* Create Token Account for Fee Collector */}
            <div className="bg-white/[0.02] p-6 rounded-2xl border border-white/[0.05]">
              <h3 className="text-xl font-bold mb-4">Create Token Account</h3>
              <p className="text-gray-400 text-sm mb-4">
                Create token account for fee collector before staking
              </p>
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Token Mint Address *</label>
                <input
                  type="text"
                  value={tokenMintForFeeCollector}
                  onChange={(e) => setTokenMintForFeeCollector(e.target.value)}
                  placeholder="Enter token mint"
                  className="w-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white focus:border-[#fb57ff] focus:outline-none font-mono text-sm"
                />
              </div>
              <button
              onClick={handleCreateTokenAccount}
              disabled={creatingTokenAccount || !tokenMintForFeeCollector}
              className="w-full px-4 py-3 bg-gradient-to-r from-black to-[#fb57ff] rounded-lg hover:from-[#fb57ff]/90 hover:to-[#fb57ff]/70 transition-all font-semibold disabled:opacity-50"
            >
              {creatingTokenAccount ? "Creating..." : "Create Token Account"}
            </button>
            </div>

            {/* Pool Creation Fee Card */}
            <div className="bg-white/[0.02] p-6 rounded-2xl border border-white/[0.05]">
              <div className="flex items-center gap-3 mb-4">
                <DollarSign className="w-8 h-8 text-[#fb57ff]" />
                <h3 className="text-xl font-bold">Pool Creation Fee</h3>
              </div>
              <p className="text-gray-400 mb-2">Current Fee: {poolCreationFee} SOL</p>
              <p className="text-gray-500 text-sm mb-4">
                This fee is charged when users create new pools
              </p>
              <button
                onClick={() => setShowPoolFeeModal(true)}
                className="w-full px-4 py-2 bg-[#fb57ff] rounded-lg hover:bg-[#fb57ff]/90 transition-all"
              >
                Update Pool Fee
              </button>
            </div>

            {/* Platform Settings Card */}
            <div className="bg-white/[0.02] p-6 rounded-2xl border border-white/[0.05]">
              <div className="flex items-center gap-3 mb-4">
                <Settings className="w-8 h-8 text-[#fb57ff]" />
                <h3 className="text-xl font-bold">Platform Settings</h3>
              </div>
              <p className="text-gray-400 mb-4">Manage platform configuration</p>
              <button
                onClick={() => setShowFeeCollectorModal(true)}
                className="w-full px-4 py-2 bg-[#fb57ff] rounded-lg hover:bg-[#fb57ff]/90 transition-all"
              >
                Update Fee Collector
              </button>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#fb57ff]" />
                Recent Pools
              </h3>
              <div className="space-y-3">
                {pools.slice(0, 5).map((pool) => (
                  <div key={pool.id} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg">
                    <div className="flex items-center gap-3">
                      {pool.logo && (
                        <img src={pool.logo} alt={pool.symbol} className="w-10 h-10 rounded" />
                      )}
                      <div>
                        <p className="font-semibold">{pool.name}</p>
                        <p className="text-sm text-gray-400">{pool.symbol}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-400">{pool.views || 0} views</span>
                      {pool.isPaused && (
                        <span className="text-xs bg-yellow-600/30 text-yellow-400 px-2 py-1 rounded">
                          Paused
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ✅ NEW: Swap & Featured Tokens Tab */}
        {activeTab === "swap" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Swap Configuration */}
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <ArrowDownUp className="w-6 h-6 text-[#fb57ff]" />
                    <h3 className="text-xl font-bold">Swap Configuration</h3>
                  </div>
                  <button
                    onClick={loadSwapConfig}
                    className="p-2 bg-white/[0.02] rounded-lg hover:bg-white/[0.04] transition-all"
                    title="Refresh"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Enable/Disable Swap */}
                  <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-lg">
                    <div>
                      <p className="font-semibold text-white">Swap Feature</p>
                      <p className="text-sm text-gray-400">Enable or disable swap functionality</p>
                    </div>
                    <button
                      onClick={() => setSwapConfig({ ...swapConfig, swapEnabled: !swapConfig.swapEnabled })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${swapConfig.swapEnabled ? "bg-blue-600" : "bg-gray-600"
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${swapConfig.swapEnabled ? "translate-x-6" : "translate-x-1"
                          }`}
                      />
                    </button>
                  </div>

                  {/* Platform Fee */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Platform Fee Percentage
                    </label>
                    <input
                      type="number"
                      value={swapConfig.platformFeePercentage}
                      onChange={(e) => setSwapConfig({ ...swapConfig, platformFeePercentage: parseFloat(e.target.value) })}
                      step="0.1"
                      min="0"
                      max="100"
                      className="w-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white focus:border-[#fb57ff] focus:outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Current: {swapConfig.platformFeePercentage.toFixed(2)}%
                    </p>
                  </div>

                  {/* Max Slippage */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Max Slippage (%)
                    </label>
                    <input
                      type="number"
                      value={swapConfig.maxSlippage}
                      onChange={(e) => setSwapConfig({ ...swapConfig, maxSlippage: parseFloat(e.target.value) })}
                      step="0.1"
                      min="0"
                      max="100"
                      className="w-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white focus:border-[#fb57ff] focus:outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Users cannot set slippage above this value
                    </p>
                  </div>

                  {/* Priority Fee */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Priority Fee (SOL)
                    </label>
                    <input
                      type="number"
                      value={swapConfig.priorityFee}
                      onChange={(e) => setSwapConfig({ ...swapConfig, priorityFee: parseFloat(e.target.value) })}
                      step="0.0001"
                      min="0"
                      className="w-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white focus:border-[#fb57ff] focus:outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Transaction priority fee
                    </p>
                  </div>

                  <button
                    onClick={handleSaveSwapConfig}
                    disabled={savingSwapConfig}
                    className="w-full px-4 py-3 bg-gradient-to-r from-black to-[#fb57ff] rounded-lg hover:from-[#fb57ff]/90 hover:to-[#fb57ff]/70bg-white/[0.02] p-6 rounded-2xl border border-white/[0.05] transition-all font-semibold disabled:opacity-50"
                  >
                    {savingSwapConfig ? "Saving..." : "Save Swap Configuration"}
                  </button>
                </div>
              </div>

              {/* Featured Tokens Manager */}
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-6 h-6 text-yellow-400" />
                    <h3 className="text-xl font-bold">Featured Tokens</h3>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAddTokenModal(true)}
                      className="p-2 bg-purple-600 rounded-lg hover:bg-purple-500 transition-all"
                      title="Add Token"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={loadFeaturedTokens}
                      disabled={loadingTokens}
                      className="p-2 bg-white/[0.02] rounded-lg hover:bg-white/[0.04] transition-all disabled:opacity-50"
                      title="Refresh"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingTokens ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </div>

                <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto">
                  {featuredTokens.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Sparkles className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No featured tokens yet</p>
                      <button
                        onClick={() => setShowAddTokenModal(true)}
                        className="text-[#fb57ff] hover:text-purple-300 text-sm mt-2"
                      >
                        Add your first token →
                      </button>
                    </div>
                  ) : (
                    featuredTokens.map((token, index) => (
                      <div
                        key={token.address}
                        className={`bg-white/[0.02] rounded-lg p-3 flex items-center gap-3 ${!token.enabled ? "opacity-50" : ""
                          }`}
                      >
                        {token.logoURI && (
                          <img
                            src={token.logoURI}
                            alt={token.symbol}
                            width="32"
                            height="32"
                            className="rounded-full"
                          />
                        )}
                        <div className="flex-1">
                          <div className="font-semibold text-white text-sm">{token.symbol}</div>
                          <div className="text-xs text-gray-400">{token.name}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveTokenUp(index)}
                            disabled={index === 0}
                            className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => moveTokenDown(index)}
                            disabled={index === featuredTokens.length - 1}
                            className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            ▼
                          </button>
                        </div>
                        <button
                          onClick={() => toggleToken(token.address)}
                          className={`text-xs px-2 py-1 rounded ${token.enabled
                              ? "bg-green-600/30 text-green-400"
                              : "bg-gray-700 text-gray-400"
                            }`}
                        >
                          {token.enabled ? "ON" : "OFF"}
                        </button>
                        <button
                          onClick={() => removeToken(token.address)}
                          className="p-1 text-red-400 hover:text-red-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <button
                  onClick={handleSaveFeaturedTokens}
                  disabled={savingFeaturedTokens}
                  className="w-full px-4 py-3 bg-gradient-to-r from-black to-[#fb57ff] rounded-lg hover:from-[#fb57ff]/90 hover:to-[#fb57ff]/70bg-white/[0.02] p-6 rounded-2xl border border-white/[0.05] transition-all font-semibold disabled:opacity-50"
                >
                  {savingFeaturedTokens ? "Saving..." : "Save Featured Tokens"}
                </button>
              </div>
            </div>

            {/* Info Banner */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
              <div className="flex items-start gap-3">
                <ArrowDownUp className="w-5 h-5 text-[#fb57ff] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-gray-300 font-semibold mb-1">Configuration Overview</p>
                  <p className="text-gray-400 text-sm">
                    <strong>Swap Configuration:</strong> Controls swap functionality, fees, and slippage limits.<br />
                    <strong>Featured Tokens:</strong> Tokens shown in the swap interface for quick access. Users can search for any token, but featured tokens appear prominently.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "pools" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={poolSearchQuery}
                  onChange={(e) => setPoolSearchQuery(e.target.value)}
                  placeholder="Search pools by name, symbol, or ID..."
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white focus:border-[#fb57ff] focus:outline-none transition-all"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={expandAll}
                  className="px-4 py-3 bg-white/[0.02] border border-white/[0.05] rounded-lg hover:bg-white/[0.04] transition-all text-sm"
                >
                  Expand All
                </button>
                <button
                  onClick={collapseAll}
                  className="px-4 py-3 bg-white/[0.02] border border-white/[0.05] rounded-lg hover:bg-white/[0.04] transition-all text-sm"
                >
                  Collapse All
                </button>
              </div>
            </div>

            {selectedPools.size > 0 && (
              <div className="bg-[#fb57ff]/10 border border-[#fb57ff]/30 rounded-lg p-4 flex items-center justify-between">
                <span className="text-[#fb57ff] font-medium">
                  {selectedPools.size} pool{selectedPools.size !== 1 ? "s" : ""} selected
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={bulkHide}
                    className="px-3 py-2 bg-gray-600 rounded hover:bg-gray-700 transition-all text-sm"
                  >
                    Hide All
                  </button>
                  <button
                    onClick={deselectAll}
                    className="px-3 py-2 bg-white/[0.04] rounded hover:bg-white/[0.06] transition-all text-sm"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">
                Showing {filteredPools.length} of {pools.length} pools
              </span>
              <div className="flex gap-2">
                <button
                  onClick={selectAllFiltered}
                  className="text-[#fb57ff] hover:text-gray-300"
                >
                  Select All
                </button>
                <span className="text-gray-600">|</span>
                <button
                  onClick={deselectAll}
                  className="text-gray-400 hover:text-gray-300"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <ul className="space-y-3">
              {filteredPools.map((pool) => {
                const isExpanded = expandedPools.has(pool.id);
                const isSelected = selectedPools.has(pool.id);

                return (
                  <li
                    key={pool.id}
                    className={`bg-white/[0.02]/50 backdrop-blur rounded-lg border transition-all ${isSelected ? "border-blue-500 bg-blue-900/10" : "border-white/[0.05]"
                      }`}
                  >
                    <div className="p-4 flex items-center gap-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectPool(pool.id);
                        }}
                        className="flex-shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-[#fb57ff]" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-600" />
                        )}
                      </button>

                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => toggleExpand(pool.id)}
                      >
                        {pool.logo && (
                          <img
                            src={pool.logo}
                            alt={pool.symbol}
                            className="w-10 h-10 rounded"
                          />
                        )}
                        <div className="flex-1">
                          <p className="font-bold">
                            {pool.name} ({pool.symbol})
                          </p>
                          <a
                            href={`/pool/${pool.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#fb57ff] hover:underline inline-flex items-center gap-1 mt-1"
                          >
                            <Globe className="w-3 h-3" />
                            /pool/{pool.id.slice(0, 8)}...
                          </a>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {pool.isInitialized && (
                              <span className="text-xs bg-green-600/30 text-green-400 px-2 py-0.5 rounded">
                                ✓ Init
                              </span>
                            )}
                            {pool.isPaused && (
                              <span className="text-xs bg-yellow-600/30 text-yellow-400 px-2 py-0.5 rounded">
                                ⏸ Paused
                              </span>
                            )}
                            {pool.featured && (
                              <span className="text-xs bg-purple-600/30 text-[#fb57ff] px-2 py-0.5 rounded">
                                ⭐ Featured
                              </span>
                            )}
                            {pool.hidden && (
                              <span className="text-xs bg-gray-600/30 text-gray-400 px-2 py-0.5 rounded">
                                👁 Hidden
                              </span>
                            )}
                            {pool.hasSelfReflections && (
                              <span className="text-xs bg-blue-600/30 text-[#fb57ff] px-2 py-0.5 rounded">
                                Self Ref
                              </span>
                            )}
                            {pool.hasExternalReflections && (
                              <span className="text-xs bg-purple-600/30 text-[#fb57ff] px-2 py-0.5 rounded">
                                Ext Ref
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right hidden sm:block">
                        <p className="text-sm text-gray-400">{pool.views || 0} views</p>
                        <p className="text-xs text-gray-500">
                          {pool.createdAt ? new Date(pool.createdAt).toLocaleDateString() : "N/A"}
                        </p>
                      </div>

                      <button
                        onClick={() => toggleExpand(pool.id)}
                        className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-white/[0.05] pt-4 space-y-4">
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => handleEdit(pool)}
                            className="px-3 py-1.5 bg-blue-600 rounded hover:bg-blue-700 transition-all text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggle(pool.id, "hidden")}
                            className="px-3 py-1.5 bg-gray-600 rounded hover:bg-gray-700 transition-all text-sm"
                          >
                            {pool.hidden ? "Unhide" : "Hide"}
                          </button>
                          <button
                            onClick={() => handleToggle(pool.id, "featured")}
                            className="px-3 py-1.5 bg-purple-600 rounded hover:bg-purple-700 transition-all text-sm"
                          >
                            {pool.featured ? "Unfeature" : "Feature"}
                          </button>
                          {pool.featured && (
                            <select
                              value={pool.featuredOrder || 99}
                              onChange={async (e) => {
                                const newOrder = parseInt(e.target.value);
                                try {
                                  await authFetch(`/api/admin/pools/${pool.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ featuredOrder: newOrder }),
                                  });
                                  refreshPools();
                                  showSuccess(`✅ Priority set to ${newOrder}`);
                                } catch (err) {
                                  showError("❌ Failed to update priority");
                                }
                              }}
                              className="px-2 py-1.5 bg-purple-900/50 border border-purple-500/30 rounded text-sm text-white"
                              title="Featured Priority (1 = highest)"
                            >
                              <option value={1}>🥇 1st</option>
                              <option value={2}>🥈 2nd</option>
                              <option value={3}>🥉 3rd</option>
                              <option value={4}>4th</option>
                              <option value={5}>5th</option>
                              <option value={99}>Default</option>
                            </select>
                          )}
                          <button
                            onClick={() => setConfirmDelete(pool.id)}
                            className="px-3 py-1.5 bg-red-600 rounded hover:bg-red-700 transition-all text-sm ml-auto"
                          >
                            Delete
                          </button>
                        </div>

                        <AdvancedPoolControls
                          key={`pool-${pool.id}-${pool.isInitialized}-${pool.apy}-${pool.lockPeriod}-${pool.isPaused}`}
                          pool={pool}
                          onUpdate={refreshPools}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {filteredPools.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg">No pools found matching "{poolSearchQuery}"</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "create" && (
          <form
            onSubmit={handleSubmit}
            className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6 space-y-6"
          >
            <h2 className="text-2xl font-semibold">
              {editingPool ? "✏️ Edit Pool" : "🎨 Create New Pool"}
            </h2>

            {/* Warning when editing */}
            {editingPool && (
              <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">⚠️</div>
                  <div>
                    <p className="text-yellow-300 font-semibold mb-2">
                      Editing UI Information Only
                    </p>
                    <p className="text-yellow-200 text-sm mb-2">
                      You can only update visual information here (name, logo, etc.).
                    </p>
                    <p className="text-yellow-200 text-sm">
                      To change blockchain parameters (APY, lock period, pause state, etc.),
                      use the <strong>Advanced Pool Controls</strong> section in the "Manage Pools" tab.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Verify Token Pair */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-[#fb57ff]">Step 1: Verify Token Pair</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="pairAddress"
                  value={form.pairAddress}
                  onChange={handleChange}
                  placeholder="Enter DexScreener Pair Address"
                  className="flex-1 p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white focus:border-[#fb57ff] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={verifyPair}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-500 hover:to-purple-500 transition-all font-medium"
                >
                  Verify
                </button>
              </div>
            </div>

            {/* Step 2: Token Details */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-[#fb57ff]">Step 2: Token Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Token Name"
                  required
                  className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white focus:border-[#fb57ff] focus:outline-none"
                />
                <input
                  type="text"
                  name="symbol"
                  value={form.symbol}
                  onChange={handleChange}
                  placeholder="Symbol"
                  required
                  className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white focus:border-[#fb57ff] focus:outline-none"
                />
                <input
                  type="text"
                  name="logo"
                  value={form.logo}
                  onChange={handleChange}
                  placeholder="Logo URL"
                  className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white focus:border-[#fb57ff] focus:outline-none"
                />
                <input
                  type="text"
                  name="mintAddress"
                  value={form.mintAddress}
                  onChange={handleChange}
                  placeholder="Mint Address"
                  disabled={!!editingPool}
                  className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white focus:border-[#fb57ff] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <input
                  type="number"
                  name="poolId"
                  value={form.poolId}
                  onChange={handleChange}
                  placeholder="Pool ID (0 for first pool, 1 for second...)"
                  min="0"
                  disabled={!!editingPool}
                  className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white focus:border-[#fb57ff] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Step 3: Rate Mode Selection */}
            {!editingPool && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-[#fb57ff]">Step 3: Select Reward Mode</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Fixed APY Option */}
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, rateMode: 0 })}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      form.rateMode === 0
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-white/[0.05] bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        form.rateMode === 0 ? "border-blue-500 bg-blue-500" : "border-gray-500"
                      }`} />
                      <span className="font-bold text-lg">Fixed APY</span>
                    </div>
                    <p className="text-sm text-gray-400">
                      Set a fixed APY percentage (e.g., 15%). Rewards calculated automatically based on stake amount and time.
                    </p>
                  </button>

                  {/* Variable/Dynamic Option */}
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, rateMode: 1 })}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      form.rateMode === 1
                        ? "border-purple-500 bg-purple-500/10"
                        : "border-white/[0.05] bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-4 h-4 rounded-full border-2 ${
                        form.rateMode === 1 ? "border-purple-500 bg-purple-500" : "border-gray-500"
                      }`} />
                      <span className="font-bold text-lg">Variable/Dynamic</span>
                    </div>
                    <p className="text-sm text-gray-400">
                      Deposit reward tokens upfront. APY calculated dynamically based on total staked vs rewards deposited.
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Configuration based on Rate Mode */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-[#fb57ff]">
                {editingPool ? "Step 3: Pool Configuration (Display Only)" : "Step 4: Pool Configuration"}
              </h3>
              
              {editingPool && (
                <p className="text-sm text-gray-400">
                  These values are for display purposes. To change actual blockchain parameters, use Advanced Pool Controls.
                </p>
              )}

              {/* Fixed APY Configuration */}
              {form.rateMode === 0 && (
                <div className="space-y-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                  <div className="flex items-center gap-2 text-blue-400 text-sm font-medium">
                    <Zap className="w-4 h-4" />
                    Fixed APY Mode
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">APY Percentage *</label>
                      <div className="relative">
                        <input
                          type="number"
                          name="fixedApyPercent"
                          value={form.fixedApyPercent}
                          onChange={handleChange}
                          placeholder="15"
                          step="0.1"
                          min="0"
                          disabled={!!editingPool}
                          className="w-full p-3 pr-12 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        e.g., 15 = 15% APY → {Math.round(parseFloat(form.fixedApyPercent || "0") * 100)} basis points
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Lock Period (days)</label>
                      <input
                        type="number"
                        name="lockPeriod"
                        value={form.lockPeriod}
                        onChange={handleChange}
                        placeholder="0"
                        min="0"
                        disabled={!!editingPool}
                        className="w-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        0 = Unlocked/Flexible (users can withdraw anytime)
                      </p>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="bg-white/[0.02] rounded-lg p-3 mt-2">
                    <p className="text-sm text-gray-300">
                      <strong>Preview:</strong> {form.fixedApyPercent || "0"}% APY, {form.lockPeriod === "0" || !form.lockPeriod ? "Unlocked" : `${form.lockPeriod} day lock`}
                    </p>
                  </div>
                </div>
              )}

              {/* Variable/Dynamic Configuration */}
              {form.rateMode === 1 && (
                <div className="space-y-4 p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl">
                  <div className="flex items-center gap-2 text-purple-400 text-sm font-medium">
                    <TrendingUp className="w-4 h-4" />
                    Variable/Dynamic Mode
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Reward Amount (tokens)</label>
                      <input
                        type="number"
                        name="rewardAmount"
                        value={form.rewardAmount}
                        onChange={handleChange}
                        placeholder="1000"
                        min="0"
                        disabled={!!editingPool}
                        className="w-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white focus:border-purple-500 focus:outline-none disabled:opacity-50"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Total rewards to distribute
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Pool Duration (days)</label>
                      <input
                        type="number"
                        name="poolDuration"
                        value={form.poolDuration}
                        onChange={handleChange}
                        placeholder="90"
                        min="1"
                        disabled={!!editingPool}
                        className="w-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white focus:border-purple-500 focus:outline-none disabled:opacity-50"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        How long the pool runs
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Lock Period (days)</label>
                      <input
                        type="number"
                        name="lockPeriod"
                        value={form.lockPeriod}
                        onChange={handleChange}
                        placeholder="0"
                        min="0"
                        disabled={!!editingPool}
                        className="w-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white focus:border-purple-500 focus:outline-none disabled:opacity-50"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        0 = Unlocked
                      </p>
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3">
                    <p className="text-purple-300 text-sm">
                      💡 <strong>How it works:</strong> APY is calculated as (Total Rewards ÷ Total Staked) × (365 ÷ Duration Days) × 100. 
                      The more users stake, the lower the APY per user.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Step 5: Reflection Settings */}
            <div className="space-y-3 border-t border-white/[0.05] pt-4">
              <h3 className="text-lg font-semibold text-[#fb57ff]">
                {editingPool ? "Step 4" : "Step 5"}: Reflection Settings
              </h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer p-3 bg-white/[0.02] rounded-lg hover:bg-slate-750 transition-all">
                  <input
                    type="checkbox"
                    name="hasSelfReflections"
                    checked={form.hasSelfReflections}
                    onChange={handleChange}
                    className="w-5 h-5 rounded bg-white/[0.04] border-slate-600"
                  />
                  <div>
                    <span className="font-medium">Enable Self Reflections</span>
                    <p className="text-sm text-gray-400">Users earn more of the staked token</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer p-3 bg-white/[0.02] rounded-lg hover:bg-slate-750 transition-all">
                  <input
                    type="checkbox"
                    name="hasExternalReflections"
                    checked={form.hasExternalReflections}
                    onChange={handleChange}
                    className="w-5 h-5 rounded bg-white/[0.04] border-slate-600"
                  />
                  <div>
                    <span className="font-medium">Enable External Reflections</span>
                    <p className="text-sm text-gray-400">Users earn a different token</p>
                  </div>
                </label>

                {form.hasExternalReflections && (
                  <input
                    type="text"
                    name="externalReflectionMint"
                    value={form.externalReflectionMint}
                    onChange={handleChange}
                    placeholder="External Reflection Token Mint Address"
                    className="w-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white focus:border-[#fb57ff] focus:outline-none"
                  />
                )}
              </div>
            </div>

            {/* Summary Preview (for new pools only) */}
            {!editingPool && (
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                <h4 className="font-semibold mb-3 text-gray-300">📋 Pool Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Token</p>
                    <p className="font-medium">{form.symbol || "—"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Rate Mode</p>
                    <p className="font-medium">{form.rateMode === 0 ? "Fixed APY" : "Variable"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">APY</p>
                    <p className="font-medium">
                      {form.rateMode === 0 ? `${form.fixedApyPercent}%` : "Dynamic"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Lock Period</p>
                    <p className="font-medium">
                      {form.lockPeriod === "0" || !form.lockPeriod ? "Unlocked" : `${form.lockPeriod} days`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Buttons */}
            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-gradient-to-r from-black to-[#fb57ff] rounded-lg hover:from-[#fb57ff]/90 hover:to-[#fb57ff]/70 transition-all font-medium text-lg"
              >
                {editingPool ? "💾 Update Pool Info" : "🚀 Create Pool"}
              </button>
              {editingPool && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingPool(null);
                    setForm({
                      name: "",
                      symbol: "",
                      logo: "",
                      mintAddress: "",
                      pairAddress: "",
                      poolId: 0,
                      rateMode: 0 as 0 | 1,
                      fixedApyPercent: "15",
                      rewardAmount: "1000",
                      poolDuration: "90",
                      lockPeriod: "0",
                      type: "unlocked",
                      apr: "",
                      apy: "",
                      rewards: "",
                      hasSelfReflections: false,
                      hasExternalReflections: false,
                      externalReflectionMint: "",
                      transferTaxPercent: "0",
                    });
                    setActiveTab("pools");
                  }}
                  className="px-6 py-3 bg-white/[0.04] rounded-lg hover:bg-white/[0.06] transition-all"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}

        {/* ✅ SEO Tab Content */}
        {activeTab === "seo" && (
          <SEOManager
            onSuccess={showSuccess}
            onError={showError}
          />
        )}
        {/* ✅ Pop-Up Ads Tab Content */}
        {activeTab === "popups" && (
          <PopUpAdManager />
        )}
        {/* ✅ Telegram Bot Tab Content */}
        {activeTab === "telegram" && (
          <div className="space-y-6">
            {/* Main Bot Control */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Activity className="w-8 h-8 text-[#fb57ff]" />
                <div>
                  <h2 className="text-2xl font-bold">Telegram Leaderboard Bot</h2>
                  <p className="text-gray-400 text-sm">Manage your weekly trading leaderboard bot</p>
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Activity className="w-5 h-5 text-[#fb57ff] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-gray-300 font-semibold mb-2">About the Leaderboard Bot</p>
                    <p className="text-gray-400 text-sm mb-2">
                      This bot displays the weekly top traders on your StakePoint platform. It shows:
                    </p>
                    <ul className="text-gray-400 text-sm list-disc list-inside space-y-1">
                      <li>Top 10/20 traders for the current week (Monday-Sunday)</li>
                      <li>Trading volumes and swap counts</li>
                      <li>40% reward pool distributed to top traders</li>
                      <li>Individual reward amounts per trader</li>
                      <li>Monthly and all-time leaderboards</li>
                    </ul>
                  </div>
                </div>
              </div>

              <TelegramBotControl />
            </div>

            {/* Bot Commands Reference */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span>📱</span>
                Bot Commands
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-white/[0.02] p-4 rounded-lg">
                  <code className="text-[#fb57ff]">/start</code>
                  <p className="text-sm text-gray-400 mt-1">Welcome message and bot info</p>
                </div>
                <div className="bg-white/[0.02] p-4 rounded-lg">
                  <code className="text-[#fb57ff]">/help</code>
                  <p className="text-sm text-gray-400 mt-1">Show all available commands</p>
                </div>
                <div className="bg-white/[0.02] p-4 rounded-lg">
                  <code className="text-[#fb57ff]">/toptraders</code>
                  <p className="text-sm text-gray-400 mt-1">Weekly top 10 (Monday-Sunday)</p>
                </div>
                <div className="bg-white/[0.02] p-4 rounded-lg">
                  <code className="text-[#fb57ff]">/top20</code>
                  <p className="text-sm text-gray-400 mt-1">Weekly top 20 traders</p>
                </div>
                <div className="bg-white/[0.02] p-4 rounded-lg">
                  <code className="text-[#fb57ff]">/monthly</code>
                  <p className="text-sm text-gray-400 mt-1">Last 30 days top 10</p>
                </div>
                <div className="bg-white/[0.02] p-4 rounded-lg">
                  <code className="text-[#fb57ff]">/alltime</code>
                  <p className="text-sm text-gray-400 mt-1">All-time top 10 traders</p>
                </div>
              </div>
            </div>

            {/* Reward Pool Info */}
            <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 backdrop-blur border border-green-500/30 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <div className="text-4xl">🎁</div>
                <div>
                  <h3 className="text-xl font-bold text-green-300 mb-2">Weekly Reward Pool</h3>
                  <p className="text-green-200 text-sm mb-3">
                    40% of all swap fees collected during the week are automatically distributed to the top 10 traders based on their trading volume.
                  </p>
                  <div className="bg-green-950/50 border border-green-500/30 rounded-lg p-3">
                    <p className="text-green-300 text-sm font-mono">
                      <strong>Formula:</strong> Individual Reward = (Your Volume / Top 10 Total Volume) × Reward Pool
                    </p>
                  </div>
                  <p className="text-green-200 text-xs mt-2">
                    📅 Reward pool resets every Monday at 00:00 UTC
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Token Modal */}
      {showAddTokenModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white/[0.02] rounded-2xl p-6 max-w-md w-full max-h-[80vh] flex flex-col border border-white/[0.05]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Add Featured Token</h3>
              <button
                onClick={() => {
                  setShowAddTokenModal(false);
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
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchTokens(e.target.value);
                }}
                placeholder="Search by name, symbol, or address..."
                className="w-full bg-white/[0.02] text-white rounded-lg pl-10 pr-4 py-3 outline-none border border-white/[0.05] focus:border-[#fb57ff]"
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
                    className="w-full flex items-center gap-3 p-3 bg-white/[0.02] hover:bg-white/[0.04] rounded-lg transition-colors"
                  >
                    {token.logoURI && (
                      <img
                        src={token.logoURI}
                        alt={token.symbol}
                        width="40"
                        height="40"
                        className="rounded-full"
                      />
                    )}
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-white">
                        {token.symbol}
                      </div>
                      <div className="text-sm text-gray-400">{token.name}</div>
                    </div>
                    <Plus className="w-5 h-5 text-[#fb57ff]" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showInitModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50 p-4">
          <div className="bg-white/[0.02] border border-yellow-700 p-6 rounded-xl shadow-2xl text-white max-w-lg w-full">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Zap className="w-6 h-6 text-yellow-400" />
              Initialize Platform
            </h2>
            <p className="text-gray-400 mb-6 text-sm">
              Set up the platform with initial fee configuration. This is a one-time operation.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Token Fee (Basis Points)
                </label>
                <input
                  type="number"
                  value={initForm.platformTokenFeeBps}
                  onChange={(e) => setInitForm({ ...initForm, platformTokenFeeBps: e.target.value })}
                  placeholder="250"
                  className="w-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white focus:border-yellow-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  250 = 2.5%, 100 = 1%, 10000 = 100%
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  SOL Fee (in lamports)
                </label>
                <input
                  type="number"
                  value={initForm.platformSolFee}
                  onChange={(e) => setInitForm({ ...initForm, platformSolFee: e.target.value })}
                  placeholder="1000000"
                  className="w-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white focus:border-yellow-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  1000000 lamports = 0.001 SOL | 1000000000 = 1 SOL
                </p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Fee Collector Address *
                </label>
                <input
                  type="text"
                  value={initForm.feeCollector}
                  onChange={(e) => setInitForm({ ...initForm, feeCollector: e.target.value })}
                  placeholder="Enter wallet address to receive fees"
                  className="w-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white focus:border-yellow-500 focus:outline-none font-mono text-sm"
                />
              </div>
            </div>

            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 mb-6">
              <p className="text-yellow-300 text-xs">
                ℹ️ Platform initialization can only be done once. Make sure the fee collector address is correct!
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowInitModal(false);
                  setInitForm({
                    platformTokenFeeBps: "250",
                    platformSolFee: "1000000",
                    feeCollector: "",
                  });
                }}
                className="flex-1 px-4 py-3 bg-white/[0.04] rounded-lg hover:bg-white/[0.06] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleInitializePlatform}
                disabled={!initForm.feeCollector}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-black to-[#fb57ff] rounded-lg hover:from-[#fb57ff]/90 hover:to-[#fb57ff]/70 transition-all disabled:opacity-50 font-semibold"
              >
                Initialize Platform
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50 p-4">
          <div className="bg-white/[0.02] border border-white/[0.05] p-6 rounded-xl shadow-2xl text-white max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">⚠️ Confirm Deletion</h2>
            <p className="mb-6 text-gray-300">
              Are you sure you want to delete this pool? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 bg-white/[0.04] rounded-lg hover:bg-white/[0.06] transition-all"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition-all"
                onClick={() => {
                  handleDelete(confirmDelete);
                  setConfirmDelete(null);
                }}
              >
                Delete Pool
              </button>
            </div>
          </div>
        </div>
      )}

      {showFeeCollectorModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50 p-4">
          <div className="bg-white/[0.02] border border-purple-700 p-6 rounded-xl shadow-2xl text-white max-w-lg w-full">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Settings className="w-6 h-6 text-[#fb57ff]" />
              Update Fee Collector
            </h2>
            <p className="text-gray-400 mb-6 text-sm">
              Change the wallet address that receives platform fees
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  New Fee Collector Address *
                </label>
                <input
                  type="text"
                  value={newFeeCollector}
                  onChange={(e) => setNewFeeCollector(e.target.value)}
                  placeholder="66oZ17EyWhmRXPYpuVpoojvmaz3AZWAaewekTWqJFhfB"
                  className="w-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white focus:border-[#fb57ff] focus:outline-none font-mono text-sm"
                />
              </div>
            </div>

            <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3 mb-6">
              <p className="text-purple-300 text-xs">
                ℹ️ This will update where all future fees are sent. Current stakes are unaffected.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowFeeCollectorModal(false);
                  setNewFeeCollector("");
                }}
                className="flex-1 px-4 py-3 bg-white/[0.04] rounded-lg hover:bg-white/[0.06] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateFeeCollector}
                disabled={!newFeeCollector}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-black to-[#fb57ff] rounded-lg hover:from-[#fb57ff]/90 hover:to-[#fb57ff]/70 transition-all disabled:opacity-50 font-semibold"
              >
                Update Fee Collector
              </button>
            </div>
          </div>
        </div>
      )}

      {showPoolFeeModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50 p-4">
          <div className="bg-white/[0.02] border border-purple-700 p-6 rounded-xl shadow-2xl text-white max-w-lg w-full">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-[#fb57ff]" />
              Update Pool Creation Fee
            </h2>
            <p className="text-gray-400 mb-6 text-sm">
              Set the fee users pay when creating new staking pools
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Fee Amount (SOL) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={poolCreationFee}
                  onChange={(e) => setPoolCreationFee(e.target.value)}
                  placeholder="0.01"
                  className="w-full p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white focus:border-[#fb57ff] focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Current: {poolCreationFee} SOL ({(parseFloat(poolCreationFee) * 1_000_000_000).toLocaleString()} lamports)
                </p>
              </div>
            </div>

            <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3 mb-6">
              <p className="text-purple-300 text-xs">
                ℹ️ This fee applies to both regular pools and LP pools. Changes take effect immediately.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPoolFeeModal(false);
                  loadPoolCreationFee();
                }}
                className="flex-1 px-4 py-3 bg-white/[0.04] rounded-lg hover:bg-white/[0.06] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePoolCreationFee}
                disabled={savingPoolFee || !poolCreationFee}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-black to-[#fb57ff] rounded-lg hover:from-[#fb57ff]/90 hover:to-[#fb57ff]/70 transition-all disabled:opacity-50 font-semibold"
              >
                {savingPoolFee ? "Saving..." : "Update Fee"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}