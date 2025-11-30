"use client";
import { useState } from "react";
import { Shield, Search, AlertTriangle } from "lucide-react";
import { useAdminProgram } from "@/hooks/useAdminProgram";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

interface Stake {
  id: string;
  userId: string;
  amount: number;
  createdAt: string;
}

interface Pool {
  tokenMint?: string;
  mintAddress?: string;
}

export default function UserWalletManager({ 
  poolId, 
  poolName,
  pool 
}: { 
  poolId: string; 
  poolName: string;
  pool?: Pool;
}) {
  const { publicKey } = useWallet();
  const { changeWithdrawalWallet } = useAdminProgram();
  
  const [activeModal, setActiveModal] = useState(false);
  const [searchWallet, setSearchWallet] = useState("");
  const [newWallet, setNewWallet] = useState("");
  const [stakes, setStakes] = useState<Stake[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const tokenMint = pool?.tokenMint || pool?.mintAddress;

  const showMessage = (type: "success" | "error", message: string) => {
    if (type === "success") {
      setSuccessMsg(message);
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setErrorMsg(message);
      setTimeout(() => setErrorMsg(null), 5000);
    }
  };

  const handleSearchUser = async () => {
    if (!searchWallet) {
      showMessage("error", "❌ Please enter a wallet address");
      return;
    }

    // Validate wallet address format
    try {
      new PublicKey(searchWallet);
    } catch {
      showMessage("error", "❌ Invalid wallet address format");
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/admin/stakes?poolId=${poolId}&userId=${searchWallet}`);
      if (!res.ok) throw new Error("Failed to fetch stakes");
      
      const data = await res.json();
      setStakes(data);
      
      if (data.length === 0) {
        showMessage("error", "❌ No stakes found for this wallet in this pool");
      }
    } catch (err: any) {
      showMessage("error", `❌ Error: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleChangeWallet = async () => {
    // Validation
    if (!newWallet) {
      showMessage("error", "❌ Please enter a new wallet address");
      return;
    }

    if (!searchWallet) {
      showMessage("error", "❌ Please search for a user first");
      return;
    }

    if (!publicKey) {
      showMessage("error", "❌ Please connect your admin wallet");
      return;
    }

    if (!tokenMint) {
      showMessage("error", "❌ Pool token mint not configured");
      return;
    }

    // Validate new wallet address format
    try {
      new PublicKey(newWallet);
    } catch {
      showMessage("error", "❌ Invalid new wallet address format");
      return;
    }

    setIsProcessing(true);
    
    try {
      // STEP 1: Update on-chain first (most important)
      console.log("📝 Step 1: Updating blockchain...");
      showMessage("success", "⏳ Updating blockchain state...");
      
      await changeWithdrawalWallet(
        tokenMint,
        searchWallet, // user's current wallet
        newWallet     // new wallet address
      );
      
      console.log("✅ Blockchain updated successfully");
      
      // STEP 2: Update database to match blockchain
      console.log("📝 Step 2: Updating database...");
      showMessage("success", "⏳ Updating database...");
      
      const res = await fetch(`/api/admin/stakes/change-wallet`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poolId,
          oldWallet: searchWallet,
          newWallet,
        }),
      });

      if (!res.ok) {
        throw new Error("Database update failed - blockchain was changed but database sync failed");
      }
      
      const result = await res.json();
      
      showMessage(
        "success", 
        `✅ Complete! Wallet changed on blockchain and database. ${result.updatedCount} stake(s) transferred.`
      );
      
      console.log("✅ Database updated successfully");
      
      // Reset form
      setSearchWallet("");
      setNewWallet("");
      setStakes([]);
      
      setTimeout(() => setActiveModal(false), 3000);
      
    } catch (err: any) {
      console.error("❌ Wallet change error:", err);
      
      // Provide specific error guidance
      if (err.message?.includes("blockchain")) {
        showMessage("error", `❌ Blockchain update failed: ${err.message}. No changes made.`);
      } else if (err.message?.includes("database")) {
        showMessage("error", `⚠️ WARNING: Blockchain updated but database sync failed. Manual database fix needed!`);
      } else {
        showMessage("error", `❌ Failed: ${err.message}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setActiveModal(true)}
        className="flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-sm transition-colors"
        title="Change withdrawal wallet for compromised accounts"
      >
        <Shield className="w-4 h-4" />
        Change User Wallet
      </button>

      {/* Modal */}
      {activeModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 p-4">
          <div className="bg-slate-800 p-6 rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2 text-cyan-400 mb-4">
              <Shield className="w-6 h-6" />
              <h2 className="text-xl font-bold">Change User Wallet Address</h2>
            </div>
            
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
              <div className="flex gap-2 items-start">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-yellow-300">
                  <strong>Important:</strong> This updates BOTH the blockchain and database. 
                  Use only for compromised wallets. The user must connect with the NEW wallet to withdraw.
                </div>
              </div>
            </div>

            <p className="text-gray-300 text-sm mb-6">
              Transfer a user's staked tokens and rewards to a new wallet address. 
              This will update the withdrawal wallet on-chain.
            </p>

            {/* Token Mint Warning */}
            {!tokenMint && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                <p className="text-red-300 text-sm">
                  ⚠️ Pool token mint not configured. Cannot change withdrawal wallet.
                </p>
              </div>
            )}

            {/* Messages */}
            {successMsg && (
              <div className="bg-green-600 text-white px-4 py-2 rounded mb-4 animate-pulse">
                {successMsg}
              </div>
            )}
            {errorMsg && (
              <div className="bg-red-600 text-white px-4 py-2 rounded mb-4">
                {errorMsg}
              </div>
            )}

            <div className="space-y-4">
              {/* Search Current Wallet */}
              <div>
                <label className="block text-sm text-gray-400 mb-1 font-semibold">
                  Step 1: Search Current Wallet Address
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchWallet}
                    onChange={(e) => setSearchWallet(e.target.value)}
                    placeholder="Enter current wallet address"
                    className="flex-1 p-2 rounded bg-slate-900 text-white border border-gray-700 focus:border-cyan-500 focus:outline-none text-sm"
                  />
                  <button
                    onClick={handleSearchUser}
                    disabled={isSearching || !tokenMint}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 flex items-center gap-2 transition-colors"
                  >
                    <Search className="w-4 h-4" />
                    {isSearching ? "Searching..." : "Search"}
                  </button>
                </div>
              </div>

              {/* Display Stakes */}
              {stakes.length > 0 && (
                <div className="bg-slate-900 p-4 rounded border border-slate-700 animate-in fade-in duration-300">
                  <h3 className="font-semibold mb-3 text-cyan-400">
                    Found Stakes in {poolName}:
                  </h3>
                  <div className="space-y-2">
                    {stakes.map((stake) => (
                      <div key={stake.id} className="flex justify-between text-sm bg-slate-800 p-2 rounded">
                        <span className="text-gray-400">Stake ID: {stake.id.slice(0, 8)}...</span>
                        <span className="text-white font-semibold">{stake.amount.toLocaleString()} tokens</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-slate-700 flex justify-between font-bold text-lg">
                      <span>Total:</span>
                      <span className="text-cyan-400">
                        {stakes.reduce((sum, s) => sum + s.amount, 0).toLocaleString()} tokens
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* New Wallet Address */}
              {stakes.length > 0 && (
                <div className="animate-in slide-in-from-bottom duration-300">
                  <label className="block text-sm text-gray-400 mb-1 font-semibold">
                    Step 2: Enter New Wallet Address
                  </label>
                  <input
                    type="text"
                    value={newWallet}
                    onChange={(e) => setNewWallet(e.target.value)}
                    placeholder="Enter new safe wallet address"
                    className="w-full p-2 rounded bg-slate-900 text-white border border-gray-700 focus:border-cyan-500 focus:outline-none text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    ⚠️ All stakes and withdrawal rights will be transferred to this address on-chain
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              {stakes.length > 0 && (
                <button
                  onClick={handleChangeWallet}
                  disabled={isProcessing || !tokenMint}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all"
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin">⏳</span>
                      Processing...
                    </span>
                  ) : (
                    "Change Wallet (Blockchain + Database)"
                  )}
                </button>
              )}
              <button
                onClick={() => {
                  setActiveModal(false);
                  setSearchWallet("");
                  setNewWallet("");
                  setStakes([]);
                  setSuccessMsg(null);
                  setErrorMsg(null);
                }}
                disabled={isProcessing}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
              >
                Close
              </button>
            </div>

            {/* Technical Info */}
            {tokenMint && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-xs text-gray-500">
                  Pool Token Mint: {tokenMint.slice(0, 8)}...{tokenMint.slice(-8)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}