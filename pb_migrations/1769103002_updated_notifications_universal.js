/// <reference path="../pb_data/types.d.ts" />

/**
 * Updates the 'notifications' collection to support the universal notification system.
 *
 * Adds:
 * - recurring_notification_id: Links to the recurring notification that created this (optional)
 * - source_collection: The collection name of the source record (e.g., "people")
 * - source_id: The ID of the source record
 *
 * The person_id field is kept for backward compatibility but will be deprecated.
 * New code should use source_collection + source_id instead.
 */
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('notifications');
    const recurringNotificationsCollection = app.findCollectionByNameOrId('recurring_notifications');

    // Add recurring_notification_id field (optional, for notifications created by recurring notifications)
    collection.fields.add(
      new RelationField({
        name: 'recurring_notification_id',
        required: false,
        collectionId: recurringNotificationsCollection.id,
        cascadeDelete: false, // Don't delete notifications if recurring notification is deleted
        maxSelect: 1,
      })
    );

    // Add source_collection field (e.g., "people", "gift_cards")
    collection.fields.add(
      new TextField({
        name: 'source_collection',
        required: false,
        max: 100,
      })
    );

    // Add source_id field
    collection.fields.add(
      new TextField({
        name: 'source_id',
        required: false,
        max: 50,
      })
    );

    // Add indexes for the new fields
    collection.indexes.push(
      'CREATE INDEX IF NOT EXISTS idx_notifications_recurring_id ON notifications (recurring_notification_id)'
    );
    collection.indexes.push(
      'CREATE INDEX IF NOT EXISTS idx_notifications_source ON notifications (source_collection, source_id)'
    );

    return app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('notifications');

    // Remove indexes first
    collection.indexes = collection.indexes.filter(
      (idx) =>
        !idx.includes('idx_notifications_recurring_id') &&
        !idx.includes('idx_notifications_source')
    );

    // Remove the new fields
    const recurringIdField = collection.fields.getByName('recurring_notification_id');
    if (recurringIdField) {
      collection.fields.removeById(recurringIdField.id);
    }

    const sourceCollectionField = collection.fields.getByName('source_collection');
    if (sourceCollectionField) {
      collection.fields.removeById(sourceCollectionField.id);
    }

    const sourceIdField = collection.fields.getByName('source_id');
    if (sourceIdField) {
      collection.fields.removeById(sourceIdField.id);
    }

    return app.save(collection);
  }
);
