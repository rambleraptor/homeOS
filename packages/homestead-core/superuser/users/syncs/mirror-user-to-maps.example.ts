/**
 * EXAMPLE resource-sync handler — mirror each `user` record to an external
 * "Maps" system, one-way. Named `.example.ts` so it is **not** auto-loaded or
 * bundled and never fires in production: it's a reference an operator copies and
 * adapts, not a shipped sync. See `resource-sync.md` and the commented `syncs`
 * block in `../app.config.ts` for how to enable a real one.
 *
 * The pattern it demonstrates:
 *  - branch on `ctx.event` (`create` | `update` | `delete`);
 *  - on `delete`, use `ctx.previous` (the removed record) to tear down the
 *    external object — `ctx.record` is null;
 *  - on `create`/`update`, upsert from `ctx.record`;
 *  - persist the external-id mapping yourself (here, in an `address` record via
 *    the shared client) so the handler owns idempotency — delivery is
 *    at-least-once, so a re-run must not create a duplicate on the Maps side.
 *
 * The `mapsClient()` call is a clearly-stubbed stand-in for whatever SDK the
 * operator supplies; swap it for a real client.
 */

import type { SyncHandler } from '@rambleraptor/homestead-core/apps/sync';
import { serverClient } from '@rambleraptor/homestead-core/server/client';

/** The bit of a user we mirror. `id`/`email` come from the User wire shape. */
interface UserSnapshot {
  id: string;
  email?: string;
  display_name?: string;
}

/**
 * An app-owned record that stores the external mapping for one user, so the
 * handler can find (and reuse) the Maps id on a later run instead of creating a
 * duplicate. An operator declares this `address` resource in their own app.
 */
interface Address {
  id: string;
  user_id: string;
  maps_place_id?: string;
}

/** Minimal shape of the external Maps SDK an operator would plug in. */
interface MapsClient {
  upsertPlace(input: { key: string; name: string }): Promise<{ placeId: string }>;
  deletePlace(placeId: string): Promise<void>;
}

/** Stubbed external client — replace with the operator's real Maps SDK. */
function mapsClient(): MapsClient {
  throw new Error('mapsClient() is a stub — wire your Maps SDK here');
}

const mirrorUserToMaps: SyncHandler = async (ctx) => {
  const maps = mapsClient();
  // The app's own mapping records, keyed by user id (the handler owns this).
  const addresses = serverClient(ctx.token).collection<Address>('addresses');

  const existingMapping = async (userId: string): Promise<Address | undefined> => {
    const page = await addresses.page({ filter: `user_id = "${userId}"` });
    return page.records[0];
  };

  if (ctx.event === 'delete') {
    // The row is gone — clean up from the pre-state.
    const previous = ctx.previous as UserSnapshot | null;
    if (!previous) return;
    const mapping = await existingMapping(previous.id);
    if (mapping?.maps_place_id) {
      await maps.deletePlace(mapping.maps_place_id);
      // Merge-patch: null clears the stored external id.
      await addresses.record(mapping.id).update({ maps_place_id: null });
      await ctx.log(`deleted Maps place for user ${previous.id}`);
    }
    return { removed: previous.id };
  }

  // create | update: upsert the external object from the post-state.
  const record = ctx.record as UserSnapshot | null;
  if (!record) return;
  const name = record.display_name || record.email || record.id;
  // Idempotency key ties the external object to this user, so a retry (or a
  // duplicate event) upserts the same place rather than creating a new one.
  const { placeId } = await maps.upsertPlace({ key: `user:${record.id}`, name });

  const mapping = await existingMapping(record.id);
  if (mapping) {
    if (mapping.maps_place_id !== placeId) {
      await addresses.record(mapping.id).update({ maps_place_id: placeId });
    }
  } else {
    await addresses.create({ user_id: record.id, maps_place_id: placeId });
  }
  await ctx.log(`mirrored user ${record.id} to Maps place ${placeId}`);
  return { mirrored: record.id, placeId };
};

export default mirrorUserToMaps;
