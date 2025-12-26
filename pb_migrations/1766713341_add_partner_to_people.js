/// <reference path="../pb_data/types.d.ts" />

/**
 * Adds partner_id field to the 'people' collection to support relationships.
 * Partners can share certain information like address and anniversary.
 */
migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('people');

    // Add the partner_id field (self-referencing relation)
    collection.fields.add(
      new RelationField({
        name: 'partner_id',
        required: false,
        collectionId: collection.id, // Self-reference to people collection
        cascadeDelete: true, // Clear partner_id when partner is deleted
        maxSelect: 1, // Only one partner allowed
      })
    );

    // Add index for partner_id for efficient queries
    collection.indexes.push(
      'CREATE INDEX IF NOT EXISTS idx_people_partner_id ON people (partner_id)'
    );

    return app.save(collection);
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('people');

    // Remove the index on partner_id first
    const updatedIndexes = collection.indexes.filter(
      idx => !idx.includes('idx_people_partner_id')
    );
    collection.indexes = updatedIndexes;

    // Remove the partner_id field
    const partnerIdField = collection.fields.getByName('partner_id');
    if (partnerIdField) {
      collection.fields.removeById(partnerIdField.id);
    }

    return app.save(collection);
  }
);
