'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Plus, Trash2, Edit, Loader2, 
  User, Shield, X, Save
} from 'lucide-react';

interface Admin {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
  is_active: boolean;
  is_online: boolean;
  last_seen_at: string | null;
}

export default function TeamPage() {
  const router = useRouter();
  const [currentAdmin, setCurrentAdmin] = useState<any>(null);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    display_name: '',
    avatar_url: '',
    role: 'agent'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const session = localStorage.getItem('helpdesk_session');
    const adminData = localStorage.getItem('helpdesk_admin');
    
    if (!session || !adminData) {
      router.push('/helpdesk/admin');
      return;
    }

    const admin = JSON.parse(adminData);
    if (admin.role !== 'owner') {
      router.push('/helpdesk/admin/dashboard');
      return;
    }

    setCurrentAdmin(admin);
    loadTeam();
  }, [router]);

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('helpdesk_session')}`,
    'Content-Type': 'application/json'
  });

  const loadTeam = async () => {
    try {
      const res = await fetch('/api/helpdesk/admin/team', {
        headers: getAuthHeaders()
      });

      if (res.ok) {
        const data = await res.json();
        setAdmins(data.admins || []);
      }
    } catch (err) {
      console.error('Load team error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      const url = editingAdmin 
        ? `/api/helpdesk/admin/team/${editingAdmin.id}`
        : '/api/helpdesk/admin/team';
      
      const method = editingAdmin ? 'PATCH' : 'POST';
      
      const body: any = {
        email: formData.email,
        display_name: formData.display_name,
        avatar_url: formData.avatar_url || null,
        role: formData.role
      };

      if (formData.password) {
        body.password = formData.password;
      }

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to save');
        setIsSaving(false);
        return;
      }

      setShowForm(false);
      setEditingAdmin(null);
      setFormData({ email: '', password: '', display_name: '', avatar_url: '', role: 'agent' });
      loadTeam();
    } catch (err) {
      setError('Connection failed');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteAdmin = async (admin: Admin) => {
    if (admin.id === currentAdmin?.id) {
      alert("You can't delete yourself!");
      return;
    }

    if (admin.role === 'owner') {
      alert("You can't delete an owner!");
      return;
    }

    if (!confirm(`Delete ${admin.display_name}?`)) return;

    try {
      const res = await fetch(`/api/helpdesk/admin/team/${admin.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (res.ok) {
        loadTeam();
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const openEditForm = (admin: Admin) => {
    setEditingAdmin(admin);
    setFormData({
      email: admin.email,
      password: '',
      display_name: admin.display_name,
      avatar_url: admin.avatar_url || '',
      role: admin.role
    });
    setShowForm(true);
  };

  const openNewForm = () => {
    setEditingAdmin(null);
    setFormData({ email: '', password: '', display_name: '', avatar_url: '', role: 'agent' });
    setShowForm(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#060609] flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-[#fb57ff]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060609] p-4 lg:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/helpdesk/admin/dashboard')}
              className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors"
            >
              <ArrowLeft size={20} className="text-white" />
            </button>
            <h1 
              className="text-2xl font-bold"
              style={{
                background: 'linear-gradient(45deg, white, #fb57ff)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              Team Management
            </h1>
          </div>
          <button
            onClick={openNewForm}
            className="px-4 py-2.5 rounded-xl text-white font-medium text-sm flex items-center gap-2 hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
          >
            <Plus size={18} />
            Add Admin
          </button>
        </div>

        {/* Team Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {admins.map(admin => (
            <div
              key={admin.id}
              className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 hover:border-[#fb57ff]/30 transition-colors"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-black to-[#fb57ff] flex items-center justify-center overflow-hidden">
                    {admin.avatar_url ? (
                      <img src={admin.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User size={24} className="text-white" />
                    )}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#060609] ${
                    admin.is_online ? 'bg-green-500' : 'bg-gray-600'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">{admin.display_name}</div>
                  <div className="text-gray-500 text-sm truncate">{admin.email}</div>
                </div>
                {admin.role === 'owner' && (
                  <Shield size={18} className="text-[#fb57ff]" />
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  admin.role === 'owner' 
                    ? 'bg-[#fb57ff]/20 text-[#fb57ff]' 
                    : 'bg-white/[0.04] text-gray-400'
                }`}>
                  {admin.role.charAt(0).toUpperCase() + admin.role.slice(1)}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEditForm(admin)}
                    className="p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                  >
                    <Edit size={16} className="text-gray-400" />
                  </button>
                  {admin.id !== currentAdmin?.id && admin.role !== 'owner' && (
                    <button
                      onClick={() => deleteAdmin(admin)}
                      className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 size={16} className="text-red-400" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add/Edit Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-[#0a0a0f] border border-white/[0.05] rounded-2xl w-full max-w-md">
              <div className="flex items-center justify-between p-5 border-b border-white/[0.05]">
                <h2 className="text-white text-lg font-semibold">
                  {editingAdmin ? 'Edit Admin' : 'Add Admin'}
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="p-2 rounded-lg hover:bg-white/[0.04] transition-colors"
                >
                  <X size={18} className="text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div>
                  <label className="text-gray-400 text-sm mb-1.5 block">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-white text-sm focus:outline-none focus:border-[#fb57ff]/50"
                  />
                </div>

                <div>
                  <label className="text-gray-400 text-sm mb-1.5 block">
                    Password {editingAdmin && '(leave blank to keep current)'}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingAdmin}
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-white text-sm focus:outline-none focus:border-[#fb57ff]/50"
                  />
                </div>

                <div>
                  <label className="text-gray-400 text-sm mb-1.5 block">Display Name</label>
                  <input
                    type="text"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-white text-sm focus:outline-none focus:border-[#fb57ff]/50"
                  />
                </div>

                <div>
                  <label className="text-gray-400 text-sm mb-1.5 block">Avatar URL (optional)</label>
                  <input
                    type="url"
                    value={formData.avatar_url}
                    onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-white text-sm focus:outline-none focus:border-[#fb57ff]/50"
                  />
                </div>

                <div>
                  <label className="text-gray-400 text-sm mb-1.5 block">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-white text-sm focus:outline-none focus:border-[#fb57ff]/50"
                  >
                    <option value="agent">Agent</option>
                    <option value="owner">Owner</option>
                  </select>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-3 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
                >
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {editingAdmin ? 'Save Changes' : 'Add Admin'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
