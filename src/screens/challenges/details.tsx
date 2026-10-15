import { ScrollView, View } from 'react-native';
import { Txt } from '@/components/themed-text';
import { WEEKLY_GOAL } from '@/features/challenges/model';
import { useChallenges } from '@/store/challenges';
import { colors, spacing } from '@/theme';

export function ChallengeDetails() {
  const { week } = useChallenges();
  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.gutter, paddingBottom: spacing.xxxl, gap: spacing.xl }}>
    <View style={{ gap: spacing.sm }}><Txt variant="eyebrow" c={colors.blue}>Demo challenge · {week.label}</Txt><Txt variant="h1">A little running.{'\n'}A little reward.</Txt>
      <Txt>This is a proposed Brooks Run Club promotion for the app demo. It does not enter an actual sweepstakes or award a real prize.</Txt></View>
    <View style={{ gap: spacing.sm }}><Txt variant="h3">The weekly {WEEKLY_GOAL.badge}</Txt><Txt>Join this week and run a total of {WEEKLY_GOAL.distance}, in one run or several. Running workouts recorded in Apple Health count from Monday through Sunday in your local time, including runs earlier in the week before you joined.</Txt>
      <Txt>Runs need a recorded distance. Walking, hikes and daily steps do not count. Duplicate workout records count once; edits or deletions update your progress on the next sync.</Txt></View>
    <View style={{ gap: spacing.sm }}><Txt variant="h3">The proposed prize</Txt><Txt>Complete the {WEEKLY_GOAL.badge} to earn one demo entry for a weekly drawing for Brooks running shoes. One entry per member per week. Completion earns a chance, rather than a guaranteed pair of shoes.</Txt></View>
    <View style={{ gap: spacing.sm }}><Txt variant="h3">Your workouts stay here</Txt><Txt>The app stores your weekly total and counted days on this device and shares the display with its home screen widget. It does not send workouts to Brooks. Review read access in Apple Health whenever you want.</Txt></View>
  </ScrollView>;
}
