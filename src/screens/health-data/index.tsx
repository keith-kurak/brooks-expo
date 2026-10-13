import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Press } from '@/components/press';
import { Txt } from '@/components/themed-text';
import { border, colors, spacing } from '@/theme';
import { HEALTH_NAME, IS_HEALTH_CONNECT, openHealthSettings } from '@/utils/health';
import { useTabBarOverlap } from '@/utils/native-tabs';
import { exampleHealth, formatDuration, METERS_PER_MILE, type HealthSummary } from './summary';
import { useHealthSummary, type HealthState } from './use-health-summary';

const provider = process.env.EXPO_OS === 'web' ? 'Apple Health or Health Connect' : HEALTH_NAME;
const count = (value: number) => Math.round(value).toLocaleString();
const miles = (meters: number) => (meters / METERS_PER_MILE).toFixed(1);
const kinds = { run: 'Run', walk: 'Walk', hike: 'Hike' };

export function HealthData() {
  const [preview, setPreview] = useState(false);
  const { state, refresh, connect } = useHealthSummary();
  const overlap = useTabBarOverlap();
  const summary = preview ? exampleHealth() : state.status === 'ready' ? state.summary : null;
  const hasData = summary?.hasData;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentInset={{ bottom: overlap }}
      scrollIndicatorInsets={{ bottom: overlap }}
      showsVerticalScrollIndicator={false}
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      <View style={styles.source}>
        <View style={styles.sourceDot} />
        <Txt variant="caption" c={colors.blue}>{provider}</Txt>
      </View>
      <View style={styles.tabs} accessibilityRole="tablist">
        <Mode label="Your data" selected={!preview} onPress={() => setPreview(false)} />
        <Mode label="Preview examples" selected={preview} onPress={() => setPreview(true)} />
      </View>

      {preview && (
        <View style={styles.previewNote}>
          <Txt variant="caption" c={colors.blue}>Example data</Txt>
          <Txt variant="bodySmall" c={colors.inkMuted}>A preview of what you could see. These numbers aren't yours.</Txt>
        </View>
      )}

      {hasData && summary ? (
        <HealthOverview summary={summary} preview={preview} refresh={refresh} />
      ) : !preview ? (
        <ConnectionState state={state} connect={connect} refresh={refresh} onPreview={() => setPreview(true)} />
      ) : null}

      {preview && (
        <View style={styles.section}>
          <Txt variant="h3">More health possibilities</Txt>
          <Txt variant="bodySmall" c={colors.inkMuted} style={styles.note}>These are examples only. Brooks doesn't read these yet. Availability depends on your device, apps and permissions.</Txt>
          <ExampleMetric label="Sleep" detail="Last night" value="7h 42m" />
          <ExampleMetric label="Resting heart rate" detail="Daily average" value="56 bpm" />
          <ExampleMetric label="Active energy" detail="Today" value="420 kcal" />
        </View>
      )}

      {!preview && IS_HEALTH_CONNECT && state.status !== 'unavailable' && state.status !== 'loading' && state.status !== 'install-required' && (
        <View style={styles.settings}><TextAction label="Manage Health Connect access" onPress={() => void openHealthSettings()} /></View>
      )}
      <Txt variant="bodySmall" c={colors.inkMuted} style={styles.privacy}>Read-only. Your health data stays on your device.</Txt>
    </ScrollView>
  );
}

