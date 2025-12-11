"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { Plus, Gift, Shield, ArrowLeft } from "lucide-react";
import Link from "next/link";
import CreatePoolModalWithReferrer from "@/components/CreatePoolModalWithReferrer";

function CreatePoolContent() {
  const searchParams = useSearchParams();
  const { connected } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [referrerWallet, setReferrerWallet] = useState<string | null>(null);
  const [referrerValid, setReferrerValid] = useState(false);

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      try {
        // Validate it's a valid Solana address
        new PublicKey(ref);
        setReferrerWallet(ref);
        setReferrerValid(true);
      } catch {
        console.error("Invalid referrer wallet address");
        setReferrerWallet(null);
        setReferrerValid(false);
      }
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/[0.05]">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold" style={{ 
              background: 'linear-gradient(45deg, white, #fb57ff)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent' 
            }}>
              StakePoint
            </span>
          </Link>
          <WalletMultiButton />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Back Link */}
        <Link 
          href="/pools" 
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Pools
        </Link>

        {/* Referrer Banner */}
        {referrerWallet && referrerValid && (
          <div className="bg-[#fb57ff]/10 border border-[#fb57ff]/30 rounded-xl p-4 mb-8 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}>
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-semibold" style={{ color: '#fb57ff' }}>You were referred!</p>
              <p className="text-sm text-gray-300">
                Referred by: <span className="font-mono text-white">{referrerWallet.slice(0, 6)}...{referrerWallet.slice(-4)}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Referrer earns 50%</p>
              <p className="text-xs text-gray-400">of platform fees</p>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#fb57ff]/10 border border-[#fb57ff]/30 rounded-full mb-6">
            <Plus className="w-4 h-4" style={{ color: '#fb57ff' }} />
            <span className="text-sm font-medium" style={{ color: '#fb57ff' }}>Create Staking Pool</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ 
            background: 'linear-gradient(45deg, white, #fb57ff)', 
            WebkitBackgroundClip: 'text', 
            WebkitTextFillColor: 'transparent' 
          }}>
            Launch Your Staking Pool
          </h1>
          
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Create a staking pool for your token in minutes. No coding required.
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6 hover:border-[#fb57ff]/30 transition-colors">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}>
              <Plus className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Easy Setup</h3>
            <p className="text-gray-400 text-sm">
              Select your token, configure rewards, and launch in 4 simple transactions.
            </p>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6 hover:border-[#fb57ff]/30 transition-colors">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}>
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Fully On-Chain</h3>
            <p className="text-gray-400 text-sm">
              Your pool runs on Solana smart contracts. Secure, transparent, and decentralized.
            </p>
          </div>

          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6 hover:border-[#fb57ff]/30 transition-colors">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}>
              <Gift className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Reflection Support</h3>
            <p className="text-gray-400 text-sm">
              Distribute additional rewards from trading fees or external tokens to stakers.
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-white/[0.02] border border-[#fb57ff]/30 rounded-2xl p-8 text-center">
          {connected ? (
            <>
              <h2 className="text-2xl font-bold mb-4">Ready to Create Your Pool?</h2>
              <p className="text-gray-400 mb-6">
                You'll need tokens in your wallet to deposit as rewards.
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:scale-105"
                style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'linear-gradient(45deg, #fb57ff, black)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'linear-gradient(45deg, black, #fb57ff)'}
              >
                <Plus className="w-5 h-5 inline-block mr-2" />
                Create Pool
              </button>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
              <p className="text-gray-400 mb-6">
                Connect your wallet to create a staking pool for your token.
              </p>
              <WalletMultiButton />
            </>
          )}
        </div>

        {/* Pricing Info */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Pool creation fee: <span className="text-white font-semibold">0.01 SOL</span>
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Platform takes a small fee on deposits, withdrawals, and claims.
          </p>
        </div>
      </div>

      {/* Create Pool Modal */}
      {showModal && (
        <CreatePoolModalWithReferrer
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
          }}
          referrerWallet={referrerWallet}
          referrerSplitBps={5000} // 50% split - platform controlled
        />
      )}
    </div>
  );
}

export default function CreatePoolPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#fb57ff] border-t-transparent rounded-full" />
      </div>
    }>
      <CreatePoolContent />
    </Suspense>
  );
}