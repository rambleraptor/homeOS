/**
 * `credit-cards-perk-reminders` cron handler.
 *
 * "$50 dining credit expires Sunday" is the reminder this app exists to make
 * possible, and it is the hardest source in the repo to raise. Three things make
 * it awkward, and most of this file is about them.
 *
 * **The date isn't in the database.** A `perk` has no date field at all — its
 * deadline is computed from `frequency` + the card's `reset_mode` and
 * `anniversary_date`. The only stored `period_start` / `period_end` live on a
 * `redemption`, a row that exists only *after* the perk has been used. So the
 * record that would carry the due date is precisely the one that exists only
 * once the reminder is no longer wanted. We compute the window instead, through
 * the very same `periodUtils` the UI uses — which is why that module has to stay
 * React- and DOM-free, and why a reminder can never disagree with the perks list
 * about when something expires.
 *
 * **Volume is the real risk.** A monthly perk's window closes twelve times a
 * year; three cards with four monthly perks each would be ~144 interruptions a
 * year, which is how you train someone to swipe the whole app away. Three levers,
 * and this source needs all of them: leads scaled by frequency
 * ({@link PERK_REMINDER_LEAD_DAYS}), **one digest per card and period** rather
 * than one push per perk, and a {@link MIN_REMAINING_VALUE} floor so a $3
 * streaming credit doesn't buy the same interruption as a $200 travel credit.
 *
 * **"Unredeemed" is ambiguous.** `getRedemptionStatus` returns
 * `none | partial | full`, and the perks list treats `partial` as done. A
 * reminder deliberately disagrees: $50 spent of a $200 credit is $150 still on
 * the table, and that's worth a nudge. See {@link remainingValue}.
 *
 * Recipients need no permission work — `credit-card`, `perk`, and `redemption`
 * are all household-shared, so anyone may see any perk and the only question is
 * who asked to be interrupted.
 *
 * Server-only: lives under `crons/`, so vite stubs it out of the browser bundle.
 */

import type { CronHandler } from '@rambleraptor/homestead-core/apps/types';
import { serverClient } from '@rambleraptor/homestead-core/server/client';
import { usersWithFlag } from '@rambleraptor/homestead-core/server/user-settings';
import {
  reconcileReminders,
  type PlannedReminder,
} from '../../events/crons/materializer';
import { MORNING_HOUR } from '../../events/utils/reminderDate';
import { CREDIT_CARDS, CREDIT_CARD_PERKS, PERK_REDEMPTIONS } from '../resources';
import { PERK_REMINDER_SETTING } from '../perkReminderSetting';
import {
  PERK_REMINDER_LEAD_DAYS,
  dateKey,
  getCurrentPeriod,
  sumRedeemedForPeriod,
  toLocalISODate,
} from '../utils/periodUtils';
import type {
  CreditCard,
  CreditCardPerk,
  PerkFrequency,
  PerkPeriod,
  PerkRedemption,
} from '../types';

/** The app id stamped on every reminder this handler raises. */
export const CREDIT_CARDS_REMINDER_TYPE = 'credit-cards';

/**
 * A card's whole digest is skipped when this little is left on the table.
 * Applied to the group total rather than per perk, so three small credits
 * closing together still earn a mention while one trivial one doesn't.
 */
export const MIN_REMAINING_VALUE = 10;

/** How long a delivered perk reminder is kept before being swept. */
export const PRUNE_AFTER_DAYS = 30;

/**
 * How far ahead a window may be written before it opens. Small — the reminder
 * only has to exist by its own due moment, and the daily run gives three days
 * of slack for a box that was down.
 */
export const HORIZON_DAYS = 3;

/** A perk whose window is closing, with what's still unclaimed on it. */
interface ClosingPerk {
  perk: CreditCardPerk;
  period: PerkPeriod;
  remaining: number;
}

/**
 * How much of a perk has been claimed this period.
 *
 * Two readings, and we take whichever found more.
 *
 * The strict one is `sumRedeemedForPeriod`, shared with the perks list on
 * purpose — two implementations of "how much of this has been used" would
 * eventually disagree, and the one that disagrees loudly is the one that sends a
 * push. But it matches a redemption to a period by exact `dateKey` equality on
 * *both* boundaries, and redemptions are written client-local while this cron
 * computes the period server-local. A household member in another timezone can
 * store boundaries that slice to the neighbouring day and miss that match. In
 * the perks list that's a quiet sort-order wobble; here it would be a push
 * telling someone to spend a credit they already spent.
 *
 * So the lenient reading also counts any redemption whose stored `period_end`
 * lands anywhere inside the computed window. Taking the larger of the two can
 * only ever *reduce* what we think is unclaimed — it can suppress a reminder,
 * never invent one, which for a notification is the safe direction to be wrong
 * in. The underlying skew still wants fixing at the source.
 */
export function redeemedForPeriod(
  redemptions: PerkRedemption[],
  perkId: string,
  period: PerkPeriod,
): number {
  const strict = sumRedeemedForPeriod(redemptions, perkId, period);

  const startKey = dateKey(period.start);
  const endKey = dateKey(period.end);
  let lenient = 0;
  for (const r of redemptions) {
    if (r.perk !== perkId) continue;
    const key = dateKey(r.period_end);
    if (key >= startKey && key <= endKey) lenient += r.amount;
  }

  return Math.max(strict, lenient);
}

/**
 * What's still unclaimed on a perk this period.
 *
 * Note this deliberately does *not* ask `getRedemptionStatus`: the perks list
 * treats `partial` as done, but $50 spent of a $200 credit is $150 still on the
 * table and worth a nudge. The reminder's rule differs from the widget's sort on
 * purpose.
 */
