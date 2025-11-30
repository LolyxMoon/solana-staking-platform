import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { 
  Transaction, 
  TransactionInstruction, 
  PublicKey,
  SystemProgram 
} from "@solana/web3.js";
import bs58 from "bs58";

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export function useAdminAuth() {
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    token: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const checkExistingAuth = async () => {
      const storedToken = localStorage.getItem("admin_token");
      
      if (!storedToken) {
        setAuthState({
          isAuthenticated: false,
          token: null,
          isLoading: false,
          error: null,
        });
        return;
      }

      try {
        const response = await fetch("/api/admin/auth", {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (response.ok) {
          setAuthState({
            isAuthenticated: true,
            token: storedToken,
            isLoading: false,
            error: null,
          });
        } else {
          localStorage.removeItem("admin_token");
          setAuthState({
            isAuthenticated: false,
            token: null,
            isLoading: false,
            error: "Session expired",
          });
        }
      } catch (error) {
        console.error("Token verification error:", error);
        localStorage.removeItem("admin_token");
        setAuthState({
          isAuthenticated: false,
          token: null,
          isLoading: false,
          error: "Failed to verify session",
        });
      }
    };

    checkExistingAuth();
  }, []);

  const login = useCallback(async () => {
    if (!publicKey || !signTransaction) {
      setAuthState((prev) => ({
        ...prev,
        error: "Wallet not connected or does not support transaction signing",
      }));
      return false;
    }

    setAuthState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      console.log('🔑 Wallet:', publicKey.toString());
      console.log('📝 Creating authentication transaction...');

      // Create a nonce message
      const timestamp = Date.now();
      const message = `StakePoint Admin Auth ${timestamp}`;
      
      // Get latest blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      
      // Create transaction with simple transfer (better Ledger support)
      const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: publicKey,
      });

      // Add tiny transfer to self (1 lamport = 0.000000001 SOL)
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: publicKey,
          lamports: 1,
        })
      );

      console.log('✍️ Requesting transaction signature from wallet...');
      
      // Sign the transaction (works with Ledger!)
      const signedTx = await signTransaction(transaction);
      
      console.log('✅ Transaction signed');

      // Serialize the signed transaction
      const serializedTx = bs58.encode(signedTx.serialize());
      
      console.log('📦 Serialized transaction:', serializedTx.substring(0, 20) + '...');

      const payload = {
        wallet: publicKey.toString(),
        transaction: serializedTx,
        message: message,
      };

      console.log('📤 Sending auth request to backend...');
      
      // Send to backend for verification
      const response = await fetch("/api/admin/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log('📥 Response status:', response.status);
      
      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Auth failed:', data);
        throw new Error(data.error || "Authentication failed");
      }

      // Store token
      localStorage.setItem("admin_token", data.token);

      setAuthState({
        isAuthenticated: true,
        token: data.token,
        isLoading: false,
        error: null,
      });

      console.log("✅ Admin authenticated successfully");
      return true;
    } catch (error: any) {
      console.error("❌ Login error:", error);
      
      setAuthState({
        isAuthenticated: false,
        token: null,
        isLoading: false,
        error: error.message || "Authentication failed",
      });
      return false;
    }
  }, [publicKey, signTransaction, connection]);

  const logout = useCallback(() => {
    localStorage.removeItem("admin_token");
    setAuthState({
      isAuthenticated: false,
      token: null,
      isLoading: false,
      error: null,
    });
    console.log("🔓 Admin logged out");
  }, []);

  const getAuthHeaders = useCallback(() => {
    if (!authState.token) {
      return {};
    }
    return {
      Authorization: `Bearer ${authState.token}`,
    };
  }, [authState.token]);

  return {
    ...authState,
    login,
    logout,
    getAuthHeaders,
  };
}