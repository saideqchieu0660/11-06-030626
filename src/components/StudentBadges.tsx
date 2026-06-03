import React from 'react';
import { Award, Zap, Star, Shield, Cpu, Book } from 'lucide-react';
import { cn } from '../lib/utils';
import { store } from '../lib/store';

export const StudentBadges = ({ points }: { points: number }) => {
  const BADGES = [
    { id: 'novice', name: 'Novice Student', req: 50, icon: Book, color: 'text-stone-500', bg: 'bg-stone-500/20' },
    { id: 'early_bird', name: 'Early Bird', req: 200, icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-500/20' },
    { id: 'knowledge_seeker', name: 'Knowledge Seeker', req: 500, icon: Star, color: 'text-blue-500', bg: 'bg-blue-500/20' },
    { id: 'scholar', name: 'Dedicated Scholar', req: 1000, icon: Award, color: 'text-purple-500', bg: 'bg-purple-500/20' },
    { id: 'ai_master', name: 'AI Master', req: 2000, icon: Cpu, color: 'text-emerald-500', bg: 'bg-emerald-500/20' },
    { id: 'stoic', name: 'Stoic Sage', req: 5000, icon: Shield, color: 'text-orange-500', bg: 'bg-orange-500/20' },
  ];

  return (
    <div className="glass p-6 rounded-xl space-y-4">
      <h3 className="text-xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 via-amber-500 to-yellow-600 dark:from-amber-200 dark:via-yellow-400 dark:to-amber-500 flex items-center gap-2">
        <Award className="w-5 h-5 text-yellow-500" /> Thành Tựu ({points} pts)
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-2 leading-tight">
        {BADGES.map(badge => {
          const unlocked = points >= badge.req;
          const Icon = badge.icon;
          return (
            <div 
              key={badge.id}
              className={cn(
                "flex flex-col items-center p-3 rounded-xl border text-center transition-all duration-300",
                unlocked 
                  ? `${badge.bg} border-${badge.color.replace('text-', '')}/30 shadow-sm hover:scale-105` 
                  : "bg-black/5 dark:bg-white/5 border-transparent opacity-40 grayscale"
              )}
              title={unlocked ? 'Unlocked' : `Requires ${badge.req} pts`}
            >
              <Icon className={cn("w-6 h-6 mb-2", unlocked ? badge.color : "text-stone-500")} />
              <span className="font-bold text-xs">{badge.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
