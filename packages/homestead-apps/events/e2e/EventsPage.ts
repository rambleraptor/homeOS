/**
 * Events Page Object Model
 */

import { Page, expect } from '@playwright/test';

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
    /** `YYYY-MM-DD`; split into the month/day (and optional year) inputs. */
    date: string;
    /** Also fill the optional year input from the date's year. */
    withYear?: boolean;
    tag?: 'birthday' | 'anniversary' | string;
    personNames?: string[];
    recurrence?: {
      week: '1' | '2' | '3' | '4' | '-1';
      weekday: '0' | '1' | '2' | '3' | '4' | '5' | '6';
    };
  }) {
    await this.page.getByTestId('event-form-name').fill(data.name);
    const [y, m, d] = data.date.substring(0, 10).split('-');
    await this.page.getByTestId('event-form-month').selectOption(String(Number(m)));
    await this.page.getByTestId('event-form-day').fill(String(Number(d)));
    if (data.withYear) {
      await this.page.getByTestId('event-form-year').fill(y);
    }
    if (data.tag !== undefined) {
      const knownTags = ['birthday', 'anniversary'];
      if (data.tag === '' || knownTags.includes(data.tag)) {
        await this.page
          .getByTestId('event-form-tag')
          .selectOption(data.tag === '' ? '' : data.tag);
      } else {
        await this.page
          .getByTestId('event-form-tag')
          .selectOption('__custom__');
        await this.page
          .getByTestId('event-form-tag-custom')
          .fill(data.tag);
      }
    }
    if (data.recurrence) {
      await this.page
        .getByTestId('event-form-recurrence')
        .selectOption('yearly-nth-weekday');
      await this.page
        .getByTestId('event-form-recurrence-week')
        .selectOption(data.recurrence.week);
      await this.page
        .getByTestId('event-form-recurrence-weekday')
        .selectOption(data.recurrence.weekday);
    }
    if (data.personNames && data.personNames.length > 0) {
      for (const name of data.personNames) {
        const chip = this.page.getByRole('button', { name, exact: true });
        await chip.waitFor({ state: 'visible' });
        await chip.click();
      }
    }
  }

  async submitEventForm() {
    const submit = this.page.getByTestId('event-form-submit');
    await submit.waitFor({ state: 'visible' });
    await submit.click();
    await submit.waitFor({ state: 'hidden' });
  }

  async createEvent(data: {
    name: string;
    date: string;
    tag?: string;
    personNames?: string[];
    recurrence?: {
      week: '1' | '2' | '3' | '4' | '-1';
      weekday: '0' | '1' | '2' | '3' | '4' | '5' | '6';
    };
  }) {
    await this.clickAddEvent();
    await this.fillEventForm(data);
    await this.submitEventForm();
    await this.page.waitForLoadState('networkidle');
  }

  async expectEventInList(name: string) {
    await expect(this.page.getByText(name).first()).toBeVisible();
  }

  async expectEventNotInList(name: string) {
    const locator = this.page.getByText(name).first();
    await expect(locator)
      .not.toBeVisible({ timeout: 2000 })
      .catch(() => {
        // OK — element doesn't exist
      });
  }

  async editEvent(
    eventName: string,
    newData: Partial<{
      name: string;
      date: string;
      tag: string;
    }>,
  ) {
    const editButton = this.page
      .getByRole('button', { name: `Edit ${eventName}` })
      .first();
    await editButton.waitFor({ state: 'visible' });
    await editButton.click();

    await this.page.getByTestId('event-form-name').waitFor({ state: 'visible' });

    if (newData.name !== undefined) {
      await this.page.getByTestId('event-form-name').fill(newData.name);
    }
    if (newData.date !== undefined) {
      const [, m, d] = newData.date.substring(0, 10).split('-');
      await this.page
        .getByTestId('event-form-month')
        .selectOption(String(Number(m)));
      await this.page.getByTestId('event-form-day').fill(String(Number(d)));
    }
    if (newData.tag !== undefined) {
      await this.fillEventForm({
        name: newData.name ?? eventName,
        date: newData.date ?? '1990-01-01',
        tag: newData.tag,
      });
    }

    await this.submitEventForm();
    await this.page.waitForLoadState('networkidle');
  }

  async filterByName(query: string) {
    await this.page.getByTestId('filter-text-name').fill(query);
  }

  async toggleTagFilter(tag: string) {
    await this.page.getByTestId(`filter-chip-tag-${tag}`).click();
  }

  // ---------------------------------------------------------------------------
  // Reminders tab
  // ---------------------------------------------------------------------------

  /**
   * Open the Reminders tab. Reminders share the Events page but not its list —
   * every reminder interaction below needs this first.
   */
  async gotoReminders() {
    await this.page.goto('/events?tab=reminders');
    await this.page
      .getByTestId('add-reminder-button')
      .waitFor({ state: 'visible' });
  }

  /** Switch tabs in place, without a navigation. */
  async selectTab(tab: 'events' | 'reminders') {
    await this.page.getByTestId(`events-tab-${tab}`).click();
  }

  tab(tab: 'events' | 'reminders') {
    return this.page.getByTestId(`events-tab-${tab}`);
  }

  async expectTabSelected(tab: 'events' | 'reminders') {
    await expect(this.tab(tab)).toHaveAttribute('aria-selected', 'true');
  }

  /** The tab choice round-trips through the URL, so notifications can link to it. */
  async expectRemindersTabInUrl() {
    await expect(this.page).toHaveURL(/tab=reminders/);
  }

  async clickAddReminder() {
    const addButton = this.page.getByTestId('add-reminder-button');
    await addButton.waitFor({ state: 'visible' });
    await addButton.click();
  }

  async fillReminderForm(data: {
    title: string;
    /** `YYYY-MM-DD`. */
    date: string;
    /** `HH:MM`; omitted leaves the form's default hour in place. */
    time?: string;
    notes?: string;
  }) {
    await this.page.getByTestId('reminder-form-title').fill(data.title);
    await this.page.getByTestId('reminder-form-date').fill(data.date);
    if (data.time !== undefined) {
      await this.page.getByTestId('reminder-form-time').fill(data.time);
    }
    if (data.notes !== undefined) {
      await this.page.getByTestId('reminder-form-notes').fill(data.notes);
    }
  }

  async submitReminderForm() {
    const submit = this.page.getByTestId('reminder-form-submit');
    await submit.waitFor({ state: 'visible' });
    await submit.click();
    await submit.waitFor({ state: 'hidden' });
  }

  async createReminder(data: {
    title: string;
    date: string;
    time?: string;
    notes?: string;
  }) {
    await this.clickAddReminder();
    await this.fillReminderForm(data);
    await this.submitReminderForm();
  }

  reminderRow(title: string) {
    return this.page
      .getByTestId('reminders-list')
      .locator('li')
      .filter({ hasText: title });
  }

  async expectReminderInList(title: string) {
    await expect(this.reminderRow(title).first()).toBeVisible();
  }

  async expectReminderNotInList(title: string) {
    await expect(this.reminderRow(title)).toHaveCount(0);
  }

  async expectReminderOverdue(title: string) {
    await expect(this.reminderRow(title).first()).toContainText('Overdue');
  }

  async toggleReminderDone(title: string) {
    await this.page
      .getByRole('checkbox', { name: `Mark ${title} as done` })
      .click();
  }

  async showDoneReminders() {
    await this.page.getByTestId('reminders-toggle-done').click();
  }

  /** Unfold the reminders raised by apps, which the list hides by default. */
  async showAppReminders() {
    await this.page.getByTestId('reminders-toggle-app').click();
  }

  appRemindersToggle() {
    return this.page.getByTestId('reminders-toggle-app');
  }

  async editReminder(
    title: string,
    newData: Partial<{ title: string; date: string; time: string; notes: string }>,
  ) {
    await this.page.getByRole('button', { name: `Edit ${title}` }).click();
    await this.page.getByTestId('reminder-form-title').waitFor({ state: 'visible' });
    if (newData.title !== undefined) {
      await this.page.getByTestId('reminder-form-title').fill(newData.title);
    }
    if (newData.date !== undefined) {
      await this.page.getByTestId('reminder-form-date').fill(newData.date);
    }
    if (newData.time !== undefined) {
      await this.page.getByTestId('reminder-form-time').fill(newData.time);
    }
    if (newData.notes !== undefined) {
      await this.page.getByTestId('reminder-form-notes').fill(newData.notes);
    }
    await this.submitReminderForm();
  }

  async deleteReminder(title: string) {
    await this.expectReminderInList(title);
    await this.page.getByRole('button', { name: `Delete ${title}` }).click();
    const confirmButton = this.page.getByRole('button', {
      name: /confirm|yes|delete/i,
    });
    await confirmButton.last().click();
  }

  async deleteEvent(eventName: string) {
    await this.expectEventInList(eventName);
    const deleteButton = this.page
      .getByRole('button', { name: `Delete ${eventName}` })
      .first();
    await deleteButton.waitFor({ state: 'visible' });
    await deleteButton.click();
    const confirmButton = this.page.getByRole('button', {
      name: /confirm|yes|delete/i,
    });
    const isVisible = await confirmButton
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    if (isVisible) {
      await confirmButton.click();
    }
    await this.page.waitForLoadState('networkidle');
  }
}
