"use client";

import { X, Loader2, Check, AlertCircle, Gift, RefreshCw, Zap } from "lucide-react";

export type BatchOperationType = "claim" | "compound";

export type BatchTxStep = {
  id: string;
  batchNumber: number;
  poolSymbols: string[];
  status: "pending" | "building" | "signing" | "confirming" | "success" | "error";
  txSignature?: string;
  error?: string;
};

export type BatchOperationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  operationType: BatchOperationType;
  steps: BatchTxStep[];
  currentStepIndex: number;
  totalPools: number;
  totalBatches: number;
  successCount: number;
  failCount: number;
  isComplete: boolean;
  gasSaved?: number; // Number of transactions saved by batching
};

export default function BatchOperationModal({
  isOpen,
  onClose,
  operationType,
  steps,
  currentStepIndex,
  totalPools,
  totalBatches,
  successCount,
  failCount,
  isComplete,
  gasSaved = 0,
}: BatchOperationModalProps) {
  if (!isOpen) return null;

  const title = operationType === "claim" ? "Claiming All Rewards" : "Compounding All Rewards";
  const Icon = operationType === "claim" ? Gift : RefreshCw;

  const getStatusText = (status: BatchTxStep["status"]) => {
    switch (status) {
      case "building": return "Building transaction...";
      case "signing": return "Awaiting signature...";
      case "confirming": return "Confirming on-chain...";
      case "success": return "Confirmed!";
      case "error": return "Failed";
      default: return "Waiting...";
    }
  };

  const getStepIcon = (step: BatchTxStep) => {
    switch (step.status) {
      case "building":
      case "signing":
      case "confirming":
        return <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#fb57ff' }} />;
      case "success":
        return <Check className="w-5 h-5 text-green-400" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-gray-600" />;
    }
  };

  const explorerUrl = (sig: string) => {
    const cluster = process.env.NEXT_PUBLIC_NETWORK === "mainnet-beta" ? "" : "?cluster=devnet";
    return `https://solscan.io/tx/${sig}${cluster}`;
  };

  // Calculate progress
  const completedBatches = steps.filter(s => s.status === "success" || s.status === "error").length;
  const progress = isComplete ? 100 : (completedBatches / totalBatches) * 100;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-black/95 rounded-2xl max-w-lg w-full border border-white/[0.1] animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
            >
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{title}</h2>
              <p className="text-sm text-gray-400">
                {isComplete 
                  ? `${successCount} of ${totalBatches} batches succeeded`
                  : `Processing batch ${currentStepIndex + 1} of ${totalBatches}`
                }
              </p>
            </div>
          </div>
          {isComplete && (
            <button 
              onClick={onClose} 
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Batch Info Banner */}
        <div className="mx-6 mt-4 p-3 rounded-lg bg-[#fb57ff]/10 border border-[#fb57ff]/20">
          <div className="flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4" style={{ color: '#fb57ff' }} />
            <span style={{ color: '#fb57ff' }} className="font-medium">
              Batched: {totalPools} pools → {totalBatches} transaction{totalBatches > 1 ? 's' : ''}
            </span>
            {gasSaved > 0 && (
              <span className="text-green-400 ml-auto text-xs">
                Saving ~{gasSaved} tx fees
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4">
          <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
            <div 
              className="h-full transition-all duration-500 ease-out rounded-full"
              style={{ 
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #fb57ff, #9333ea)'
              }}
            />
          </div>
        </div>

        {/* Batch Steps */}
        <div className="p-6 max-h-72 overflow-y-auto">
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div 
                key={step.id}
                className={`p-4 rounded-lg transition-all border ${
                  step.status === "building" || step.status === "signing" || step.status === "confirming"
                    ? 'bg-[#fb57ff]/10 border-[#fb57ff]/30' 
                    : step.status === "success"
                    ? 'bg-green-500/10 border-green-500/20'
                    : step.status === "error"
                    ? 'bg-red-500/10 border-red-500/20'
                    : 'bg-white/[0.02] border-white/[0.05]'
                }`}
              >
                <div className="flex items-center gap-3">
                  {getStepIcon(step)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${
                        step.status === "success" ? 'text-green-300' :
                        step.status === "error" ? 'text-red-300' :
                        step.status === "pending" ? 'text-gray-500' :
                        'text-white'
                      }`}>
                        Batch {step.batchNumber}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({step.poolSymbols.length} pool{step.poolSymbols.length > 1 ? 's' : ''})
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {step.poolSymbols.join(', ')}
                    </p>
                    {step.status !== "pending" && step.status !== "success" && (
                      <p className="text-xs mt-1" style={{ color: step.status === "error" ? '#f87171' : '#fb57ff' }}>
                        {step.error || getStatusText(step.status)}
                      </p>
                    )}
                  </div>
                  {step.txSignature && (
                    <a
                      href={explorerUrl(step.txSignature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-2 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] transition-colors flex-shrink-0"
                      style={{ color: '#fb57ff' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      View Tx
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        {isComplete && (
          <div className="p-6 border-t border-white/[0.05]">
            {/* Summary */}
            <div className="flex items-center justify-center gap-8 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{successCount}</div>
                <div className="text-xs text-gray-400">Batches Succeeded</div>
              </div>
              {failCount > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">{failCount}</div>
                  <div className="text-xs text-gray-400">Batches Failed</div>
                </div>
              )}
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ color: '#fb57ff' }}>{totalPools}</div>
                <div className="text-xs text-gray-400">Pools Processed</div>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-full px-4 py-3 rounded-lg font-semibold transition-all text-white"
              style={{ background: 'linear-gradient(45deg, #fb57ff, #9333ea)' }}
            >
              {successCount > 0 ? 'Done' : 'Close'}
            </button>
          </div>
        )}

        {/* Processing footer */}
        {!isComplete && (
          <div className="p-6 border-t border-white/[0.05]">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#fb57ff' }} />
              {steps[currentStepIndex]?.status === "signing" 
                ? "Please confirm in your wallet..."
                : "Processing transaction..."
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
}