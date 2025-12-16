import { Connection, PublicKey } from "@solana/web3.js";

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.mainnet-beta.solana.com";
export const connection = new Connection(RPC_URL, {
  commitment: "confirmed",
  wsEndpoint: process.env.NEXT_PUBLIC_WS_ENDPOINT || "wss://api.mainnet-beta.solana.com",
});

// ✅ Get SOL balance
export async function getSolBalance(pubkey: string): Promise<number> {
  try {
    const balanceLamports = await connection.getBalance(new PublicKey(pubkey));
    return balanceLamports / 1e9; // lamports → SOL
  } catch (err) {
    console.error("Error fetching SOL balance:", err);
    return 0;
  }
}

// ✅ Get SPL token balance
export async function getTokenBalance(pubkey: string, mint: string): Promise<number> {
  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(pubkey),
      { mint: new PublicKey(mint) }
    );

    if (tokenAccounts.value.length === 0) return 0;

    const amount = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
    return amount || 0;
  } catch (err) {
    console.error("Error fetching token balance:", err);
    return 0;
  }
}