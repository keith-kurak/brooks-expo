import { router, Stack, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

import { Button } from '@/components/button';
import { Press } from '@/components/press';
import { Txt } from '@/components/themed-text';
import { challengeProgress, WEEKLY_GOAL } from '@/features/challenges/model';
import { isChallengeHealthAvailable, joinWeeklyChallenge, needsChallengeHealthAccess, refreshChallenges, useChallenges } from '@/store/challenges';
import { useMember } from '@/store/member';
import { colors, font, spacing } from '@/theme';

import { WeeklyBadge } from './badge';

/** @ref LLP 0008#weekly-challenge-implementation — One goal on Profile's stack, full-width navy to the status bar. */
export function Challenges() {
  const state = useChallenges();
  const member = useMember();
  const focused = useIsFocused();
  const [opening, setOpening] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const progress = challengeProgress(state.summary);
  const available = isChallengeHealthAvailable();
  const join = async () => {
    if (!member) { router.push('/login'); return; }
    setOpening(true);
    setJoinError(null);
    try {
      if (await needsChallengeHealthAccess()) router.push('/join-challenge');
      else await joinWeeklyChallenge();
    } catch { setJoinError('Could not connect to Apple Health. Please try again.'); }
    finally { setOpening(false); }
  };
  const drawing = new Date(state.week.end);
  drawing.setDate(drawing.getDate() + 1);

  return (
    <>
      <Stack.Screen options={{ title: 'Challenges', headerTitle: 'Challenges', headerShown: true, headerTransparent: false,
        headerLargeTitle: true, headerStyle: { backgroundColor: colors.navy },
        headerLargeStyle: { backgroundColor: colors.navy }, headerTintColor: colors.surface,
        headerBackTitle: 'Profile', headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false,
        headerTitleStyle: { fontFamily: font.extraBold, color: colors.surface },
        headerLargeTitleStyle: { fontFamily: font.black, fontSize: 30, color: colors.surface },
      }} />
      {/* Remount after Health enrollment so the system sheet's restored status style cannot persist. */}
      {focused && <StatusBar key={state.enrolled ? 'enrolled' : 'invitation'} style="light" animated />}
      <ScrollView testID="challenges-screen" contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: colors.surface }}
        contentContainerStyle={{ paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}
        refreshControl={state.enrolled ? <RefreshControl refreshing={state.loading} onRefresh={() => { void refreshChallenges(); }} tintColor={colors.surface} /> : undefined}>
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: -1000, height: 1000, backgroundColor: colors.navy }} />
        <View style={{ backgroundColor: colors.navy, padding: spacing.gutter, paddingBottom: spacing.xxl, gap: spacing.lg, minHeight: 300 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
            <Txt variant="eyebrow" c={colors.surface}>This week</Txt>
            <Txt variant="bodySmall" c={colors.surface}>{state.week.label}</Txt>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}>
            <Txt variant="h1" c={colors.surface} style={{ flex: 1, fontFamily: font.black }}>
              {progress.complete && state.enrolled ? `You did it.\n${WEEKLY_GOAL.title}.` : `Run ${WEEKLY_GOAL.distance}\nthis week.`}
            </Txt>
            <WeeklyBadge complete={state.enrolled && progress.complete} />
          </View>
          {state.enrolled ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
                <Txt selectable c={colors.surface} testID="challenge-distance" style={{ fontFamily: font.black, fontSize: 66, lineHeight: 70, letterSpacing: -1.65, fontVariant: ['tabular-nums'], flexShrink: 1 }}>{progress.distance}</Txt>
                <Txt c={colors.surface} style={{ fontFamily: font.medium, fontSize: 23, lineHeight: 30 }}>/ {WEEKLY_GOAL.distance}</Txt>
              </View>
              <View accessible accessibilityRole="progressbar" accessibilityLabel={`${WEEKLY_GOAL.title} progress`}
                accessibilityValue={{ min: 0, max: WEEKLY_GOAL.km, now: Math.min(WEEKLY_GOAL.km, (state.summary?.distanceMeters ?? 0) / 1000), text: `${progress.distance} of ${WEEKLY_GOAL.km} kilometers` }}
                style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.2)' }}>
                <View style={{ width: `${progress.share * 100}%`, height: 8, backgroundColor: colors.lime }} />
              </View>
              <Txt c={colors.surface} style={{ fontFamily: font.medium, lineHeight: 20 }}>
                {progress.complete ? 'Next challenge on Monday.' : `${progress.remaining} km to go. Ends Sunday.`}
              </Txt>
            </>
          ) : (
            <>
              <Txt c={colors.surface}>One run or a few. At your pace.</Txt>
              {available ? <Button title={member ? 'Join this week' : 'Log in to join'} variant="onDark" loading={opening || state.loading} onPress={() => { void join(); }} style={{ marginRight: 4 }} /> : null}
              <Txt variant="bodySmall" c={colors.surface}>
                {available ? 'Your workouts do the counting.' : 'Workout challenges are available on iPhone with Apple Health.'}
              </Txt>
            </>
          )}
          {(joinError || (!state.enrolled && state.error)) && <Txt accessibilityRole="alert" c={colors.surface}>{joinError ?? state.error}</Txt>}
        </View>

        {state.enrolled && <View style={{ paddingHorizontal: spacing.gutter, paddingTop: 18, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            <Txt variant="caption" c={colors.inkSoft}>Apple Health</Txt>
            <Txt variant="bodySmall" c={colors.inkSoft}>{`${state.summary?.runs ?? 0} ${state.summary?.runs === 1 ? 'run' : 'runs'} · ${state.loading ? 'Syncing…' : syncedLabel(state.readAt)}`}</Txt>
          </View>
          <View style={{ flexDirection: 'row' }}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => {
              const counted = state.summary?.countedDays[index] ?? false;
              return <View key={state.week.days[index]} accessible
                accessibilityLabel={`${new Date(state.week.days[index]).toLocaleDateString('en-US', { weekday: 'long' })}, ${counted ? 'run counted' : 'no counted run'}`}
                style={{ flex: 1, alignItems: 'center', gap: spacing.sm }}>
                <Txt variant="bodySmall" c={colors.inkSoft}>{label}</Txt>
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: counted ? colors.blue : colors.hairline, backgroundColor: counted ? colors.blue : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                  {counted && <Svg width={14} height={14} viewBox="0 0 14 14"><Path d="m3 7 2.5 2.5 5-5" fill="none" stroke={colors.surface} strokeWidth={1.5} /></Svg>}
                </View>
              </View>;
            })}
          </View>
          {state.error && <Txt accessibilityRole="alert" variant="bodySmall" c={colors.inkSoft}>{state.error}</Txt>}
          {state.summary?.runs === 0 && <Txt variant="bodySmall" c={colors.inkMuted}>No runs showing yet? In Apple Health, review Brooks access to Workouts and Walking + Running Distance, then pull down to sync.</Txt>}
        </View>}

        <View style={{ paddingHorizontal: spacing.gutter, paddingTop: state.enrolled ? 20 : spacing.xl, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
            <View style={{ width: 28, paddingTop: 2 }}><GiftGlyph /></View>
            <View style={{ flex: 1, gap: 4 }}>
              <Txt variant="productTitle" style={{ fontSize: 17, lineHeight: 22 }}>{state.enrolled && progress.complete ? '1 entry earned' : 'A chance to win Brooks shoes'}</Txt>
              <Txt variant="bodySmall" c={colors.inkSoft}>{state.enrolled && progress.complete ? "You're in the weekly shoe draw." : `Finish the ${WEEKLY_GOAL.badge} for 1 draw entry.`}</Txt>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 40, gap: spacing.sm, flexWrap: 'wrap' }}>
            <Txt variant="bodySmall" c={colors.inkSoft}>Drawing {drawing.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Txt>
            <Press accessibilityRole="link" onPress={() => router.push('/challenge-details')} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Txt variant="bodySmall" c={colors.blue} style={{ textDecorationLine: 'underline' }}>Prize details & rules</Txt>
            </Press>
          </View>
        </View>
        {!state.enrolled && available && <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center', paddingHorizontal: spacing.gutter, paddingTop: spacing.xl }}>
          <HealthGlyph size={18} />
          <Txt c={colors.inkSoft} style={{ flex: 1 }}>Connect once with Apple Health.{'\n'}Your runs update the goal automatically.</Txt>
        </View>}
      </ScrollView>
    </>
  );
}

function syncedLabel(at: number | null) {
  if (at == null) return 'Not synced yet';
  const minutes = Math.max(0, Math.floor((Date.now() - at) / 60000));
  return minutes < 1 ? 'Just synced' : minutes < 60 ? `Synced ${minutes}m ago` : `Synced ${Math.floor(minutes / 60)}h ago`;
}

export function HealthGlyph({ size = 28 }: { size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 28 28"><Path d="m14 23-8.8-8.5C-.1 9.2 7.3 2 14 8.8 20.7 2 28.1 9.2 22.8 14.5L14 23Z" fill="none" stroke={colors.blue} strokeWidth={1.8} strokeLinejoin="round" /></Svg>;
}

function GiftGlyph() {
  return <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={colors.blue} strokeWidth={1.4}>
    <Polyline points="20 12 20 22 4 22 4 12" /><Rect x={2} y={7} width={20} height={5} /><Line x1={12} y1={22} x2={12} y2={7} />
    <Path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
  </Svg>;
}
