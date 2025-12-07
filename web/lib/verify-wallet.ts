import nacl from 'tweetnacl';
import bs58 from 'bs58';

export function verifyWalletSignature(
  wallet: string,
  message: string,
  signature: string
): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = bs58.decode(wallet);
    
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

export function isSignatureValid(timestamp: number, maxAgeMs: number = 5 * 60 * 1000): boolean {
  const now = Date.now();
  return Math.abs(now - timestamp) <= maxAgeMs;
}