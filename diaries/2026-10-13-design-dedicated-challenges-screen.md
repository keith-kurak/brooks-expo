# Move the workout goal into Challenges

**Date:** 2026-10-13
**Agent:** Codex / GPT-6.1
**System:** Shared
**Scope:** Revise the approved Paper concept to use a dedicated Challenges screen.

## Outcome

[observed] Updated the existing
[Paper page](https://app.paper.design/file/01M06FKT4VGZT5BB9ST564VHEN/p-6-0).
Five states now show the Profile entry, invitation, connection, progress and
completion. Goal and reward content live on Challenges, with a back action to
Profile. Exports are in [`designs/challenges-screen/`](../designs/challenges-screen/).
Updated LLP 0008 to supersede the direct Profile placement. No app code changed.

[observed — follow-up revision] Extended the blue section edge to edge and behind
the status/header across all four Challenge states. Reparenting existing nodes
preserved their identity. White foreground SVG fills/strokes retain the original
status shapes and opacity. Screenshot review verified alignment and no clipping;
the same PNG exports were refreshed.

## What worked well

[observed] Editing the existing headers and moving native back rows preserved
the approved card, badge, workout strip and enrollment sheet. Reusing the
membership card and navigation geometry kept Profile recognizable.

## Friction and blockers

[observed] The older member-card clone retained 20 px side margins in addition
to the new inset padding, doubling its left gutter and clipping the right edge.
Computed styles identified the retained margins; setting them to zero fixed the
layout without recreating the card.

## What was hard

[inferred] The navigation choice matters more than new styling. A pushed screen
with a Profile entry provides a dedicated destination while preserving the
existing tab structure.

## Comparative friction

Not observed. This was a Paper revision, not framework implementation.

## Improvement ideas

[inferred] A clone option that drops layout margins while preserving component
styling would make reuse inside new containers less error prone.

## Follow-ups

None for the requested design revision.
