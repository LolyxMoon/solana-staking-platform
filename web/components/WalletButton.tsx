"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    solana?: any;
  }
}

export default function WalletButton() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    console.log("Phantom detected:", !!window.solana);
    console.log("Phantom isPhantom:", window.solana?.isPhantom);
  }, []);

  const connectWallet = async () => {
    try {
      console.log("Connect button clicked");
      
      if (!window.solana) {
        alert("Phantom wallet is not installed!");
        window.open("https://phantom.app/", "_blank");
        return;
      }

      console.log("Calling window.solana.connect()...");
      const response = await window.solana.connect();
      console.log("Connection response:", response);
      
      const pubKey = response.publicKey.toString();
      setWalletAddress(pubKey);
      console.log("Connected to:", pubKey);
      
      alert("Connected! Address: " + pubKey.slice(0, 8) + "...");
    } catch (error) {
      console.error("Connection error:", error);
      alert("Failed to connect: " + error);
    }
  };

  const disconnectWallet = async () => {
    try {
      console.log("Disconnecting...");
      await window.solana?.disconnect();
      setWalletAddress(null);
      console.log("Disconnected");
      alert("Wallet disconnected!");
    } catch (error) {
      console.error("Disconnect error:", error);
    }
  };

  if (!mounted) {
    return <div className="px-4 py-2 bg-gray-600 rounded-lg text-sm">Loading...</div>;
  }

  if (walletAddress) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-xs text-green-400 text-center font-mono">
          ✅ {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
        </div>
        <button
          onClick={disconnectWallet}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connectWallet}
      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-semibold"
    >
      Connect Phantom
    </button>
  );
}