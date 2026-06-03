import React from 'react';
import { motion } from 'motion/react';
import { Play, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Deck } from '../lib/store';

interface DeckListProps {
  decks: Deck[];
}

export const DeckList = ({ decks }: DeckListProps) => {
  return (
    <div className="space-y-8">
      {Object.entries(decks.reduce((acc, deck) => {
        const subj = deck.subject || "general";
        if (!acc[subj]) acc[subj] = [];
        acc[subj].push(deck);
        return acc;
      }, {} as Record<string, Deck[]>)).map(([subject, subjectDecks]) => (
        <div key={subject} className="space-y-4">
          <h3 className="text-xl font-display font-bold text-stone-800 dark:text-stone-200 uppercase tracking-widest border-b border-amber-600/20 dark:border-amber-500/30 pb-2 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-500" /> {subject}
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {subjectDecks.map((deck, idx) => {
              const masteredCount = deck.cards.filter(c => c.mastery >= 80).length;
              const masteryRate = deck.cards.length > 0 ? Math.round((masteredCount / deck.cards.length) * 100) : 0;
              
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  key={deck.id} 
                  className="glass p-6 rounded-xl flex flex-col hover:border-yellow-500/50 transition"
                >
                  <h4 className="font-bold text-lg mb-1">{deck.title}</h4>
                  <span className="text-sm opacity-60 uppercase tracking-wider mb-4">{deck.subject}</span>
                  
                  <div className="mt-auto pt-4 border-t border-amber-600/20 dark:border-amber-500/30 flex items-center justify-between">
                    <div className="flex flex-col gap-1 w-full mr-4">
                      <div className="flex justify-between text-xs font-mono font-bold">
                        <span>Chỉ số Thông thạo</span>
                        <span className="text-yellow-600 dark:text-yellow-400">{masteryRate}%</span>
                      </div>
                      <div className="w-full h-2 bg-stone-300/60 dark:bg-zinc-800/80 rounded-full overflow-hidden">
                        <motion.div 
                          className="bg-yellow-500 h-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${masteryRate}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                    
                    <Link to={`/study/${deck.id}`} className="bg-black dark:bg-white text-white dark:text-black p-3 rounded-full hover:scale-110 shadow-md transition flex items-center justify-center shrink-0">
                      <Play className="w-4 h-4 ml-0.5" />
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
