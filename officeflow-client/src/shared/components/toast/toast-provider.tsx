"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, XCircle } from "lucide-react";

type ToastType = "success" | "error";

type Toast = {
  id: number;
  type: ToastType;
  message: string;
};

type ToastContextValue = {
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now();
    setToasts((items) => [...items, { id, type, message }]);

    window.setTimeout(() => {
      setToasts((items) => items.filter((toast) => toast.id !== id));
    }, 3200);
  }, []);

  const value = useMemo(
    () => ({
      success: (message: string) => showToast("success", message),
      error: (message: string) => showToast("error", message),
    }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-50 grid w-[min(380px,calc(100vw-2rem))] gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="motion-toast flex items-start gap-3 rounded-2xl border border-white/80 bg-white/95 p-4 text-sm shadow-2xl shadow-zinc-950/15 ring-1 ring-zinc-950/[0.04] backdrop-blur"
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 text-red-600" />
            )}
            <p className="font-medium text-zinc-900">{toast.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }

  return context;
}
