import React, { useEffect, useState, useRef } from 'react';
import { Award, Zap, Star, Shield, Cpu, Book, Flame, Calendar, Clock, Trophy, Share2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { AchievementToast } from './AchievementToast';

export const AchievementBadges = ({ points, streak }: { points: number, streak: number }) => {
  const BADGES = [
    { id: 'novice', name: 'Novice Student', req: 50, icon: Book, color: 'text-stone-500', bg: 'bg-stone-500/20' },
    { id: 'early_bird', name: 'Early Bird', req: 200, icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-500/20' },
    { id: 'knowledge_seeker', name: 'Knowledge Seeker', req: 500, icon: Star, color: 'text-blue-500', bg: 'bg-blue-500/20' },
    { id: 'scholar', name: 'Dedicated Scholar', req: 1000, icon: Award, color: 'text-purple-500', bg: 'bg-purple-500/20' },
    { id: 'ai_master', name: 'AI Master', req: 2000, icon: Cpu, color: 'text-emerald-500', bg: 'bg-emerald-500/20' },
    { id: 'stoic', name: 'Stoic Sage', req: 5000, icon: Shield, color: 'text-orange-500', bg: 'bg-orange-500/20' },
    { id: 'week_warrior', name: 'Week Warrior (7 ngày)', req: 7, icon: Flame, color: 'text-orange-600', bg: 'bg-orange-500/20', isStreak: true },
    { id: 'monthly_sage', name: 'Monthly Sage (30 ngày)', req: 30, icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-500/20', isStreak: true },
    { id: 'century_master', name: 'Century Master (100 ngày)', req: 100, icon: Clock, color: 'text-red-600', bg: 'bg-red-500/20', isStreak: true },
  ];

  const [toasts, setToasts] = useState<{ id: string; message: string }[]>([]);
  const prevUnlockedBadgeIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const newlyUnlocked: { id: string; message: string }[] = [];
    BADGES.forEach((badge) => {
      const val = badge.isStreak ? streak : points;
      const unlocked = val >= badge.req;
      if (unlocked && !prevUnlockedBadgeIds.current.has(badge.id)) {
        newlyUnlocked.push({ id: badge.id, message: `Bạn đã đạt được huy hiệu: ${badge.name}! 🎉` });
      }
      if (unlocked) {
        prevUnlockedBadgeIds.current.add(badge.id);
      }
    });

    if (newlyUnlocked.length > 0) {
      setToasts((prev) => [...prev, ...newlyUnlocked]);
    }
  }, [points, streak]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleShare = async (badgeName: string) => {
    // Generate a simple stylized canvas image
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#f5f5f4'; // neutral-100
    ctx.fillRect(0, 0, 400, 200);

    // Text
    ctx.fillStyle = '#333';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`Achievement: ${badgeName}`, 20, 100);
    ctx.font = '16px sans-serif';
    ctx.fillText('Check out my learning progress!', 20, 140);

    // Download
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${badgeName.replace(/\s+/g, '_')}_achievement.png`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
        <Trophy className="w-6 h-6 text-yellow-500" /> Thành tựu của bạn
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {BADGES.map((badge, index) => {
          const val = badge.isStreak ? streak : points;
          const unlocked = val >= badge.req;
          const Icon = badge.icon;
          return (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, scale: 0.7, rotateX: -20 }}
              animate={{ opacity: 1, scale: 1, rotateX: 0 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 15,
                delay: index * 0.05,
                duration: 0.5
              }}
              className={cn(
                "flex flex-col items-center p-4 rounded-2xl border text-center transition-all duration-300 relative",
                unlocked 
                  ? `${badge.bg} border-${badge.color.replace('text-', '')}/30 shadow-md hover:scale-105 perspective-1000` 
                  : "bg-neutral-100 dark:bg-neutral-800/50 border-transparent opacity-50 grayscale"
              )}
            >
              <Icon className={cn("w-8 h-8 mb-3", unlocked ? badge.color : "text-neutral-400")} />
              <span className="font-bold text-sm text-neutral-800 dark:text-neutral-200">{badge.name}</span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {unlocked ? 'Đã đạt được!' : `Yêu cầu: ${badge.req} ${badge.isStreak ? 'ngày liên tiếp' : 'điểm'}`}
              </span>
              {!unlocked && (
                <div className="w-full bg-neutral-200 dark:bg-neutral-700 h-2 rounded-full mt-2 overflow-hidden">
                  <div 
                    className={cn("h-full rounded-full", badge.color.replace('text-', 'bg-'))} 
                    style={{ width: `${Math.min(100, Math.max(0, ((badge.isStreak ? streak : points) / badge.req) * 100))}%` }} 
                  />
                </div>
              )}
              {unlocked && (
                <>
                  <span className="absolute top-2 right-2 text-emerald-500">✓</span>
                  <button
                    onClick={() => handleShare(badge.name)}
                    className="absolute bottom-2 right-2 p-2 rounded-full bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition"
                    title="Chia sẻ thành tựu"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </motion.div>
          );
        })}
      </div>
      <AnimatePresence>
        {toasts.map((toast) => (
          <AchievementToast key={toast.id} message={toast.message} onDismiss={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
};
