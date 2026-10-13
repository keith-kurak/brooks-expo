import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, RefreshControl, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { BrooksIcon } from '@/components/icons';
import { Press } from '@/components/press';
import { ScreenHeading, ScreenScrollView, useScreenTopPadding } from '@/components/screen';
import { ShoeImage } from '@/components/shoe-image';
import { TabIcon } from '@/components/tab-icon';
import { Txt } from '@/components/themed-text';
import {
  mileageOf,
  REPLACE_AT,
  weeksLeftLabel,
  formatMileage,
  type OwnedShoe,
} from '@/data/mileage';
import { refreshMileage, removeShoe, retireShoe, useShoes } from '@/store/shoes';
import { border, colors, spacing } from '@/theme';
import { useTabBarOverlap } from '@/utils/native-tabs';
import { HEALTH_NAME, IS_HEALTH_CONNECT, openHealthSettings, useHealthAccess } from '@/utils/health';

import { imageOf, successorOf } from './replacement';

const FINDER = '/(tabs)/(shoes)/finder' as const;

/**
 * The Shoes tab: the pairs the runner owns, how far each has gone, and the
 * way to the next pair.
 *
 * @ref LLP 0006#the-shoes-tab — This tab used to be the Shoe Finder alone. A
 * quiz is something a shopper takes once a year; a pair's miles change every
 * run. So the tab leads with the pairs, and the Finder is where a worn pair
 * sends the runner, already knowing what they run in.
 */
export function Shoes() {
  const state = useShoes();
  const { access } = useHealthAccess();
  const HEALTH = access.status === 'available';
  const active = state.shoes.filter((s) => s.retiredAt == null);
  const retired = state.shoes.filter((s) => s.retiredAt != null);
  const [refreshing, setRefreshing] = useState(false);

  if (state.shoes.length === 0) return <Empty />;

  const pull = async () => {
    setRefreshing(true);
    await refreshMileage();
    setRefreshing(false);
  };

  return (
    <ScreenScrollView
      refreshControl={HEALTH ? <RefreshControl refreshing={refreshing} onRefresh={pull} /> : undefined}
    >
      <ScreenHeading>Your shoes.</ScreenHeading>
      <HealthNote readAt={state.readAt} error={state.syncError} />

      <View style={{ gap: spacing.xl, marginTop: spacing.lg }}>
        {active.map((shoe) => (
          <ShoeCard key={shoe.id} shoe={shoe} miles={state.byShoe[shoe.id]} />
        ))}
      </View>

      <View style={{ paddingHorizontal: spacing.gutter, marginTop: spacing.xl }}>
        <Button title="Add a pair" variant="secondary" onPress={() => router.push('/add-shoe')} />
      </View>

      {retired.length ? (
        <View style={styles.retired}>
          <Txt variant="eyebrow" c={colors.inkMuted}>
            Retired
          </Txt>
          {retired.map((shoe) => (
            <RetiredRow key={shoe.id} shoe={shoe} miles={state.byShoe[shoe.id]} />
          ))}
        </View>
      ) : null}
    </ScreenScrollView>
  );
}

/** Where the miles come from, and when they were last read. */
function HealthNote({ readAt, error }: { readAt: number | null; error: string | null }) {
  const [asking, setAsking] = useState(false);
  const { access, reload } = useHealthAccess();
  if (access.status === 'unavailable') {
    return <Txt variant="bodySmall" c={colors.inkMuted} style={styles.note}>
      Health data is unavailable here. Each pair keeps the miles you gave it.
    </Txt>;
  }
  const connected = access.workouts && access.distance;
  const connect = async () => {
    setAsking(true);
    try {
      if (access.status === 'install-required') await openHealthSettings();
      else await refreshMileage({ ask: true });
    } finally { await reload(); setAsking(false); }
  };
  return (
    <View>
      {readAt == null || !connected || error ? (
        <Press style={styles.connect} accessibilityRole="button" disabled={asking} onPress={connect}>
          <View style={{ flex: 1 }}>
            <Txt variant="productTitle">{access.status === 'install-required' ? 'Install Health Connect' : `Count miles from ${HEALTH_NAME}`}</Txt>
            <Txt variant="bodySmall" c={colors.inkMuted}>
              {error ?? (!connected && readAt != null
                ? 'Allow workouts and distance to refresh. Your saved miles are unchanged.'
                : 'Brooks adds up your recorded runs since each start date. The data stays on this phone.')}
            </Txt>
          </View>
          <BrooksIcon name="caretRight" size={14} color={colors.ink} />
        </Press>
      ) : (
        <Txt variant="bodySmall" c={colors.inkMuted} style={styles.note}>
          From your {HEALTH_NAME} workouts, read {sinceLabel(readAt)}. Pull down to read again.
        </Txt>
      )}
      {IS_HEALTH_CONNECT ? (
        <View style={{ paddingHorizontal: spacing.gutter, marginTop: spacing.sm }}>
          <Txt variant="bodySmall" c={colors.inkMuted}>
            {access.background ? 'Miles also refresh in the background when Android schedules it.' : 'Miles refresh when you open Brooks. Allow background access for updates while it is closed.'}
          </Txt>
          <Press accessibilityRole="button" onPress={openHealthSettings} style={{ paddingVertical: spacing.sm }}>
            <Txt variant="bodySmall" style={styles.underline}>Manage Health Connect access</Txt>
          </Press>
        </View>
      ) : null}
    </View>
  );
}

