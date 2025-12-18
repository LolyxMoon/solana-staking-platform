/**
 * StakePoint Helpdesk - Server-Side Encryption ONLY
 * The encryption key NEVER leaves the server
 * 
 * Flow:
 * 1. Visitor sends plaintext → API encrypts → Database stores ciphertext
 * 2. Admin requests → API decrypts → Returns plaintext
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

// Key is SERVER-SIDE ONLY - never in NEXT_PUBLIC_*
const ENCRYPTION_KEY = process.env.HELPDESK_ENCRYPTION_KEY!;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  throw new Error('HELPDESK_ENCRYPTION_KEY must be a 64-character hex string');
}

function getKey(): Buffer {
  return Buffer.from(ENCRYPTION_KEY, 'hex');
}

/**
 * Encrypt message content (server-side only)
 */
export function encryptMessage(plaintext: string): {
  encrypted: string;
  iv: string;
  authTag: string;
} {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  });
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  return {
    encrypted,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64')
  };
}

/**
 * Decrypt message content (server-side only)
 */
export function decryptMessage(
  encrypted: string,
  iv: string,
  authTag: string
): string {
  const key = getKey();
  const ivBuffer = Buffer.from(iv, 'base64');
  const authTagBuffer = Buffer.from(authTag, 'base64');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer, {
    authTagLength: AUTH_TAG_LENGTH
  });
  
  decipher.setAuthTag(authTagBuffer);
  
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Batch decrypt messages
 */
export function decryptMessages<T extends {
  id: string;
  encrypted_content: string;
  iv: string;
  auth_tag: string;
}>(messages: T[]): Array<Omit<T, 'encrypted_content' | 'iv' | 'auth_tag'> & { content: string }> {
  return messages.map((msg) => {
    try {
      const content = decryptMessage(msg.encrypted_content, msg.iv, msg.auth_tag);
      const { encrypted_content, iv, auth_tag, ...rest } = msg;
      return { ...rest, content };
    } catch (error) {
      console.error(`Failed to decrypt message ${msg.id}:`, error);
      const { encrypted_content, iv, auth_tag, ...rest } = msg;
      return { ...rest, content: '[Decryption failed]' };
    }
  });
}

/**
 * Hash sensitive data (one-way)
 */
export function hashData(data: string): string {
  return crypto
    .createHash('sha256')
    .update(data + ENCRYPTION_KEY) // Salted with key
    .digest('hex');
}

export default {
  encryptMessage,
  decryptMessage,
  decryptMessages,
  hashData
};
