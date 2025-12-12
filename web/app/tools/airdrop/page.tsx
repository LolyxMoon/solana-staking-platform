"use client";

import { useState, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { ComputeBudgetProgram } from "@solana/web3.js";
import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAccount,
  getMint,
} from "@solana/spl-token";
import {
  Send,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Wallet,
  Coins,
  Users,
  FileText,
  Trash2,
  ExternalLink,
  Info,
  Play,
  Pause,
  RotateCcw,
} from "lucide-react";

interface Recipient {
  wallet: string;
  amount: number;
  status: "pending" | "sending" | "success" | "failed" | "skipped";
  txId?: string;
  error?: string;
}

interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  logoURI: string | null;
  isToken2022: boolean;
}

export default function AirdropPage() {
  const { publicKey, signAllTransactions, connected } = useWallet();
  const { connection } = useConnection();

  // Form state
  const [tokenMint, setTokenMint] = useState("");
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [recipientInput, setRecipientInput] = useState("");
  const [amountPerWallet, setAmountPerWallet] = useState("");
  const [useCustomAmounts, setUseCustomAmounts] = useState(false);

  // Recipients
  const [recipients, setRecipients] = useState<Recipient[]>([]);

  // Status
  const [loading, setLoading] = useState(false);
  const [loadingToken, setLoadingToken] = useState(false);
  const [airdropRunning, setAirdropRunning] = useState(false);
  const [airdropPaused, setAirdropPaused] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  // Settings
  const [batchSize, setBatchSize] = useState(10); // Recipients per transaction
  const [skipExisting, setSkipExisting] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
  });

  // Fetch token info
  const fetchTokenInfo = async () => {
    if (!tokenMint.trim() || !publicKey) return;

    setLoadingToken(true);
    setError("");
    setTokenInfo(null);

    try {
      const mintPubkey = new PublicKey(tokenMint);

      // Try Token-2022 first, then regular SPL
      let mintData;
      let isToken2022 = false;

      try {
        mintData = await getMint(connection, mintPubkey, "confirmed", TOKEN_2022_PROGRAM_ID);
        isToken2022 = true;
      } catch {
        mintData = await getMint(connection, mintPubkey, "confirmed", TOKEN_PROGRAM_ID);
      }

      const decimals = mintData.decimals;

      // Get user's token balance
      const programId = isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
      const userAta = await getAssociatedTokenAddress(mintPubkey, publicKey, false, programId);

      let balance = 0;
      try {
        const accountInfo = await getAccount(connection, userAta, "confirmed", programId);
        balance = Number(accountInfo.amount) / Math.pow(10, decimals);
      } catch {
        // No token account = 0 balance
      }

      // Fetch metadata from DexScreener
      let symbol = tokenMint.slice(0, 4) + "...";
      let name = "Unknown Token";
      let logoURI: string | null = null;

      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`);
        if (res.ok) {
          const data = await res.json();
          const pair = data.pairs?.[0];
          if (pair?.baseToken) {
            symbol = pair.baseToken.symbol || symbol;
            name = pair.baseToken.name || name;
            logoURI = pair.info?.imageUrl || null;
          }
        }
      } catch {
        // Silent fail
      }

      setTokenInfo({
        mint: tokenMint,
        symbol,
        name,
        decimals,
        balance,
        logoURI,
        isToken2022,
      });
    } catch (err: any) {
      console.error("Token fetch error:", err);
      setError("Invalid token mint address or token not found");
    } finally {
      setLoadingToken(false);
    }
  };

  // Parse recipients from text input
  const parseRecipients = useCallback(() => {
    if (!recipientInput.trim()) {
      setRecipients([]);
      return;
    }

    const lines = recipientInput
      .split(/[\n,]/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const parsed: Recipient[] = [];
    const seen = new Set<string>();

    for (const line of lines) {
      // Support format: "address" or "address,amount" or "address amount"
      const parts = line.split(/[,\s\t]+/);
      const wallet = parts[0];

      // Validate wallet address
      try {
        new PublicKey(wallet);
      } catch {
        continue; // Skip invalid addresses
      }

      // Skip duplicates
      if (seen.has(wallet.toLowerCase())) continue;
      seen.add(wallet.toLowerCase());

      // Parse custom amount if provided
      let amount = parseFloat(amountPerWallet) || 0;
      if (useCustomAmounts && parts[1]) {
        const customAmount = parseFloat(parts[1]);
        if (!isNaN(customAmount) && customAmount > 0) {
          amount = customAmount;
        }
      }

      parsed.push({
        wallet,
        amount,
        status: "pending",
      });
    }

    setRecipients(parsed);
    setStats({ total: parsed.length, success: 0, failed: 0, skipped: 0 });
  }, [recipientInput, amountPerWallet, useCustomAmounts]);

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRecipientInput(text);
    };
    reader.readAsText(file);
  };

  // Execute airdrop
  const executeAirdrop = async () => {
    if (!publicKey || !signAllTransactions || !tokenInfo || recipients.length === 0) {
      setError("Please connect wallet, select token, and add recipients");
      return;
    }

    const totalAmount = recipients.reduce((sum, r) => sum + r.amount, 0);
    if (totalAmount > tokenInfo.balance) {
      setError(`Insufficient balance. Need ${totalAmount.toLocaleString()} ${tokenInfo.symbol}, have ${tokenInfo.balance.toLocaleString()}`);
      return;
    }

    setAirdropRunning(true);
    setAirdropPaused(false);
    setError("");

    const mintPubkey = new PublicKey(tokenInfo.mint);
    const programId = tokenInfo.isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
    const senderAta = await getAssociatedTokenAddress(mintPubkey, publicKey, false, programId);

    // Get all pending/failed recipients
    const pendingRecipients = recipients.filter((r) => r.status === "pending" || r.status === "failed");
    const totalBatches = Math.ceil(pendingRecipients.length / batchSize);

    console.log(`🚀 Starting airdrop: ${pendingRecipients.length} recipients in ${totalBatches} batches of ${batchSize}`);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIdx = batchIndex * batchSize;
      const batch = pendingRecipients.slice(startIdx, startIdx + batchSize);
      
      console.log(`📦 Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} recipients)`);
      setStatusMessage(`Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} recipients)...`);

      // Update status to sending
      const batchWallets = new Set(batch.map(b => b.wallet));
      setRecipients((prev) =>
        prev.map((r) =>
          batchWallets.has(r.wallet) ? { ...r, status: "sending" as const } : r
        )
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Retry logic - try up to 3 times
      let success = false;
      let lastError: any = null;
      
      for (let attempt = 1; attempt <= 3 && !success; attempt++) {
        try {
          const transaction = new Transaction();
          let ataCreationCount = 0;

          // Add priority fee instruction FIRST
          const { ComputeBudgetProgram } = await import("@solana/web3.js");
          transaction.add(
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }) // Priority fee
          );

          // Build instructions for each recipient in batch
          for (const recipient of batch) {
            const recipientPubkey = new PublicKey(recipient.wallet);
            const recipientAta = await getAssociatedTokenAddress(
              mintPubkey,
              recipientPubkey,
              true,
              programId
            );

            // Check if ATA exists
            let ataExists = false;
            try {
              await getAccount(connection, recipientAta, "confirmed", programId);
              ataExists = true;
            } catch {
              // ATA doesn't exist
            }

            // Create ATA if needed
            if (!ataExists) {
              ataCreationCount++;
              transaction.add(
                createAssociatedTokenAccountInstruction(
                  publicKey,
                  recipientAta,
                  recipientPubkey,
                  mintPubkey,
                  programId
                )
              );
            }

            // Add transfer instruction
            const amountInSmallestUnit = BigInt(
              Math.floor(recipient.amount * Math.pow(10, tokenInfo.decimals))
            );

            transaction.add(
              createTransferInstruction(
                senderAta,
                recipientAta,
                publicKey,
                amountInSmallestUnit,
                [],
                programId
              )
            );
          }

          // Set compute unit limit based on instruction count
          const computeUnits = 50000 + (ataCreationCount * 30000) + (batch.length * 10000);
          transaction.add(
            ComputeBudgetProgram.setComputeUnitLimit({ units: Math.min(computeUnits, 1400000) })
          );

          console.log(`📝 Batch ${batchIndex + 1} (attempt ${attempt}): ${batch.length} transfers + ${ataCreationCount} ATA creations`);

          // Get FRESH blockhash right before sending
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = publicKey;

          // Sign and send
          const signedTxs = await signAllTransactions([transaction]);
          const txId = await connection.sendRawTransaction(signedTxs[0].serialize(), {
            skipPreflight: true, // Skip preflight for speed
            maxRetries: 3,
          });

          console.log(`📤 Batch ${batchIndex + 1} sent (attempt ${attempt}): ${txId}`);

          // Wait for confirmation with timeout
          const confirmation = await connection.confirmTransaction(
            { signature: txId, blockhash, lastValidBlockHeight },
            "processed" // Use "processed" for faster confirmation
          );

          if (confirmation.value.err) {
            throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
          }

          // Success!
          success = true;
          setRecipients((prev) =>
            prev.map((r) =>
              batchWallets.has(r.wallet) ? { ...r, status: "success" as const, txId } : r
            )
          );

          setStats((prev) => ({
            ...prev,
            success: prev.success + batch.length,
          }));

          console.log(`✅ Batch ${batchIndex + 1} confirmed: ${txId}`);

        } catch (err: any) {
          lastError = err;
          console.error(`❌ Batch ${batchIndex + 1} attempt ${attempt} error:`, err.message);
          
          if (attempt < 3) {
            console.log(`🔄 Retrying batch ${batchIndex + 1}...`);
            await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2s before retry
          }
        }
      }

      // If all retries failed, mark batch as failed
      if (!success) {
        setRecipients((prev) =>
          prev.map((r) =>
            batchWallets.has(r.wallet)
              ? { ...r, status: "failed" as const, error: lastError?.message?.slice(0, 100) }
              : r
          )
        );

        setStats((prev) => ({
          ...prev,
          failed: prev.failed + batch.length,
        }));
      }

      // Delay between batches
      if (batchIndex < totalBatches - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    setAirdropRunning(false);
    setStatusMessage(`Airdrop complete! ✅`);
  };

  const pauseAirdrop = () => {
    setAirdropPaused(true);
  };

  const resetAirdrop = () => {
    setRecipients((prev) => prev.map((r) => ({ ...r, status: "pending" as const, txId: undefined, error: undefined })));
    setStats({ total: recipients.length, success: 0, failed: 0, skipped: 0 });
    setStatusMessage("");
  };

  const clearAll = () => {
    setRecipients([]);
    setRecipientInput("");
    setStats({ total: 0, success: 0, failed: 0, skipped: 0 });
    setStatusMessage("");
    setError("");
  };

  const totalAmount = recipients.reduce((sum, r) => sum + (r.amount || 0), 0);

  return (
    <div className="max-w-4xl mx-auto pt-6 px-4 pb-20">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <Send className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Airdrop Tool</h1>
            <p className="text-gray-400 text-sm">Send tokens to multiple wallets in batches</p>
          </div>
        </div>
      </div>

      {/* Wallet Connection Check */}
      {!connected && (
        <div className="mb-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
          <div className="flex items-center gap-2 text-yellow-400">
            <Wallet className="w-5 h-5" />
            <span>Please connect your wallet to use the airdrop tool</span>
          </div>
        </div>
      )}

      {/* Step 1: Select Token */}
      <div className="mb-6 p-5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-xs font-bold">1</div>
          <h2 className="text-lg font-semibold text-white">Select Token</h2>
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            value={tokenMint}
            onChange={(e) => setTokenMint(e.target.value)}
            placeholder="Enter token mint address..."
            className="flex-1 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] focus:border-green-500/50 outline-none text-white placeholder-gray-500 font-mono text-sm"
          />
          <button
            onClick={fetchTokenInfo}
            disabled={loadingToken || !tokenMint.trim() || !connected}
            className="px-5 py-3 rounded-xl bg-green-500 hover:bg-green-600 disabled:bg-gray-700 disabled:opacity-50 font-semibold text-white transition-colors"
          >
            {loadingToken ? <Loader2 className="w-5 h-5 animate-spin" /> : "Load"}
          </button>
        </div>

        {/* Token Info Display */}
        {tokenInfo && (
          <div className="mt-4 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
            <div className="flex items-center gap-4">
              {tokenInfo.logoURI ? (
                <img src={tokenInfo.logoURI} alt={tokenInfo.symbol} className="w-12 h-12 rounded-full" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                  <Coins className="w-6 h-6 text-gray-400" />
                </div>
              )}
              <div className="flex-1">
                <p className="font-bold text-white text-lg">{tokenInfo.symbol}</p>
                <p className="text-sm text-gray-400">{tokenInfo.name}</p>
                {tokenInfo.isToken2022 && (
                  <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded mt-1 inline-block">
                    Token-2022
                  </span>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Your Balance</p>
                <p className="font-bold text-white text-xl">{tokenInfo.balance.toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Add Recipients */}
      <div className="mb-6 p-5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-xs font-bold">2</div>
          <h2 className="text-lg font-semibold text-white">Add Recipients</h2>
        </div>

        {/* Amount Input */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-400">Amount per wallet</label>
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={useCustomAmounts}
                onChange={(e) => setUseCustomAmounts(e.target.checked)}
                className="rounded border-gray-600"
              />
              Use custom amounts from list
            </label>
          </div>
          {!useCustomAmounts && (
            <input
              type="number"
              value={amountPerWallet}
              onChange={(e) => setAmountPerWallet(e.target.value)}
              placeholder="e.g., 100"
              className="w-full p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] focus:border-green-500/50 outline-none text-white placeholder-gray-500"
            />
          )}
          {useCustomAmounts && (
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-sm text-blue-400">
              <Info className="w-4 h-4 inline mr-2" />
              Format: one per line as "wallet,amount" or "wallet amount"
            </div>
          )}
        </div>

        {/* Recipients Input */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-400">Wallet addresses</label>
            <label className="flex items-center gap-2 text-sm text-green-400 cursor-pointer hover:text-green-300">
              <Upload className="w-4 h-4" />
              <span>Upload CSV/TXT</span>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
          <textarea
            value={recipientInput}
            onChange={(e) => setRecipientInput(e.target.value)}
            placeholder="Paste wallet addresses here (one per line or comma-separated)..."
            rows={6}
            className="w-full p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] focus:border-green-500/50 outline-none text-white placeholder-gray-500 font-mono text-sm resize-none"
          />
        </div>

        {/* Parse Button */}
        <button
          onClick={parseRecipients}
          disabled={!recipientInput.trim()}
          className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] hover:bg-white/[0.1] disabled:opacity-50 font-semibold text-white transition-colors"
        >
          <Users className="w-4 h-4 inline mr-2" />
          Parse Recipients ({recipientInput.split(/[\n,]/).filter((l) => l.trim()).length} lines)
        </button>
      </div>

      {/* Step 3: Review & Send */}
      {recipients.length > 0 && (
        <div className="mb-6 p-5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-xs font-bold">3</div>
            <h2 className="text-lg font-semibold text-white">Review & Send</h2>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <p className="text-xs text-gray-400 mb-1">Recipients</p>
              <p className="text-xl font-bold text-white">{recipients.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <p className="text-xs text-gray-400 mb-1">Total Amount</p>
              <p className="text-xl font-bold text-white">{totalAmount.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/30">
              <p className="text-xs text-green-400 mb-1">Success</p>
              <p className="text-xl font-bold text-green-400">{stats.success}</p>
            </div>
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
              <p className="text-xs text-red-400 mb-1">Failed</p>
              <p className="text-xl font-bold text-red-400">{stats.failed}</p>
            </div>
          </div>

          {/* Settings */}
          <div className="flex items-center gap-4 mb-4 p-3 rounded-xl bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">Batch size:</label>
              <select
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="p-2 rounded-lg bg-white/[0.05] border border-white/[0.1] text-white text-sm"
                >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={18}>18 (max safe)</option>
                <option value={20}>20 (risky)</option>
                </select>
            </div>
            <span className="text-xs text-gray-500">
              (recipients per transaction)
            </span>
          </div>

          {/* Balance Check Warning */}
          {tokenInfo && totalAmount > tokenInfo.balance && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                <span>
                  Insufficient balance! Need {totalAmount.toLocaleString()} {tokenInfo.symbol}, have{" "}
                  {tokenInfo.balance.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Status Message */}
          {statusMessage && (
            <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/30">
              <div className="flex items-center gap-2 text-green-400">
                {airdropRunning && <Loader2 className="w-4 h-4 animate-spin" />}
                {statusMessage}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {!airdropRunning ? (
              <button
                onClick={executeAirdrop}
                disabled={!tokenInfo || totalAmount > (tokenInfo?.balance || 0) || recipients.length === 0}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: "linear-gradient(45deg, #22c55e, #10b981)" }}
              >
                <Play className="w-5 h-5" />
                Start Airdrop
              </button>
            ) : (
              <button
                onClick={pauseAirdrop}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-600 font-semibold text-white transition-colors"
              >
                <Pause className="w-5 h-5" />
                Pause
              </button>
            )}
            <button
              onClick={resetAirdrop}
              disabled={airdropRunning}
              className="px-4 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-50 text-white transition-colors"
              title="Reset all to pending"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button
              onClick={clearAll}
              disabled={airdropRunning}
              className="px-4 py-3 rounded-xl bg-white/[0.05] hover:bg-red-500/20 disabled:opacity-50 text-white transition-colors"
              title="Clear all"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Recipients List */}
      {recipients.length > 0 && (
        <div className="mb-6 p-5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Recipients</h3>
            <span className="text-sm text-gray-400">
              Showing {Math.min(recipients.length, 50)} of {recipients.length}
            </span>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2">
            {recipients.slice(0, 50).map((recipient, idx) => (
              <div
                key={recipient.wallet}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  recipient.status === "success"
                    ? "bg-green-500/10 border-green-500/30"
                    : recipient.status === "failed"
                    ? "bg-red-500/10 border-red-500/30"
                    : recipient.status === "sending"
                    ? "bg-yellow-500/10 border-yellow-500/30"
                    : "bg-white/[0.02] border-white/[0.05]"
                }`}
              >
                <span className="text-sm text-gray-500 w-8">#{idx + 1}</span>
                <span className="flex-1 font-mono text-sm text-white truncate">
                  {recipient.wallet.slice(0, 8)}...{recipient.wallet.slice(-8)}
                </span>
                <span className="text-sm text-gray-400">
                  {recipient.amount.toLocaleString()} {tokenInfo?.symbol || "tokens"}
                </span>
                <div className="w-6">
                  {recipient.status === "pending" && <div className="w-2 h-2 rounded-full bg-gray-500" />}
                  {recipient.status === "sending" && <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />}
                  {recipient.status === "success" && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                  {recipient.status === "failed" && <XCircle className="w-4 h-4 text-red-400" />}
                </div>
                {recipient.txId && (
                  <a
                    href={`https://solscan.io/tx/${recipient.txId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-400 hover:text-green-300"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))}
          </div>

          {recipients.length > 50 && (
            <div className="mt-3 text-center text-sm text-gray-500">
              +{recipients.length - 50} more recipients
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-400">
            <p className="font-semibold text-gray-300 mb-1">How it works</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Tokens are sent in batches to minimize transaction fees</li>
              <li>Token accounts are created automatically for recipients who don't have one</li>
              <li>You can pause and resume the airdrop at any time</li>
              <li>Failed transfers can be retried by clicking "Start Airdrop" again</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}