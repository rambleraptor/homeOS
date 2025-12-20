/// <reference path="../pb_data/types.d.ts" />

/**
 * Deletes the 'events' collection.
 */
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('events');
    return app.delete(collection);
  },
  (app) => {
    const usersCollection = app.findCollectionByNameOrId('users');

    const collection = new Collection({
      name: 'events',
      type: 'base',
      system: false,
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && (created_by = @request.auth.id || @request.auth.role = 'admin')",
      deleteRule: "@request.auth.id != '' && (created_by = @request.auth.id || @request.auth.role = 'admin')",
    });

    // Add fields using the Collection API
    collection.fields.add(
      new SelectField({
        name: 'event_type',
        required: true,
        values: ['birthday', 'anniversary'],
      })
    );

    collection.fields.add(
      new TextField({
        name: 'title',
        required: true,
        max: 200,
      })
    );

    collection.fields.add(
      new TextField({
        name: 'people_involved',
        required: true,
        max: 500,
      })
    );

    collection.fields.add(
      new DateField({
        name: 'event_date',
        required: true,
      })
    );

    collection.fields.add(
      new BoolField({
        name: 'recurring_yearly',
        required: false,
      })
    );

    collection.fields.add(
      new TextField({
        name: 'details',
        required: false,
        max: 2000,
      })
    );

    collection.fields.add(
      new JSONField({
        name: 'notification_preferences',
        required: false,
      })
    );

    collection.fields.add(
      new RelationField({
        name: 'created_by',
        required: false,
        collectionId: usersCollection.id,
        cascadeDelete: false,
        maxSelect: 1,
      })
    );

    // Add indexes
    collection.indexes = [
      'CREATE INDEX IF NOT EXISTS idx_events_event_type ON events (event_type)',
      'CREATE INDEX IF NOT EXISTS idx_events_event_date ON events (event_date)',
      'CREATE INDEX IF NOT EXISTS idx_events_created_by ON events (created_by)',
    ];

    return app.save(collection);
  }
);
