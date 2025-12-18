'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MessageSquare, Users, Settings, LogOut, Send, 
  Clock, CheckCircle2, AlertCircle, Loader2,
  ChevronDown, RefreshCw
} from 'lucide-react';

interface Admin {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
}

interface Conversation {
  id: string;
  status: string;
  priority: string;
  subject: string;
  unread_count: number;
  last_message_at: string;
  created_at: string;
  visitor: {
    id: string;
    visitor_uuid: string;
    display_name: string | null;
  };
}

interface Message {
  id: string;
  sender_type: 'visitor' | 'admin';
  content: string;
  created_at: string;
  admin?: {
    display_name: string;
    avatar_url: string | null;
  };
}

export default function AdminDashboard() {
  const router = useRouter();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [filter, setFilter] = useState('all');
  const [showSettings, setShowSettings] = useState(false);

  // Auth check
  useEffect(() => {
    const session = localStorage.getItem('helpdesk_session');
    const adminData = localStorage.getItem('helpdesk_admin');
    
    if (!session || !adminData) {
      router.push('/helpdesk/admin');
      return;
    }

    setAdmin(JSON.parse(adminData));
    loadConversations();
  }, [router]);

  // Poll for new conversations
  useEffect(() => {
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  // Load messages when conversation selected
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
      markAsRead(selectedConversation.id);
    }
  }, [selectedConversation]);

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('helpdesk_session')}`,
    'Content-Type': 'application/json'
  });

  const loadConversations = async () => {
    try {
      const res = await fetch('/api/helpdesk/admin/conversations', {
        headers: getAuthHeaders()
      });

      if (res.status === 401) {
        localStorage.clear();
        router.push('/helpdesk/admin');
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error('Load conversations error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const res = await fetch(`/api/helpdesk/admin/messages?conversationId=${conversationId}`, {
        headers: getAuthHeaders()
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Load messages error:', err);
    }
  };

  const markAsRead = async (conversationId: string) => {
    try {
      await fetch(`/api/helpdesk/admin/conversations/${conversationId}/read`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      loadConversations();
    } catch (err) {
      console.error('Mark as read error:', err);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || isSending) return;

    setIsSending(true);
    try {
      const res = await fetch('/api/helpdesk/admin/messages', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          content: newMessage
        })
      });

      if (res.ok) {
        setNewMessage('');
        loadMessages(selectedConversation.id);
        loadConversations();
      }
    } catch (err) {
      console.error('Send message error:', err);
    } finally {
      setIsSending(false);
    }
  };

  const updateStatus = async (conversationId: string, status: string) => {
    try {
      await fetch(`/api/helpdesk/admin/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status })
      });
      loadConversations();
    } catch (err) {
      console.error('Update status error:', err);
    }
  };

  const logout = () => {
    localStorage.removeItem('helpdesk_session');
    localStorage.removeItem('helpdesk_refresh');
    localStorage.removeItem('helpdesk_admin');
    router.push('/helpdesk/admin');
  };

  const filteredConversations = conversations.filter(c => 
    filter === 'all' || c.status === filter
  );

  const statusColors: Record<string, string> = {
    open: '#22c55e',
    pending: '#eab308',
    resolved: '#6366f1',
    closed: '#6b7280'
  };

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Loader2 size={40} color="#6366f1" className="animate-spin" />
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      display: 'flex'
    }}>
      {/* Sidebar */}
      <div style={{
        width: '320px',
        borderRight: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src="/favicon.jpg" alt="Logo" style={{ width: '36px', height: '36px', borderRadius: '8px' }} />
            <div>
              <div style={{ color: 'white', fontWeight: '600' }}>{admin?.displayName}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>{admin?.role}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}
            >
              <Settings size={20} />
            </button>
            <button
              onClick={logout}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ padding: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['all', 'open', 'pending', 'resolved'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 12px',
                borderRadius: '16px',
                border: 'none',
                background: filter === f ? '#6366f1' : 'rgba(255,255,255,0.1)',
                color: 'white',
                fontSize: '12px',
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Conversation List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredConversations.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
              <MessageSquare size={40} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <p>No conversations</p>
            </div>
          ) : (
            filteredConversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                style={{
                  padding: '16px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  background: selectedConversation?.id === conv.id ? 'rgba(99,102,241,0.2)' : 'transparent'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: 'white', fontWeight: '500' }}>
                    {conv.visitor?.display_name || `Visitor ${conv.visitor?.visitor_uuid?.slice(0, 8)}`}
                  </span>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: statusColors[conv.status] || '#6b7280'
                  }} />
                </div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginBottom: '4px' }}>
                  {conv.subject?.slice(0, 50) || 'No subject'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
                    {conv.last_message_at ? new Date(conv.last_message_at).toLocaleString() : 'New'}
                  </span>
                  {conv.unread_count > 0 && (
                    <span style={{
                      background: '#6366f1',
                      color: 'white',
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '10px'
                    }}>
                      {conv.unread_count}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Team Link */}
        {admin?.role === 'owner' && (
          <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <button
              onClick={() => router.push('/helpdesk/admin/team')}
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Users size={18} />
              Manage Team
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedConversation ? (
          <>
            {/* Conversation Header */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ color: 'white', margin: 0, fontSize: '18px' }}>
                  {selectedConversation.visitor?.display_name || `Visitor ${selectedConversation.visitor?.visitor_uuid?.slice(0, 8)}`}
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', margin: '4px 0 0', fontSize: '13px' }}>
                  {selectedConversation.subject || 'No subject'}
                </p>
              </div>
              <select
                value={selectedConversation.status}
                onChange={(e) => updateStatus(selectedConversation.id, e.target.value)}
                style={{
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {messages.map(msg => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: msg.sender_type === 'admin' ? 'row-reverse' : 'row',
                    marginBottom: '16px',
                    gap: '12px'
                  }}
                >
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: msg.sender_type === 'admin' ? '#6366f1' : 'rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}>
                    {msg.sender_type === 'admin' && msg.admin?.avatar_url ? (
                      <img src={msg.admin.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ color: 'white', fontSize: '14px' }}>
                        {msg.sender_type === 'admin' ? 'A' : 'V'}
                      </span>
                    )}
                  </div>
                  <div style={{
                    maxWidth: '70%',
                    background: msg.sender_type === 'admin' ? '#6366f1' : 'rgba(255,255,255,0.1)',
                    padding: '12px 16px',
                    borderRadius: msg.sender_type === 'admin' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    color: 'white'
                  }}>
                    {msg.sender_type === 'admin' && msg.admin?.display_name && (
                      <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>
                        {msg.admin.display_name}
                      </div>
                    )}
                    <div style={{ wordBreak: 'break-word' }}>{msg.content}</div>
                    <div style={{ fontSize: '11px', opacity: 0.5, marginTop: '4px' }}>
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Reply Input */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              gap: '12px'
            }}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type your reply..."
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim() || isSending}
                style={{
                  padding: '12px 24px',
                  background: newMessage.trim() && !isSending ? '#6366f1' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: newMessage.trim() && !isSending ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                Send
              </button>
            </div>
          </>
        ) : (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.5)'
          }}>
            <MessageSquare size={60} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p style={{ fontSize: '18px' }}>Select a conversation</p>
            <p style={{ fontSize: '14px', opacity: 0.7 }}>Choose from the sidebar to view messages</p>
          </div>
        )}
      </div>
    </div>
  );
}