export function remainingValue(
  perk: CreditCardPerk,
  period: PerkPeriod,
  redemptions: PerkRedemption[],
): number {
  return perk.value - redeemedForPeriod(redemptions, perk.id, period);
}

/**
 * When a closing window should be announced: the morning slot, `lead` days
 * before the period ends.
 *
 * Derived purely from the period and the frequency, never from the clock. That
 * matters more here than anywhere else in the reminder system: the plan is
 * recomputed daily, and `due_at` is half the delivery dedup key, so a moment
 * that drifted with "today" would re-notify every single morning until the
 * deadline — the exact nagging this source has to avoid.
 */
export function windowOpensAt(period: PerkPeriod, frequency: PerkFrequency): Date {
  const lead = PERK_REMINDER_LEAD_DAYS[frequency];
  const end = period.end;
  return new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate() - lead,
    MORNING_HOUR,
    0,
    0,
    0,
  );
}

const money = (n: number) =>
  `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

/** Title + notes for one card's closing window. */
export function buildContent(
  card: CreditCard,
  closing: readonly ClosingPerk[],
  period: PerkPeriod,
): { title: string; notes: string } {
  const deadline = period.end.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });
  const total = closing.reduce((sum, c) => sum + c.remaining, 0);

  if (closing.length === 1) {
    const only = closing[0];
    return {
      title: `${only.perk.name} closes ${deadline}`,
      notes: `${money(only.remaining)} unclaimed on your ${card.name}. The window closes ${deadline}.`,
    };
  }

  const lines = closing
    .map((c) => `• ${c.perk.name} — ${money(c.remaining)} left`)
    .join('\n');
  return {
    title: `${closing.length} credits close ${deadline} on ${card.name}`,
    notes: `${money(total)} unclaimed before ${deadline}:\n${lines}`,
  };
}

const handler: CronHandler = async ({ token, firedAt, log }) => {
  const hs = serverClient(token);
  const now = new Date(firedAt);

  const users = await hs.collection<{ id: string }>('users').listAll();
  const optedIn = await usersWithFlag(
    token,
    users.map((user) => user.id),
    CREDIT_CARDS_REMINDER_TYPE,
    PERK_REMINDER_SETTING,
  );

  const planned = new Map<string, PlannedReminder>();
  let perksScanned = 0;
  let requests = 1;

  // With nobody opted in there is nothing to plan — but still reconcile, so
  // turning the setting off withdraws what was already written.
  if (optedIn.length > 0) {
    const cards = await hs.collection<CreditCard>(CREDIT_CARDS).listAll();
    requests++;

    for (const card of cards) {
      if (card.archived) continue;
      const cardRef = hs.collection(CREDIT_CARDS).record(card.id);
      const perks = await cardRef
        .collection<CreditCardPerk>(CREDIT_CARD_PERKS)
        .listAll();
      requests++;

      const groups = new Map<
        string,
        { period: PerkPeriod; dueAt: Date; closing: ClosingPerk[] }
      >();

      for (const perk of perks) {
        perksScanned++;
        if (PERK_REMINDER_LEAD_DAYS[perk.frequency] === undefined) continue;
        const period = getCurrentPeriod(
          perk.frequency,
          card.reset_mode,
          card.anniversary_date,
          now,
        );
        if (period.end.getTime() < now.getTime()) continue; // already closed

        const dueAt = windowOpensAt(period, perk.frequency);
        if (dueAt.getTime() > now.getTime() + HORIZON_DAYS * 86_400_000) continue;

        // Redemptions are only fetched for a perk whose window is actually in
        // play. The walk is three levels deep, so this is what keeps a firing at
        // roughly one request per card rather than one per perk.
        const redemptions = (
          await cardRef
            .collection(CREDIT_CARD_PERKS)
            .record(perk.id)
            .collection<PerkRedemption>(PERK_REDEMPTIONS)
            .listAll()
        ).map((r) => ({ ...r, perk: perk.id }));
        requests++;

        const remaining = remainingValue(perk, period, redemptions);
        if (remaining <= 0) continue;

        // Keyed by the window they share *and* the warning they earn: two perks
        // closing the same day are one interruption, but a monthly and an annual
        // perk have different urgency and shouldn't share the earlier lead.
        const key = `${toLocalISODate(period.end)}:${perk.frequency}`;
        const group = groups.get(key);
        if (group) group.closing.push({ perk, period, remaining });
        else {
          groups.set(key, {
            period,
            dueAt,
            closing: [{ perk, period, remaining }],
          });
        }
      }

      for (const [key, { period, dueAt, closing }] of groups) {
        const total = closing.reduce((sum, c) => sum + c.remaining, 0);
        if (total < MIN_REMAINING_VALUE) continue;

        const { title, notes } = buildContent(card, closing, period);
        const sourceKey = `perk-window:${card.id}:${key}`;
        planned.set(sourceKey, {
          source_key: sourceKey,
          title,
          notes,
          due_at: dueAt.toISOString(),
          notify_users: optedIn,
        });
      }
    }
  }

  const outcome = await reconcileReminders(
    token,
    CREDIT_CARDS_REMINDER_TYPE,
    planned,
    { now, pruneAfterDays: PRUNE_AFTER_DAYS },
  );

  await log(
    `optedIn=${optedIn.length} perks=${perksScanned} requests=${requests} planned=${planned.size} created=${outcome.created} updated=${outcome.updated} unchanged=${outcome.unchanged} withdrawn=${outcome.withdrawn} pruned=${outcome.pruned}`,
  );
  return {
    optedIn: optedIn.length,
    perks: perksScanned,
    requests,
    planned: planned.size,
    ...outcome,
  };
};

export default handler;
