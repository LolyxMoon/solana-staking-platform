'use client';

/**
 * StakePoint Helpdesk - Admin Login Page
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/helpdesk/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store session token
      localStorage.setItem('helpdesk_session', data.sessionToken);
      localStorage.setItem('helpdesk_admin', JSON.stringify({
        id: data.adminId,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        role: data.role
      }));

      router.push('/helpdesk/admin/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '20px',
          padding: '40px',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              borderRadius: '16px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              boxShadow: '0 8px 25px -5px rgba(99, 102, 241, 0.4)'
            }}
          >
            <img
              src="/favicon.jpg"
              alt="StakePoint"
              style={{ width: '48px', height: '48px', borderRadius: '8px' }}
            />
          </div>
          <h1
            style={{
              color: 'white',
              fontSize: '24px',
              fontWeight: 700,
              margin: '0 0 8px 0'
            }}
          >
            Helpdesk Admin
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: 0 }}>
            Sign in to manage support conversations
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin}>
          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '10px',
                padding: '12px 16px',
                marginBottom: '20px',
                color: '#f87171',
                fontSize: '14px'
              }}
            >
              {error}
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                color: 'rgba(255,255,255,0.8)',
                fontSize: '14px',
                fontWeight: 500,
                marginBottom: '8px'
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                padding: '14px 16px',
                color: 'white',
                fontSize: '15px',
                outline: 'none',
                transition: 'border-color 0.2s, background 0.2s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#6366f1';
                e.target.style.background = 'rgba(255,255,255,0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                e.target.style.background = 'rgba(255,255,255,0.08)';
              }}
              placeholder="admin@stakepoint.app"
            />
          </div>

          <div style={{ marginBottom: '28px' }}>
            <label
              style={{
                display: 'block',
                color: 'rgba(255,255,255,0.8)',
                fontSize: '14px',
                fontWeight: 500,
                marginBottom: '8px'
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                padding: '14px 16px',
                color: 'white',
                fontSize: '15px',
                outline: 'none',
                transition: 'border-color 0.2s, background 0.2s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#6366f1';
                e.target.style.background = 'rgba(255,255,255,0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                e.target.style.background = 'rgba(255,255,255,0.08)';
              }}
              placeholder="••••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              background: isLoading
                ? 'rgba(99, 102, 241, 0.5)'
                : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              border: 'none',
              borderRadius: '10px',
              padding: '14px',
              color: 'white',
              fontSize: '15px',
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 4px 15px -3px rgba(99, 102, 241, 0.4)'
            }}
            onMouseOver={(e) => {
              if (!isLoading) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px -3px rgba(99, 102, 241, 0.5)';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 15px -3px rgba(99, 102, 241, 0.4)';
            }}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p
          style={{
            textAlign: 'center',
            color: 'rgba(255,255,255,0.4)',
            fontSize: '12px',
            marginTop: '24px'
          }}
        >
          StakePoint Helpdesk v1.0
        </p>
      </div>
    </div>
  );
}
