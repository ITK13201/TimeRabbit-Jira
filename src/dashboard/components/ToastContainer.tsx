import type { Toast } from "@/shared/utils/useToast";

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-[100] pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-3 bg-[#172b4d] text-white text-xs rounded-md px-4 py-3 shadow-lg min-w-[240px]"
        >
          <span className="flex-1">{toast.message}</span>
          {toast.action && (
            <button
              onClick={() => {
                toast.action!.onClick();
                onDismiss(toast.id);
              }}
              className="cursor-pointer border-none bg-transparent text-[#4c9aff] hover:text-white font-semibold text-xs whitespace-nowrap transition-colors"
            >
              {toast.action.label}
            </button>
          )}
          <button
            onClick={() => onDismiss(toast.id)}
            className="cursor-pointer border-none bg-transparent text-white/50 hover:text-white text-xs leading-none transition-colors"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
