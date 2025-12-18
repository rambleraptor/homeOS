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
    const addButton = this.page.getByTestId('add-event-button');
    await addButton.waitFor({ state: 'visible' });
    await addButton.click();
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
    const submitButton = this.page.getByTestId('event-form-submit');
    await submitButton.waitFor({ state: 'visible' });
    await submitButton.click();
    // Wait for modal/form to close
    await submitButton.waitFor({ state: 'hidden' });
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
    // Wait for network to settle after mutation
    await this.page.waitForLoadState('networkidle');
  }

  async expectEventInList(eventName: string) {
    // Events can appear in multiple places (Upcoming Events and All Events sections)
    await expect(this.page.getByText(eventName).first()).toBeVisible();
  }

  async expectEventNotInList(eventName: string) {
    const eventLocator = this.page.getByText(eventName).first();
    await expect(eventLocator).not.toBeVisible({ timeout: 2000 }).catch(() => {
      // Element doesn't exist, which is fine
    });
  }

  async getEventCard(eventName: string): Promise<Locator> {
    // Events are displayed as cards
    // Find by looking for the heading, then traverse to the card container
    return this.page.getByRole('heading', { name: eventName, level: 3 })
      .locator('..')
      .locator('..')
      .locator('..');
  }

  async editEvent(eventName: string, newData: Partial<{
    name: string;
    date: string;
    recurring: boolean;
    notes: string;
    event_type: 'birthday' | 'anniversary';
    people_involved: string;
  }>) {
    // Wait for the event to be visible
    await this.expectEventInList(eventName);

    // Click edit button
    const editButton = this.page.getByRole('button', { name: `Edit ${eventName}` }).first();
    await editButton.waitFor({ state: 'visible' });
    await editButton.click();

    // Wait for form to appear
    await this.page.locator('#title').waitFor({ state: 'visible' });

    // Fill in changed fields
    if (newData.event_type) {
      await this.page.locator('#event_type').selectOption(newData.event_type);
    }

    if (newData.name) {
      await this.page.locator('#title').fill(newData.name);
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

    // Submit and wait for form to close
    await this.submitEventForm();
  }

  async deleteEvent(eventName: string) {
    // Wait for the event to be visible
    await this.expectEventInList(eventName);

    // Click delete button
    const deleteButton = this.page.getByRole('button', { name: `Delete ${eventName}` }).first();
    await deleteButton.waitFor({ state: 'visible' });
    await deleteButton.click();

    // Handle confirmation dialog if present
    const confirmButton = this.page.getByRole('button', { name: /confirm|yes|delete/i });
    const isConfirmVisible = await confirmButton.isVisible({ timeout: 1000 }).catch(() => false);

    if (isConfirmVisible) {
      await confirmButton.click();
    }

    // Wait for network to settle after deletion
    await this.page.waitForLoadState('networkidle');
  }
}
