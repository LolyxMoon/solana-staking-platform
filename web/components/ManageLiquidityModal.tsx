"use client";
import { useState, useEffect, useMemo } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { X, Loader2, AlertCircle, Plus, Minus, ArrowDownUp } from "lucide-react";
import { useToast } from "@/components/ToastContainer";
import { getRaydiumPoolInfo, getPoolReserves } from "@/lib/raydium-api";
import { addLiquidityToPool, removeLiquidityFromPool, calculateLPTokensToReceive, calculateTokensFromLP } from "@/lib/raydium-liquidity";
import { getDexInfo, isDexSupported } from "@/lib/liquidity-router";

interface ManageLiquidityModalProps {
  isOpen: boolean;
  onClose: () => void;
  poolId: string;
  poolName: string;
  lpTokenMint: string;
  dexType: string;
  dexPoolAddress: string;
  rewardTokenSymbol?: string;
}

export default function ManageLiquidityModal({
  isOpen,
  onClose,
  poolId,
  poolName,
  lpTokenMint,
  dexType,
  dexPoolAddress,
  rewardTokenSymbol,
}: ManageLiquidityModalProps) {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { showSuccess, showError, showInfo } = useToast();

  const [mode, setMode] = useState<"add" | "remove">("add");
  const [loading, setLoading] = useState(false);
  const [poolInfoLoading, setPoolInfoLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Pool data
  const [poolInfo, setPoolInfo] = useState<any>(null);
  const [baseToken, setBaseToken] = useState<any>(null);
  const [quoteToken, setQuoteToken] = useState<any>(null);
  const [reserves, setReserves] = useState<any>(null);

  // Form state
  const [baseAmount, setBaseAmount] = useState("");
  const [quoteAmount, setQuoteAmount] = useState("");
  const [lpAmount, setLpAmount] = useState("");
  const [slippage, setSlippage] = useState(1.0);

  // Balances
  const [baseBalance, setBaseBalance] = useState<number>(0);
  const [quoteBalance, setQuoteBalance] = useState<number>(0);
  const [lpBalance, setLpBalance] = useState<number>(0);

  // Check DEX support
  const dexInfo = getDexInfo(dexType as any);
  const dexSupport = isDexSupported(dexType as any);

  // Fetch pool info on mount
  useEffect(() => {
    if (isOpen && dexPoolAddress) {
      loadPoolInfo();
    }
  }, [isOpen, dexPoolAddress]);

  const loadPoolInfo = async () => {
    setPoolInfoLoading(true);
    
    // Check if DEX is supported
    if (!dexSupport.supported) {
        setPoolInfoLoading(false);
        showError(dexSupport.message || "This DEX is not supported yet");
        return;
    }

    try {
        console.log(`🔍 Loading ${dexInfo.displayName} pool info:`, dexPoolAddress);

        // Only Raydium is currently supported for transactions
        if (dexType !== 'raydium') {
        setPoolInfoLoading(false);
        showInfo(`${dexInfo.displayName} liquidity management coming soon! For now, use ${dexInfo.displayName}'s UI.`);
        return;
        }

        const info = await getRaydiumPoolInfo(dexPoolAddress);
      if (!info) {
        showError("Failed to load pool info");
        return;
      }

      setPoolInfo(info);

      // Fetch token metadata
      const [baseMintInfo, quoteMintInfo] = await Promise.all([
        connection.getParsedAccountInfo(new PublicKey(info.baseMint)),
        connection.getParsedAccountInfo(new PublicKey(info.quoteMint)),
      ]);

      setBaseToken({
        mint: info.baseMint,
        decimals: info.baseDecimals,
        symbol: 'Token A', // You can enhance this with actual token metadata
      });

      setQuoteToken({
        mint: info.quoteMint,
        decimals: info.quoteDecimals,
        symbol: 'Token B',
      });

      // Fetch reserves
      const reservesData = await getPoolReserves(connection, dexPoolAddress);
      setReserves(reservesData);

      // Fetch user balances
      if (publicKey) {
        await fetchBalances(info);
      }

      console.log('✅ Pool info loaded successfully');
    } catch (error) {
      console.error('❌ Error loading pool info:', error);
      showError("Failed to load pool information");
    } finally {
      setPoolInfoLoading(false);
    }
  };

  const fetchBalances = async (info: any) => {
    if (!publicKey) return;

    try {
      const { getAssociatedTokenAddress, getAccount } = await import('@solana/spl-token');

      // Fetch base token balance
      try {
        const baseTokenAccount = await getAssociatedTokenAddress(
          new PublicKey(info.baseMint),
          publicKey
        );
        const baseAccountInfo = await getAccount(connection, baseTokenAccount);
        setBaseBalance(Number(baseAccountInfo.amount) / Math.pow(10, info.baseDecimals));
      } catch (error) {
        setBaseBalance(0);
      }

      // Fetch quote token balance
      try {
        const quoteTokenAccount = await getAssociatedTokenAddress(
          new PublicKey(info.quoteMint),
          publicKey
        );
        const quoteAccountInfo = await getAccount(connection, quoteTokenAccount);
        setQuoteBalance(Number(quoteAccountInfo.amount) / Math.pow(10, info.quoteDecimals));
      } catch (error) {
        setQuoteBalance(0);
      }

      // Fetch LP token balance
      try {
        const lpTokenAccount = await getAssociatedTokenAddress(
          new PublicKey(info.lpMint),
          publicKey
        );
        const lpAccountInfo = await getAccount(connection, lpTokenAccount);
        setLpBalance(Number(lpAccountInfo.amount) / Math.pow(10, info.lpDecimals));
      } catch (error) {
        setLpBalance(0);
      }

      console.log('💰 Balances loaded:', {
        base: baseBalance,
        quote: quoteBalance,
        lp: lpBalance,
      });

    } catch (error) {
      console.error('Error fetching balances:', error);
    }
  };

  // Auto-calculate quote amount when base amount changes (Add mode)
  useEffect(() => {
    if (mode === "add" && baseAmount && reserves) {
      const calculatedQuote = (parseFloat(baseAmount) / reserves.ratio).toFixed(6);
      setQuoteAmount(calculatedQuote);
    }
  }, [baseAmount, reserves, mode]);

  // Auto-calculate base amount when quote amount changes (Add mode)
  useEffect(() => {
    if (mode === "add" && quoteAmount && reserves) {
      const calculatedBase = (parseFloat(quoteAmount) * reserves.ratio).toFixed(6);
      setBaseAmount(calculatedBase);
    }
  }, [quoteAmount, reserves, mode]);

  // Calculate expected LP tokens (Add mode)
  const expectedLPTokens = useMemo(() => {
    if (mode === "add" && baseAmount && quoteAmount && reserves && poolInfo) {
      return calculateLPTokensToReceive(
        parseFloat(baseAmount),
        parseFloat(quoteAmount),
        reserves.baseReserve,
        reserves.quoteReserve,
        reserves.lpSupply
      );
    }
    return 0;
  }, [mode, baseAmount, quoteAmount, reserves, poolInfo]);

  // Calculate expected tokens from LP (Remove mode)
  const expectedTokens = useMemo(() => {
    if (mode === "remove" && lpAmount && reserves && poolInfo) {
      return calculateTokensFromLP(
        parseFloat(lpAmount),
        reserves.baseReserve,
        reserves.quoteReserve,
        reserves.lpSupply
      );
    }
    return { baseAmount: 0, quoteAmount: 0 };
  }, [mode, lpAmount, reserves, poolInfo]);

  const handleAddLiquidity = async () => {
    if (!publicKey || !signTransaction || !poolInfo) {
      showError("Please connect your wallet");
      return;
    }

    if (!baseAmount || !quoteAmount || parseFloat(baseAmount) <= 0 || parseFloat(quoteAmount) <= 0) {
      showError("Please enter valid amounts");
      return;
    }

    if (parseFloat(baseAmount) > baseBalance) {
      showError(`Insufficient ${baseToken.symbol} balance`);
      return;
    }

    if (parseFloat(quoteAmount) > quoteBalance) {
      showError(`Insufficient ${quoteToken.symbol} balance`);
      return;
    }

    setProcessing(true);
    try {
      console.log('💦 Adding liquidity...', {
        baseAmount,
        quoteAmount,
        expectedLP: expectedLPTokens,
      });

      const txSignature = await addLiquidityToPool(
        connection,
        publicKey,
        dexPoolAddress,
        poolInfo,
        parseFloat(baseAmount),
        parseFloat(quoteAmount),
        slippage,
        signTransaction
      );

      console.log('✅ Liquidity added! TX:', txSignature);
      showSuccess(`✅ Added ${baseAmount} + ${quoteAmount} liquidity!`);

      // Reset form
      setBaseAmount("");
      setQuoteAmount("");

      // Refresh balances
      await fetchBalances(poolInfo);
      await loadPoolInfo();

    } catch (error: any) {
      console.error('❌ Add liquidity error:', error);
      showError(error.message || "Failed to add liquidity");
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!publicKey || !signTransaction || !poolInfo) {
      showError("Please connect your wallet");
      return;
    }

    if (!lpAmount || parseFloat(lpAmount) <= 0) {
      showError("Please enter valid LP amount");
      return;
    }

    if (parseFloat(lpAmount) > lpBalance) {
      showError("Insufficient LP token balance");
      return;
    }

    setProcessing(true);
    try {
      console.log('💧 Removing liquidity...', {
        lpAmount,
        expectedBase: expectedTokens.baseAmount,
        expectedQuote: expectedTokens.quoteAmount,
      });

      const txSignature = await removeLiquidityFromPool(
        connection,
        publicKey,
        dexPoolAddress,
        poolInfo,
        parseFloat(lpAmount),
        slippage,
        signTransaction
      );

      console.log('✅ Liquidity removed! TX:', txSignature);
      showSuccess(`✅ Removed ${lpAmount} LP tokens!`);

      // Reset form
      setLpAmount("");

      // Refresh balances
      await fetchBalances(poolInfo);
      await loadPoolInfo();

    } catch (error: any) {
      console.error('❌ Remove liquidity error:', error);
      showError(error.message || "Failed to remove liquidity");
    } finally {
      setProcessing(false);
    }
  };

  const handleMaxBase = () => {
    setBaseAmount(baseBalance.toFixed(6));
  };

  const handleMaxQuote = () => {
    setQuoteAmount(quoteBalance.toFixed(6));
  };

  const handleMaxLP = () => {
    setLpAmount(lpBalance.toFixed(6));
  };

  const handlePercentageLP = (percent: number) => {
    const amount = (lpBalance * percent / 100).toFixed(6);
    setLpAmount(amount);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-black/90 rounded-2xl max-w-lg w-full border border-white/[0.05] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/[0.05] sticky top-0 bg-black/90 z-10">
          <h2 className="text-2xl font-bold" style={{ 
            background: 'linear-gradient(45deg, white, #fb57ff)', 
            WebkitBackgroundClip: 'text', 
            WebkitTextFillColor: 'transparent' 
          }}>
            Manage Liquidity
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Pool Info */}
        <div className="p-6 border-b border-white/[0.05]">
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Pool</p>
            <p className="text-lg font-bold text-white">{poolName}</p>
            {reserves && (
              <div className="mt-3 pt-3 border-t border-white/[0.05] grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-500">Pool Ratio</p>
                  <p className="text-white font-mono">1 : {reserves.ratio.toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Total Liquidity</p>
                  <p className="text-white">${(reserves.baseReserve * 2).toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="flex border-b border-white/[0.05]">
          <button
            onClick={() => setMode("add")}
            className={`flex-1 px-6 py-4 font-semibold transition-all ${
              mode === "add"
                ? "text-white border-b-2"
                : "text-gray-400 hover:text-gray-300"
            }`}
            style={mode === "add" ? { borderColor: '#fb57ff' } : {}}
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Add Liquidity
          </button>
          <button
            onClick={() => setMode("remove")}
            className={`flex-1 px-6 py-4 font-semibold transition-all ${
              mode === "remove"
                ? "text-white border-b-2"
                : "text-gray-400 hover:text-gray-300"
            }`}
            style={mode === "remove" ? { borderColor: '#fb57ff' } : {}}
          >
            <Minus className="w-4 h-4 inline mr-2" />
            Remove Liquidity
          </button>
        </div>

        {/* Unsupported DEX Warning */}
        {!dexSupport.supported ? (
        <div className="p-12 flex flex-col items-center justify-center text-center">
            <span className="text-6xl mb-4">{dexInfo.icon}</span>
            <h3 className="text-xl font-bold mb-2">{dexInfo.displayName} Not Supported Yet</h3>
            <p className="text-gray-400 mb-4 max-w-md">
            {dexSupport.message}
            </p>
            <a
            href={dexSupport.dexUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 rounded-lg font-semibold transition-all"
            style={{ background: `linear-gradient(45deg, black, ${dexInfo.color})` }}
            >
            Open {dexInfo.displayName} →
            </a>
        </div>
        ) : poolInfoLoading ? (
        <div className="p-12 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin mb-4" style={{ color: '#fb57ff' }} />
            <p className="text-gray-400">Loading pool information...</p>
        </div>
        ) : !poolInfo ? (
          <div className="p-12 flex flex-col items-center justify-center">
            <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
            <p className="text-red-300">Failed to load pool information</p>
            <button
              onClick={loadPoolInfo}
              className="mt-4 px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {/* Add Liquidity Mode */}
            {mode === "add" && (
              <>
                {/* Base Token Input */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-gray-400">{baseToken.symbol}</label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        Balance: {baseBalance.toFixed(4)}
                      </span>
                      <button
                        onClick={handleMaxBase}
                        className="text-xs px-2 py-1 rounded hover:bg-white/[0.05] transition-all"
                        style={{ color: '#fb57ff' }}
                      >
                        MAX
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    value={baseAmount}
                    onChange={(e) => setBaseAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.05] rounded-lg text-white text-lg focus:outline-none focus:border-[#fb57ff]/50"
                  />
                </div>

                {/* Plus Icon */}
                <div className="flex justify-center">
                  <div className="w-10 h-10 rounded-full bg-white/[0.05] flex items-center justify-center">
                    <Plus className="w-5 h-5 text-gray-400" />
                  </div>
                </div>

                {/* Quote Token Input */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-gray-400">{quoteToken.symbol}</label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        Balance: {quoteBalance.toFixed(4)}
                      </span>
                      <button
                        onClick={handleMaxQuote}
                        className="text-xs px-2 py-1 rounded hover:bg-white/[0.05] transition-all"
                        style={{ color: '#fb57ff' }}
                      >
                        MAX
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    value={quoteAmount}
                    onChange={(e) => setQuoteAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.05] rounded-lg text-white text-lg focus:outline-none focus:border-[#fb57ff]/50"
                  />
                </div>

                {/* Expected LP Tokens */}
                {expectedLPTokens > 0 && (
                  <div className="bg-white/[0.02] border border-[#fb57ff]/20 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">LP Tokens to Receive</span>
                      <span className="text-lg font-bold" style={{ color: '#fb57ff' }}>
                        {expectedLPTokens.toFixed(6)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Slippage */}
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Slippage Tolerance</label>
                  <div className="flex gap-2">
                    {[0.5, 1.0, 2.0].map((value) => (
                      <button
                        key={value}
                        onClick={() => setSlippage(value)}
                        className={`flex-1 px-3 py-2 rounded-lg transition-all text-sm ${
                          slippage === value
                            ? "text-white"
                            : "bg-white/[0.05] text-gray-300 hover:bg-white/[0.08]"
                        }`}
                        style={slippage === value ? { background: 'linear-gradient(45deg, black, #fb57ff)' } : {}}
                      >
                        {value}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Add Button */}
                <button
                  onClick={handleAddLiquidity}
                  disabled={processing || !publicKey || !baseAmount || !quoteAmount}
                  className="w-full px-6 py-4 rounded-xl font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Adding Liquidity...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Add Liquidity
                    </>
                  )}
                </button>
              </>
            )}

            {/* Remove Liquidity Mode */}
            {mode === "remove" && (
              <>
                {/* LP Token Input */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-gray-400">LP Tokens to Remove</label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        Balance: {lpBalance.toFixed(4)}
                      </span>
                      <button
                        onClick={handleMaxLP}
                        className="text-xs px-2 py-1 rounded hover:bg-white/[0.05] transition-all"
                        style={{ color: '#fb57ff' }}
                      >
                        MAX
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    value={lpAmount}
                    onChange={(e) => setLpAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-white/[0.02] border border-white/[0.05] rounded-lg text-white text-lg focus:outline-none focus:border-[#fb57ff]/50"
                  />
                </div>

                {/* Percentage Buttons */}
                <div className="grid grid-cols-4 gap-2">
                  {[25, 50, 75, 100].map((percent) => (
                    <button
                      key={percent}
                      onClick={() => handlePercentageLP(percent)}
                      className="px-3 py-2 bg-white/[0.05] hover:bg-white/[0.08] rounded-lg text-sm transition-all"
                    >
                      {percent}%
                    </button>
                  ))}
                </div>

                {/* Expected Tokens */}
                {expectedTokens.baseAmount > 0 && (
                  <div className="bg-white/[0.02] border border-[#fb57ff]/20 rounded-lg p-4 space-y-2">
                    <p className="text-sm text-gray-400 mb-2">You will receive:</p>
                    <div className="flex items-center justify-between">
                      <span className="text-white">{baseToken.symbol}</span>
                      <span className="text-lg font-bold" style={{ color: '#fb57ff' }}>
                        {expectedTokens.baseAmount.toFixed(6)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white">{quoteToken.symbol}</span>
                      <span className="text-lg font-bold" style={{ color: '#fb57ff' }}>
                        {expectedTokens.quoteAmount.toFixed(6)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Slippage */}
                <div>
                  <label className="text-sm text-gray-400 mb-2 block">Slippage Tolerance</label>
                  <div className="flex gap-2">
                    {[0.5, 1.0, 2.0].map((value) => (
                      <button
                        key={value}
                        onClick={() => setSlippage(value)}
                        className={`flex-1 px-3 py-2 rounded-lg transition-all text-sm ${
                          slippage === value
                            ? "text-white"
                            : "bg-white/[0.05] text-gray-300 hover:bg-white/[0.08]"
                        }`}
                        style={slippage === value ? { background: 'linear-gradient(45deg, black, #fb57ff)' } : {}}
                      >
                        {value}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Remove Button */}
                <button
                  onClick={handleRemoveLiquidity}
                  disabled={processing || !publicKey || !lpAmount}
                  className="w-full px-6 py-4 rounded-xl font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Removing Liquidity...
                    </>
                  ) : (
                    <>
                      <Minus className="w-5 h-5" />
                      Remove Liquidity
                    </>
                  )}
                </button>
              </>
            )}

            {/* Warning */}
            {!publicKey && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-200">
                  Connect your wallet to manage liquidity
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}