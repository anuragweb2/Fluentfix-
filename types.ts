
export type ToneType = 'Professional' | 'Friendly' | 'Casual' | 'Academic' | 'Standard';
export type AppMode = 'EDITOR' | 'LEARNING';

export interface CorrectionResult {
  id: string;
  original: string;
  corrected: string;
  tone: ToneType;
  timestamp: number;
}

export interface Challenge {
  id: string;
  originalPart: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  type: 'grammar' | 'spelling' | 'vocabulary' | 'phrasing';
}

export enum AppStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  NEEDS_KEY = 'NEEDS_KEY'
}
