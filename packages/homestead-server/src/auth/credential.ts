/**
 * Classifying the credential a request arrived with.
 *
 * Most authorization questions are about *what* a caller may touch, and the
 * grant system answers those. A few are about *how* the caller proved who they
 * are — minting a new token being the clearest case. A personal access token or
 * a token issued to an OAuth client is a delegated credential: it was handed to
 * some other program to act on the user's behalf, usually with a deliberately
 * narrow scope. Letting one of those mint a fresh, broader credential would
 * undo whatever narrowing it was given, so that operation is reserved for an
 * interactive session.
 */

import type { Database } from '../engine/sqlite';
import { getTokenRecord } from '../engine/users';
import { getAccessTokenBinding } from './storage';

/**
 * Whether `token` is a delegated credential rather than an interactive login.
 *
 * Ordinary logins are issued through the same `issueSession` path as OAuth
 * tokens and so also carry a binding row — but with a null client, scope and
 * audience. It is those fields, not the row's existence, that mark a credential
 * as delegated.
 */
export function isDelegatedCredential(db: Database, token: string): boolean {
  const record = getTokenRecord(db, token);
  if (record?.pat_id) return true; // a personal access token

  const binding = getAccessTokenBinding(db, token);
  if (!binding) return false; // no OAuth binding at all: a plain session
  return (
    binding.client_id !== null || binding.scope !== null || binding.audience !== null
  );
}
