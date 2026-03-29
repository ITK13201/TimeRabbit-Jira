import { useCallback, useState } from "react";
import { nanoid } from "nanoid";

export interface Toast {
  id: string;
  message: string;
  action?: { label: string; onClick: () => void };
  durationMs: number;
}

export interface UseToastReturn {
  toasts: Toast[];
  showToast: (message: string, opts?: { action?: Toast["action"]; durationMs?: number }) => string;
  dismissToast: (id: string) => void;
}

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, opts?: { action?: Toast["action"]; durationMs?: number }): string => {
      const id = nanoid();
      const durationMs = opts?.durationMs ?? 3000;
      const toast: Toast = { id, message, action: opts?.action, durationMs };
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, durationMs);
      return id;
    },
    [],
  );

  return { toasts, showToast, dismissToast };
}
