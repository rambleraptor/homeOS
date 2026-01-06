/**
 * Gift Card Notification Sender Utility
 *
 * Handles sending push notifications for gift cards expiring within a week
 */

import webpush from 'web-push';
import PocketBase from 'pocketbase';

interface GiftCard {
  id: string;
  merchant: string;
  amount: number;
  expiration_date?: string;
  created_by?: string;
}

interface NotificationSubscription {
  id: string;
  user_id: string;
  subscription_data: webpush.PushSubscription;
  enabled: boolean;
}

/**
 * Check if a gift card is expiring within 7 days
 */
function isExpiringWithinWeek(expirationDate: string): boolean {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const expDate = new Date(expirationDate);
  expDate.setHours(0, 0, 0, 0);

  // Check if expiration date is in the future
  if (expDate < now) {
    return false; // Already expired, don't send notification
  }

  // Check if expiring within 7 days
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  return expDate >= now && expDate <= sevenDaysFromNow;
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Calculate days until expiration
 */
function getDaysUntilExpiration(expirationDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const expDate = new Date(expirationDate);
  expDate.setHours(0, 0, 0, 0);

  const diffTime = expDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Send push notifications for an expiring gift card
 */
async function sendGiftCardNotifications(
  giftCard: GiftCard,
  pb: PocketBase
): Promise<void> {
  try {
    if (!giftCard.expiration_date) {
      return; // No expiration date set
    }

    // Get subscriptions for the user who owns this gift card
    const filter = giftCard.created_by
      ? `enabled = true && user_id = "${giftCard.created_by}"`
      : 'enabled = true';

    const subscriptions = await pb
      .collection('notification_subscriptions')
      .getFullList<NotificationSubscription>({
        filter,
        sort: '-created',
      });

    if (subscriptions.length === 0) {
      console.log(`No active subscriptions found for gift card: ${giftCard.merchant}`);
      return;
    }

    const daysUntil = getDaysUntilExpiration(giftCard.expiration_date);
    const expirationDateStr = formatDate(giftCard.expiration_date);

    const title = '🎁 Gift Card Expiring Soon';
    const body =
      daysUntil === 0
        ? `Your ${giftCard.merchant} gift card ($${giftCard.amount.toFixed(2)}) expires today!`
        : daysUntil === 1
        ? `Your ${giftCard.merchant} gift card ($${giftCard.amount.toFixed(2)}) expires tomorrow (${expirationDateStr})`
        : `Your ${giftCard.merchant} gift card ($${giftCard.amount.toFixed(2)}) expires in ${daysUntil} days (${expirationDateStr})`;

    let sentCount = 0;
    let failedCount = 0;
    let expiredCount = 0;

    for (const sub of subscriptions) {
      try {
        const subscriptionData = sub.subscription_data;

        const payload = JSON.stringify({
          title,
          body,
          icon: '/icon-192.png',
          badge: '/badge-72.png',
          tag: `gift-card-${giftCard.id}`,
          data: {
            url: '/gift-cards',
            giftCardId: giftCard.id,
            timestamp: new Date().toISOString(),
          },
        });

        // Send push notification
        try {
          await webpush.sendNotification(subscriptionData, payload);
          sentCount++;

          // Create notification record
          await pb.collection('notifications').create({
            user_id: sub.user_id,
            gift_card_id: giftCard.id,
            title: title,
            message: body,
            notification_type: 'week_before',
            scheduled_for: giftCard.expiration_date,
            read: false,
            sent_at: new Date().toISOString(),
          });
        } catch (error: unknown) {
          const err = error as { statusCode?: number; message?: string };
          // Handle subscription errors
          if (err.statusCode === 404 || err.statusCode === 410) {
            // Subscription expired or invalid
            expiredCount++;
            try {
              await pb.collection('notification_subscriptions').delete(sub.id);
              console.log(`Deleted expired subscription for user ${sub.user_id}`);
            } catch (deleteError) {
              console.error('Error deleting expired subscription:', deleteError);
            }
          } else {
            failedCount++;
            console.error('Push notification error:', {
              userId: sub.user_id,
              error: err.message,
              statusCode: err.statusCode,
            });
          }
        }
      } catch (error) {
        failedCount++;
        console.error('Error processing subscription:', error);
      }
    }

    console.log(
      `Notification summary for "${giftCard.merchant} gift card ($${giftCard.amount})":`,
      {
        sent: sentCount,
        failed: failedCount,
        expired: expiredCount,
        total: subscriptions.length,
      }
    );
  } catch (error) {
    console.error('Error in sendGiftCardNotifications:', error);
  }
}

/**
 * Main function to check and send gift card expiration notifications
 */
export async function checkAndSendGiftCardNotifications(): Promise<void> {
  try {
    const now = new Date();
    console.log(
      `[${now.toISOString()}] Checking for gift cards expiring within a week...`
    );

    // Initialize PocketBase with server credentials
    const pb = new PocketBase(
      process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090'
    );

    // Authenticate as admin to access all gift cards
    const adminEmail = process.env.POCKETBASE_ADMIN_EMAIL;
    const adminPassword = process.env.POCKETBASE_ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.error(
        'POCKETBASE_ADMIN_EMAIL and POCKETBASE_ADMIN_PASSWORD must be set'
      );
      return;
    }

    await pb.admins.authWithPassword(adminEmail, adminPassword);

    // Get all gift cards with expiration dates
    const giftCards = await pb.collection('gift_cards').getFullList<GiftCard>({
      filter: 'expiration_date != null && archived != true',
      sort: 'expiration_date',
    });

    if (giftCards.length === 0) {
      console.log('No gift cards with expiration dates found');
      return;
    }

    console.log(`Found ${giftCards.length} gift cards with expiration dates`);

    let notificationsSent = 0;

    for (const giftCard of giftCards) {
      if (giftCard.expiration_date && isExpiringWithinWeek(giftCard.expiration_date)) {
        const daysUntil = getDaysUntilExpiration(giftCard.expiration_date);
        console.log(
          `Sending expiration notification for ${giftCard.merchant} (expires in ${daysUntil} days)`
        );
        await sendGiftCardNotifications(giftCard, pb);
        notificationsSent++;
      }
    }

    if (notificationsSent === 0) {
      console.log('No gift card expiration notifications needed today');
    } else {
      console.log(`Processed ${notificationsSent} gift card expiration notifications`);
    }
  } catch (error) {
    console.error('Error in checkAndSendGiftCardNotifications:', error);
  }
}
