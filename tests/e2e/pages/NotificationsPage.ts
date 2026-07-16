/**
 * Notifications Page Object Model.
 *
 * Covers the notifications app's two tabs — Notifications and Operations
 * (AEP-151 long-running operations) — plus the top-bar bell decoration that
 * turns into a spinner while operations are running.
 */

import { Page, Locator } from '@playwright/test';

export class NotificationsPage {
  constructor(private page: Page) {}

  /**
   * Full navigation to /notifications. A hard load (rather than a client-side
   * route change) remounts the operations query so it picks up any in-flight
   * operation and starts polling.
   */
  async goto() {
    await this.page.goto('/notifications');
  }

  async openOperationsTab() {
    await this.page.getByTestId('operations-tab').click();
  }

  async openNotificationsTab() {
    await this.page.getByTestId('notifications-tab').click();
  }

  /** The row for a specific operation id. */
  operationRow(operationId: string): Locator {
    return this.page.getByTestId(`operation-${operationId}`);
  }

  /** The spinner overlaid on the top-bar bell while operations are running. */
  get bellSpinner(): Locator {
    return this.page.getByTestId('operations-spinner');
  }
}
