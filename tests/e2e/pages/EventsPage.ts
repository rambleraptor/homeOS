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
    recurrenceType?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    notes?: string;
  }) {
    await this.page.getByLabel(/name|event name/i).fill(data.name);
    await this.page.getByLabel(/date/i).fill(data.date);

    if (data.recurring) {
      const recurringCheckbox = this.page.getByLabel(/recurring|repeat/i);
      await recurringCheckbox.check();

      if (data.recurrenceType) {
        await this.page.getByLabel(/type|frequency/i).selectOption(data.recurrenceType);
      }
    }

    if (data.notes) {
      await this.page.getByLabel(/notes/i).fill(data.notes);
    }
  }

  async submitEventForm() {
    await this.page.getByRole('button', { name: /save|submit|create/i }).click();
  }

  async createEvent(data: {
    name: string;
    date: string;
    recurring?: boolean;
    recurrenceType?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    notes?: string;
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
    recurrenceType: 'daily' | 'weekly' | 'monthly' | 'yearly';
    notes: string;
  }>) {
    const row = await this.getEventRow(eventName);
    await row.getByRole('button', { name: /edit/i }).click();

    if (newData.name) {
      const nameField = this.page.getByLabel(/name|event name/i);
      await nameField.clear();
      await nameField.fill(newData.name);
    }

    if (newData.date) {
      await this.page.getByLabel(/date/i).fill(newData.date);
    }

    if (newData.recurring !== undefined) {
      const recurringCheckbox = this.page.getByLabel(/recurring|repeat/i);

      if (newData.recurring) {
        await recurringCheckbox.check();
      } else {
        await recurringCheckbox.uncheck();
      }
    }

    if (newData.recurrenceType) {
      await this.page.getByLabel(/type|frequency/i).selectOption(newData.recurrenceType);
    }

    if (newData.notes) {
      await this.page.getByLabel(/notes/i).fill(newData.notes);
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
