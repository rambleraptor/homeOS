/**
 * API Route: Send Test Notification
 *
 * POST /api/notifications/send-test
 * Returns: { success: boolean, message: string, timestamp: string }
 *
 * Requires user authentication (PocketBase token in Authorization header)
 */

import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import PocketBase from 'pocketbase';
import { checkAndSendPeopleNotifications } from '../utils/notification-sender';

/**
 * Verify user authentication using PocketBase token
 */
async function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090');

  try {
    // Load the token into authStore
    pb.authStore.save(token);

    // Verify the token is structurally valid and not expired
    if (!pb.authStore.isValid) {
      return null;
    }

    // Actually verify the token by making an authenticated request
    // This will throw if the token is invalid
    await pb.collection('users').authRefresh();

    return pb.authStore.model;
  } catch (error) {
    console.error('Auth verification failed:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify user authentication
    const authRecord = await verifyAuth(request);
    if (!authRecord) {
      return NextResponse.json(
        { error: 'Unauthorized - authentication required' },
        { status: 401 }
      );
    }

    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@example.com';

    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json(
        { error: 'VAPID keys not configured' },
        { status: 500 }
      );
    }

    // Configure VAPID details
    webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);

    // Run the notification check
    await checkAndSendPeopleNotifications();

    return NextResponse.json({
      success: true,
      message: 'Test notification check triggered',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in test notification endpoint:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
