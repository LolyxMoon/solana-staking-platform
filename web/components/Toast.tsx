"use client";
import { useEffect } from "react";
import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <XCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
    warning: <AlertTriangle className="w-5 h-5" />,
  };

  const styles = {
    success: "bg-green-500/90 text-white border-green-600",
    error: "bg-red-500/90 text-white border-red-600",
    info: "bg-blue-500/90 text-white border-blue-600",
    warning: "bg-yellow-500/90 text-white border-yellow-600",
  };

  return (
    <div
      className={`
        ${styles[type]}
        backdrop-blur-sm border rounded-lg shadow-lg p-4 
        flex items-center gap-3 min-w-[300px] max-w-md
        animate-in slide-in-from-top-5 duration-300
      `}
    >
      {icons[type]}
      <p className="flex-1 font-medium">{message}</p>
      <button
        onClick={onClose}
        className="hover:opacity-70 transition-opacity"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}