import { Connection, PublicKey, VersionedTransaction, Transaction } from "@solana/web3.js";

const RAYDIUM_API_BASE = "https://transaction-v1.raydium.io";
const SOL_MINT = "So11111111111111111111111111111111111111112";

export interface RaydiumQuoteResponse {
  id: string;
  success: boolean;
  version: string;
  data: {
    swapType: string;
    inputMint: string;
    inputAmount: string;
    outputMint: string;
    outputAmount: string;
    otherAmountThreshold: string;
    slippageBps: number;
    priceImpactPct: number;
    routePlan: any[];
  };
}

/**
 * Get user token account for a given mint
 */
async function getUserTokenAccount(
  connection: Connection,
  walletAddress: string,
  tokenMintAddress: string
): Promise<string | null> {
  try {
    const accounts = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(walletAddress),
      { mint: new PublicKey(tokenMintAddress) }
    );

    if (accounts.value.length === 0) {
      return null;
    }

    // Find account with largest balance
    let largestAccount = accounts.value[0];
    let largestBalance = 0;

    for (const account of accounts.value) {
      const balance = parseInt(account.account.data.parsed.info.tokenAmount.amount);
      if (balance > largestBalance) {
        largestBalance = balance;
        largestAccount = account;
      }
    }

    console.log(`🏦 Selected token account ${largestAccount.pubkey.toString()} with balance ${largestBalance}`);
    return largestAccount.pubkey.toString();
  } catch (error) {
    console.error("❌ Error fetching user token account:", error);
    return null;
  }
}

/**
 * Get a quote from Raydium
 */
export async function getRaydiumQuote(
  connection: Connection,
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 50,
  txVersion: "V0" | "LEGACY" = "V0"
): Promise<RaydiumQuoteResponse | null> {
  try {
    console.log("🔍 Fetching Raydium quote...");
    
    // Get token decimals
    const tokenInfo = await connection.getParsedAccountInfo(new PublicKey(inputMint));
    const decimals = tokenInfo?.value?.data && 'parsed' in tokenInfo.value.data 
      ? tokenInfo.value.data.parsed.info.decimals 
      : 9;

    const inputAmount = Math.floor(amount * Math.pow(10, decimals)).toString();

    const url = `${RAYDIUM_API_BASE}/compute/swap-base-in?` +
      `inputMint=${inputMint}&` +
      `outputMint=${outputMint}&` +
      `amount=${inputAmount}&` +
      `slippageBps=${slippageBps}&` +
      `txVersion=${txVersion}`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error(`❌ Raydium quote failed: ${response.status}`);
      
      // Try LEGACY if V0 failed
      if (txVersion === "V0") {
        console.log("⚠️ Retrying with LEGACY transaction version...");
        return getRaydiumQuote(connection, inputMint, outputMint, amount, slippageBps, "LEGACY");
      }
      
      return null;
    }

    const data = await response.json();
    
    if (!data || data.error) {
      console.error("❌ Raydium quote error:", data?.error || data?.msg);
      
      // Try LEGACY if V0 failed with version error
      if (txVersion === "V0" && data?.msg?.includes("REQ_TX_VERSION_ERROR")) {
        console.log("⚠️ Retrying with LEGACY transaction version...");
        return getRaydiumQuote(connection, inputMint, outputMint, amount, slippageBps, "LEGACY");
      }
      
      return null;
    }

    console.log("✅ Raydium quote received using", txVersion);
    return { ...data, txVersion };
  } catch (error) {
    console.error("❌ Raydium quote error:", error);
    
    // Try LEGACY if V0 threw an error
    if (txVersion === "V0") {
      console.log("⚠️ Retrying with LEGACY transaction version...");
      return getRaydiumQuote(connection, inputMint, outputMint, amount, slippageBps, "LEGACY");
    }
    
    return null;
  }
}

/**
 * Get swap transaction from Raydium
 */
