"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { isAdmin } from "@/lib/adminAuth";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { ShieldAlert, Lock, RefreshCw } from "lucide-react";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { publicKey, connected } = useWallet();
  
  // 🔒 JWT Authentication
  const { 
    isAuthenticated, 
    isLoading: authLoading, 
    error: authError, 
    login 
  } = useAdminAuth();

  // ====================================================================
  // STATE 1: Not connected to wallet
  // ====================================================================
  if (!connected || !publicKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-6">
        <div className="max-w-md w-full bg-gray-800/50 border-2 border-red-500/50 rounded-2xl p-8 text-center">
          <Lock className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">Admin Access Required</h1>
          <p className="text-gray-400 mb-6">
            Please connect your wallet to access the admin panel
          </p>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-yellow-300 text-sm">
              ⚠️ Only authorized wallets can access this area
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ====================================================================
  // STATE 2: Connected but not in admin list (frontend check)
  // ====================================================================
  if (!isAdmin(publicKey.toString())) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-6">
        <div className="max-w-md w-full bg-gray-800/50 border-2 border-red-500/50 rounded-2xl p-8 text-center">
          <ShieldAlert className="w-16 h-16 text-red-400 mx-auto mb-4 animate-pulse" />
          <h1 className="text-3xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400 mb-6">
            Your wallet is not authorized to access the admin panel
          </p>
          
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 mb-6">
            <p className="text-xs text-gray-500 mb-1">Connected Wallet:</p>
            <p className="text-gray-300 font-mono text-sm break-all">
              {publicKey.toString()}
            </p>
          </div>

          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <p className="text-red-300 text-sm font-semibold mb-2">
              🚫 Unauthorized Access
            </p>
            <p className="text-red-400 text-xs">
              This incident has been logged. If you believe this is an error, please contact the administrator.
            </p>
          </div>

          <button
            onClick={() => window.location.href = "/"}
            className="mt-6 w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-all"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  // ====================================================================
  // STATE 3: Admin wallet but checking JWT authentication
  // ====================================================================
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // ====================================================================
  // STATE 4: Admin wallet but NOT authenticated with JWT
  // Show login screen
  // ====================================================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-6">
        <div className="max-w-md w-full bg-slate-900 border-2 border-blue-500/50 rounded-2xl p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Admin Authentication Required
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              Sign a message with your wallet to prove ownership and access the admin panel
            </p>
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-500 mb-1">Connected Wallet:</p>
              <p className="text-gray-300 font-mono text-sm break-all">
                {publicKey.toString()}
              </p>
            </div>
          </div>

          {authError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
              <p className="text-red-400 text-sm">{authError}</p>
            </div>
          )}

          <button
            onClick={login}
            disabled={authLoading}
            className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-500 hover:to-purple-500 transition-all font-semibold text-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {authLoading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Signing...
              </>
            ) : (
              <>
                <Lock className="w-5 h-5" />
                Sign to Login
              </>
            )}
          </button>

          <div className="mt-6 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <p className="text-blue-300 text-xs">
              <strong>🔒 Secure Authentication:</strong>
              <br />
              • Your wallet will prompt you to sign a message
              <br />
              • No transaction fee required
              <br />
              • Session valid for 24 hours
              <br />
              • Signature never leaves your device
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ====================================================================
  // STATE 5: Fully authenticated - show admin panel
  // ====================================================================
  return <>{children}</>;
}
