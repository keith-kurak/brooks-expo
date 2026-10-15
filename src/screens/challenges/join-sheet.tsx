import { router, Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { BrooksIcon } from '@/components/icons';
import { Press } from '@/components/press';
import { Txt } from '@/components/themed-text';
import { WEEKLY_GOAL } from '@/features/challenges/model';
import { isChallengeHealthAvailable, joinWeeklyChallenge, useChallenges } from '@/store/challenges';
import { useMember } from '@/store/member';
import { colors, font, headerIcon, nativeSheetHeader, spacing } from '@/theme';

import { HealthGlyph } from './index';

export function JoinChallengeSheet() {
  const state = useChallenges();
  const member = useMember();
  const insets = useSafeAreaInsets();
  const join = async () => {
    if (!member) { router.replace('/login'); return; }
    if (await joinWeeklyChallenge()) router.back();
  };
  return (
    <View collapsable={false} style={{ flex: 1, backgroundColor: colors.surface }}>
      {nativeSheetHeader ? <><Stack.Toolbar placement="right"><Stack.Toolbar.Button icon={headerIcon.close} accessibilityLabel="Close" onPress={() => router.back()} /></Stack.Toolbar><View collapsable={false} /></>
        : <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.gutter }}><Txt variant="h3">{WEEKLY_GOAL.title}</Txt><Press accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} onPress={() => router.back()}><BrooksIcon name="closeThin" size={22} /></Press></View>}
      <ScrollView contentInsetAdjustmentBehavior={nativeSheetHeader ? 'automatic' : 'never'}
        style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.gutter, gap: spacing.md }}>
        <Txt variant="eyebrow" c={colors.blue}>{state.week.label} · Brooks Run Club</Txt>
        <Txt variant="h1" style={{ fontFamily: font.black }}>Run {WEEKLY_GOAL.distance}{'\n'}this week.</Txt>
        <Txt c={colors.inkSoft}>Finish for 1 entry in the weekly shoe draw.{'\n'}One run or a few, at your pace.</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surfaceAlt, marginTop: spacing.md }}>
          <View style={{ width: 32 }}><HealthGlyph /></View>
          <View style={{ flex: 1, gap: 4 }}><Txt variant="price">Apple Health</Txt><Txt variant="bodySmall" c={colors.inkSoft}>Running workouts & distance</Txt></View>
        </View>
        <Txt variant="bodySmall" c={colors.inkSoft}>We use your running workouts and distance to update this challenge automatically. Your data stays on this device.</Txt>
        {state.error && <Txt accessibilityRole="alert" variant="bodySmall" c={colors.inkSoft}>{state.error}</Txt>}
      </ScrollView>
      <View style={{ paddingHorizontal: spacing.gutter, paddingTop: spacing.sm, paddingBottom: Math.max(insets.bottom, spacing.gutter), gap: spacing.sm }}>
        <Button title="Connect & join" variant="brand" loading={state.loading} disabled={!isChallengeHealthAvailable()} onPress={() => { void join(); }} style={{ marginRight: 4 }} />
        <Press accessibilityRole="link" onPress={() => router.push('/challenge-details')} style={{ alignItems: 'center', minHeight: 44, justifyContent: 'center' }}>
          <Txt variant="bodySmall" c={colors.blue} style={{ textDecorationLine: 'underline' }}>Challenge details & demo rules</Txt>
        </Press>
      </View>
    </View>
  );
}
