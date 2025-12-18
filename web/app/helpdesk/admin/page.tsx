'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/helpdesk/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setIsLoading(false);
        return;
      }

      localStorage.setItem('helpdesk_session', data.sessionToken);
      localStorage.setItem('helpdesk_refresh', data.refreshToken);
      localStorage.setItem('helpdesk_admin', JSON.stringify({
        id: data.adminId,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        role: data.role
      }));

      router.push('/helpdesk/admin/dashboard');
    } catch (err) {
      setError('Connection failed. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060609] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <img 
            src="/favicon.jpg" 
            alt="StakePoint" 
            className="w-16 h-16 rounded-2xl mx-auto mb-4"
          />
          <h1 
            className="text-2xl font-bold mb-2"
            style={{
              background: 'linear-gradient(45deg, white, #fb57ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            Helpdesk Admin
          </h1>
          <p className="text-gray-500">Sign in to manage support</p>
        </div>

        {/* Login Form */}
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-6">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#fb57ff]/50 transition-colors"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-2 block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 pr-12 rounded-xl bg-white/[0.02] border border-white/[0.05] text-white placeholder-gray-600 text-sm focus:outline-none focus:border-[#fb57ff]/50 transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-400 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              style={{
                background: 'linear-gradient(45deg, black, #fb57ff)'
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-6">
          StakePoint Support Dashboard
        </p>
      </div>
    </div>
  );
}
