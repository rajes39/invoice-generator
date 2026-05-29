import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, AlertCircle, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, x: 20 }}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border card-container transition-all ${
              toast.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                : toast.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-100 dark:border-rose-900/60 text-rose-800 dark:text-rose-200'
                : 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900/60 text-indigo-800 dark:text-indigo-200'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              {toast.type === 'error' && <XCircle className="w-5 h-5 text-rose-500" />}
              {toast.type === 'info' && <AlertCircle className="w-5 h-5 text-indigo-500" />}
            </div>
            
            <div className="flex-1 text-sm font-medium">
              {toast.message}
            </div>

            <button
              onClick={() => onRemove(toast.id)}
              className="shrink-0 p-1 rounded-lg text-current opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
