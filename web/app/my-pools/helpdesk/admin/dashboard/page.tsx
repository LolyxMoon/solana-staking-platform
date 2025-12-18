'use client';

/**
 * StakePoint Helpdesk - Admin Dashboard
 * Manage conversations, view messages, respond to users
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Admin {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'owner' | 'agent';
}

interface Visitor {
  id: string;
  visitor_uuid: string;
  display_name: string | null;
  email: string | null;
  page_url: string | null;
  created_at: string;
  last_seen_at: string;
}

interface Conversation {
  id: string;
  visitor_id: string;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  subject: string | null;
  unread_count: number;
  last_message_at: string | null;
  created_at: string;
  visitor?: Visitor;
  assigned_admin?: Admin;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_type: 'visitor' | 'admin';
  admin_id: string | null;
  content: string;
  message_type: 'text' | 'image' | 'file' | 'system';
  is_read: boolean;
  created_at: string;
  admin?: Admin;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'pending' | 'resolved'>('all');
  const [showSettings, setShowSettings] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check authentication
  useEffect(() => {
    const sessionToken = localStorage.getItem('helpdesk_session');
    const adminData = localStorage.getItem('helpdesk_admin');

    if (!sessionToken || !adminData) {
      router.push('/helpdesk/admin');
      return;
    }

    setAdmin(JSON.parse(adminData));
    loadConversations();

    // Poll for updates every 3 seconds
    pollIntervalRef.current = setInterval(loadConversations, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [router]);

  // Load conversations
  const loadConversations = async () => {
    try {
      const sessionToken = localStorage.getItem('helpdesk_session');
      const response = await fetch('/api/helpdesk/admin/conversations', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('helpdesk_session');
          localStorage.removeItem('helpdesk_admin');
          router.push('/helpdesk/admin');
          return;
        }
        throw new Error('Failed to load conversations');
      }

      const data = await response.json();
      setConversations(data.conversations);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      setIsLoading(false);
    }
  };

  // Load messages for selected conversation
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  const loadMessages = async (conversationId: string) => {
    try {
      const sessionToken = localStorage.getItem('helpdesk_session');
      const response = await fetch(`/api/helpdesk/admin/messages?conversationId=${conversationId}`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
        
        // Mark as read
        await fetch(`/api/helpdesk/admin/conversations/${conversationId}/read`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const sendMessage = async () => {
    if (!inputValue.trim() || !selectedConversation || !admin) return;

    const content = inputValue.trim();
    setInputValue('');

    try {
      const sessionToken = localStorage.getItem('helpdesk_session');
      const response = await fetch('/api/helpdesk/admin/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          content
        })
      });

      if (response.ok) {
        // Add optimistic message
        const newMessage: Message = {
          id: `temp-${Date.now()}`,
          conversation_id: selectedConversation.id,
          sender_type: 'admin',
          admin_id: admin.id,
          content,
          message_type: 'text',
          is_read: true,
          created_at: new Date().toISOString(),
          admin
        };
        setMessages((prev) => [...prev, newMessage]);
        
        // Reload to get real message
        setTimeout(() => loadMessages(selectedConversation.id), 500);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // Update conversation status
  const updateStatus = async (status: Conversation['status']) => {
    if (!selectedConversation) return;

    try {
      const sessionToken = localStorage.getItem('helpdesk_session');
      await fetch(`/api/helpdesk/admin/conversations/${selectedConversation.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ status })
      });

      setSelectedConversation({ ...selectedConversation, status });
      loadConversations();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('helpdesk_session');
    localStorage.removeItem('helpdesk_admin');
    router.push('/helpdesk/admin');
  };

  // Filter conversations
  const filteredConversations = conversations.filter((conv) => {
    if (filter === 'all') return true;
    return conv.status === filter;
  });

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const statusColors = {
    open: '#22c55e',
    pending: '#eab308',
    resolved: '#3b82f6',
    closed: '#6b7280'
  };

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white'
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100vh',
        background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)',
        display: 'flex',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: 'white'
      }}
    >
      {/* Sidebar - Conversations List */}
      <div
        style={{
          width: '320px',
          borderRight: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: admin?.avatarUrl 
                ? `url(${admin.avatarUrl}) center/cover`
                : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 600
            }}
          >
            {!admin?.avatarUrl && admin?.displayName?.charAt(0)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '15px' }}>{admin?.displayName}</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
              {admin?.role === 'owner' ? 'Owner' : 'Agent'}
            </div>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              width: '36px',
              height: '36px',
              cursor: 'pointer',
              color: 'white',
              fontSize: '18px'
            }}
          >
            ⚙️
          </button>
        </div>

        {/* Filters */}
        <div
          style={{
            padding: '12px 20px',
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          {(['all', 'open', 'pending', 'resolved'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                background: filter === f ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255,255,255,0.05)',
                border: filter === f ? '1px solid #6366f1' : '1px solid transparent',
                borderRadius: '6px',
                padding: '6px 12px',
                color: 'white',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Conversations List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredConversations.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: 'rgba(255,255,255,0.5)'
              }}
            >
              No conversations
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  background: selectedConversation?.id === conv.id
                    ? 'rgba(99, 102, 241, 0.1)'
                    : 'transparent',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => {
                  if (selectedConversation?.id !== conv.id) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  }
                }}
                onMouseOut={(e) => {
                  if (selectedConversation?.id !== conv.id) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px'
                    }}
                  >
                    {conv.visitor?.display_name?.charAt(0) || '👤'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: '14px', marginBottom: '2px' }}>
                      {conv.visitor?.display_name || `Visitor ${conv.visitor?.visitor_uuid.slice(0, 8)}`}
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        color: 'rgba(255,255,255,0.6)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {conv.subject || 'New conversation'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {conv.unread_count > 0 && (
                      <div
                        style={{
                          background: '#6366f1',
                          borderRadius: '10px',
                          padding: '2px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          marginBottom: '4px'
                        }}
                      >
                        {conv.unread_count}
                      </div>
                    )}
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                      {conv.last_message_at ? formatTime(conv.last_message_at) : formatTime(conv.created_at)}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: statusColors[conv.status]
                    }}
                  />
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>
                    {conv.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Logout Button */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '10px',
              color: '#f87171',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content - Messages */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedConversation ? (
          <>
            {/* Conversation Header */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>
                  {selectedConversation.visitor?.display_name || 
                   `Visitor ${selectedConversation.visitor?.visitor_uuid.slice(0, 8)}`}
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                  {selectedConversation.visitor?.email || selectedConversation.visitor?.page_url || 'No details'}
                </div>
              </div>
              
              {/* Status Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['open', 'pending', 'resolved', 'closed'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => updateStatus(status)}
                    style={{
                      background: selectedConversation.status === status
                        ? statusColors[status]
                        : 'rgba(255,255,255,0.1)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      transition: 'all 0.2s'
                    }}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Messages */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: msg.sender_type === 'admin' ? 'row-reverse' : 'row',
                    gap: '12px'
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      flexShrink: 0,
                      background: msg.sender_type === 'admin'
                        ? msg.admin?.avatarUrl
                          ? `url(${msg.admin.avatarUrl}) center/cover`
                          : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                        : 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px'
                    }}
                  >
                    {msg.sender_type === 'admin' && !msg.admin?.avatarUrl && msg.admin?.displayName?.charAt(0)}
                    {msg.sender_type === 'visitor' && '👤'}
                  </div>
                  <div style={{ maxWidth: '70%' }}>
                    {msg.sender_type === 'admin' && (
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'rgba(255,255,255,0.5)',
                          marginBottom: '4px',
                          textAlign: 'right'
                        }}
                      >
                        {msg.admin?.displayName || 'Admin'}
                      </div>
                    )}
                    <div
                      style={{
                        background: msg.sender_type === 'admin'
                          ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                          : 'rgba(255,255,255,0.1)',
                        borderRadius: msg.sender_type === 'admin'
                          ? '12px 12px 4px 12px'
                          : '12px 12px 12px 4px',
                        padding: '12px 16px',
                        fontSize: '14px',
                        lineHeight: 1.5
                      }}
                    >
                      {msg.content}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.4)',
                        marginTop: '4px',
                        textAlign: msg.sender_type === 'admin' ? 'right' : 'left'
                      }}
                    >
                      {formatTime(msg.created_at)}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div
              style={{
                padding: '20px 24px',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.2)'
              }}
            >
              <div style={{ display: 'flex', gap: '12px' }}>
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Type your reply... (Enter to send)"
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    padding: '14px 16px',
                    color: 'white',
                    fontSize: '14px',
                    resize: 'none',
                    outline: 'none',
                    minHeight: '50px',
                    maxHeight: '120px'
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputValue.trim()}
                  style={{
                    background: inputValue.trim()
                      ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                      : 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0 24px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: inputValue.trim() ? 'pointer' : 'default',
                    opacity: inputValue.trim() ? 1 : 0.5
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: '16px',
              color: 'rgba(255,255,255,0.5)'
            }}
          >
            <div style={{ fontSize: '48px' }}>💬</div>
            <div style={{ fontSize: '16px' }}>Select a conversation to view messages</div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowSettings(false)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
              borderRadius: '16px',
              padding: '24px',
              width: '400px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 20px 0', fontSize: '18px' }}>Settings</h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>
                Display Name
              </label>
              <input
                type="text"
                defaultValue={admin?.displayName}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: 'white',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>
                Avatar URL
              </label>
              <input
                type="text"
                defaultValue={admin?.avatarUrl || ''}
                placeholder="https://..."
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: 'white',
                  fontSize: '14px'
                }}
              />
            </div>

            {admin?.role === 'owner' && (
              <button
                onClick={() => router.push('/helpdesk/admin/team')}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px',
                  color: 'white',
                  fontSize: '14px',
                  cursor: 'pointer',
                  marginBottom: '12px'
                }}
              >
                Manage Team Members
              </button>
            )}

            <button
              onClick={() => setShowSettings(false)}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                border: 'none',
                borderRadius: '8px',
                padding: '12px',
                color: 'white',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
