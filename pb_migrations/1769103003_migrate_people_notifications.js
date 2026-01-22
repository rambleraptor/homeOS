/// <reference path="../pb_data/types.d.ts" />

/**
 * Migrates people's notification_preferences to recurring_notifications.
 *
 * For each person with notification_preferences:
 * - Creates recurring_notification records for birthday (if person has birthday)
 * - Creates recurring_notification records for anniversary (if person has anniversary)
 *
 * Also migrates existing notifications to include source_collection and source_id.
 */
migrate(
  (app) => {
    const peopleCollection = app.findCollectionByNameOrId('people');
    const recurringNotificationsCollection = app.findCollectionByNameOrId('recurring_notifications');
    const notificationsCollection = app.findCollectionByNameOrId('notifications');

    // Get all people with notification preferences
    const people = app.findRecordsByFilter(
      'people',
      'notification_preferences != null && notification_preferences != "[]"',
      '-created',
      10000,
      0
    );

    console.log(`Found ${people.length} people with notification preferences to migrate`);

    const templates = {
      birthday: {
        title: "Birthday Reminder - {{name}}",
        message: "{{name}}'s birthday is coming up on {{date}}!",
      },
      anniversary: {
        title: "Anniversary Reminder - {{name}}",
        message: "{{name}}'s anniversary is coming up on {{date}}!",
      },
    };

    let createdCount = 0;

    for (const person of people) {
      const preferences = person.get('notification_preferences');
      const createdBy = person.get('created_by');
      const birthday = person.get('birthday');
      const anniversary = person.get('anniversary');

      // Skip if no preferences or no user
      if (!preferences || !createdBy) {
        continue;
      }

      // Parse preferences (it's stored as JSON)
      let prefs;
      try {
        prefs = typeof preferences === 'string' ? JSON.parse(preferences) : preferences;
      } catch (e) {
        console.log(`Could not parse preferences for person ${person.id}:`, e);
        continue;
      }

      if (!Array.isArray(prefs) || prefs.length === 0) {
        continue;
      }

      // Create recurring notifications for birthday
      if (birthday) {
        for (const timing of prefs) {
          try {
            const record = new Record(recurringNotificationsCollection);
            record.set('user_id', createdBy);
            record.set('source_collection', 'people');
            record.set('source_id', person.id);
            record.set('title_template', templates.birthday.title);
            record.set('message_template', templates.birthday.message);
            record.set('reference_date_field', 'birthday');
            record.set('timing', timing);
            record.set('enabled', true);
            app.save(record);
            createdCount++;
          } catch (e) {
            // Skip duplicates (unique constraint)
            if (!e.message?.includes('UNIQUE constraint failed')) {
              console.log(`Error creating birthday recurring notification for person ${person.id}:`, e);
            }
          }
        }
      }

      // Create recurring notifications for anniversary
      if (anniversary) {
        for (const timing of prefs) {
          try {
            const record = new Record(recurringNotificationsCollection);
            record.set('user_id', createdBy);
            record.set('source_collection', 'people');
            record.set('source_id', person.id);
            record.set('title_template', templates.anniversary.title);
            record.set('message_template', templates.anniversary.message);
            record.set('reference_date_field', 'anniversary');
            record.set('timing', timing);
            record.set('enabled', true);
            app.save(record);
            createdCount++;
          } catch (e) {
            // Skip duplicates (unique constraint)
            if (!e.message?.includes('UNIQUE constraint failed')) {
              console.log(`Error creating anniversary recurring notification for person ${person.id}:`, e);
            }
          }
        }
      }
    }

    console.log(`Created ${createdCount} recurring notification records`);

    // Migrate existing notifications to include source_collection and source_id
    const existingNotifications = app.findRecordsByFilter(
      'notifications',
      'person_id != null && person_id != ""',
      '-created',
      10000,
      0
    );

    console.log(`Found ${existingNotifications.length} existing notifications to migrate`);

    let migratedCount = 0;
    for (const notification of existingNotifications) {
      const personId = notification.get('person_id');
      if (personId) {
        notification.set('source_collection', 'people');
        notification.set('source_id', personId);
        app.save(notification);
        migratedCount++;
      }
    }

    console.log(`Migrated ${migratedCount} existing notifications`);

    return null;
  },
  (app) => {
    // Rollback: Delete all recurring_notifications for people
    // (We can't easily restore notification_preferences from this)
    const recurringNotifications = app.findRecordsByFilter(
      'recurring_notifications',
      'source_collection = "people"',
      '-created',
      10000,
      0
    );

    console.log(`Deleting ${recurringNotifications.length} recurring notifications for rollback`);

    for (const record of recurringNotifications) {
      app.delete(record);
    }

    // Clear source_collection and source_id from notifications
    const notifications = app.findRecordsByFilter(
      'notifications',
      'source_collection = "people"',
      '-created',
      10000,
      0
    );

    for (const notification of notifications) {
      notification.set('source_collection', '');
      notification.set('source_id', '');
      app.save(notification);
    }

    return null;
  }
);
