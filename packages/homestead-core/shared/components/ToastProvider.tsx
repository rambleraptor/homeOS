import { createContext, useContext, useCallback } from 'react';
import type { ReactNode } from 'react';
import { toast as sonnerToast } from 'sonner';
import { Toaster } from '@rambleraptor/homestead-core/shared/components/ui/sonner';
import type { ToastType } from '@rambleraptor/homestead-core/shared/types/toast';
import { getAepErrorMessage } from '@rambleraptor/homestead-core/api/errorMessage';

interface ToastContextValue {
  showToast: (type: ToastType, message: string, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  /**
   * Show an error toast. Accepts a plain string, or any thrown value — a
   * caught `AepbaseError` (or other error) is reduced to its standardized
   * user-facing message via {@link getAepErrorMessage}, so call sites can pass
   * the raw error: `catch (err) { toast.error(err); }`.
   */
  error: (error: unknown, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const showToast = useCallback(
    (type: ToastType, message: string, duration?: number) => {
      const options = duration ? { duration } : undefined;

      switch (type) {
        case 'success':
          sonnerToast.success(message, options);
          break;
        case 'error':
          sonnerToast.error(message, options);
          break;
        case 'info':
          sonnerToast.info(message, options);
          break;
        case 'warning':
          sonnerToast.warning(message, options);
          break;
      }
    },
    []
  );

  const success = useCallback(
    (message: string, duration?: number) => showToast('success', message, duration),
    [showToast]
  );

  const error = useCallback(
    (error: unknown, duration?: number) =>
      showToast(
        'error',
        typeof error === 'string' ? error : getAepErrorMessage(error),
        duration
      ),
    [showToast]
  );

  const info = useCallback(
    (message: string, duration?: number) => showToast('info', message, duration),
    [showToast]
  );

  const warning = useCallback(
    (message: string, duration?: number) => showToast('warning', message, duration),
    [showToast]
  );

  const value = { showToast, success, error, info, warning };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