function sinceLabel(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  return `at ${new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

function startedLabel(shoe: OwnedShoe): string {
  const date = new Date(shoe.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const what = shoe.kinds.length > 1 ? 'Runs and walks' : 'Runs';
  return `Since ${date} · ${what}`;
}

function ShoeCard({ shoe, miles }: { shoe: OwnedShoe; miles: Parameters<typeof mileageOf>[1] }) {
  const m = mileageOf(shoe, miles);
  const image = imageOf(shoe);
  const successor = m.replace ? successorOf(shoe) : null;
  const pace = weeksLeftLabel(m);

  const retire = () =>
    Alert.alert(`Retire your ${shoe.name}?`, 'It stops counting new runs. You can still see its miles.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Retire', style: 'destructive', onPress: () => retireShoe(shoe.id) },
    ]);

  return (
    <View style={styles.card} accessible={false}>
      <View style={styles.cardHead}>
        <View style={styles.thumb}>
          {image ? <ShoeImage url={image} width={88} /> : <TabIcon name="finder" color={colors.inkFaint} />}
        </View>
        <View style={styles.cardTitle}>
          <Txt variant="h3" numberOfLines={2}>
            {shoe.name}
          </Txt>
          <Txt variant="tiny" c={colors.inkMuted}>
            {startedLabel(shoe)}
          </Txt>
        </View>
      </View>

      <View
        style={styles.readout}
        accessible
        accessibilityLabel={`${m.status} ${m.milesLabel}.${pace ? ` ${pace}.` : ''}`}
      >
        <View style={styles.percentRow}>
          <Txt variant="hero" c={m.replace ? colors.ink : colors.blue}>
            {m.percent}%
          </Txt>
          <Txt variant="h3" style={{ marginBottom: 6 }}>
            done
          </Txt>
          {m.replace ? (
            <View style={styles.replaceBadge}>
              <Txt variant="eyebrow" c={colors.blue} style={{ fontSize: 10 }}>
                Time to replace
              </Txt>
            </View>
          ) : null}
        </View>
        <MileageBar share={m.share} replace={m.replace} />
        <View style={styles.metaRow}>
          <Txt variant="caption">{m.milesLabel}</Txt>
          {pace ? (
            <Txt variant="caption" c={colors.inkMuted}>
              {pace}
            </Txt>
          ) : null}
        </View>
      </View>

      {m.replace ? (
        <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
          <Button
            title="Find its replacement"
            onPress={() => router.push({ pathname: FINDER, params: { replacing: shoe.id } })}
          />
          {successor ? (
            <Press
              onPress={() => router.push({ pathname: '/product/[id]', params: { id: successor.id } })}
              style={styles.successor}
              accessibilityRole="link"
            >
              <Txt variant="caption" style={styles.underline}>
                {successor.name === shoe.name ? `Get another ${shoe.name}` : `Shop the ${successor.name}`}
              </Txt>
            </Press>
          ) : null}
        </View>
      ) : null}

      {/* Retiring is the card's close: it takes the pair out of the active
          list. The alert says what it does before it happens. */}
      <Press onPress={retire} style={styles.retire} accessibilityRole="button" accessibilityLabel={`Retire ${shoe.name}`}>
        <BrooksIcon name="close" size={14} color={colors.inkMuted} />
      </Press>
    </View>
  );
}

/**
 * The pair's miles against its limit. The tick marks the replace line, so the
 * bar says how close the pair is to it, not just how full it is.
 *
 * @ref LLP 0003#brand — Square, like the quiz meter. Lime is a spark, not a
 * surface: it is the fill only once the pair is past the line.
 *
 * @ref LLP 0006#the-70-line — A full bar has no tick. At the limit, a line
 * three-quarters along reads as "not done yet".
 */
function MileageBar({ share, replace }: { share: number; replace: boolean }) {
  return (
    <View style={styles.bar}>
      <View
        style={[
          styles.barFill,
          { width: `${Math.min(1, share) * 100}%`, backgroundColor: replace ? colors.lime : colors.blue },
        ]}
      />
      {share < 1 ? <View style={[styles.barTick, { left: `${REPLACE_AT * 100}%` }]} /> : null}
    </View>
  );
}

function RetiredRow({ shoe, miles }: { shoe: OwnedShoe; miles: Parameters<typeof mileageOf>[1] }) {
  const m = mileageOf(shoe, miles);
  const remove = () =>
    Alert.alert(`Remove your ${shoe.name}?`, 'Its miles are deleted from this phone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeShoe(shoe.id) },
    ]);
  return (
    <View style={styles.retiredRow}>
      <View style={{ flex: 1 }}>
        <Txt variant="navRow">{shoe.name}</Txt>
        <Txt variant="tiny" c={colors.inkMuted}>
          {formatMileage(m.totalMiles)} mi · retired {new Date(shoe.retiredAt!).toLocaleDateString()}
        </Txt>
      </View>
      <Press onPress={remove} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${shoe.name}`}>
        <Txt variant="tiny" c={colors.inkMuted} style={styles.underline}>
          Remove
        </Txt>
      </Press>
    </View>
  );
}