function HealthOverview({ summary, preview, refresh }: {
  summary: HealthSummary;
  preview: boolean;
  refresh: () => Promise<void>;
}) {
  return (
    <>
      <View style={styles.sectionTop}>
        <Txt variant="eyebrow" c={colors.inkMuted}>Past 7 days</Txt>
        {!preview && <TextAction label="Refresh" onPress={() => void refresh()} />}
      </View>
      <View style={styles.distance}>
        <Txt variant="bodySmall" c={colors.inkMuted}>Workout distance</Txt>
        <View style={styles.figure}>
          <Txt variant="hero" c={colors.blue} selectable>{summary.distanceMeters === null ? '—' : miles(summary.distanceMeters)}</Txt>
          {summary.distanceMeters !== null && <Txt variant="h3" c={colors.blue}>mi</Txt>}
        </View>
        <Txt variant="bodySmall" c={colors.inkMuted}>
          {summary.workouts.length ? `${summary.workouts.length} workouts${summary.durationMinutes === null ? '' : ` · ${formatDuration(summary.durationMinutes)}`}` : 'No shared workouts'}
        </Txt>
      </View>
      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Txt variant="bodySmall" c={colors.inkMuted}>Daily steps</Txt>
          <Txt variant="h2" selectable>{summary.dailySteps === null ? '—' : count(summary.dailySteps)}</Txt>
          <Txt variant="bodySmall" c={colors.inkMuted}>7-day average · includes today</Txt>
        </View>
        <View style={styles.metric}>
          <Txt variant="bodySmall" c={colors.inkMuted}>Elevation gain</Txt>
          <Txt variant="h2" selectable>{summary.elevationGainMeters === null ? '—' : `${count(summary.elevationGainMeters)} m`}</Txt>
          <Txt variant="bodySmall" c={colors.inkMuted}>Across your workouts</Txt>
        </View>
      </View>
      {summary.workouts.length > 0 && (
        <View style={styles.section}>
          <Txt variant="h3">Recent activity</Txt>
          {summary.workouts.slice(0, 3).map((workout) => (
            <View key={`${workout.start}-${workout.kind}-${workout.durationMinutes}-${workout.distanceMeters}`} style={styles.activity}>
              <View style={styles.activityLabel}>
                <Txt variant="productTitle">{workout.indoor === true ? `Indoor ${kinds[workout.kind].toLowerCase()}` : kinds[workout.kind]}</Txt>
                <Txt variant="bodySmall" c={colors.inkMuted}>{new Date(workout.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {formatDuration(workout.durationMinutes)}</Txt>
              </View>
              <Txt variant="price" selectable>{workout.distanceMeters === null ? '—' : `${miles(workout.distanceMeters)} mi`}</Txt>
            </View>
          ))}
        </View>
      )}
      {!preview && <Txt variant="bodySmall" c={colors.inkMuted} style={styles.note}>Runs, walks and hikes you share with Brooks. A dash means no shared measurement. Workout time is {IS_HEALTH_CONNECT ? 'elapsed time' : 'active time'}.</Txt>}
    </>
  );
}

const connectionCopy = {
  error: `Try again, or check what you're sharing in ${provider}.`,
  ready: `No workouts or steps were returned for the past 7 days. Check your data and Brooks access in ${provider}.`,
  unavailable: "Health data isn't available here. Preview examples to see what Brooks can show.",
  'install-required': 'Set up Health Connect to see your workouts, distance and steps here.',
  unlinked: `See your workouts, distance and daily steps from ${provider}. You choose what to share.`,
};

function ConnectionState({ state, connect, refresh, onPreview }: {
  state: HealthState;
  connect: () => Promise<void>;
  refresh: () => Promise<void>;
  onPreview: () => void;
}) {
  if (state.status === 'loading') {
    return (
      <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Reading health data">
        <ActivityIndicator color={colors.blue} />
        <Txt variant="bodySmall" c={colors.inkMuted}>Reading your activity…</Txt>
      </View>
    );
  }
  const title = state.status === 'error' ? "Couldn't read your activity"
    : state.status === 'ready' ? 'No shared activity yet' : 'Your movement, at a glance.';
  return (
    <View style={styles.empty}>
      <Txt variant="h2">{title}</Txt>
      <Txt variant="body" c={colors.inkMuted} style={styles.note}>{connectionCopy[state.status]}</Txt>
      <View style={styles.actions}>
        {state.status === 'unlinked' && <Button title={`Connect ${HEALTH_NAME}`} onPress={() => void connect()} />}
        {(state.status === 'error' || state.status === 'ready') && <Button title="Try again" onPress={() => void refresh()} />}
        {state.status === 'install-required' && <Button title="Set up Health Connect" onPress={() => void openHealthSettings()} />}
        <TextAction label="Preview examples" onPress={onPreview} />
      </View>
    </View>
  );
}

function Mode({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Press accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={[styles.mode, selected && styles.modeSelected]}><Txt variant="caption" c={selected ? colors.blue : colors.inkMuted}>{label}</Txt></Press>;
}

function TextAction({ label, onPress }: { label: string; onPress: () => void }) {
  return <Press accessibilityRole="button" onPress={onPress} style={styles.textAction}><Txt variant="caption" c={colors.blue} style={{ textDecorationLine: 'underline' }}>{label}</Txt></Press>;
}

function ExampleMetric({ label, detail, value }: { label: string; detail: string; value: string }) {
  return <View style={styles.activity}><View style={styles.activityLabel}><Txt variant="productTitle">{label}</Txt><Txt variant="bodySmall" c={colors.inkMuted}>{detail}</Txt></View><Txt variant="price" selectable>{value}</Txt></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.gutter, paddingBottom: spacing.xxxl, maxWidth: 600, width: '100%', alignSelf: 'center' },
  source: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sourceDot: { width: 6, height: 6, backgroundColor: colors.blue, borderRadius: 3 },
  tabs: { flexDirection: 'row', borderBottomWidth: border.rule, borderBottomColor: colors.hairline, marginTop: spacing.md, marginBottom: spacing.xl },
  mode: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, borderBottomWidth: border.heavy, borderBottomColor: 'transparent' },
  modeSelected: { borderBottomColor: colors.blue },
  previewNote: { backgroundColor: colors.surfaceAlt, padding: spacing.md, gap: spacing.xs, marginBottom: spacing.xl },
  sectionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  distance: { paddingTop: spacing.md, paddingBottom: spacing.xl },
  figure: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginVertical: spacing.xs },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, paddingVertical: spacing.lg, borderTopWidth: border.rule, borderBottomWidth: border.rule, borderColor: colors.hairline },
  metric: { flex: 1, minWidth: 140, gap: spacing.xs },
  section: { marginTop: spacing.xxl },
  activity: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg, paddingVertical: spacing.lg, borderBottomWidth: border.rule, borderBottomColor: colors.hairline },
  activityLabel: { flex: 1, gap: spacing.xs },
  note: { marginTop: spacing.sm },
  empty: { paddingVertical: spacing.xl },
  loading: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  actions: { gap: spacing.lg, alignItems: 'stretch', marginTop: spacing.xl },
  textAction: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  settings: { marginTop: spacing.lg },
  privacy: { marginTop: spacing.xl },
});
