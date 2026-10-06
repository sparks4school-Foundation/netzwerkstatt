import type { StufeId } from '../model/stufe';

/**
 * Was eine Klassenstufe sieht und bearbeiten darf (siehe AGENTS.md 5.3).
 * Das Datenmodell bleibt immer vollständig; hier wird nur gefiltert.
 */
export interface StufenKonfiguration {
  id: StufeId;
  name: string;
  schichtenmodell: 'infrastruktur-dienste' | 'vier-schichten';
  zeigeSubnetzmaske: boolean;
  zeigeRoutingtabelle: boolean;
  zeigePorts: boolean;
  zeigeSequenzdiagramm: boolean;
}

export const stufenKonfiguration: Record<StufeId, StufenKonfiguration> = {
  '7-8': {
    id: '7-8',
    name: 'Klasse 7/8',
    schichtenmodell: 'infrastruktur-dienste',
    zeigeSubnetzmaske: false,
    zeigeRoutingtabelle: false,
    zeigePorts: false,
    zeigeSequenzdiagramm: false,
  },
  '11': {
    id: '11',
    name: 'Klasse 11',
    schichtenmodell: 'vier-schichten',
    zeigeSubnetzmaske: true,
    zeigeRoutingtabelle: true,
    zeigePorts: true,
    zeigeSequenzdiagramm: true,
  },
};
