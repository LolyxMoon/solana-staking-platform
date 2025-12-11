"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { Shield, FileText, Download, Loader2, AlertTriangle, CheckCircle, XCircle, Flame } from "lucide-react";
import AuditPaymentModal from "./AuditPaymentModal";

interface AuditResult {
  programId: string;
  programName: string;
  timestamp: string;
  overallScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  summary: string;
  instructions: InstructionAnalysis[];
  securityChecks: SecurityCheck[];
  recommendations: string[];
}

interface InstructionAnalysis {
  name: string;
  accounts: AccountInfo[];
  hasSignerCheck: boolean;
  hasPdaValidation: boolean;
  hasOwnerCheck: boolean;
  risks: string[];
}

interface AccountInfo {
  name: string;
  isMut: boolean;
  isSigner: boolean;
  constraints: string[];
}

interface SecurityCheck {
  name: string;
  status: "PASS" | "WARN" | "FAIL";
  description: string;
}

export default function SmartContractAudit() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  
  const [programId, setProgramId] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const validateProgramId = (id: string): boolean => {
    try {
      new PublicKey(id);
      return true;
    } catch {
      return false;
    }
  };

  const handleStartAudit = () => {
    if (!validateProgramId(programId)) {
      setError("Invalid Program ID");
      return;
    }
    setError(null);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async (txSignature: string) => {
    setShowPaymentModal(false);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/tools/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId,
          paymentTx: txSignature,
          walletAddress: publicKey?.toString(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Audit failed");
      }

      const result = await res.json();
      setAuditResult(result.audit);
    } catch (err: any) {
      setError(err.message || "Failed to generate audit");
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIXED: PDF download function with proper browser support
  const handleDownloadPdf = async () => {
    if (!auditResult) return;
    
    setDownloadingPdf(true);
    setError(null);
    
    try {
      console.log("Starting PDF download...");
      
      const res = await fetch("/api/tools/audit/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit: auditResult }),
      });

      console.log("PDF response status:", res.status);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "PDF generation failed");
      }

      const blob = await res.blob();
      console.log("PDF blob size:", blob.size);
      
      // Create object URL
      const url = window.URL.createObjectURL(blob);
      
      // Create link element
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `audit-${auditResult.programId.slice(0, 8)}-${Date.now()}.pdf`;
      
      // ✅ CRITICAL: Append to body (required for Firefox and some browsers)
      document.body.appendChild(a);
      
      // Trigger download
      a.click();
      
      // Cleanup after small delay
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
      
      console.log("PDF download triggered successfully");
      
    } catch (err: any) {
      console.error("PDF download error:", err);
      setError(err.message || "Failed to download PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "LOW": return "#22c55e";
      case "MEDIUM": return "#eab308";
      case "HIGH": return "#f97316";
      case "CRITICAL": return "#ef4444";
      default: return "#6b7280";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PASS": return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "WARN": return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "FAIL": return <XCircle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}>
          <Shield className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Smart Contract Audit</h2>
          <p className="text-sm text-gray-400">Automated security analysis for Solana programs</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-[#fb57ff]/10 border border-[#fb57ff]/30 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <Flame className="w-5 h-5 mt-0.5" style={{ color: '#fb57ff' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: '#fb57ff' }}>Token-Gated Feature</p>
            <p className="text-xs text-gray-300 mt-1">
              Audits cost <span className="font-semibold text-white">2 SOL worth of SPT</span> which gets burned. 
              This supports the ecosystem while providing valuable security insights.
            </p>
          </div>
        </div>
      </div>

      {!auditResult ? (
        <>
          {/* Input Section */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Program ID
              </label>
              <input
                type="text"
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
                placeholder="Enter Solana Program ID..."
                className="w-full px-4 py-3 bg-black border border-white/[0.1] rounded-lg text-white font-mono text-sm focus:outline-none focus:border-[#fb57ff]/50"
              />
              <p className="text-xs text-gray-500 mt-1">
                The program must have a verified IDL on-chain or on Anchor registry
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {connected ? (
              <button
                onClick={handleStartAudit}
                disabled={!programId || loading}
                className="w-full px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating Audit...
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5" />
                    Start Audit (2 SOL in SPT)
                  </>
                )}
              </button>
            ) : (
              <div className="text-center">
                <p className="text-sm text-gray-400 mb-3">Connect wallet to start audit</p>
                <WalletMultiButton />
              </div>
            )}
          </div>

          {/* What's Checked */}
          <div className="mt-8 pt-6 border-t border-white/[0.05]">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">What We Analyze</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                "Instruction Access Control",
                "Signer Validations",
                "PDA Derivations",
                "Owner Checks",
                "Account Constraints",
                "Reentrancy Patterns",
                "Integer Overflows",
                "Initialization Checks",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-gray-400">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* Audit Results */
        <div className="space-y-6">
          {/* Score Header */}
          <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-lg border border-white/[0.05]">
            <div>
              <p className="text-sm text-gray-400">Overall Security Score</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-4xl font-bold">{auditResult.overallScore}</span>
                <span className="text-2xl text-gray-500">/100</span>
              </div>
            </div>
            <div 
              className="px-4 py-2 rounded-lg font-semibold"
              style={{ 
                background: `${getRiskColor(auditResult.riskLevel)}20`,
                color: getRiskColor(auditResult.riskLevel),
                border: `1px solid ${getRiskColor(auditResult.riskLevel)}50`
              }}
            >
              {auditResult.riskLevel} RISK
            </div>
          </div>

          {/* Summary */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Summary</h3>
            <p className="text-sm text-gray-400">{auditResult.summary}</p>
          </div>

          {/* Security Checks */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Security Checks</h3>
            <div className="space-y-2">
              {auditResult.securityChecks.map((check, i) => (
                <div 
                  key={i}
                  className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(check.status)}
                    <span className="text-sm">{check.name}</span>
                  </div>
                  <span className="text-xs text-gray-500">{check.description}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Instructions Analysis */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">
              Instructions Analyzed ({auditResult.instructions.length})
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {auditResult.instructions.map((ix, i) => (
                <div 
                  key={i}
                  className="p-3 bg-white/[0.02] rounded-lg border border-white/[0.05]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm text-white">{ix.name}</span>
                    <div className="flex items-center gap-2">
                      {ix.hasSignerCheck && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">Signer ✓</span>
                      )}
                      {ix.hasPdaValidation && (
                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">PDA ✓</span>
                      )}
                      {ix.hasOwnerCheck && (
                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">Owner ✓</span>
                      )}
                    </div>
                  </div>
                  {ix.risks.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {ix.risks.map((risk, j) => (
                        <span key={j} className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">
                          {risk}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          {auditResult.recommendations.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Recommendations</h3>
              <ul className="space-y-2">
                {auditResult.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-white/[0.05]">
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="flex-1 px-4 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(45deg, black, #fb57ff)' }}
            >
              {downloadingPdf ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Download PDF Report
                </>
              )}
            </button>
            <button
              onClick={() => {
                setAuditResult(null);
                setProgramId("");
              }}
              className="px-4 py-3 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.1] rounded-lg font-semibold transition-all"
            >
              New Audit
            </button>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <AuditPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSuccess={handlePaymentSuccess}
        solAmount={2}
      />
    </div>
  );
}