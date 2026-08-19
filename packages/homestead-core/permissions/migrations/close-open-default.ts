/**
 * Retire the open-household grant, without locking anyone out.
 *
 * Instances seeded before the closed-by-default change carry a single grant —
 * `everyone → write on *` (`OPEN_GRANT_ID`) — that gave every account, including
 * accounts in no group at all, read/write over every household collection.
 * Deleting it outright would strand exactly the people who were relying on it,
 * so this migration moves them onto the Member role first and only then removes
 * the grant.
 *
 * The Member role confers `all`-scope `write`, which is precisely what the open
 * grant conferred, so a household's effective access is unchanged: the same
 * people can do the same things afterwards. What changes is the *baseline* — a
 * user created after this point starts with nothing until an admin picks their
 * access level.
 *
 * Three guards, in order:
 *   1. **No open grant → no-op.** Either a fresh (already-closed) household, or
 *      one whose admin deleted the grant deliberately to lock things down. In
 *      both cases the memberships here would be a silent re-opening, so we do
 *      nothing at all.
 *   2. **No member-role group → bail without deleting.** If the Members group is
 *      gone we have nowhere to put people, and deleting the grant would lock the
 *      household out of its own data. Leave everything as it is and report why;
 *      the migration retries on the next boot.
 *   3. **Only ungrouped regular users are touched.** Anyone already in a
 *      role-bearing group has an admin-chosen access level (the store was
 *      already suppressing the default for them), and superusers break glass
 *      past enforcement, so neither needs a membership.
 *
 * Idempotent: after a successful run guard 1 short-circuits every re-run, and
 * the membership pass skips users who already have one, so an interrupted run
 * resumes cleanly.
 */

import type { MigrationHandler } from '@rambleraptor/homestead-core/apps/migrations';
import { serverClient } from '@rambleraptor/homestead-core/server/client';
import {
  ACCESS_GRANTS,
  GROUPS,
  GROUP_MEMBERSHIPS,
} from '../resources';
import { OPEN_GRANT_ID } from '../seed';

/** The role a group must confer for us to park the open grant's users in it. */
const MEMBER_ROLE_ID = 'member';

interface GrantRow {
  id: string;
}
interface GroupRow {
  id: string;
  name?: string;
  /** Role reference — stored bare (`member`) or as a path (`roles/member`). */
  role?: string;
}
interface MembershipRow {
  id: string;
  user?: string;
}
interface UserRow {
  id: string;
  type?: string;
}

/** `roles/member` → `member`; a bare id passes through unchanged. */
function bareId(value: string): string {
  const slash = value.lastIndexOf('/');
  return slash === -1 ? value : value.slice(slash + 1);
}

const migrate: MigrationHandler = async ({ token, log }) => {
  const client = serverClient(token);
  const grants = client.collection<GrantRow>(ACCESS_GRANTS);

  // Guard 1 — is the open grant even here? Listing rather than fetching by id
  // keeps this to one round trip and avoids treating a transport error as
  // "absent" (a 404-shaped failure would silently skip the migration forever).
  const allGrants = await grants.listAll();
  if (!allGrants.some((g) => g.id === OPEN_GRANT_ID)) {
    await log('no open-household grant — household is already closed');
    return { openGrant: 'absent', joined: 0 };
  }

  // Guard 2 — somewhere to put people. Any group conferring the member role
  // will do; the household may have renamed the seeded one.
  const groups = await client.collection<GroupRow>(GROUPS).listAll();
  const memberGroup = groups.find((g) => g.role && bareId(g.role) === MEMBER_ROLE_ID);
  if (!memberGroup) {
    // Deliberately *not* an error: throwing would retry identically on every
    // boot. Returning leaves the grant in place (nobody loses access) and
    // records why, so an admin can recreate the group and reboot.
    await log(
      'no group confers the member role — leaving the open grant in place ' +
        'rather than locking the household out. Recreate a member-role group ' +
        'and reboot to finish this migration.',
    );
    return { openGrant: 'kept', reason: 'no-member-group', joined: 0 };
  }

  // Who already has a role? Membership in *any* role-bearing group means an
  // admin has already chosen this person's access, so leave them alone.
  const roleBearing = groups.filter((g) => g.role);
  const alreadyGrouped = new Set<string>();
  for (const group of roleBearing) {
    const memberships = await client
      .collection(GROUPS)
      .record(group.id)
      .collection<MembershipRow>(GROUP_MEMBERSHIPS)
      .listAll();
    for (const m of memberships) {
      if (m.user) alreadyGrouped.add(bareId(m.user));
    }
  }

  const users = await client.collection<UserRow>('users').listAll();
  const memberships = client
    .collection(GROUPS)
    .record(memberGroup.id)
    .collection<MembershipRow>(GROUP_MEMBERSHIPS);

  let joined = 0;
  for (const user of users) {
    // Superusers break glass past enforcement; a role would be inert for them.
    if (user.type === 'superuser') continue;
    if (alreadyGrouped.has(user.id)) continue;
    // Bare id, matching what the create-user UI and e2e helpers write.
    await memberships.create({ user: user.id });
    joined += 1;
  }
  await log(`joined ${joined} ungrouped user(s) to "${memberGroup.name ?? memberGroup.id}"`);

  // Only now is it safe: everyone who was riding the default holds the Member
  // role, so removing the grant changes the baseline without changing anyone's
  // effective access.
  await grants.record(OPEN_GRANT_ID).delete();
  await log('deleted the open-household grant — the household is now closed by default');

  return { openGrant: 'deleted', joined, scanned: users.length };
};

export default migrate;
