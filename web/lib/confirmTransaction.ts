import { Connection } from "@solana/web3.js";

/**
 * Polling-based transaction confirmation (no WebSocket needed)
 * Works through RPC proxy
 */
export async function confirmTransactionPolling(
  connection: Connection,
  signature: string,
  maxRetries: number = 30,
  intervalMs: number = 2000
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    const response = await connection.getSignatureStatuses([signature]);
    const status = response.value[0];
    
    if (status) {
      if (status.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
      }
      if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
        return true;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  throw new Error("Transaction confirmation timeout");
}
