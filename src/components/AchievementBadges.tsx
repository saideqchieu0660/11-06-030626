import React from 'react';
import { Award, Zap, Star, Shield, Cpu, Book, Flame, Calendar, Clock, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

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
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.4 }}
              className={cn(
                "flex flex-col items-center p-4 rounded-2xl border text-center transition-all duration-300 relative",
                unlocked 
                  ? `${badge.bg} border-${badge.color.replace('text-', '')}/30 shadow-md hover:scale-105` 
                  : "bg-neutral-100 dark:bg-neutral-800/50 border-transparent opacity-50 grayscale"
              )}
            >
              <Icon className={cn("w-8 h-8 mb-3", unlocked ? badge.color : "text-neutral-400")} />
              <span className="font-bold text-sm text-neutral-800 dark:text-neutral-200">{badge.name}</span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {unlocked ? 'Đã đạt được!' : `Yêu cầu: ${badge.req} ${badge.isStreak ? 'ngày liên tiếp' : 'điểm'}`}
              </span>
              {unlocked && <span className="absolute top-2 right-2 text-emerald-500">✓</span>}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
