export interface WeeklyChallengeWidgetProps {
  /** Goal labels come from the app, so the widget has no distance of its own. */
  title: string;
  goal: string;
  badge: string;
  phase: 'invitation' | 'progress' | 'complete';
  distance: string;
  remaining: string;
  share: number;
  runsLabel: string;
  expiresAt: number;
  url: string;
}
