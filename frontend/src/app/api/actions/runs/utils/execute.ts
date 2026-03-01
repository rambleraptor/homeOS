/**
 * Script Execution Utility
 *
 * This file contains the logic to execute Playwright scripts from Next.js
 */

import PocketBase from 'pocketbase';
import path from 'path';

const MAX_LOG_ENTRIES = 1000;

/**
 * Logger that captures output and stores in action_run
 */
class ActionLogger {
  logs: Array<{ timestamp: string; level: string; message: string }> = [];

  log(message: string) {
    this.addLog('info', message);
    console.log(`[Action] ${message}`);
  }

  warn(message: string) {
    this.addLog('warn', message);
    console.warn(`[Action] ${message}`);
  }

  error(message: string) {
    this.addLog('error', message);
    console.error(`[Action] ${message}`);
  }

  addLog(level: string, message: string) {
    this.logs.push({
      timestamp: new Date().toISOString(),
      level,
      message: String(message),
    });

    // Trim logs if too many
    if (this.logs.length > MAX_LOG_ENTRIES) {
      this.logs = this.logs.slice(-MAX_LOG_ENTRIES);
    }
  }
}

/**
 * Execute a Playwright script
 */
export async function executeScript(
  runId: string,
  pocketbaseUrl: string,
  pocketbaseToken: string
) {
  const pb = new PocketBase(pocketbaseUrl);
  pb.authStore.save(pocketbaseToken);

  const logger = new ActionLogger();
  const startTime = Date.now();

  try {
    // Get the run and action
    const run = await pb.collection('action_runs').getOne(runId);
    const action = await pb.collection('actions').getOne(run.action);

    // Update status to running
    await pb.collection('action_runs').update(runId, {
      status: 'running',
      started_at: new Date().toISOString(),
    });

    logger.log(`Starting script: ${action.script_id}`);
    logger.log(`Parameters: ${Object.keys(action.parameters || {}).join(', ')}`);

    // Load the script
    const scriptPath = path.join(process.cwd(), '..', 'scripts', 'actions', `${action.script_id}.js`);
    logger.log(`Loading script from: ${scriptPath}`);

    // Dynamic import the script
    const scriptModule = await import(scriptPath);

    if (typeof scriptModule.run !== 'function') {
      throw new Error(`Script ${action.script_id} does not export a 'run' function`);
    }

    logger.log('Executing script...');
    const result = await scriptModule.run(action.parameters || {}, logger);

    const duration = Date.now() - startTime;
    logger.log(`Script completed in ${duration}ms`);

    // Update run with success
    await pb.collection('action_runs').update(runId, {
      status: 'success',
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      result,
      logs: logger.logs,
    });

    // Update action's last_run_at
    await pb.collection('actions').update(action.id, {
      last_run_at: new Date().toISOString(),
    });

    logger.log('✅ Action completed successfully');

  } catch (err: unknown) {
    const duration = Date.now() - startTime;
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Script failed: ${message}`);

    // Check if this is a user input request
    if (message.includes('2FA verification required')) {
      logger.log('⏸️  Waiting for user input (2FA code)');

      await pb.collection('action_runs').update(runId, {
        status: 'awaiting_input',
        input_request: {
          prompt: 'Enter the 6-digit verification code sent to your email',
          field_name: 'verificationCode',
          field_type: 'text',
          placeholder: '000000',
        },
        logs: logger.logs,
      });
      return; // Don't mark as error, waiting for input
    }

    // Regular error
    await pb.collection('action_runs').update(runId, {
      status: 'error',
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      error: message,
      logs: logger.logs,
    });

    logger.log('❌ Action failed');
  }
}
