/// <reference path="../pb_data/types.d.ts" />

/**
 * Updates the 'notifications' collection to replace 'event_id' with 'person_id'.
 */
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('notifications');
    const peopleCollection = app.findCollectionByNameOrId('people');

    // Remove the index on event_id first
    const updatedIndexes = collection.indexes.filter(
      idx => !idx.includes('idx_notifications_event_id')
    );
    collection.indexes = updatedIndexes;

    // Remove the old event_id field
    const eventIdField = collection.fields.getByName('event_id');
    if (eventIdField) {
      collection.fields.removeById(eventIdField.id);
    }

    // Add the new person_id field
    collection.fields.add(
      new RelationField({
        name: 'person_id',
        required: false,
        collectionId: peopleCollection.id,
        cascadeDelete: true,
        maxSelect: 1,
      })
    );

    // Add index for person_id
    collection.indexes.push(
      'CREATE INDEX IF NOT EXISTS idx_notifications_person_id ON notifications (person_id)'
    );

    return app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('notifications');
    const eventsCollection = app.findCollectionByNameOrId('events');

    // Remove the index on person_id first
    const updatedIndexes = collection.indexes.filter(
      idx => !idx.includes('idx_notifications_person_id')
    );
    collection.indexes = updatedIndexes;

    // Remove the person_id field
    const personIdField = collection.fields.getByName('person_id');
    if (personIdField) {
      collection.fields.removeById(personIdField.id);
    }

    // Add the old event_id field
    collection.fields.add(
      new RelationField({
        name: 'event_id',
        required: false,
        collectionId: eventsCollection.id,
        cascadeDelete: true,
        maxSelect: 1,
      })
    );

    // Add index for event_id
    collection.indexes.push(
      'CREATE INDEX IF NOT EXISTS idx_notifications_event_id ON notifications (event_id)'
    );

    return app.save(collection);
  }
);
