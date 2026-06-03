import { playSound } from '../lib/audio';

export const useSound = () => {
  return {
    click: () => playSound('click'),
    success: () => playSound('success'),
    error: () => playSound('error'),
  };
};
