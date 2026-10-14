import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Switch, View } from 'react-native';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

import { BrooksIcon } from '@/components/icons';
import { Button } from '@/components/button';
import { Divider } from '@/components/divider';
import { Press } from '@/components/press';
import { ScreenHeading, ScreenScrollView, useScreenTopPadding } from '@/components/screen';
import { Squiggle } from '@/components/squiggle';
import { Txt } from '@/components/themed-text';
import { catalog } from '@/data/catalog';
import { VOICE } from '@/data/editorial';
import { leave, useMember } from '@/store/member';
import { RUN_CLUB_PERKS } from '@/constants';
import { border, colors, spacing } from '@/theme';
import { LIQUID_GLASS, setGlassTabs, useNativeTabs, useTabBarOverlap } from '@/utils/native-tabs';
import { useUpdateCheck } from '@/utils/updates';

/**
 * Account.
 *
 * @ref LLP 0003#login — Run Club framing throughout: a member sees their club
 * card; a guest sees the pitch, with browsing never gated behind either.
 * A guest gets the pitch and the settings rows: a navy Run Club panel, three
 * perks Brooks states itself, the same rows a member sees, and one `Log in or
 * join` button that opens the email-first sheet.
 */
export function Account() {
  const member = useMember();

  // @ref LLP 0003#the-header-collapses-on-scroll — the blue header is Home's
  // alone. The controls this screen used to carry up top (search, cart, browse)
  // are all one tab-bar tap away, and the rows below already reach the Shoe
  // Finder.
  if (!member) {
    return (
      <GuestPitch />
    );
  }

  return (
    <ScreenScrollView>
      <ScreenHeading>{`Hey, ${member.firstName}.`}</ScreenHeading>

      {member ? (
        <View style={styles.card}>
          <View style={styles.cardTopRow}>
            <Txt variant="eyebrow" c={colors.lime}>
              Brooks Run Club
            </Txt>
            <View style={styles.memberBadge}>
              <Txt variant="tiny" c={colors.blue}>
                Member
              </Txt>
            </View>
          </View>
          <Txt variant="h2" c={colors.surface} style={{ marginTop: spacing.sm }}>
            {VOICE.runClub}
          </Txt>
          <Txt variant="bodySmall" c="rgba(255,255,255,0.75)" style={{ marginTop: spacing.sm }}>
            {member.email}
          </Txt>
          <Divider style={{ marginVertical: spacing.lg, backgroundColor: 'rgba(255,255,255,0.15)' }} />
          <View style={{ gap: spacing.sm }}>
            {RUN_CLUB_PERKS.slice(0, 3).map((perk) => (
              <View key={perk} style={styles.perkRow}>
                <View style={styles.perkTick} />
                <Txt variant="bodySmall" c="rgba(255,255,255,0.9)">
                  {perk}
                </Txt>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* ----------------------------------------------------------- ROWS -- */}
      {/* The rows' rules stop at the gutter, not the screen edge. */}
      <View style={{ marginTop: spacing.xxl, marginHorizontal: spacing.gutter }}>
        <SettingsRows />
      </View>

      {member ? (
        <Press onPress={leave} style={styles.signOut}>
          <Txt variant="caption" c={colors.inkMuted}>
            Sign out
          </Txt>
        </Press>
      ) : null}

      <View style={styles.foot}>
        <Squiggle />
        <Txt variant="script" c={colors.inkMuted}>
          {VOICE.tagline}
        </Txt>
        <Txt variant="tiny" c={colors.inkFaint} style={{ marginTop: spacing.sm }}>
          Catalog snapshot harvested {new Date(catalog.harvestedAt).toLocaleDateString()} ·
          photography and search live from Brooks
        </Txt>
      </View>
    </ScreenScrollView>
  );
}

/**
 * What a guest sees. The perks repeat only what brooksrunning.com lists as
 * member perks (see `RUN_CLUB_PERKS`).
 */
function GuestPitch() {
  const top = useScreenTopPadding();
  const overlap = useTabBarOverlap();
  const focused = useIsFocused();
  return (
    // Scrolls only when the pitch is taller than the screen (an iPhone SE with
    // the tab bar switch drawn); elsewhere the spacer still pins the button low.
    // `flexGrow` sizes the content to the full frame, which runs under the
    // glass bar, so the bar's overlap goes in the padding, not `contentInset`:
    // the button has to rest above the bar, not scroll clear of it.
    <ScreenScrollView
      alwaysBounceVertical={false}
      contentInset={{ bottom: 0 }}
      contentContainerStyle={[styles.guestScreen, { paddingBottom: spacing.xl + overlap }]}
    >
      {/* The navy panel runs under the status bar, so the bar goes light while
          this tab is in front. */}
      {focused && <StatusBar style="light" animated />}
      {/* @ref LLP 0003#profile-overscroll — extend the navy above the content
          without adding scroll height, as Home does below its blue footer. */}
      <View pointerEvents="none" style={styles.overscrollFill} />
      <View style={[styles.hero, { paddingTop: top + spacing.xl }]}>
        <Txt variant="eyebrow" c={colors.lime}>
          Brooks Run Club
        </Txt>
        <Txt variant="hero" c={colors.surface} style={{ marginTop: spacing.md }}>
          Join the club.{'\n'}Run happier.
        </Txt>
        <Txt variant="body" c="rgba(255,255,255,0.8)" style={{ marginTop: spacing.md }}>
          Membership is free. Log in to see your orders and keep your addresses
          and payment methods in one place.
        </Txt>
      </View>

      <View style={styles.perkList}>
        <Txt variant="eyebrow" c={colors.inkMuted} style={{ marginBottom: spacing.sm }}>
          What members get
        </Txt>
        <Perk glyph={<TruckGlyph />} title="Free shipping" body="Standard shipping on every order. Express is free over $160." />
        <Perk glyph={<GiftGlyph />} title="A birthday gift" body="A gift with purchase in your birthday month, every year." />
        <Perk glyph={<ClockGlyph />} title="Early access" body="Early access to new shoes and sales." />
      </View>

      <View style={styles.guestSettings}>
        <Txt variant="eyebrow" c={colors.inkMuted}>
          Settings
        </Txt>
        <SettingsRows />
      </View>

      <View style={{ flex: 1 }} />
      <View style={styles.guestActions}>
        <Button title="Log in or join" onPress={() => router.push('/login')} />
        <Txt variant="tiny" c={colors.inkFaint} style={styles.guestNote}>
          Browsing never requires an account.
        </Txt>
      </View>
    </ScreenScrollView>
  );
}

function Perk({ glyph, title, body }: { glyph: React.ReactNode; title: string; body: string }) {
  return (
    <View style={styles.perk} accessible accessibilityLabel={`${title}. ${body}`}>
      <View style={styles.perkGlyph}>{glyph}</View>
      <View style={{ flex: 1 }}>
        <Txt variant="productTitle">{title}</Txt>
        <Txt variant="bodySmall" c={colors.inkMuted} style={{ marginTop: 2 }}>
          {body}
        </Txt>
      </View>
    </View>
  );
}

/** Line glyphs for the perks, drawn in the ink of the control rule. */
const GLYPH = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: colors.ink, strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' } as const;

function TruckGlyph() {
  return (
    <Svg {...GLYPH}>
      <Rect x={1} y={4} width={15} height={12} />
      <Polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <Circle cx={5.5} cy={18.5} r={2.5} />
      <Circle cx={18.5} cy={18.5} r={2.5} />
    </Svg>
  );
}

function ClockGlyph() {
  return (
    <Svg {...GLYPH}>
      <Circle cx={12} cy={12} r={10} />
      <Polyline points="12 6 12 12 16 14" />
    </Svg>
  );
}

function GiftGlyph() {
  return (
    <Svg {...GLYPH}>
      <Polyline points="20 12 20 22 4 22 4 12" />
      <Rect x={2} y={7} width={20} height={5} />
      <Line x1={12} y1={22} x2={12} y2={7} />
      <Path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <Path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </Svg>
  );
}

/**
 * The rows a guest and a member share. Only rows that act are listed: the bag
 * is its own tab, and order history and the Run Happy Promise had no screen
 * behind them.
 */
function SettingsRows() {
  const update = useUpdateCheck();
  return (
    <>
      <Row label="Challenges" detail="Weekly running goals and rewards" onPress={() => router.push('/(tabs)/(account)/challenges')} />
      <Row label="Your shoes" detail="Miles on the pairs you own" onPress={() => router.navigate('/(tabs)/(shoes)/shoes')} />
      <Row label="Shoe Finder" detail="Find your perfect shoe" onPress={() => router.push('/(tabs)/(account)/finder')} />
      <Row label={update.label} detail={update.detail} onPress={update.onPress} />
      <GlassTabsRow />
    </>
  );
}

function Row({ label, detail, onPress }: { label: string; detail?: string; onPress?: () => void }) {
  return (
    <Press scaleTo={onPress ? 0.99 : 1} onPress={onPress} style={styles.row}>
      <View style={{ flex: 1 }}>
        <Txt variant="navRow">{label}</Txt>
        {detail ? (
          <Txt variant="tiny" c={colors.inkMuted} style={{ marginTop: 2 }}>
            {detail}
          </Txt>
        ) : null}
      </View>
      {onPress ? <BrooksIcon name="caretRight" size={14} color={colors.inkFaint} /> : null}
    </Press>
  );
}

/**
 * The tab bar switch. Only a Liquid Glass device has a second bar to offer, so
 * everywhere else the row is not drawn.
 *
 * @ref LLP 0003#liquid-glass-is-a-profile-toggle — Off by default: the
 * app-drawn bar is the brand's, and the system bar is opt-in.
 */
function GlassTabsRow() {
  const on = useNativeTabs();
  if (!LIQUID_GLASS) return null;
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Txt variant="navRow">Liquid Glass tab bar</Txt>
        <Txt variant="tiny" c={colors.inkMuted} style={{ marginTop: 2 }}>
          Use the system tab bar instead of the Brooks one
        </Txt>
      </View>
      <Switch
        accessibilityLabel="Liquid Glass tab bar"
        value={on}
        onValueChange={(value) => setGlassTabs(value, '/(tabs)/(account)/account')}
        trackColor={{ true: colors.blue }}
      />
    </View>
  );
}

/** The button's hard shadow hangs 4pt below its face; the note clears it. */
const SHADOW_GAP = 4;
const OVERSCROLL_FILL = 1000;

const styles = StyleSheet.create({
  /** The navy panel draws its own top inset, so the screen adds none. */
  guestScreen: { flexGrow: 1, paddingTop: 0 },
  overscrollFill: {
    position: 'absolute',
    top: -OVERSCROLL_FILL,
    right: 0,
    left: 0,
    height: OVERSCROLL_FILL,
    backgroundColor: colors.navy,
  },
  hero: {
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.xxl,
  },
  perkList: { paddingHorizontal: spacing.gutter, marginTop: spacing.xl },
  guestSettings: { paddingHorizontal: spacing.gutter, marginTop: spacing.xl, marginBottom: spacing.xl },
  perk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: border.rule,
    borderBottomColor: colors.hairline,
  },
  /** Square, outlined in the control rule: the same block the buttons are. */
  perkGlyph: {
    width: 44,
    height: 44,
    borderWidth: border.heavy,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestActions: { paddingHorizontal: spacing.gutter },
  guestNote: { marginTop: spacing.md + SHADOW_GAP, textAlign: 'center' },
  card: {
    marginHorizontal: spacing.gutter,
    backgroundColor: colors.navy,
    padding: spacing.xl,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  memberBadge: {
    backgroundColor: colors.lime,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  perkTick: { width: 8, height: 8, backgroundColor: colors.lime },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderBottomWidth: border.rule,
    borderBottomColor: colors.hairline,
  },
  signOut: { alignSelf: 'center', marginTop: spacing.xl, padding: spacing.sm },
  foot: { alignItems: 'center', marginTop: spacing.xxl, paddingHorizontal: spacing.gutter },
});
