/**
 * Data migration: account-tags → groups + group-memberships.
 *
 * Account tags predate the permissions system: a superuser stamped a user with
 * a tag (e.g. `kids`, `adults`) and apps gated visibility on it via an
 * `enabled_tags` flag. The permissions system models the same "a named set of
 * people" idea as a first-class `group`, which access-grants can address. This
 * migration lifts every existing tag into that model so households keep their
 * cohorts when enforcement is turned on:
 *
 *   - each distinct tag *name* becomes one `group` (shared across users), and
 *   - each `(user, tag)` pair becomes one `group-membership` under that group.
 *
 * It is additive — it never deletes an `account-tag`, so the legacy
 * `enabled_tags` app gate keeps working until it's retired separately.
 *
 * Idempotent by construction (not just by the ledger): it reuses an existing
 * group of the same name and skips a membership that already exists, so a
 * partial run that died mid-way is safe to resume on the next boot.
 */

import type { MigrationHandler } from '@rambleraptor/homestead-core/apps/migrations';
import { aepList, aepCreate } from '@rambleraptor/homestead-core/server/aepbase';
import { USERS } from '@rambleraptor/homestead-core/resources/builtins';
import {
  GROUPS,
  GROUP_MEMBERSHIPS,
} from '@rambleraptor/homestead-core/permissions/resources';
import { ACCOUNT_TAGS } from '../resources';

interface UserRecord {
  id: string;
}
interface AccountTag {
  id: string;
  name?: string;
}
interface Group {
  id: string;
  name?: string;
}
interface GroupMembership {
  id: string;
  user?: string;
}

/** Strip a `<collection>/` reference prefix to the bare id (`users/u1` → `u1`). */
function bareId(value: string): string {
  const slash = value.lastIndexOf('/');
  return slash === -1 ? value : value.slice(slash + 1);
}

const handler: MigrationHandler = async ({ token, log }) => {
  const users = await aepList<UserRecord>(USERS, token);

  // Existing groups keyed by name, so a re-run (or an admin-made group of the
  // same name) is reused rather than duplicated.
  const groupIdByName = new Map<string, string>();
  for (const g of await aepList<Group>(GROUPS, token)) {
    if (g.name) groupIdByName.set(g.name, g.id);
  }

  // Lazily-loaded set of member user-ids per group, so we never re-add a member.
  const membersByGroup = new Map<string, Set<string>>();
  const membersFor = async (groupId: string): Promise<Set<string>> => {
    let set = membersByGroup.get(groupId);
    if (!set) {
      const rows = await aepList<GroupMembership>(GROUP_MEMBERSHIPS, token, [
        GROUPS,
        groupId,
      ]);
      set = new Set(rows.map((m) => bareId(m.user ?? '')));
      membersByGroup.set(groupId, set);
    }
    return set;
  };

  let tagsScanned = 0;
  let groupsCreated = 0;
  let membershipsCreated = 0;

  for (const user of users) {
    const tags = await aepList<AccountTag>(ACCOUNT_TAGS, token, [USERS, user.id]);
    for (const tag of tags) {
      const name = (tag.name ?? '').trim();
      if (!name) continue;
      tagsScanned += 1;

      let groupId = groupIdByName.get(name);
      if (!groupId) {
        const created = await aepCreate<Group>(
          GROUPS,
          { name, description: `Migrated from the "${name}" account tag.` },
          token,
        );
        groupId = created.id;
        groupIdByName.set(name, groupId);
        membersByGroup.set(groupId, new Set());
        groupsCreated += 1;
      }

      const members = await membersFor(groupId);
      if (!members.has(user.id)) {
        await aepCreate<GroupMembership>(
          GROUP_MEMBERSHIPS,
          { user: user.id },
          token,
          [GROUPS, groupId],
        );
        members.add(user.id);
        membershipsCreated += 1;
      }
    }
  }

  await log(
    `scanned ${tagsScanned} tag(s) across ${users.length} user(s): ` +
      `created ${groupsCreated} group(s), ${membershipsCreated} membership(s)`,
  );
  return {
    users: users.length,
    tagsScanned,
    groupsCreated,
    membershipsCreated,
  };
};

export default handler;
