// lib/adminAuth.ts

// Add your admin wallet addresses here
export const ADMIN_WALLETS = [
  process.env.NEXT_PUBLIC_ADMIN_WALLET_1,
  process.env.NEXT_PUBLIC_ADMIN_WALLET_2,
  process.env.NEXT_PUBLIC_ADMIN_WALLET_3,
].filter(Boolean) as string[]; // Remove undefined values

// Check if wallet is admin
export function isAdmin(walletAddress: string | null): boolean {
  if (!walletAddress) return false;
  
  // Case-insensitive comparison for safety
  return ADMIN_WALLETS.some(
    admin => admin.toLowerCase() === walletAddress.toLowerCase()
  );
}

// Optional: Log admin access attempts (for security monitoring)
export function logAdminAccess(walletAddress: string, granted: boolean) {
  const timestamp = new Date().toISOString();
  console.log(`[ADMIN ACCESS] ${timestamp} - Wallet: ${walletAddress} - Access: ${granted ? "GRANTED" : "DENIED"}`);
  
  // Later you can save this to database for audit logs
  // await prisma.adminLog.create({ ... })
}