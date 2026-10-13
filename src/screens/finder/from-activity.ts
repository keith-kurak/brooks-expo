import { type ActivityProfile, formatMiles, formatSteps } from '@/data/activity';

import type { Answers, QuestionCode } from './quiz';

/** Why each pre-filled answer was chosen, in words the shopper can check. */
export type Evidence = Partial<Record<QuestionCode, string>>;

/** One run every two weeks: fewer than this and we do not call someone a runner. */
const MIN_RUNS = 4;
/** Steps a day at which someone walks enough to shop for walking shoes. [inferred] */
const WALKER_STEPS = 7500;

/**
 * Turns an activity profile into the Finder answers it can support.
 *
 * @ref LLP 0005#answer-only-what-the-data-shows — An answer is filled only when
 * the data points at one option clearly. Anything the data cannot see (how the
 * ground should feel, injuries, the barefoot tests, fit) stays a question, and
 * so does a race goal for someone whose runs are all short: a 4-mile runner may
 * be training for a 5k or for health, and Health cannot tell which.
 */
export function answersFromActivity(p: ActivityProfile): { answers: Answers; evidence: Evidence } {
  const answers: Answers = {};
  const evidence: Evidence = {};
  const weeks = Math.round(p.days / 7);

  if (p.runs >= MIN_RUNS) {
    if (p.elevationComplete && p.distanceComplete && p.trailRuns / p.runs >= 0.5) {
      answers.use = ['usetrail'];
      evidence.use = `${p.trailRuns} of your ${p.runs} runs climbed like trail runs`;
      answers.trailtype = [p.mountainShare >= 0.5 ? 'rugged' : 'smooth'];
      evidence.trailtype =
        p.mountainShare >= 0.5 ? 'Most of them climbed steeply' : 'Most of them stayed on rolling ground';
    } else if ((p.elevationComplete && p.distanceComplete) || p.treadmillShare >= 0.5) {
      answers.use = ['useroadtread'];
      evidence.use =
        p.treadmillShare >= 0.5
          ? `Most of your ${p.runs} runs were on a treadmill`
          : `${p.runs} runs in ${weeks} weeks${p.indoorComplete ? ', mostly on the road' : ''}`;
    }

    // The site's own bands: 0-10, 11-30 and 31+ miles a week.
    const weekly = Math.round(p.weeklyRunMiles);
    if (p.distanceComplete) {
      answers.rundistance = [weekly <= 10 ? 'rundistance1' : weekly <= 30 ? 'rundistance2' : 'rundistance3'];
      evidence.rundistance = `About ${formatMiles(p.weeklyRunMiles)} miles a week`;
    }

    if (p.distanceComplete && p.longestRunMiles >= 16) answers.training = ['trainingmarathon'];
    else if (p.distanceComplete && p.longestRunMiles >= 9) answers.training = ['traininghalfmarathon'];
    if (answers.training) evidence.training = `Your longest run was ${formatMiles(p.longestRunMiles, 1)} miles`;
  } else if (p.workoutsAvailable && (p.walks >= MIN_RUNS || (p.avgDailySteps ?? 0) >= WALKER_STEPS)) {
    answers.use = ['usewalk'];
    evidence.use =
      p.avgDailySteps != null ? `About ${formatSteps(p.avgDailySteps)} steps a day` : `${p.walks} walks in ${weeks} weeks`;
  }

  return { answers, evidence };
}
