'use client';

/**
 * StakePoint Helpdesk - Secure Chat Widget
 * Messages are encrypted SERVER-SIDE only
 * No encryption key in browser
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface Message {
  id: string;
  sender_type: 'visitor' | 'admin';
  content: string;
  message_type: string;
  created_at: string;
  admin?: {
    display_name: string;
    avatar_url: string | null;
  };
}

interface ChatWidgetProps {
  position?: 'bottom-right' | 'bottom-left';
  primaryColor?: string;
  logoUrl?: string;
  welcomeMessage?: string;
  placeholderText?: string;
}

// Generate visitor UUID
function generateVisitorUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 0x0f) >> 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Get or create visitor UUID
function getOrCreateVisitorUUID(): string {
  const COOKIE_NAME = 'sp_visitor_id';
  const STORAGE_KEY = 'stakepoint_visitor_uuid';

  // Try cookie first
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === COOKIE_NAME && value) {
      return value;
    }
  }

  // Try localStorage
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    setVisitorCookie(stored);
    return stored;
  }

  // Generate new
  const newUUID = generateVisitorUUID();
  setVisitorCookie(newUUID);
  localStorage.setItem(STORAGE_KEY, newUUID);
  return newUUID;
}

function setVisitorCookie(uuid: string): void {
  const expiry = new Date();
  expiry.setMonth(expiry.getMonth() + 6);
  document.cookie = `sp_visitor_id=${uuid}; expires=${expiry.toUTCString()}; path=/; SameSite=Lax; Secure`;
}

export default function ChatWidget({
  position = 'bottom-right',
  primaryColor = '#6366f1',
  logoUrl = '/favicon.jpg',
  welcomeMessage = 'Hi! 👋 How can we help you today?',
  placeholderText = 'Type your message...'
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [visitorUUID, setVisitorUUID] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize
  useEffect(() => {
    const uuid = getOrCreateVisitorUUID();
    setVisitorUUID(uuid);
    setIsLoaded(true);
  }, []);

  // Load existing conversation when opened
  useEffect(() => {
    if (!visitorUUID || !isOpen) return;

    const initChat = async () => {
      try {
        // Register visitor
        await fetch('/api/helpdesk/visitor/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-visitor-uuid': visitorUUID
          },
          body: JSON.stringify({
            pageUrl: window.location.href,
            userAgent: navigator.userAgent
          })
        });

        // Check for existing conversation
        const convRes = await fetch('/api/helpdesk/visitor/conversation', {
          headers: { 'x-visitor-uuid': visitorUUID }
        });

        if (convRes.ok) {
          const { conversation } = await convRes.json();
          if (conversation) {
            setConversationId(conversation.id);
            await loadMessages(conversation.id);
          }
        }

        setIsConnected(true);

        // Poll for new messages every 3 seconds
        pollIntervalRef.current = setInterval(() => {
          if (conversationId) {
            loadMessages(conversationId);
          }
        }, 3000);
      } catch (error) {
        console.error('Chat init error:', error);
      }
    };

    initChat();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [visitorUUID, isOpen]);

  // Update polling when conversationId changes
  useEffect(() => {
    if (conversationId && pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(() => {
        loadMessages(conversationId);
      }, 3000);
    }
  }, [conversationId]);

  // Load messages
  const loadMessages = async (convId: string) => {
    try {
      const res = await fetch(`/api/helpdesk/visitor/messages?conversationId=${convId}`, {
        headers: { 'x-visitor-uuid': visitorUUID }
      });

      if (res.ok) {
        const { messages: newMessages } = await res.json();
        setMessages(newMessages);
      }
    } catch (error) {
      console.error('Load messages error:', error);
    }
  };

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Send message - PLAINTEXT to server
  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || !visitorUUID || isSending) return;

    const content = inputValue.trim();
    setInputValue('');
    setIsSending(true);

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: tempId,
      sender_type: 'visitor',
      content,
      message_type: 'text',
      created_at: new Date().toISOString()
    }]);

    try {
      const res = await fetch('/api/helpdesk/visitor/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-visitor-uuid': visitorUUID
        },
        body: JSON.stringify({
          conversationId,
          content  // PLAINTEXT - server will encrypt
        })
      });

      if (res.ok) {
        const { conversationId: newConvId } = await res.json();
        if (!conversationId) {
          setConversationId(newConvId);
        }
        // Reload to get server-assigned ID
        setTimeout(() => loadMessages(newConvId || conversationId!), 500);
      } else {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        const error = await res.json();
        console.error('Send error:', error);
      }
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      console.error('Send message error:', error);
    } finally {
      setIsSending(false);
    }
  }, [inputValue, conversationId, visitorUUID, isSending]);

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isLoaded) return null;

  return (
    <>
      <style jsx global>{`
        @keyframes sp-chat-fade-in {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes sp-chat-slide-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sp-chat-widget * {
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .sp-chat-scrollbar::-webkit-scrollbar { width: 6px; }
        .sp-chat-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .sp-chat-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
      `}</style>

      <div
        className="sp-chat-widget"
        style={{
          position: 'fixed',
          [position === 'bottom-right' ? 'right' : 'left']: '20px',
          bottom: '20px',
          zIndex: 9999
        }}
      >
        {/* Chat Window */}
        {isOpen && (
          <div
            style={{
              position: 'absolute',
              bottom: '70px',
              [position === 'bottom-right' ? 'right' : 'left']: '0',
              width: '380px',
              height: '520px',
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'sp-chat-fade-in 0.3s ease-out',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            {/* Header */}
            <div
              style={{
                background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)`,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: 'rgba(255,255,255,0.2)', overflow: 'hidden'
              }}>
                <img src={logoUrl} alt="StakePoint" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: 'white', fontWeight: 600, fontSize: '15px' }}>StakePoint Support</div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: isConnected ? '#22c55e' : '#eab308'
                  }} />
                  {isConnected ? 'Online' : 'Connecting...'}
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px',
                  width: '32px', height: '32px', cursor: 'pointer', color: 'white', fontSize: '18px'
                }}
              >×</button>
            </div>

            {/* Messages */}
            <div className="sp-chat-scrollbar" style={{
              flex: 1, overflowY: 'auto', padding: '16px',
              display: 'flex', flexDirection: 'column', gap: '12px'
            }}>
              {messages.length === 0 && (
                <div style={{ display: 'flex', gap: '10px', animation: 'sp-chat-slide-up 0.3s ease-out' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: primaryColor, overflow: 'hidden'
                  }}>
                    <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{
                    background: 'rgba(255,255,255,0.1)', borderRadius: '12px 12px 12px 4px',
                    padding: '12px 16px', color: 'rgba(255,255,255,0.9)', fontSize: '14px', maxWidth: '85%'
                  }}>
                    {welcomeMessage}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: msg.sender_type === 'visitor' ? 'row-reverse' : 'row',
                    gap: '10px',
                    animation: 'sp-chat-slide-up 0.3s ease-out'
                  }}
                >
                  {msg.sender_type === 'admin' && (
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: primaryColor, overflow: 'hidden'
                    }}>
                      {msg.admin?.avatar_url ? (
                        <img src={msg.admin.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                    </div>
                  )}
                  <div style={{
                    background: msg.sender_type === 'visitor' ? primaryColor : 'rgba(255,255,255,0.1)',
                    borderRadius: msg.sender_type === 'visitor' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                    padding: '12px 16px', color: 'white', fontSize: '14px', maxWidth: '85%', wordBreak: 'break-word'
                  }}>
                    {msg.sender_type === 'admin' && msg.admin?.display_name && (
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>
                        {msg.admin.display_name}
                      </div>
                    )}
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={placeholderText}
                  disabled={isSending}
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px', padding: '12px 16px', color: 'white', fontSize: '14px', outline: 'none'
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputValue.trim() || isSending}
                  style={{
                    background: inputValue.trim() && !isSending ? primaryColor : 'rgba(255,255,255,0.1)',
                    border: 'none', borderRadius: '10px', width: '44px', height: '44px',
                    cursor: inputValue.trim() && !isSending ? 'pointer' : 'default',
                    opacity: inputValue.trim() && !isSending ? 1 : 0.5
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </div>
              <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                🔒 Messages are encrypted
              </div>
            </div>
          </div>
        )}

        {/* Toggle Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: '60px', height: '60px', borderRadius: '50%',
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%)`,
            border: 'none', cursor: 'pointer',
            boxShadow: '0 8px 25px -5px rgba(99, 102, 241, 0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform 0.3s', position: 'relative'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <img
            src={logoUrl}
            alt="Chat"
            style={{
              width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover',
              transition: 'opacity 0.3s',
              opacity: isOpen ? 0 : 1,
              position: 'absolute'
            }}
          />
          <svg
            width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"
            style={{ transition: 'opacity 0.3s', opacity: isOpen ? 1 : 0, position: 'absolute' }}
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </>
  );
}
