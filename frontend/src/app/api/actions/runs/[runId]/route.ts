/**
 * API Route: Get/Update Action Run
 *
 * GET /api/actions/runs/[runId]
 * Returns the current status and details of an action run
 *
 * POST /api/actions/runs/[runId]
 * Provides user input for an awaiting_input run
 * Body: { input: Record<string, unknown> }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPocketBase } from '@/core/api/pocketbase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const pb = getPocketBase(request);
    const { runId } = await params;

    const run = await pb.collection('action_runs').getOne(runId, {
      expand: 'action',
    });

    return NextResponse.json(run);

  } catch (error) {
    console.error('Error fetching action run:', error);
    return NextResponse.json(
      { error: 'Failed to fetch action run' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const pb = getPocketBase(request);
    const { runId } = await params;
    const { input } = await request.json();

    if (!input) {
      return NextResponse.json(
        { error: 'input is required' },
        { status: 400 }
      );
    }

    // Get current run
    const run = await pb.collection('action_runs').getOne(runId);

    if (run.status !== 'awaiting_input') {
      return NextResponse.json(
        { error: 'Run is not awaiting input' },
        { status: 400 }
      );
    }

    // Update with user input and resume execution
    await pb.collection('action_runs').update(runId, {
      input_response: input,
      status: 'pending', // Will trigger re-execution
      input_request: null,
    });

    // Trigger execution with the input
    const pocketbaseUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090';
    const { executeScript } = await import('../utils/execute');

    executeScript(runId, pocketbaseUrl, pb.authStore.token).catch(err => {
      console.error('Script execution error:', err);
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error providing input:', error);
    return NextResponse.json(
      { error: 'Failed to provide input' },
      { status: 500 }
    );
  }
}
