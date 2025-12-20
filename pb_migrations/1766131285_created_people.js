/// <reference path="../pb_data/types.d.ts" />

/**
 * Creates the 'people' collection with the specified schema.
 */
migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId('users');

    const collection = new Collection({
      name: 'people',
      type: 'base',
      system: false,
      listRule: 'created_by = @request.auth.id',
      viewRule: 'created_by = @request.auth.id',
      createRule: '@request.auth.id != ""',
      updateRule: 'created_by = @request.auth.id',
      deleteRule: 'created_by = @request.auth.id',
    });

    // Add fields using the Collection API
    collection.fields.add(
      new TextField({
        name: 'name',
        required: true,
        min: 2,
        max: 200,
      })
    );

    collection.fields.add(
      new TextField({
        name: 'address',
        required: false,
        max: 500,
      })
    );

    collection.fields.add(
      new DateField({
        name: 'birthday',
        required: false,
      })
    );

    collection.fields.add(
      new DateField({
        name: 'anniversary',
        required: false,
      })
    );

    collection.fields.add(
      new JSONField({
        name: 'notification_preferences',
        required: false,
        maxSize: 200,
      })
    );

    collection.fields.add(
      new RelationField({
        name: 'created_by',
        required: true,
        collectionId: usersCollection.id,
        cascadeDelete: true,
      })
    );

    // Add index
    collection.indexes = ['CREATE INDEX `idx_people_name` ON `people` (`name`)'];

    return app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('people');
    return app.delete(collection);
  }
);
