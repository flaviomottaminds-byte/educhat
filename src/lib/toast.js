import { useState, useEffect } from 'react';

// Conjunto de listeners para componentes inscritos
const listeners = new Set();
let toastIdCounter = 0;

export const toast = {
  show(message, type = 'error', duration = 5000) {
    if (!message) return null;
    const id = ++toastIdCounter;
    const toastItem = {
      id,
      message: typeof message === 'string' ? message : String(message?.message || message),
      type, // 'error' | 'success' | 'warning' | 'info'
      duration,
      createdAt: Date.now()
    };

    listeners.forEach((listener) => {
      try {
        listener((prev) => [...prev, toastItem]);
      } catch {}
    });

    if (duration > 0) {
      setTimeout(() => {
        toast.dismiss(id);
      }, duration);
    }

    return id;
  },

  error(message, duration = 6000) {
    return toast.show(message, 'error', duration);
  },

  success(message, duration = 4000) {
    return toast.show(message, 'success', duration);
  },

  warning(message, duration = 5000) {
    return toast.show(message, 'warning', duration);
  },

  info(message, duration = 4000) {
    return toast.show(message, 'info', duration);
  },

  dismiss(id) {
    listeners.forEach((listener) => {
      try {
        listener((prev) => prev.filter((t) => t.id !== id));
      } catch {}
    });
  }
};

export function useToasts() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    listeners.add(setToasts);
    return () => {
      listeners.delete(setToasts);
    };
  }, []);

  return { toasts, dismiss: toast.dismiss };
}

export default toast;
