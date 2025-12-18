/**
 * StakePoint Helpdesk - Supabase Client Configuration
 */

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

// Environment variables (set in .env.local)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Types for the helpdesk tables
export interface Admin {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: 'owner' | 'agent';
  is_active: boolean;
  is_online: boolean;
  last_seen_at: string;
  created_at: string;
}

export interface Visitor {
  id: string;
  visitor_uuid: string;
  display_name: string | null;
  email: string | null;
  metadata: Record<string, any>;
  page_url: string | null;
  created_at: string;
  last_seen_at: string;
}

export interface Conversation {
  id: string;
  visitor_id: string;
  assigned_admin_id: string | null;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  subject: string | null;
  unread_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  visitor?: Visitor;
  assigned_admin?: Admin;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_type: 'visitor' | 'admin';
  admin_id: string | null;
  encrypted_content: string;
  iv: string;
  auth_tag: string;
  message_type: 'text' | 'image' | 'file' | 'system';
  is_read: boolean;
  created_at: string;
  // Decrypted content (added client-side)
  content?: string;
  // Joined relations
  admin?: Admin;
}

// Create Supabase client with visitor UUID header
export function createHelpdeskClient(visitorUUID?: string): SupabaseClient {
  const headers: Record<string, string> = {};
  
  if (visitorUUID) {
    headers['x-visitor-uuid'] = visitorUUID;
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  });
}

// Create admin client with service role (for admin dashboard)
export function createAdminClient(): SupabaseClient {
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
  
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Subscribe to new messages in a conversation
export function subscribeToMessages(
  supabase: SupabaseClient,
  conversationId: string,
  onMessage: (message: Message) => void
): RealtimeChannel {
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'helpdesk_messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      (payload) => {
        onMessage(payload.new as Message);
      }
    )
    .subscribe();
}

// Subscribe to all conversations (for admin)
export function subscribeToConversations(
  supabase: SupabaseClient,
  onUpdate: (conversation: Conversation) => void
): RealtimeChannel {
  return supabase
    .channel('admin:conversations')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'helpdesk_conversations'
      },
      (payload) => {
        onUpdate(payload.new as Conversation);
      }
    )
    .subscribe();
}

// Subscribe to new messages across all conversations (for admin notifications)
export function subscribeToAllMessages(
  supabase: SupabaseClient,
  onMessage: (message: Message) => void
): RealtimeChannel {
  return supabase
    .channel('admin:all-messages')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'helpdesk_messages',
        filter: 'sender_type=eq.visitor'
      },
      (payload) => {
        onMessage(payload.new as Message);
      }
    )
    .subscribe();
}

export default {
  createHelpdeskClient,
  createAdminClient,
  subscribeToMessages,
  subscribeToConversations,
  subscribeToAllMessages
};
