import { useState, useEffect } from 'react';

export interface Toast {
  message: string;
  type: 'success' | 'error' | 'info';
}

export const useToast = () => {
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: Toast['type'] = 'info') => {
    setToast({ message, type });
  };

  return { toast, showToast };
};