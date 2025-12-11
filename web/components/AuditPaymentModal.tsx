"use client";

import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { 
  PublicKey, 
  Transaction, 
  VersionedTransaction,
  LAMPORTS_PER_SOL 
} from "@solana/web3.js";
import { 
  TOKEN_2022_PROGRAM_ID,
  createBurnInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { X, Loader2, Flame, ArrowRight, Check } from "lucide-react";

const SPT_MINT = new PublicKey("5U2b4wNBfpgpYMGS4w8F7Pfoe6Rf5qfCWmfMKqvpump");

interface AuditPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (txSignature: string) => void;
  solAmount: number;
}

export default function AuditPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  solAmount,
}: AuditPaymentModalProps) {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  
  const [step, setStep] = useState<"quote" | "swap" | "burn" | "complete">("quote");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sptAmount, setSptAmount] = useState<number | null>(null);
  const [swapSignature, setSwapSignature] = useState<string | null>(null);
  const [burnSignature, setBurnSignature] = useState<string | null>(null);

  // Get quote when modal opens
  useEffect(() => {
    if (isOpen && publicKey) {
      getQuote();
    }
  }, [isOpen, publicKey]);

  const getQuote = async () => {
    setLoading(true);
    setError(null);
    try {
      const lamports = solAmount * LAMPORTS_PER_SOL;
      const res = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${SPT_MINT.toString()}&amount=${lamports}&slippageBps=300`
      );
      
      if (!res.ok) throw new Error("Failed to get quote");
      
      const quote = await res.json();
      const sptOut = Number(quote.outAmount) / 1e6; // Assuming 6 decimals
      setSptAmount(sptOut);
      setStep("quote");
    } catch (err: any) {
      setError(err.message || "Failed to get quote");
    } finally {
      setLoading(false);
    }
  };

  const executeSwapAndBurn = async () => {
    if (!publicKey || !signTransaction || !sptAmount) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Step 1: Swap SOL -> SPT
      setStep("swap");
      
      const lamports = solAmount * LAMPORTS_PER_SOL;
      
      // Get fresh quote
      const quoteRes = await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${SPT_MINT.toString()}&amount=${lamports}&slippageBps=300`
      );
      
      if (!quoteRes.ok) throw new Error("Quote failed");
      const quote = await quoteRes.json();
      
      // Get swap transaction
      const swapRes = await fetch("https://quote-api.jup.ag/v6/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: publicKey.toString(),
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: "auto",
        }),
      });
      
      if (!swapRes.ok) throw new Error("Swap request failed");
      const swapData = await swapRes.json();
      
      // Sign and send swap
      const swapTxBuf = Buffer.from(swapData.swapTransaction, "base64");
      const swapTx = VersionedTransaction.deserialize(swapTxBuf);
      const signedSwapTx = await signTransaction(swapTx);
      
      const swapSig = await connection.sendRawTransaction(signedSwapTx.serialize(), {
        skipPreflight: true,
        maxRetries: 3,
      });
      
      await connection.confirmTransaction(swapSig, "confirmed");
      setSwapSignature(swapSig);
      console.log("✅ Swap complete:", swapSig);
      
      // Step 2: Burn SPT tokens
      setStep("burn");
      
      // Wait a moment for balance to update
      await new Promise(r => setTimeout(r, 2000));
      
      // Get actual SPT balance
      const sptAta = getAssociatedTokenAddressSync(
        SPT_MINT,
        publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { mint: SPT_MINT }
      );
      
      if (tokenAccounts.value.length === 0) {
        throw new Error("No SPT tokens found after swap");
      }
      
      const sptBalance = Number(tokenAccounts.value[0].account.data.parsed.info.tokenAmount.amount);
      const sptDecimals = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.decimals;
      
      if (sptBalance <= 0) {
        throw new Error("Insufficient SPT balance to burn");
      }
      
      // Create burn instruction
      const burnIx = createBurnInstruction(
        sptAta,
        SPT_MINT,
        publicKey,
        sptBalance,
        [],
        TOKEN_2022_PROGRAM_ID
      );
      
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      
      const burnTx = new Transaction().add(burnIx);
      burnTx.recentBlockhash = blockhash;
      burnTx.feePayer = publicKey;
      
      const signedBurnTx = await signTransaction(burnTx);
      const burnSig = await connection.sendRawTransaction(signedBurnTx.serialize(), {
        skipPreflight: false,
      });
      
      await connection.confirmTransaction({
        signature: burnSig,
        blockhash,
        lastValidBlockHeight,
      }, "confirmed");
      
      setBurnSignature(burnSig);
      console.log("🔥 Burn complete:", burnSig);
      
      setStep("complete");
      
      // Wait a moment then callback
      setTimeout(() => {
        onSuccess(burnSig);
      }, 1500);
      
    } catch (err: any) {
      console.error("Payment error:", err);
      setError(err.message || "Transaction failed");
      setStep("quote");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-black/95 border border-[#fb57ff]/30 rounded-2xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}>
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Buy & Burn SPT</h2>
              <p className="text-xs text-gray-400">Required for audit access</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={loading && step !== "quote"}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          {["quote", "swap", "burn", "complete"].map((s, i) => (
            <div key={s} className="flex items-center">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  step === s 
                    ? "bg-[#fb57ff] text-white" 
                    : ["swap", "burn", "complete"].indexOf(step) > ["swap", "burn", "complete"].indexOf(s)
                      ? "bg-green-500 text-white"
                      : "bg-white/[0.1] text-gray-500"
                }`}
              >
                {["swap", "burn", "complete"].indexOf(step) > ["swap", "burn", "complete"].indexOf(s) ? (
                  <Check className="w-4 h-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 3 && (
                <div className={`w-12 h-0.5 mx-1 ${
                  ["swap", "burn", "complete"].indexOf(step) > i 
                    ? "bg-green-500" 
                    : "bg-white/[0.1]"
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="space-y-4">
          {step === "quote" && (
            <>
              <div className="bg-white/[0.02] border border-white/[0.1] rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">You Pay</p>
                    <p className="text-2xl font-bold">{solAmount} SOL</p>
                  </div>
                  <ArrowRight className="w-6 h-6 text-gray-500" />
                  <div className="text-right">
                    <p className="text-sm text-gray-400">To Burn</p>
                    <p className="text-2xl font-bold" style={{ color: '#fb57ff' }}>
                      {sptAmount ? `~${sptAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "..."} SPT
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#fb57ff]/10 border border-[#fb57ff]/30 rounded-lg p-3">
                <p className="text-xs text-gray-300">
                  <Flame className="w-4 h-4 inline mr-1" style={{ color: '#fb57ff' }} />
                  These tokens will be <span className="font-semibold text-white">permanently burned</span>, 
                  reducing total supply and supporting the SPT ecosystem.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <button
                onClick={executeSwapAndBurn}
                disabled={loading || !sptAmount}
                className="w-full px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Flame className="w-5 h-5" />
                    Swap & Burn
                  </>
                )}
              </button>
            </>
          )}

          {step === "swap" && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: '#fb57ff' }} />
              <p className="text-lg font-semibold">Swapping SOL → SPT</p>
              <p className="text-sm text-gray-400 mt-1">Please confirm the transaction in your wallet</p>
            </div>
          )}

          {step === "burn" && (
            <div className="text-center py-8">
              <Flame className="w-12 h-12 mx-auto mb-4 animate-pulse" style={{ color: '#fb57ff' }} />
              <p className="text-lg font-semibold">Burning SPT Tokens</p>
              <p className="text-sm text-gray-400 mt-1">Please confirm the burn transaction</p>
              {swapSignature && (
                <p className="text-xs text-green-400 mt-2">✓ Swap complete</p>
              )}
            </div>
          )}

          {step === "complete" && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <p className="text-lg font-semibold">Payment Complete!</p>
              <p className="text-sm text-gray-400 mt-1">Generating your audit report...</p>
              <div className="mt-4 space-y-1">
                {swapSignature && (
                  <a 
                    href={`https://solscan.io/tx/${swapSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-500 hover:text-white block"
                  >
                    Swap TX: {swapSignature.slice(0, 8)}...
                  </a>
                )}
                {burnSignature && (
                  <a 
                    href={`https://solscan.io/tx/${burnSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs hover:text-white block"
                    style={{ color: '#fb57ff' }}
                  >
                    🔥 Burn TX: {burnSignature.slice(0, 8)}...
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}