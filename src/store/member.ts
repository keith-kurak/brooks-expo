/**
 * Run Club membership, local to the prototype.
 *
 * @ref LLP 0002 — No Brooks auth endpoint is reachable from an app (Akamai), so
 * "signing in" stores a name on the device and nothing more. The screens treat
 * membership as Run Club joining (LLP 0003#login): a perk, never a gate.
 */
import { useSyncExternalStore } from 'react';

import { storage } from '../utils/kv-storage';

const STORAGE_KEY = 'brooks.member.v1';

export interface Member {
  firstName: string;
  email: string;
  joinedAt: number;
}

// Storage is synchronous, so a returning member is known before first render.
// A missing member is a guest, which is always a fine state to be in.
let current: Member | null = storage.get<Member | null>(STORAGE_KEY, null);
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/**
 * Members who have joined on this device, by lowercased email. Signing out
 * keeps the entry, so the email-first login sheet can welcome a returning
 * member back instead of asking for their name again.
 */
const KNOWN_KEY = 'brooks.member.known.v1';

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

/** A member who has joined on this device before, or null for a new email. */
export function knownMember(email: string): Member | null {
  const known = storage.get<Record<string, Member>>(KNOWN_KEY, {});
  return known[normalize(email)] ?? null;
}

export function join(member: Omit<Member, 'joinedAt'>) {
  current = knownMember(member.email) ?? { ...member, joinedAt: Date.now() };
  storage.set(STORAGE_KEY, current);
  const known = storage.get<Record<string, Member>>(KNOWN_KEY, {});
  storage.set(KNOWN_KEY, { ...known, [normalize(current.email)]: current });
  emit();
}

export function leave() {
  current = null;
  storage.remove(STORAGE_KEY);
  emit();
}

export function getMember(): Member | null {
  return current;
}

export function subscribeMember(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useMember(): Member | null {
  return useSyncExternalStore(
    subscribeMember,
    getMember,
    getMember
  );
}
