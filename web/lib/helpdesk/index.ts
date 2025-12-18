/**
 * StakePoint Helpdesk - Secure Library Exports
 */

// Supabase client
export * from './supabase';

// Server-side encryption (NEVER import in client components)
// Use: import { encryptMessage, decryptMessage } from '@/lib/helpdesk/encryption.server';

// Admin authentication
export * from './admin-auth';

// Rate limiting
export * from './rate-limit';

// Audit logging
export * from './audit';
