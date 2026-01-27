
export type ToneType = 'Professional' | 'Friendly' | 'Casual' | 'Academic' | 'Standard';

export interface CorrectionResult {
  id: string;
  original: string;
  corrected: string;
  tone: ToneType;
  timestamp: number;
}

export enum AppStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}
