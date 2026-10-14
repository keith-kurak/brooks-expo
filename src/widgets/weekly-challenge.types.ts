export interface WeeklyChallengeWidgetProps {
  phase: 'invitation' | 'progress' | 'complete';
  distance: string;
  remaining: string;
  share: number;
  runsLabel: string;
  expiresAt: number;
  url: string;
}
