'use client';

/**
 * StakePoint Helpdesk - Team Management
 * Add and manage admin accounts (Owner only)
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Admin {
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

export default function TeamManagement() {
  const router = useRouter();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: '',
    avatarUrl: '',
    role: 'agent' as 'owner' | 'agent'
  });

  useEffect(() => {
    checkAuth();
    loadAdmins();
  }, []);

  const checkAuth = () => {
    const adminData = localStorage.getItem('helpdesk_admin');
    if (!adminData) {
      router.push('/helpdesk/admin');
      return;
    }
    const admin = JSON.parse(adminData);
    if (admin.role !== 'owner') {
      router.push('/helpdesk/admin/dashboard');
    }
  };

  const loadAdmins = async () => {
    try {
      const sessionToken = localStorage.getItem('helpdesk_session');
      const response = await fetch('/api/helpdesk/admin/team', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        setAdmins(data.admins);
      }
    } catch (error) {
      console.error('Failed to load admins:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const sessionToken = localStorage.getItem('helpdesk_session');
      const endpoint = editingAdmin
        ? `/api/helpdesk/admin/team/${editingAdmin.id}`
        : '/api/helpdesk/admin/team';

      const response = await fetch(endpoint, {
        method: editingAdmin ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save admin');
      }

      setSuccess(editingAdmin ? 'Admin updated successfully!' : 'Admin created successfully!');
      setShowAddModal(false);
      setEditingAdmin(null);
      setFormData({ email: '', password: '', displayName: '', avatarUrl: '', role: 'agent' });
      loadAdmins();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (adminId: string) => {
    if (!confirm('Are you sure you want to delete this admin?')) return;

    try {
      const sessionToken = localStorage.getItem('helpdesk_session');
      const response = await fetch(`/api/helpdesk/admin/team/${adminId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      });

      if (response.ok) {
        setSuccess('Admin deleted successfully!');
        loadAdmins();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete admin');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const openEditModal = (admin: Admin) => {
    setEditingAdmin(admin);
    setFormData({
      email: admin.email,
      password: '',
      displayName: admin.display_name,
      avatarUrl: admin.avatar_url || '',
      role: admin.role
    });
    setShowAddModal(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)',
        padding: '32px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: 'white'
      }}
    >
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <button
              onClick={() => router.push('/helpdesk/admin/dashboard')}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.6)',
                fontSize: '14px',
                cursor: 'pointer',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              ← Back to Dashboard
            </button>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>Team Management</h1>
            <p style={{ margin: '8px 0 0 0', color: 'rgba(255,255,255,0.6)' }}>
              Add and manage support agents
            </p>
          </div>
          <button
            onClick={() => {
              setEditingAdmin(null);
              setFormData({ email: '', password: '', displayName: '', avatarUrl: '', role: 'agent' });
              setShowAddModal(true);
            }}
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              border: 'none',
              borderRadius: '10px',
              padding: '12px 24px',
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span style={{ fontSize: '18px' }}>+</span>
            Add Admin
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '20px',
              color: '#f87171'
            }}
          >
            {error}
          </div>
        )}
        {success && (
          <div
            style={{
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '20px',
              color: '#4ade80'
            }}
          >
            {success}
          </div>
        )}

        {/* Admins Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px'
          }}
        >
          {admins.map((admin) => (
            <div
              key={admin.id}
              style={{
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '12px',
                    background: admin.avatar_url
                      ? `url(${admin.avatar_url}) center/cover`
                      : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    fontWeight: 600
                  }}
                >
                  {!admin.avatar_url && admin.display_name.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>
                    {admin.display_name}
                  </div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                    {admin.email}
                  </div>
                </div>
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: admin.is_online ? '#22c55e' : '#6b7280'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <span
                  style={{
                    background: admin.role === 'owner' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                    color: admin.role === 'owner' ? '#fbbf24' : '#a5b4fc',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 500,
                    textTransform: 'capitalize'
                  }}
                >
                  {admin.role}
                </span>
                <span
                  style={{
                    background: admin.is_active ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: admin.is_active ? '#4ade80' : '#f87171',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 500
                  }}
                >
                  {admin.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>
                Joined {formatDate(admin.created_at)}
                {admin.last_seen_at && ` • Last seen ${formatDate(admin.last_seen_at)}`}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => openEditModal(admin)}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px',
                    color: 'white',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Edit
                </button>
                {admin.role !== 'owner' && (
                  <button
                    onClick={() => handleDelete(admin.id)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '8px',
                      padding: '10px 16px',
                      color: '#f87171',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
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
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
              borderRadius: '16px',
              padding: '32px',
              width: '450px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 24px 0', fontSize: '20px' }}>
              {editingAdmin ? 'Edit Admin' : 'Add New Admin'}
            </h2>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>
                  Password {editingAdmin ? '(leave blank to keep current)' : '*'}
                </label>
                <input
                  type="password"
                  required={!editingAdmin}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>
                  Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>
                  Avatar URL (optional)
                </label>
                <input
                  type="url"
                  value={formData.avatarUrl}
                  onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                  placeholder="https://example.com/avatar.jpg"
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
                {formData.avatarUrl && (
                  <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Preview:</span>
                    <img
                      src={formData.avatarUrl}
                      alt="Preview"
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        objectFit: 'cover'
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'owner' | 'agent' })}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                >
                  <option value="agent">Agent</option>
                  <option value="owner">Owner</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '14px',
                    color: 'white',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '14px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {editingAdmin ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
