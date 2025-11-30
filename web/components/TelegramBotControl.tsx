"use client";

import { useState, useEffect } from "react";
import { Power, RefreshCw } from "lucide-react";

interface BotStatus {
  status: "running" | "stopped";
  enabled: boolean;
}

export default function TelegramBotControl() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const checkStatus = async () => {
    try {
      const res = await fetch("/api/telegram-bot");
      const data = await res.json();
      setStatus(data);
    } catch (error) {
      console.error("Failed to check bot status:", error);
    }
  };

  const controlBot = async (action: "start" | "stop") => {
    setLoading(true);
    try {
      const res = await fetch("/api/telegram-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        await checkStatus();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to control bot:", error);
      alert("Failed to control bot");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  if (!status) {
    return (
      <div className="bg-white/[0.02] backdrop-blur border border-white/[0.05] rounded-xl p-6">
        <div className="animate-pulse">Loading bot status...</div>
      </div>
    );
  }

  if (!status.enabled) {
    return (
      <div className="bg-white/[0.02] backdrop-blur border border-white/[0.05] rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">🤖 Telegram Bot</h3>
        <div className="text-yellow-500">
          ⚠️ Telegram bot is not configured. Add TELEGRAM_BOT_TOKEN to your environment variables.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.02] backdrop-blur border border-white/[0.05] rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">🤖 Telegram Bot</h3>
        <button
          onClick={checkStatus}
          disabled={loading}
          className="p-2 hover:bg-white/[0.05] rounded-lg transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              status.status === "running" ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <span className="font-medium">
            Status: {status.status === "running" ? "Running" : "Stopped"}
          </span>
        </div>

        <div className="flex gap-2">
          {status.status === "stopped" ? (
            <button
              onClick={() => controlBot("start")}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-all disabled:opacity-50"
            >
              <Power className="w-4 h-4" />
              Start Bot
            </button>
          ) : (
            <button
              onClick={() => controlBot("stop")}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-all disabled:opacity-50"
            >
              <Power className="w-4 h-4" />
              Stop Bot
            </button>
          )}
        </div>

        <div className="text-sm text-gray-400 border-t border-white/[0.05] pt-4">
          <p className="mb-2">📱 <strong>Bot Commands:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>/toptraders - Weekly top 10</li>
            <li>/top20 - Weekly top 20</li>
            <li>/monthly - Monthly top 10</li>
            <li>/alltime - All-time top 10</li>
          </ul>
        </div>
      </div>
    </div>
  );
}