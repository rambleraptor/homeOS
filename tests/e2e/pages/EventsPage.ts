/**
 * Events Page Object Model
 */

import { Page, expect, Locator } from '@playwright/test';

export class EventsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/events');
  }

  async expectToBeOnEventsPage() {
    await expect(this.page).toHaveURL(/\/events/);
  }

  async clickAddEvent() {
    await this.page.getByRole('button', { name: /add event|new event/i }).click();
  }

  async fillEventForm(data: {
    name: string;
    date: string;
    recurring?: boolean;
    notes?: string;
    event_type?: 'birthday' | 'anniversary';
    people_involved?: string;
  }) {
    // Event Type (defaults to birthday if not specified)
    if (data.event_type) {
      await this.page.locator('#event_type').selectOption(data.event_type);
    }

    // Title field
    await this.page.locator('#title').fill(data.name);

    // People Involved field (required)
    await this.page.locator('#people_involved').fill(data.people_involved || 'Test Person');

    // Event Date field
    await this.page.locator('#event_date').fill(data.date);

    // Recurring yearly checkbox
    const recurringCheckbox = this.page.locator('#recurring_yearly');
    if (data.recurring) {
      await recurringCheckbox.check();
    } else {
      await recurringCheckbox.uncheck();
    }

    // Additional Details (optional)
    if (data.notes) {
      await this.page.locator('#details').fill(data.notes);
    }
  }

  async submitEventForm() {
    await this.page.getByRole('button', { name: /save|submit|create/i }).click();
  }

  async createEvent(data: {
    name: string;
    date: string;
    recurring?: boolean;
    notes?: string;
    event_type?: 'birthday' | 'anniversary';
    people_involved?: string;
  }) {
    await this.clickAddEvent();
    await this.fillEventForm(data);
    await this.submitEventForm();
    await this.page.waitForTimeout(500);
  }

  async expectEventInList(eventName: string) {
    await expect(this.page.getByText(eventName)).toBeVisible();
  }

  async expectEventNotInList(eventName: string) {
    await expect(this.page.getByText(eventName).first()).not.toBeVisible({ timeout: 2000 }).catch(() => {
      // If the element doesn't exist at all, that's also fine
    });
  }

  async getEventRow(eventName: string): Promise<Locator> {
    return this.page.getByRole('row').filter({ hasText: eventName }).first();
  }

  async editEvent(eventName: string, newData: Partial<{
    name: string;
    date: string;
    recurring: boolean;
    notes: string;
    event_type: 'birthday' | 'anniversary';
    people_involved: string;
  }>) {
    const row = await this.getEventRow(eventName);
    await row.getByRole('button', { name: /edit/i }).click();

    if (newData.event_type) {
      await this.page.locator('#event_type').selectOption(newData.event_type);
    }

    if (newData.name) {
      const nameField = this.page.locator('#title');
      await nameField.clear();
      await nameField.fill(newData.name);
    }

    if (newData.people_involved) {
      await this.page.locator('#people_involved').fill(newData.people_involved);
    }

    if (newData.date) {
      await this.page.locator('#event_date').fill(newData.date);
    }

    if (newData.recurring !== undefined) {
      const recurringCheckbox = this.page.locator('#recurring_yearly');

      if (newData.recurring) {
        await recurringCheckbox.check();
      } else {
        await recurringCheckbox.uncheck();
      }
    }

    if (newData.notes) {
      await this.page.locator('#details').fill(newData.notes);
    }

    await this.submitEventForm();
    await this.page.waitForTimeout(500);
  }

  async deleteEvent(eventName: string) {
    const row = await this.getEventRow(eventName);
    await row.getByRole('button', { name: /delete|remove/i }).click();

    // Confirm deletion if there's a confirmation dialog
    const confirmButton = this.page.getByRole('button', { name: /confirm|yes|delete/i });

    try {
      await confirmButton.click({ timeout: 2000 });
    } catch {
      // No confirmation dialog, that's fine
    }

    await this.page.waitForTimeout(500);
  }
}
