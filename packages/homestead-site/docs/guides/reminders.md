# Reminders & notifications

How Homestead tells you about things — what arrives, when, and how to make it
stop. This page is for people using an instance, not building one. If you're
adding notifications to an app, see
[Notifications](./notifications) instead.

This page covers:

- [The two halves: inbox and push](#the-two-halves-inbox-and-push)
- [Turn on push for a device](#turn-on-push-for-a-device)
- [Where your notifications live](#where-your-notifications-live)
- [Remind me about something](#remind-me-about-something)
- [Reminders your apps set up](#reminders-your-apps-set-up)
- [When things arrive](#when-things-arrive)
- [Why didn't I get one?](#why-didnt-i-get-one)

---

## The two halves: inbox and push

Every notification is written to your **inbox** at `/notifications`. If you've
registered a device, it's *also* pushed to that device as a pop-up.

The important part: **the inbox row is written whether or not the push
succeeds.** No devices registered, phone offline, notification permission
revoked, browser cleared its subscription — the message still lands in your
inbox and waits for you. Push is best-effort delivery layered on top of a
durable record, not the record itself.

So if you've ever wondered whether you missed something: you didn't. It's in the
inbox.

---

## Turn on push for a device

**Settings → Notifications → Enable on this device.**

Your browser will ask permission. Say yes and the device appears in the list,
where you can send it a test notification or deregister it.

**Registration is per device, per browser.** This is the thing that surprises
people most. Enabling push on your laptop does not enable it on your phone, and
Chrome and Safari on the same machine count separately. Each one has to be
turned on where you're sitting. That's a web push constraint, not a Homestead
choice — the subscription belongs to the browser.

A few consequences:

- **Deregistering a device** stops pushes to that one device. Your other devices
  and your inbox are unaffected.
- **If you denied permission**, the button can't ask again — browsers only
  prompt once. You have to re-allow notifications for the site in your browser's
  own settings, then come back.
- **Clearing site data** wipes the subscription. The device will quietly stop
  receiving pushes and you'll need to enable it again.
- **Push needs HTTPS** (except on `localhost`). If your instance is on plain
  `http://`, the option won't work at all.

If your instance's operator hasn't configured VAPID keys, push won't work for
anyone — inbox rows still get written. That's a one-time setup step on the
server.

---

## Where your notifications live

`/notifications`, or the bell in the top bar — which carries a count of unread
messages. Two tabs:

**Inbox** — what has already been delivered. Mark things read as you go, and
tap one to jump to whatever it's about — a bin reminder opens Home, an event
reminder opens Events.

**Scheduled** — what's queued *for you*, soonest first, grouped by day. This is
the useful one for answering "what's coming up?", and it's where you cancel
something before it fires.

---

## Remind me about something

On the **Scheduled** tab, hit **Remind me**.

You give it a title ("Call the plumber"), optionally some details, and a date.
The time is optional — leave it blank and it arrives at 9:00 that morning.
Reminders you created yourself can be edited or cancelled at any time.

If your instance has Chat set up, you can also just say it:

> remind me at 4 tomorrow to take the chicken out

**Reminders are for you.** You can't schedule one for somebody else, and there's
no "remind the household" option. A queued notification is addressed to exactly
one person and stored under their account, which is also what keeps yours
private. If you want your partner reminded about something, ask them to add it —
or use a shared app that raises reminders for everyone who opts in (below).

---

## Reminders your apps set up

Some reminders you don't type — an app works them out from things you've already
recorded. These show up in the Scheduled tab with a **badge** naming the app.

Two are live:

| Reminder | Where you turn it on | When it arrives |
|---|---|---|
| **Birthdays and anniversaries** | The reminder control on each event: *Off · Day of · Week before · Both* | 9:00 on the day you picked |
| **Bin night** | The **Remind me** toggle on Home | 18:00 the evening before each collection |

Both are **per person**. Two people can pick different warnings for the same
birthday, and only whoever actually wheels the bins out needs the bin reminder.
Neither of you sees the other's choice, and turning yours off doesn't affect
anyone else.

### Cancelling an app's reminder

App-badged rows can be **cancelled but not edited**. Editing wouldn't stick —
the app recalculates the content from the underlying event or pickup date every
day, so your change would be overwritten by morning. Tap the badge to jump to
the app where the real setting lives.

Cancelling **does** stick: that particular reminder won't come back tomorrow.
But it only cancels that one occurrence. To stop them for good, turn the setting
off — which also withdraws any that were already queued.

---

## When things arrive

The queue is checked **every minute**, so a reminder set for 4:15 arrives at
4:15, not at some fixed morning or evening slot.

If the server was switched off when something came due, it catches up when it
starts again — but only up to a point. Anything more than **12 hours** late is
marked *missed* instead of being sent. Getting told about last night's bins over
breakfast is worse than not being told, and marking it missed means it's visible
in your list rather than silently dropped.

A push that fails is retried with a widening gap — a minute, then two, four,
eight, then every fifteen — for a little under two hours before the reminder is
marked *failed*. That is deliberately long enough to ride out a restart, a
deploy, or a misconfiguration somebody notices and fixes. The inbox row is
written either way.

If something didn't reach you, the Scheduled tab says so: anything marked
*missed* or *failed* is called out at the top of the list with the reason,
rather than being quietly filed under Past.

---

## Why didn't I get one?

| What you saw | Most likely reason |
|---|---|
| Nothing on this device, but it's in the inbox | Push isn't enabled on *this* device — Settings → Notifications |
| Nothing anywhere, not even the inbox | Nothing was scheduled. Check the Scheduled tab: an app reminder only exists if you opted in |
| It stopped working on a device that used to work | Site data cleared, or notification permission revoked in the browser. Re-enable it |
| Marked *missed* in the Scheduled tab | The instance was down when it came due, by more than 12 hours |
| Marked *failed* | Delivery kept erroring for nearly two hours. Usually the server side — VAPID keys, or the instance being unreachable. The message is still in your inbox |
| Nobody in the household gets pushes | VAPID keys aren't configured on the server — an operator task, see [Notifications](./notifications#set-up-vapid-keys) |
| An app reminder you cancelled came back | You cancelled the *setting*'s next occurrence but the setting is still on, so the following one was raised. Turn the toggle off |
