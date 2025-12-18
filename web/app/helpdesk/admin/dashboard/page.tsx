'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MessageSquare, Users, Settings, LogOut, Send, 
  Menu, X, Loader2, Eye, EyeOff, Save, Bell
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

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

  useEffect(() => {
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
      markAsRead(selectedConversation.id);
      setSidebarOpen(false);
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
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation({ ...selectedConversation, status });
      }
    } catch (err) {
      console.error('Update status error:', err);
    }
  };

  const changePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await fetch('/api/helpdesk/admin/password', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setPasswordError(data.error || 'Failed to change password');
      } else {
        setPasswordSuccess('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setPasswordError('Connection failed');
    } finally {
      setIsChangingPassword(false);
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
    pending: '#fb57ff',
    resolved: '#6366f1',
    closed: '#6b7280'
  };

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#060609] flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-[#fb57ff]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060609] flex">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#060609] border-b border-white/[0.05] px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]"
        >
          <Menu size={20} className="text-white" />
        </button>
        <div className="flex items-center gap-2">
          <img src="/favicon.jpg" alt="Logo" className="w-8 h-8 rounded-lg" />
          <span className="text-white font-semibold">Helpdesk</span>
        </div>
        {totalUnread > 0 && (
          <span className="bg-[#fb57ff] text-white text-xs px-2 py-1 rounded-full">
            {totalUnread}
          </span>
        )}
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:relative inset-y-0 left-0 z-50
        w-80 bg-[#060609] border-r border-white/[0.05]
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col
      `}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/[0.05] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/favicon.jpg" alt="Logo" className="w-10 h-10 rounded-xl" />
            <div>
              <div className="text-white font-semibold">{admin?.displayName}</div>
              <div className="text-gray-500 text-xs capitalize">{admin?.role}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-lg hover:bg-white/[0.04] transition-colors"
            >
              <Settings size={18} className="text-gray-400" />
            </button>
            <button
              onClick={logout}
              className="p-2 rounded-lg hover:bg-white/[0.04] transition-colors"
            >
              <LogOut size={18} className="text-gray-400" />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-white/[0.04] transition-colors"
            >
              <X size={18} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-3 flex gap-2 flex-wrap border-b border-white/[0.05]">
          {['all', 'open', 'pending', 'resolved'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filter === f 
                  ? 'bg-[#fb57ff] text-white' 
                  : 'bg-white/[0.02] text-gray-400 hover:bg-white/[0.04]'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare size={40} className="mx-auto mb-3 text-gray-600" />
              <p className="text-gray-500">No conversations</p>
            </div>
          ) : (
            filteredConversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={`p-4 border-b border-white/[0.05] cursor-pointer transition-all ${
                  selectedConversation?.id === conv.id 
                    ? 'bg-[#fb57ff]/10 border-l-2 border-l-[#fb57ff]' 
                    : 'hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-white font-medium text-sm">
                    {conv.visitor?.display_name || `Visitor ${conv.visitor?.visitor_uuid?.slice(0, 8)}`}
                  </span>
                  <span 
                    className="w-2 h-2 rounded-full"
                    style={{ background: statusColors[conv.status] || '#6b7280' }}
                  />
                </div>
                <p className="text-gray-500 text-xs mb-2 line-clamp-1">
                  {conv.subject || 'No subject'}
                </p>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-xs">
                    {conv.last_message_at 
                      ? new Date(conv.last_message_at).toLocaleDateString()
                      : 'New'}
                  </span>
                  {conv.unread_count > 0 && (
                    <span className="bg-[#fb57ff] text-white text-xs px-2 py-0.5 rounded-full">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Team Link for Owners */}
        {admin?.role === 'owner' && (
          <div className="p-3 border-t border-white/[0.05]">
            <button
              onClick={() => router.push('/helpdesk/admin/team')}
              className="w-full py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-white/[0.04] transition-all"
            >
              <Users size={16} />
              Manage Team
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-0 pt-14 lg:pt-0">
        {selectedConversation ? (
          <>
            {/* Conversation Header */}
            <div className="px-4 lg:px-6 py-4 border-b border-white/[0.05] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#060609]">
              <div>
                <h2 className="text-white font-semibold text-lg">
                  {selectedConversation.visitor?.display_name || `Visitor ${selectedConversation.visitor?.visitor_uuid?.slice(0, 8)}`}
                </h2>
                <p className="text-gray-500 text-sm mt-0.5">
                  {selectedConversation.subject || 'No subject'}
                </p>
              </div>
              <select
                value={selectedConversation.status}
                onChange={(e) => updateStatus(selectedConversation.id, e.target.value)}
                className="px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] text-white text-sm focus:outline-none focus:border-[#fb57ff]/50"
              >
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] lg:max-w-[60%] ${
                    msg.sender_type === 'admin'
                      ? 'bg-gradient-to-r from-black to-[#fb57ff] text-white rounded-2xl rounded-br-sm'
                      : 'bg-white/[0.02] border border-white/[0.05] text-white rounded-2xl rounded-bl-sm'
                  } px-4 py-3`}>
                    {msg.sender_type === 'admin' && msg.admin?.display_name && (
                      <div className="text-xs text-white/70 mb-1">{msg.admin.display_name}</div>
                    )}
                    <p className="text-sm break-words">{msg.content}</p>
                    <p className="text-xs mt-1 opacity-50">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Reply Input */}
            <div className="p-4 lg:p-6 border-t border-white/[0.05] bg-[#060609]">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Type your reply..."
                  className="flex-1 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#fb57ff]/50"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || isSending}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-black to-[#fb57ff] text-white font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                >
                  {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  <span className="hidden sm:inline">Send</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <MessageSquare size={60} className="text-gray-700 mb-4" />
            <h3 className="text-white text-lg font-medium mb-2">Select a conversation</h3>
            <p className="text-gray-500 text-sm">Choose from the sidebar to view messages</p>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0a0a0f] border border-white/[0.05] rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-white/[0.05]">
              <h2 className="text-white text-lg font-semibold">Settings</h2>
              <button
                onClick={() => {
                  setShowSettings(false);
                  setPasswordError('');
                  setPasswordSuccess('');
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="p-2 rounded-lg hover:bg-white/[0.04] transition-colors"
              >
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <h3 className="text-white font-medium">Change Password</h3>
              
              <div>
                <label className="text-gray-400 text-sm mb-1.5 block">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-10 rounded-xl bg-white/[0.02] border border-white/[0.05] text-white text-sm focus:outline-none focus:border-[#fb57ff]/50"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-1.5 block">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-10 rounded-xl bg-white/[0.02] border border-white/[0.05] text-white text-sm focus:outline-none focus:border-[#fb57ff]/50"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-sm mb-1.5 block">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-white text-sm focus:outline-none focus:border-[#fb57ff]/50"
                  placeholder="••••••••"
                />
              </div>

              {passwordError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-green-400 text-sm">
                  {passwordSuccess}
                </div>
              )}

              <button
                onClick={changePassword}
                disabled={isChangingPassword}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-black to-[#fb57ff] text-white font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isChangingPassword ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                Save Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