/** No pairs yet: what the tab does, and its two ways in. */
function Empty() {
  const { access } = useHealthAccess();
  const HEALTH = access.status !== 'unavailable';
  const top = useScreenTopPadding();
  const overlap = useTabBarOverlap();
  const focused = useIsFocused();
  return (
    <ScreenScrollView
      alwaysBounceVertical={false}
      contentInset={{ bottom: 0 }}
      contentContainerStyle={[styles.emptyScreen, { paddingBottom: spacing.xl + overlap }]}
    >
      {/* The navy panel runs under the status bar. */}
      {focused && <StatusBar style="light" animated />}
      <View style={[styles.hero, { paddingTop: top + spacing.xl }]}>
        <Txt variant="eyebrow" c={colors.lime}>
          Your shoes
        </Txt>
        <Txt variant="hero" c={colors.surface} style={{ marginTop: spacing.md }}>
          Every mile,{'\n'}counted.
        </Txt>
        <Txt variant="body" c="rgba(255,255,255,0.8)" style={{ marginTop: spacing.md }}>
          {HEALTH
            ? `Add the pair you run in. Brooks adds up your ${HEALTH_NAME} runs since you started wearing them, and tells you when it is time for a new pair.`
            : 'Add the pair you run in, with the miles it has, and see how much life it has left.'}
        </Txt>
      </View>

      <View style={styles.steps}>
        <Step n="1" title="Add a pair" body="Pick it from the catalog, or type its name. Tell us when you started running in it." />
        <Step n="2" title={HEALTH ? 'Run as usual' : 'Keep running'} body={HEALTH ? `Runs your recording app shares with ${HEALTH_NAME} count toward its miles.` : 'Its miles show against the limit you set.'} />
        <Step n="3" title="Replace it at 70%" body="Then the Shoe Finder suggests the next pair, starting from what you run in now." />
      </View>

      <View style={{ flex: 1 }} />
      <View style={{ paddingHorizontal: spacing.gutter, gap: spacing.md }}>
        <Button title="Add a pair you own" onPress={() => router.push('/add-shoe')} />
        <Press onPress={() => router.push(FINDER)} style={styles.successor} accessibilityRole="button">
          <Txt variant="caption" style={styles.underline}>
            Find a new pair with the Shoe Finder
          </Txt>
        </Press>
      </View>
    </ScreenScrollView>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <View style={styles.step} accessible accessibilityLabel={`${title}. ${body}`}>
      <View style={styles.stepNumber}>
        <Txt variant="productTitle">{n}</Txt>
      </View>
      <View style={{ flex: 1 }}>
        <Txt variant="productTitle">{title}</Txt>
        <Txt variant="bodySmall" c={colors.inkMuted} style={{ marginTop: 2 }}>
          {body}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  note: { paddingHorizontal: spacing.gutter, marginTop: -spacing.sm },
  connect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.gutter,
    padding: spacing.lg,
    backgroundColor: colors.surfaceAlt,
  },
  card: {
    marginHorizontal: spacing.gutter,
    padding: spacing.lg,
    borderWidth: border.rule,
    borderColor: colors.hairline,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  // Room on the right for the retire button, so a long name wraps before it.
  cardTitle: { flex: 1, gap: 2, paddingRight: spacing.xl },
  thumb: {
    width: 88,
    height: 88,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readout: { marginTop: spacing.lg },
  percentRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  replaceBadge: {
    marginLeft: 'auto',
    marginBottom: 8,
    backgroundColor: colors.lime,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  bar: { height: 8, marginTop: spacing.md, backgroundColor: colors.surfaceSunken },
  barFill: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  barTick: { position: 'absolute', top: -3, bottom: -3, width: 2, marginLeft: -1, backgroundColor: colors.ink },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, gap: spacing.md },
  successor: { alignSelf: 'center', padding: spacing.sm },
  underline: { textDecorationLine: 'underline' },
  // A 44 pt target in the card's corner; the glyph sits 15 pt in from the edge.
  retire: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retired: { marginHorizontal: spacing.gutter, marginTop: spacing.xxl },
  retiredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: border.rule,
    borderBottomColor: colors.hairline,
  },
  emptyScreen: { flexGrow: 1, paddingTop: 0 },
  hero: { backgroundColor: colors.navy, paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxl },
  steps: { paddingHorizontal: spacing.gutter, marginTop: spacing.xl, marginBottom: spacing.xl },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: border.rule,
    borderBottomColor: colors.hairline,
  },
  stepNumber: {
    width: 44,
    height: 44,
    borderWidth: border.heavy,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