export async function getRaydiumSwapTransaction(
  connection: Connection,
  wallet: PublicKey,
  swapResponse: any,
  inputMint: string,
  outputMint: string,
  txVersion: "V0" | "LEGACY" = "V0"
): Promise<Buffer[] | null> {
  try {
    console.log("🔄 Fetching Raydium swap transaction...");
    
    const isInputSol = inputMint === SOL_MINT;
    const isOutputSol = outputMint === SOL_MINT;

    // Get token accounts if not SOL
    const inputAccount = isInputSol 
      ? undefined 
      : await getUserTokenAccount(connection, wallet.toString(), inputMint);
    
    const outputAccount = isOutputSol 
      ? undefined 
      : await getUserTokenAccount(connection, wallet.toString(), outputMint);

    const requestBody = {
      computeUnitPriceMicroLamports: "200000",
      swapResponse,
      txVersion,
      wallet: wallet.toString(),
      wrapSol: isInputSol,
      unwrapSol: isOutputSol,
      inputAccount,
      outputAccount,
    };

    const response = await fetch(`${RAYDIUM_API_BASE}/transaction/swap-base-in`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error(`❌ Raydium transaction failed: ${response.status}`);
      
      // Try alternative txVersion
      if (txVersion === "V0") {
        console.log("⚠️ Retrying with LEGACY transaction version...");
        return getRaydiumSwapTransaction(connection, wallet, swapResponse, inputMint, outputMint, "LEGACY");
      }
      
      return null;
    }

    const data = await response.json();

    if (!data || !data.success) {
      console.error("❌ Raydium transaction error:", data?.error || data?.msg);
      
      // Try alternative txVersion
      if (txVersion === "V0") {
        console.log("⚠️ Retrying with LEGACY transaction version...");
        return getRaydiumSwapTransaction(connection, wallet, swapResponse, inputMint, outputMint, "LEGACY");
      }
      
      return null;
    }

    console.log("✅ Raydium swap transaction retrieved using", txVersion);
    return data.data.map((tx: any) => Buffer.from(tx.transaction, "base64"));
  } catch (error) {
    console.error("❌ Raydium transaction error:", error);
    
    // Try alternative txVersion
    if (txVersion === "V0") {
      console.log("⚠️ Retrying with LEGACY transaction version...");
      return getRaydiumSwapTransaction(connection, wallet, swapResponse, inputMint, outputMint, "LEGACY");
    }
    
    return null;
  }
}

/**
 * Execute Raydium swap
 */
export async function executeRaydiumSwap(
  connection: Connection,
  userPublicKey: PublicKey,
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number,
  signTransaction: (tx: VersionedTransaction | Transaction) => Promise<VersionedTransaction | Transaction>
): Promise<string | null> {
  try {
    console.log("🚀 Starting Raydium swap...");
    
    // Step 1: Get quote
    const quote = await getRaydiumQuote(connection, inputMint, outputMint, amount, slippageBps);
    if (!quote) {
      throw new Error("Failed to get quote from Raydium");
    }

    // Step 2: Get swap transaction
    const txVersion = (quote as any).txVersion || "V0";
    const swapTransactions = await getRaydiumSwapTransaction(
      connection,
      userPublicKey,
      quote.data,
      inputMint,
      outputMint,
      txVersion
    );

    if (!swapTransactions || swapTransactions.length === 0) {
      throw new Error("Failed to get swap transaction from Raydium");
    }

    console.log(`Received ${swapTransactions.length} transaction(s) from Raydium`);

    // Step 3: Sign and send transactions
    const txIds: string[] = [];
    
    for (let i = 0; i < swapTransactions.length; i++) {
      const txBuf = swapTransactions[i];
      
      // Deserialize transaction
      let transaction: VersionedTransaction | Transaction;
      try {
        if (txVersion === "LEGACY") {
          transaction = Transaction.from(txBuf);
        } else {
          transaction = VersionedTransaction.deserialize(txBuf);
        }
      } catch (deserializeError) {
        console.error(`❌ Failed to deserialize transaction ${i + 1}:`, deserializeError);
        continue;
      }

      // Sign transaction
      console.log(`📝 Signing transaction ${i + 1}/${swapTransactions.length}...`);
      const signedTransaction = await signTransaction(transaction);

      // Send transaction
      console.log(`📤 Sending transaction ${i + 1}/${swapTransactions.length}...`);
      const rawTransaction = signedTransaction.serialize();
      const txid = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
        maxRetries: 3,
      });

      console.log(`✅ Transaction ${i + 1} sent: ${txid}`);
      txIds.push(txid);

      // Wait for confirmation
      if (i < swapTransactions.length - 1) {
        console.log("⏳ Waiting for confirmation before next transaction...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (txIds.length > 0) {
      console.log(`✅ Raydium swap complete! Last tx: ${txIds[txIds.length - 1]}`);
      return txIds[txIds.length - 1];
    }

    throw new Error("No transactions were successfully sent");
  } catch (error: any) {
    console.error("❌ Raydium swap failed:", error.message);
    return null;
  }
}

