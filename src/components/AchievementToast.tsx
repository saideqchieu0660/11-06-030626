import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy } from 'lucide-react';

interface ToastProps {
  message: string;
  onDismiss: () => void;
}

export const AchievementToast = ({ message, onDismiss }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-amber-500 text-white p-4 rounded-xl shadow-lg border-2 border-amber-400"
    >
      <Trophy className="w-6 h-6" />
      <span className="font-bold text-sm">{message}</span>
    </motion.div>
  );
};
