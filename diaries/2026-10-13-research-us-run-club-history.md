# US Run Club promotion history

**Date:** 2026-10-13
**Agent:** Codex / gpt-6.1-sol
**System:** Research
**Scope:** Find actual past US Brooks Run Club games, activity requirements and prizes.

## Outcome

[observed] [LLP 0008](../llp/0008-us-run-club-promotions.research.md) records
eleven completed campaigns supported by sponsor rules, with current activity
and unverified leads kept separate. Past games included memory matching,
trivia and a prize wheel. Completion mostly earned chances to win, not
guaranteed rewards. No app code changed.

## What worked well

[observed] The research skill's background agent checked recent fitness
campaigns while the root agent checked older games. Giveaway directories
provided direct links to official rules. The rules corrected misleading
directory dates and distinguished US Run Club from other Strava campaigns.

## Friction and blockers

[observed] Several retired sponsor PDFs returned 404. Indexed official PDF
text recovered some campaigns' mechanics and prizes; unrecovered details
remain labeled as secondary leads. Python's first direct request failed
local certificate validation; system curl confirmed the retired links' 404s.

## What was hard

[observed] Rules often preserved entry mechanics without game artwork or
questions. Prize offers also do not establish that every advertised prize
was claimed. A 2025 and a 2026 Disney promotion used separate rules and
different milestone values.

## Comparative friction

Not observed.

## Improvement ideas

[inferred] A source-backed campaign fixture with separate fields for challenge
completion, entries, selection and prize claim would support an honest app
demo. No new Expo API gap was observed.

## Follow-ups

[observed] Pachinko, spring 2023 Trivia prize details, the Boston 2025 event
and older standalone monthly 5K packages still lack recovered primary prize
or eligibility terms. They are not included in the verified comparison.
