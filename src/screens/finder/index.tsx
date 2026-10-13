import { useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useNavigation, useScrollToTop } from 'expo-router';
import { Dimensions, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { ProductTile } from '@/components/product-tile';
import { BrooksIcon } from '@/components/icons';
import { Button } from '@/components/button';
import { Press } from '@/components/press';
import { Screen, ScreenScrollView, useScreenTopPadding } from '@/components/screen';
import { Squiggle } from '@/components/squiggle';
import { Txt } from '@/components/themed-text';
import {
  ACTIVITY_WINDOW_DAYS,
  type ActivityProfile,
  formatMiles,
  formatSteps,
  readActivityProfile,
} from '@/data/activity';
import { catalog } from '@/data/catalog';
import { formatMileage, mileageOf, type OwnedShoe } from '@/data/mileage';
import { VOICE } from '@/data/editorial';
import type { Product } from '@/data/types';
import { useShoes } from '@/store/shoes';
import { border, colors, spacing } from '@/theme';
import { useTabBarOverlap } from '@/utils/native-tabs';
import { HEALTH_NAME, IS_HEALTH_CONNECT, healthErrorMessage, openHealthSettings, useHealthAccess } from '@/utils/health';

import { modelOf, productOf } from '../shoes/replacement';
import { answersFromActivity, type Evidence } from './from-activity';
import {
  type Answer,
  type Answers,
  type QuestionCode,
  PAGE_ORDER,
  PAGES,
  QUIZ_UI,
  SIZES,
  answerLabel,
  answersOnPath,
  chosen,
  flowFor,
  question,
  supportScore,
} from './quiz';

const { width: W } = Dimensions.get('window');
const TILE_W = Math.floor((W - spacing.gutter * 2 - spacing.lg) / 2);
const CLIP_W = Math.floor((W - spacing.gutter * 2 - spacing.md) / 2);
const SIZE_W = Math.floor((W - spacing.gutter * 2 - spacing.sm * 3) / 4);

/**
 * The Shoe Finder.
 *
 * @ref LLP 0005#health-first — Where health data is available, the Finder starts
 * from it, and the quiz only asks what the data cannot answer. Without Health,
 * the quiz is the whole Finder.
 *
 * @ref LLP 0005#the-sites-own-questions — The quiz is the one brooksrunning.com
 * runs, word for word, with its branches, its scores and its barefoot videos
 * (`./quiz.ts`). The "Take 'em off" checkpoint plays as a full-screen beat, and
 * results name *why* — which is what turns a quiz into advice.
 *
 * @ref LLP 0006#replacing-a-pair — Opened from a worn pair on the Shoes tab,
 * the Finder knows what the runner wears now: it says so at the top, and the
 * results favor the same line and feel.
 */

/* --------------------------------------------------------------- scoring --- */

/**
 * The total of the site's own answer scores at which a shopper gets a support
 * shoe. [inferred] Brooks scores answers but decides results on its server; 20
 * is the score of a single "unstable" or "knees bend" answer, and the site's own
 * example (a 0-2 year runner training for a marathon "benefiting from a little
 * more support") lands on 15–20.
 */
const SUPPORT_AT = 20;

/** Brooks's support shoes are the GTS line ("Go-To Support") and the structured models. */
function isSupportShoe(p: Product): boolean {
  return /\bGTS\b/.test(p.name) || p.support === 'structured_support';
}

const CUSHION_FOR_FEEL: Record<string, Product['cushion']> = {
  plush: 'Plush',
  balanced: 'Balanced',
  responsive: 'Responsive',
};

/** The pair being replaced, as the scoring needs it. */
interface Replacing {
  name: string;
  model: string;
  cushion: Product['cushion'];
  miles: number;
}

function recommend(
  all: Answers,
  activity: ActivityProfile | null,
  replacing: Replacing | null
): { product: Product; reasons: string[]; score: number }[] {
  const a = answersOnPath(all);
  const use = chosen(a, 'use');
  const trail = chosen(a, 'trailtype');
  const goal = chosen(a, 'training');
  const when = chosen(a, 'traininguse');
  const feel = chosen(a, 'shoefeel');
  const gender = chosen(a, 'gender');
  const features = new Set(a.features ?? []);
  const needsSupport = supportScore(a) >= SUPPORT_AT || features.has('extrasupport');

  let shoes = catalog.products.filter(
    (p) =>
      p.productType === 'Shoes' &&
      p.colors.length > 0 &&
      !p.colors.every((c) => c.soldOut) &&
      (!gender || p.gender === gender || p.gender === 'unisex')
  );
  // A chosen size narrows to shoes that have it, unless nothing would be left.
  if (a.size) {
    const fits = shoes.filter((p) =>
      p.colors.some((c) => !c.soldOut && c.sizes.some((s) => s.value === a.size && s.available))
    );
    if (fits.length) shoes = fits;
  }

  const scored = shoes.map((p) => {
    let score = 0;
    const reasons: string[] = [];

    // Surface is the hardest gate: trail shoes for trail, road for road.
    const exp = p.experience ?? '';
    if (use === 'usetrail') {
      if (!exp.includes('trail')) score -= 10;
      else {
        score += 4;
        reasons.push('Built for trail — grip and protection off-road');
        if ((trail === 'smooth' && exp === 'light_trail') || (trail === 'rugged' && exp === 'mountain_trail')) {
          score += 3;
          reasons.push(trail === 'smooth' ? 'Happiest on smooth trails' : 'Made for rocky and rugged ground');
        }
      }
    } else if (use === 'usewalk') {
      if (exp === 'walking' || p.bestFor.includes('Walking')) {
        score += 4;
        reasons.push(
          activity?.avgDailySteps != null
            ? `A favorite for all-day walking, and you average ${formatSteps(activity.avgDailySteps)} steps a day`
            : 'A favorite for walking and everyday wear'
        );
      } else if (exp.includes('trail')) score -= 6;
      else if (p.cushion === 'Plush') score += 1;
    } else {
      // Run or Treadmill, or Workout Class or Gym
      if (exp.includes('trail')) score -= 10;
      if (exp === 'walking') score -= 6;
      if (use === 'usegym' && p.bestFor.some((b) => /gym|workout/i.test(b))) {
        score += 3;
        reasons.push('Made for workouts and the gym');
      }
      if (goal === 'traininghalfmarathon' || goal === 'trainingmarathon' || goal === 'trainingultra') {
        if (p.bestFor.some((b) => /long run/i.test(b))) {
          score += 2;
          reasons.push(
            activity && activity.longestRunMiles >= 9
              ? `Loved for long runs like your ${formatMiles(activity.longestRunMiles, 1)}-miler`
              : 'Loved for long runs'
          );
        }
      }
      if (when === 'userace' && exp === 'speed') {
        score += 3;
        reasons.push('Race-ready — light and quick when it counts');
      } else if (when === 'userace') score -= 1;
      if (p.bestFor.some((b) => /everyday|daily/i.test(b))) score += 1;
    }

    // Cushion: the site's three feels map 1:1 to Brooks's cushion vocabulary.
    if (feel && p.cushion === CUSHION_FOR_FEEL[feel]) {
      score += 3;
      reasons.push(`${p.cushion} cushion — you wanted each step ${answerLabel('shoefeel', feel).toLowerCase()}`);
    }

    // Support, from the site's scores. Trail and spike models carry no support
    // rating, so the rule only applies where the catalog has one.
    if (p.support) {
      if (needsSupport === isSupportShoe(p)) {
        score += 3;
        reasons.push(
          needsSupport
            ? 'Support that steadies you, from your answers and the barefoot tests'
            : 'Neutral — your stride doesn’t need correcting'
        );
      } else score -= 1;
    }

    if (
      features.has('maxcushion') &&
      (p.cushion === 'Plush' || [...p.bestFor, ...p.features].some((f) => /max cushion/i.test(f)))
    ) {
      score += 2;
      reasons.push('Maximum cushion, as you asked');
    }
    if (features.has('flexiblemidsole') && p.features.some((f) => /flex/i.test(f))) {
      score += 2;
      reasons.push('A flexible midsole, as you asked');
    }

    // High mileage rewards durable daily trainers.
    if (chosen(a, 'rundistance') === 'rundistance3' && p.bestFor.some((b) => /everyday|daily|long/i.test(b))) {
      score += 1;
      if (activity?.distanceComplete) reasons.push(`Built to take your ${formatMiles(activity.weeklyRunMiles)} miles a week`);
    }

    // A worn-out pair is a vote for its own line: the runner kept it long enough
    // to wear it out. Worth about one answer, so the quiz can still overrule it.
    if (replacing && modelOf(p.name) === replacing.model) {
      score += 3;
      reasons.unshift(`The next ${p.name.replace(/\s+\d+.*$/, '')}, the line you put ${formatMileage(replacing.miles)} miles on`);
    } else if (replacing?.cushion && p.cushion === replacing.cushion) {
      score += 1;
    }

    // Crowd wisdom, gently.
    if (p.badge === 'Best Seller') score += 1;
    if ((p.rating ?? 0) >= 4.5) score += 1;

    return { product: p, reasons: reasons.slice(0, 3), score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((x, y) => y.score - x.score || (y.product.rating ?? 0) - (x.product.rating ?? 0))
    .slice(0, 4);
}

/** The site's short "Behind the Science" lines for the barefoot answers given. */
function scienceNotes(a: Answers): string[] {
  return (['balance', 'knee', 'flexibility'] as const)
    .map((code) => question(code).answers.find((x) => x.code === chosen(a, code))?.whyShort)
    .filter((note): note is string => !!note);
}

/* ------------------------------------------------------------------ view --- */

type Phase = 'intro' | 'activity' | 'quiz' | 'results';

/** Read once: availability does not change while the app runs. */

const WEEKS = Math.round(ACTIVITY_WINDOW_DAYS / 7);

const HEALTH_ICON = require('../../../assets/apple-health-icon.png');
const BROOKS_ICON = require('../../../assets/icon.png');

export function Finder({ replacing: replacingId }: { replacing?: string } = {}) {
  const { access, reload: reloadAccess } = useHealthAccess();
  const [readError, setReadError] = useState<string | null>(null);
  // The Finder never carried the blue header, and still does not: its intro is a
  // full-bleed navy panel. It takes its safe area from the same primitive every
  // other headerless screen does.
  // @ref LLP 0003#the-header-collapses-on-scroll
  const screenTop = useScreenTopPadding();
  const tabBarOverlap = useTabBarOverlap();
  // The quiz and activity pages scroll in a bare `ScrollView`, not
  // `ScreenScrollView`; only one is mounted at a time, so one ref serves both.
  // @ref components/screen — a second tab tap scrolls to the top.
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const [phase, setPhase] = useState<Phase>('intro');
  // The Finder is pushed now (Shoes, Browse, Profile), and its panels hide the
  // native bar, so it draws its own way back.
  const navigation = useNavigation();
  const canLeave = navigation.canGoBack();

  // The owned pair this Finder run is replacing, when the Shoes tab sent it.
  const shoes = useShoes();
  const ownedShoe = shoes.shoes.find((s) => s.id === replacingId) ?? null;
  const replacing = useMemo<Replacing | null>(() => {
    if (!ownedShoe) return null;
    return {
      name: ownedShoe.name,
      model: modelOf(productOf(ownedShoe)?.name ?? ownedShoe.name),
      cushion: productOf(ownedShoe)?.cushion ?? null,
      miles: mileageOf(ownedShoe, shoes.byShoe[ownedShoe.id]).totalMiles,
    };
  }, [ownedShoe, shoes.byShoe]);
  const [answers, setAnswers] = useState<Answers>({});
  const [stepIndex, setStepIndex] = useState(0);

  // Device activity. `profile` is what was read; `prefill` and `evidence` are the
  // answers it supports and why. All three are screen state only.
  // @ref LLP 0005#nothing-leaves-the-device
  const [reading, setReading] = useState(false);
  const [profile, setProfile] = useState<ActivityProfile | null>(null);
  const [prefill, setPrefill] = useState<Answers>({});
  const [evidence, setEvidence] = useState<Evidence>({});
  const skip = useMemo(() => new Set(Object.keys(prefill)), [prefill]);
  // Results quote the shopper's numbers only when those numbers decided something.
  const activity = skip.size > 0 ? profile : null;

  const flow = useMemo(() => flowFor(answers, skip), [answers, skip]);
  const stepId = flow[stepIndex];
  // "Behind the Science" opens per page and closes when the page changes.
  const [scienceFor, setScienceFor] = useState<string | null>(null);
  const results = useMemo(
    () => (phase === 'results' ? recommend(answers, activity, replacing) : []),
    [phase, answers, activity, replacing]
  );

  const forgetActivity = () => {
    setProfile(null);
    setPrefill({});
    setEvidence({});
  };

  const startQuiz = (start: Answers) => {
    setAnswers(start);
    setStepIndex(0);
    setPhase('quiz');
  };

  const reset = () => {
    setAnswers({});
    setStepIndex(0);
    forgetActivity();
    setPhase('intro');
  };

  const startFromActivity = async () => {
    if (reading) return;
    setReading(true);
    setReadError(null);
    if (access.status === 'install-required') {
      try { await openHealthSettings(); } catch { setReadError('Health Connect could not be opened. Install or update it in Google Play.'); }
      setReading(false);
      return;
    }
    let read: ActivityProfile | null = null;
    try {
      read = await readActivityProfile();
    } catch (error) {
      setReadError(healthErrorMessage(error));
    }
    await reloadAccess();
    const derived = read ? answersFromActivity(read) : { answers: {}, evidence: {} };
    setProfile(read);
    setPrefill(derived.answers);
    setEvidence(derived.evidence);
    setReading(false);
    setPhase('activity');
  };

  // @ref LLP 0005#the-quiz-waits-for-next — A tap selects; only Next moves on.
  const next = () => {
    // flowFor can grow (trail branch), so it is recomputed from the answers.
    if (stepIndex + 1 >= flow.length) setPhase('results');
    else setStepIndex(stepIndex + 1);
  };

  const back = () => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
    // The first question goes back to wherever the quiz started from.
    else if (profile) setPhase('activity');
    else reset();
  };

  /* ---------------------------------------------------------------- intro -- */
  // @ref LLP 0005#health-first — With Health on the device, the Finder leads
  // with it and the quiz is the fallback.
  if (phase === 'intro' && access.status !== 'unavailable') {
    return (
      <Screen style={[styles.intro, { paddingBottom: spacing.xl }]}>
        <TopBar onDark canLeave={canLeave} replacing={ownedShoe} />
        <View style={{ flex: 2 }} />
        <View style={styles.linkArt}>
          {IS_HEALTH_CONNECT ? (
            <View style={[styles.appIcon, { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }]} accessible accessibilityLabel="Health Connect">
              <LinkGlyph size={44} color={colors.navy} />
            </View>
          ) : <Image source={HEALTH_ICON} style={styles.appIcon} accessibilityLabel="Apple Health" />}
          <Image source={BROOKS_ICON} style={styles.appIcon} accessibilityLabel="Brooks" />
          <View style={styles.linkBadge}>
            <LinkGlyph />
          </View>
        </View>

        <Txt variant="hero" c={colors.surface} style={{ marginTop: spacing.xxl }}>
          Link to{'\n'}
          <Txt variant="hero" c={colors.lime}>
            {HEALTH_NAME}
          </Txt>
        </Txt>
        <Txt variant="body" c="rgba(255,255,255,0.8)" style={{ marginTop: spacing.md }}>
          {IS_HEALTH_CONNECT ? 'We read your recent runs, walks and steps, then ask only what your activity cannot tell us.' : `We read your last ${WEEKS} weeks of runs, walks and steps, then ask only what Health can't tell us.`}
        </Txt>
        <View style={styles.introRule} />

        <View style={{ flex: 3 }} />
        <LockGlyph />
        <Txt variant="bodySmall" c="rgba(255,255,255,0.8)" style={styles.privacy}>
          Your Finder profile stays on this phone and is discarded when you leave. Nothing is sent to a server.
        </Txt>
        {readError ? <Txt variant="bodySmall" c={colors.surface}>{readError}</Txt> : null}
        <Button
          title={access.status === 'install-required' ? 'Install Health Connect' : `Connect ${HEALTH_NAME}`}
          variant="onDark"
          loading={reading}
          onPress={startFromActivity}
        />
        <Press
          onPress={() => startQuiz({})}
          disabled={reading}
          style={styles.healthLink}
          accessibilityRole="button"
        >
          <Txt variant="bodySmall" c={colors.surface} style={styles.healthLinkText}>
            Answer the questions instead
          </Txt>
        </Press>
      </Screen>
    );
  }

  if (phase === 'intro') {
    return (
      <Screen style={[styles.intro, { paddingBottom: spacing.xl }]}>
        <TopBar onDark canLeave={canLeave} replacing={ownedShoe} />
        <Txt variant="eyebrow" c={colors.lime} style={{ marginTop: spacing.lg }}>
          Shoe Finder
        </Txt>
        <Txt variant="hero" c={colors.surface} style={{ marginTop: spacing.md }}>
          {VOICE.finderWelcome}
        </Txt>
        <Txt variant="body" c="rgba(255,255,255,0.8)" style={{ marginTop: spacing.lg }}>
          {VOICE.finderBlurb}
        </Txt>
        <View style={{ flex: 1 }} />
        <Button title={VOICE.finderCta} variant="onDark" onPress={() => startQuiz({})} />
      </Screen>
    );
  }

  /* ------------------------------------------------------------- activity -- */
  if (phase === 'activity') {
    const readWeeks = Math.round((profile?.days ?? ACTIVITY_WINDOW_DAYS) / 7);
    const filled = (Object.keys(prefill) as QuestionCode[]).sort(
      (x, y) => PAGE_ORDER.indexOf(x) - PAGE_ORDER.indexOf(y)
    );
    const found = filled.length > 0;
    // Some activity, but not enough to decide any answer.
    const thin =
      !!profile && (profile.runs > 0 || profile.walks > 0 || profile.avgDailySteps != null);
    const left = flowFor(prefill, skip).filter((id) => id !== 'checkpoint_bio').length;
    return (
      <Screen style={[styles.intro, { paddingHorizontal: 0, paddingBottom: spacing.xl }]}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingBottom: spacing.xl }}
          showsVerticalScrollIndicator={false}
        >
          <TopBar onDark canLeave={canLeave} replacing={ownedShoe} />
          <Txt variant="h1" c={colors.surface} style={{ marginTop: spacing.lg }}>
            {found
              ? `${filled.length === 1 ? 'One answer' : `${filled.length} answers`} down already.`
              : thin
                ? 'Not quite enough to go on.'
                : 'Nothing to go on yet.'}
          </Txt>
          <Txt variant="body" c="rgba(255,255,255,0.8)" style={{ marginTop: spacing.sm }}>
            {readError ?? (found
              ? `From your last ${readWeeks} weeks in ${HEALTH_NAME}. The quiz asks the rest.`
              : thin
                ? 'Your activity cannot answer enough yet. The quiz asks the remaining questions.'
                : IS_HEALTH_CONNECT && !access.workouts && !access.steps
                  ? 'Choose which activity Brooks can read in Health Connect, or answer the questions yourself.'
                  : `We found no usable activity from the last ${readWeeks} weeks. Check what Brooks can read in ${HEALTH_NAME} and that your recording app shares activity.`)}
          </Txt>
          {IS_HEALTH_CONNECT ? (
            <Press onPress={openHealthSettings} accessibilityRole="button" style={styles.healthLink}>
              <Txt variant="bodySmall" c={colors.surface} style={styles.healthLinkText}>Manage Health Connect access</Txt>
            </Press>
          ) : null}

          {found ? (
            <View style={{ marginTop: spacing.xl }}>
              {filled.map((key) => (
                <View key={key} style={styles.evidenceRow}>
                  <Txt variant="tiny" c="rgba(255,255,255,0.6)">
                    {question(key).progress}
                  </Txt>
                  <Txt variant="h3" c={colors.surface} style={{ marginTop: 2 }}>
                    {answerLabel(key, chosen(prefill, key))}
                  </Txt>
                  <Txt variant="bodySmall" c="rgba(255,255,255,0.7)" style={{ marginTop: 2 }}>
                    {evidence[key]}
                  </Txt>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>

        <View style={{ paddingHorizontal: spacing.gutter }}>
          <Button
            title={found ? 'Continue' : 'Answer the questions'}
            accessory={found ? `${left} left` : undefined}
            variant="onDark"
            onPress={() => startQuiz(prefill)}
          />
          {found ? (
            <Press
              onPress={() => {
                forgetActivity();
                startQuiz({});
              }}
              style={styles.healthLink}
              accessibilityRole="button"
            >
              <Txt variant="bodySmall" c={colors.surface} style={styles.healthLinkText}>
                Answer every question instead
              </Txt>
            </Press>
          ) : null}
        </View>
      </Screen>
    );
  }

  /* -------------------------------------------------------------- results -- */
  if (phase === 'results') {
    return (
      <ScreenScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <View style={{ paddingHorizontal: spacing.gutter }}>
          <TopBar canLeave={canLeave} replacing={ownedShoe} />
          <Txt variant="eyebrow" c={colors.inkMuted} style={{ marginTop: spacing.lg }}>
            Your matches
          </Txt>
          <Squiggle />
          <Txt variant="h1">
            {results.length ? QUIZ_UI.resultsTitle : 'Hmm — nothing quite fits.'}
          </Txt>
          <Txt variant="body" c={colors.inkMuted} style={{ marginTop: spacing.sm }}>
            {!results.length
              ? 'Try loosening an answer or two.'
              : replacing
                ? `To replace your ${replacing.name}, we suggest:`
                : activity
                  ? `From your ${HEALTH_NAME} activity and your answers, we suggest:`
                  : QUIZ_UI.resultsLead}
          </Txt>
          {scienceNotes(answers).length ? (
            <View style={styles.scienceBox}>
              <Txt variant="eyebrow" c={colors.inkMuted}>
                {QUIZ_UI.behindScience}
              </Txt>
              {scienceNotes(answers).map((note) => (
                <View key={note} style={styles.why}>
                  <View style={styles.whyTick} />
                  <Txt variant="bodySmall" c={colors.inkSoft} style={{ flex: 1 }}>
                    {note}
                  </Txt>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={{ marginTop: spacing.xl, gap: spacing.xxl }}>
          {results.map((r, i) => (
            <View key={r.product.id} style={styles.resultCard}>
              {i === 0 && (
                <View style={styles.topPick}>
                  <Txt variant="eyebrow" c={colors.blue} style={{ fontSize: 10 }}>
                    Top pick
                  </Txt>
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: spacing.lg }}>
                <ProductTile product={r.product} width={TILE_W} index={i} />
                <View style={{ flex: 1, gap: spacing.sm, paddingTop: spacing.sm }}>
                  {r.reasons.map((why) => (
                    <View key={why} style={styles.why}>
                      <View style={styles.whyTick} />
                      <Txt variant="bodySmall" c={colors.inkSoft} style={{ flex: 1 }}>
                        {why}
                      </Txt>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={{ paddingHorizontal: spacing.gutter, marginTop: spacing.xxl, gap: spacing.md }}>
          {/* A retake keeps the Health answers: the data has not changed, only
              the shopper's mind about the questions it could not answer. */}
          <Button title="Retake the quiz" variant="secondary" onPress={() => startQuiz(prefill)} />
          <Press onPress={reset} style={{ alignSelf: 'center', padding: spacing.sm }}>
            <Txt variant="caption" c={colors.inkMuted}>
              Start over
            </Txt>
          </Press>
        </View>
      </ScreenScrollView>
    );
  }

  /* ------------------------------------------------------------ checkpoint -- */
  const page = PAGES[stepId];
  if (page.kind === 'checkpoint') {
    // The site's description opens with the punchline; the rest is the instruction.
    const [punch, ...rest] = page.description.split('. ');
    // Extra air above the shared screen top: the checkpoint is a full-screen
    // beat, and its headline wants more room than a normal screen's first line.
    return (
      <View style={[styles.checkpoint, { paddingTop: screenTop + 46, paddingBottom: spacing.xl + tabBarOverlap }]}>
        <Txt variant="eyebrow" c={colors.blue}>
          Quick checkpoint
        </Txt>
        <Txt variant="hero" style={{ marginTop: spacing.md }}>
          {page.title}
        </Txt>
        <Txt variant="script" c={colors.inkMuted} style={{ marginTop: spacing.sm }}>
          {punch}.
        </Txt>
        <Txt variant="body" c={colors.inkSoft} style={{ marginTop: spacing.xl }}>
          {rest.join('. ')}
        </Txt>
        <View style={{ flex: 1 }} />
        <Progress flow={flow} index={stepIndex} />
        <View style={{ marginTop: spacing.lg }}>
          <Button title={page.button} onPress={next} />
        </View>
      </View>
    );
  }

  /* ----------------------------------------------------------------- quiz -- */
  const q = page;
  const picks = answers[q.code] ?? [];
  const last = stepIndex + 1 >= flow.length;
  const explained = !q.multi ? q.answers.find((x) => x.code === picks[0])?.why : undefined;
  const showScience = scienceFor === q.code;

  const pick = (code: string) =>
    setAnswers((prev) => {
      const current = prev[q.code] ?? [];
      const values = q.multi
        ? current.includes(code)
          ? current.filter((c) => c !== code)
          : [...current, code]
        : [code];
      const out: Answers = { ...prev, [q.code]: values };
      // A size belongs to one size chart: switching Women's/Men's clears it.
      if (q.code === 'gender' && current[0] !== code) delete out.size;
      return out;
    });

  // An optional page moves on with nothing chosen, under the site's own label.
  const title = last
    ? QUIZ_UI.showResults
    : q.optional && picks.length === 0
      ? QUIZ_UI.noneOfThese
      : QUIZ_UI.continue;
  const gender = q.code === 'gender' ? (picks[0] as keyof typeof SIZES | undefined) : undefined;

  return (
    <Screen style={[styles.quiz, { paddingHorizontal: 0, paddingBottom: spacing.xl }]}>
      <View style={[styles.quizHead, { paddingHorizontal: spacing.gutter }]}>
        <Press hitSlop={10} onPress={back} accessibilityRole="button" accessibilityLabel="Back">
          <BrooksIcon name="caretLeft" size={16} color={colors.inkMuted} />
        </Press>
        <Txt variant="tiny" c={colors.inkMuted}>
          {stepIndex + 1} of {flow.length}
        </Txt>
      </View>

      <ScrollView
        ref={scrollRef}
        key={q.code}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <Txt variant="eyebrow" c={colors.inkMuted} style={{ marginTop: spacing.xl }}>
          {q.progress}
        </Txt>
        <Txt
          variant={q.question.length > 90 ? 'h3' : q.question.length > 50 ? 'h2' : 'h1'}
          style={{ marginTop: spacing.sm }}
        >
          {q.question}
        </Txt>

        {q.behindScience ? (
          <>
            <Press
              onPress={() => setScienceFor(showScience ? null : q.code)}
              style={styles.scienceLink}
              accessibilityRole="button"
              accessibilityState={{ expanded: showScience }}
            >
              <Txt variant="eyebrow" c={colors.ink} style={styles.underline}>
                {QUIZ_UI.behindScience}
              </Txt>
            </Press>
            {showScience ? (
              <Txt variant="bodySmall" c={colors.inkSoft} style={styles.scienceBox}>
                {q.behindScience}
              </Txt>
            ) : null}
          </>
        ) : null}

        {q.video != null ? <LoopVideo source={q.video} style={styles.questionClip} /> : null}

        {q.layout === 'video' ? (
          <View style={styles.clipRow} accessibilityRole="radiogroup">
            {q.answers.map((o) => (
              <ClipAnswer key={o.code} answer={o} on={picks.includes(o.code)} onPress={() => pick(o.code)} />
            ))}
          </View>
        ) : (
          <View style={{ marginTop: spacing.xl, gap: spacing.md }} accessibilityRole={q.multi ? undefined : 'radiogroup'}>
            {q.answers.map((o) => (
              <TextAnswer key={o.code} answer={o} multi={q.multi} on={picks.includes(o.code)} onPress={() => pick(o.code)} />
            ))}
          </View>
        )}

        {explained ? (
          <View style={styles.scienceBox}>
            <Txt variant="eyebrow" c={colors.inkMuted}>
              {QUIZ_UI.whatDoesThisMean}
            </Txt>
            <Txt variant="bodySmall" c={colors.inkSoft} style={{ marginTop: spacing.xs }}>
              {explained}
            </Txt>
          </View>
        ) : null}

        {gender ? (
          <View style={{ marginTop: spacing.xl }}>
            <Txt variant="eyebrow" c={colors.inkMuted}>
              {QUIZ_UI.selectSize}
            </Txt>
            <View style={styles.sizeGrid}>
              {SIZES[gender].map((size) => {
                const isOn = answers.size === size;
                return (
                  <Press
                    key={size}
                    onPress={() => setAnswers((prev) => ({ ...prev, size: isOn ? undefined : size }))}
                    style={[styles.sizeCell, isOn && styles.sizeCellOn]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isOn }}
                    accessibilityLabel={`Size ${size}`}
                  >
                    <Txt variant="caption">{size}</Txt>
                  </Press>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.gutter }}>
        <Progress flow={flow} index={stepIndex} />
        <View style={{ marginTop: spacing.lg }}>
          <Button title={title} disabled={!q.optional && picks.length === 0} onPress={next} />
        </View>
      </View>
    </Screen>
  );
}

/**
 * The row above the Finder's own panels: a back control when the Finder was
 * pushed, and the pair it is replacing when there is one. Drawn by the screen
 * because the navy panels run under where a native bar would sit.
 */
function TopBar({
  canLeave,
  replacing,
  onDark = false,
}: {
  canLeave: boolean;
  replacing: OwnedShoe | null;
  onDark?: boolean;
}) {
  const navigation = useNavigation();
  if (!canLeave && !replacing) return null;
  const ink = onDark ? colors.surface : colors.ink;
  return (
    <View style={styles.topBar}>
      {canLeave ? (
        <Press hitSlop={12} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Back">
          <BrooksIcon name="caretLeft" size={16} color={ink} />
        </Press>
      ) : null}
      {replacing ? (
        <View style={[styles.replacingTag, onDark && styles.replacingTagOnDark]}>
          <Txt variant="tiny" c={ink} numberOfLines={1}>
            Replacing your {replacing.name}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

/** One text answer row. A selected row fills ink; a multi-select row also ticks. */
function TextAnswer({
  answer,
  multi,
  on,
  onPress,
}: {
  answer: Answer;
  multi: boolean;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Press
      scaleTo={0.98}
      onPress={onPress}
      style={[styles.option, on && styles.optionOn]}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={multi ? { checked: on } : { selected: on }}
    >
      <Txt variant="h3" c={on ? colors.surface : colors.ink} style={{ flex: 1 }}>
        {answer.label}
      </Txt>
      <View style={[styles.optionTick, on && styles.optionTickOn]} />
    </Press>
  );
}

/**
 * A video answer: the site's looping clip of the exercise, with its label
 * below. Both clips play at once so the shopper can compare them, and a tap
 * anywhere on the tile chooses it.
 *
 * @ref LLP 0003#border-widths — Chosen is the outlined-control gesture: the
 * rule doubles and turns ink.
 */
function ClipAnswer({ answer, on, onPress }: { answer: Answer; on: boolean; onPress: () => void }) {
  return (
    <Press
      scaleTo={0.98}
      onPress={onPress}
      style={[styles.clip, on && styles.clipOn]}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={answer.label}
    >
      {answer.video != null ? <LoopVideo source={answer.video} style={styles.clipVideo} /> : null}
      <View style={[styles.clipLabel, on && styles.clipLabelOn]}>
        <View style={[styles.optionTick, on && styles.optionTickOn]} />
        <Txt variant="caption" c={on ? colors.surface : colors.ink} style={{ flex: 1 }}>
          {answer.label}
        </Txt>
      </View>
    </Press>
  );
}

/** A muted, looping clip that plays as soon as it mounts and never takes the audio session. */
function LoopVideo({ source, style }: { source: number; style: StyleProp<ViewStyle> }) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.audioMixingMode = 'mixWithOthers';
    p.play();
  });
  return (
    <VideoView
      style={style}
      player={player}
      nativeControls={false}
      contentFit="contain"
      surfaceType="textureView"
      allowsVideoFrameAnalysis={false}
      playsInline
      pointerEvents="none"
    />
  );
}

/** Segmented lime progress on an ink track — the site's own quiz meter. */
function Progress({ flow, index }: { flow: string[]; index: number }) {
  return (
    <View style={styles.progress}>
      {flow.map((id, i) => (
        <View key={id} style={[styles.progressSeg, i <= index && styles.progressSegOn]} />
      ))}
    </View>
  );
}

/** The chain link between the two app icons. */
function LinkGlyph({ size = 20, color = colors.surface }: { size?: number; color?: string } = {}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Svg>
  );
}

function LockGlyph() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke={colors.surface} strokeWidth={2.5} />
      <Rect x={4} y={10} width={16} height={12} rx={2.5} fill={colors.surface} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  intro: {
    flex: 1,
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.gutter,
  },
  healthLink: { alignSelf: 'center', padding: spacing.md, marginTop: spacing.sm },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, minHeight: 24 },
  replacingTag: {
    flexShrink: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: border.rule,
    borderColor: colors.controlBorder,
  },
  replacingTagOnDark: { borderColor: 'rgba(255,255,255,0.4)' },
  healthLinkText: { textDecorationLine: 'underline' },
  linkArt: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
  },
  // App icons keep the iOS icon corner: this row shows two real app icons.
  appIcon: { width: 104, height: 104, borderRadius: 24 },
  linkBadge: {
    position: 'absolute',
    bottom: -20,
    alignSelf: 'center',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.ink,
    borderWidth: 3,
    borderColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introRule: {
    marginTop: spacing.xl,
    borderTopWidth: border.rule,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  privacy: { marginTop: spacing.sm, marginBottom: spacing.xl },
  evidenceRow: {
    paddingVertical: spacing.md,
    borderTopWidth: border.rule,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  quiz: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.gutter },
  quizHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: border.rule,
    borderColor: colors.controlBorder,
    backgroundColor: colors.surface,
  },
  // An answer selects by filling, like the filled chip, so the rule follows the
  // fill instead of doubling — the row would otherwise reflow its label.
  optionOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  // @ref LLP 0003#border-widths — The tick keeps the emphasis weight: at 14pt a
  // single rule disappears, and this is a mark inside the control rather than
  // the control's own edge.
  optionTick: {
    width: 14,
    height: 14,
    borderWidth: border.emphasis,
    borderColor: colors.controlBorder,
  },
  optionTickOn: { backgroundColor: colors.lime, borderColor: colors.lime },

  // Lime is a spark, never a surface (LLP 0003) — the checkpoint gets the
  // product-photography field instead, with lime reserved for the accents.
  checkpoint: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.gutter,
  },

  underline: { textDecorationLine: 'underline' },
  scienceLink: { alignSelf: 'flex-start', paddingVertical: spacing.sm, marginTop: spacing.sm },
  scienceBox: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
  },
  // The site's clips are shot on white, so `contain` on the white screen reads
  // as one surface.
  questionClip: { width: '100%', aspectRatio: 2, marginTop: spacing.lg, backgroundColor: colors.surface },
  clipRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  clip: {
    width: CLIP_W,
    borderWidth: border.rule,
    borderColor: colors.controlBorder,
    backgroundColor: colors.surface,
  },
  clipOn: { borderWidth: border.emphasis, borderColor: colors.ink },
  clipVideo: { width: '100%', aspectRatio: 1, backgroundColor: colors.surface },
  clipLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    minHeight: 56,
    borderTopWidth: border.rule,
    borderTopColor: colors.hairline,
  },
  clipLabelOn: { backgroundColor: colors.ink, borderTopColor: colors.ink },
  sizeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  sizeCell: {
    width: SIZE_W,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border.rule,
    borderColor: colors.controlBorder,
    backgroundColor: colors.surface,
  },
  sizeCellOn: { borderWidth: border.emphasis, borderColor: colors.ink },

  progress: { flexDirection: 'row', gap: 4, marginTop: spacing.lg },
  progressSeg: { flex: 1, height: 5, backgroundColor: colors.surfaceSunken },
  progressSegOn: { backgroundColor: colors.blue },

  resultCard: { paddingHorizontal: spacing.gutter },
  topPick: {
    alignSelf: 'flex-start',
    backgroundColor: colors.lime,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginBottom: spacing.sm,
  },
  why: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  whyTick: { width: 7, height: 7, backgroundColor: colors.lime, marginTop: 6 },
});
