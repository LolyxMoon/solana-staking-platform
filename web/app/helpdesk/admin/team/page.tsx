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
      padding: '24px'
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => router.push('/helpdesk/admin/dashboard')}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px',
                cursor: 'pointer',
                color: 'white'
              }}
            >
              <ArrowLeft size={20} />
            </button>
            <h1 style={{ color: 'white', margin: 0 }}>Team Management</h1>
          </div>
          <button
            onClick={openNewForm}
            style={{
              background: '#6366f1',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              cursor: 'pointer',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Plus size={18} />
            Add Admin
          </button>
        </div>

        {/* Team Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {admins.map(admin => (
            <div
              key={admin.id}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '20px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: admin.avatar_url ? 'transparent' : '#6366f1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  {admin.avatar_url ? (
                    <img src={admin.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <User size={24} color="white" />
                  )}
                  <span style={{
                    position: 'absolute',
                    bottom: '2px',
                    right: '2px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: admin.is_online ? '#22c55e' : '#6b7280',
                    border: '2px solid #1a1a2e'
                  }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'white', fontWeight: '600' }}>{admin.display_name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>{admin.email}</div>
                </div>
                {admin.role === 'owner' && (
                  <Shield size={18} color="#eab308" />
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '12px',
                  background: admin.role === 'owner' ? 'rgba(234,179,8,0.2)' : 'rgba(99,102,241,0.2)',
                  color: admin.role === 'owner' ? '#eab308' : '#6366f1',
                  fontSize: '12px',
                  textTransform: 'capitalize'
                }}>
                  {admin.role}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => openEditForm(admin)}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px',
                      cursor: 'pointer',
                      color: 'rgba(255,255,255,0.6)'
                    }}
                  >
                    <Edit size={16} />
                  </button>
                  {admin.id !== currentAdmin?.id && admin.role !== 'owner' && (
                    <button
                      onClick={() => deleteAdmin(admin)}
                      style={{
                        background: 'rgba(239,68,68,0.2)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px',
                        cursor: 'pointer',
                        color: '#f87171'
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add/Edit Modal */}
        {showForm && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: '#1a1a2e',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '420px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ color: 'white', margin: 0 }}>
                  {editingAdmin ? 'Edit Admin' : 'Add Admin'}
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', marginBottom: '6px', fontSize: '14px' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: 'white',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', marginBottom: '6px', fontSize: '14px' }}>
                    Password {editingAdmin && '(leave blank to keep current)'}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingAdmin}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: 'white',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', marginBottom: '6px', fontSize: '14px' }}>
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: 'white',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', marginBottom: '6px', fontSize: '14px' }}>
                    Avatar URL (optional)
                  </label>
                  <input
                    type="url"
                    value={formData.avatar_url}
                    onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                    placeholder="https://..."
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: 'white',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', marginBottom: '6px', fontSize: '14px' }}>
                    Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: 'white',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="agent">Agent</option>
                    <option value="owner">Owner</option>
                  </select>
                </div>

                {error && (
                  <div style={{
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: '8px',
                    padding: '10px',
                    marginBottom: '16px',
                    color: '#f87171',
                    fontSize: '14px'
                  }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#6366f1',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontWeight: '600',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    opacity: isSaving ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
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
