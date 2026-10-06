import { create } from 'zustand';
import type { StufeId } from '../model/stufe';

export type Modus = 'aufbauen' | 'ausprobieren';

interface AppZustand {
  stufe: StufeId;
  modus: Modus;
  setzeStufe: (stufe: StufeId) => void;
  setzeModus: (modus: Modus) => void;
}

export const useApp = create<AppZustand>()((set) => ({
  stufe: '7-8',
  modus: 'aufbauen',
  setzeStufe: (stufe) => set({ stufe }),
  setzeModus: (modus) => set({ modus }),
}));
