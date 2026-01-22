/// <reference path="../pb_data/types.d.ts" />

/**
 * Creates the 'recurring_notifications' collection.
 *
 * This collection stores recurring notification configurations that the daily
 * cron job uses to create Notification instances. Models (like people) can
 * have multiple recurring notifications pointing to them.
 *
 * Fields:
 * - user_id: The user who owns this recurring notification
 * - source_collection: The collection name (e.g., "people", "events")
 * - source_id: The ID of the source record
 * - title_template: Template for notification title (supports {{name}}, {{date}})
 * - message_template: Template for notification message
 * - reference_date_field: Which field on source to use for date calculation (e.g., "birthday")
 * - timing: When to send relative to the date (day_of, day_before, week_before)
 * - enabled: Whether this recurring notification is active
 * - last_triggered: When this last created a notification
 */
migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId('users');

    const collection = new Collection({
      name: 'recurring_notifications',
      type: 'base',
      system: false,
      listRule: 'user_id = @request.auth.id',
      viewRule: 'user_id = @request.auth.id',
      createRule: '@request.auth.id != ""',
      updateRule: 'user_id = @request.auth.id',
      deleteRule: 'user_id = @request.auth.id',
    });

    // User who owns this recurring notification
    collection.fields.add(
      new RelationField({
        name: 'user_id',
        required: true,
        collectionId: usersCollection.id,
        cascadeDelete: true,
        maxSelect: 1,
      })
    );

    // Source collection name (e.g., "people", "gift_cards")
    collection.fields.add(
      new TextField({
        name: 'source_collection',
        required: true,
        max: 100,
      })
    );

    // Source record ID
    collection.fields.add(
      new TextField({
        name: 'source_id',
        required: true,
        max: 50,
      })
    );

    // Template for notification title (supports placeholders like {{name}})
    collection.fields.add(
      new TextField({
        name: 'title_template',
        required: true,
        max: 200,
      })
    );

    // Template for notification message
    collection.fields.add(
      new TextField({
        name: 'message_template',
        required: true,
        max: 1000,
      })
    );

    // Which field on the source record contains the reference date
    collection.fields.add(
      new TextField({
        name: 'reference_date_field',
        required: true,
        max: 100,
      })
    );

    // When to send the notification relative to the reference date
    collection.fields.add(
      new SelectField({
        name: 'timing',
        required: true,
        values: ['day_of', 'day_before', 'week_before'],
      })
    );

    // Whether this recurring notification is enabled
    collection.fields.add(
      new BoolField({
        name: 'enabled',
        required: false,
      })
    );

    // When this recurring notification last triggered a notification
    collection.fields.add(
      new DateField({
        name: 'last_triggered',
        required: false,
      })
    );

    // Add indexes for efficient querying
    collection.indexes = [
      'CREATE INDEX idx_recurring_notifications_user_id ON recurring_notifications (user_id)',
      'CREATE INDEX idx_recurring_notifications_source ON recurring_notifications (source_collection, source_id)',
      'CREATE INDEX idx_recurring_notifications_enabled ON recurring_notifications (enabled)',
      'CREATE UNIQUE INDEX idx_recurring_notifications_unique ON recurring_notifications (user_id, source_collection, source_id, reference_date_field, timing)',
    ];

    return app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('recurring_notifications');
    return app.delete(collection);
  }
);
