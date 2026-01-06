/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("notifications");
  const giftCardsCollection = app.findCollectionByNameOrId("gift_cards");

  // Check if field already exists (idempotent)
  const existingField = collection.fields.getByName("gift_card_id");
  if (existingField) {
    return; // Field already exists, skip addition
  }

  // Add gift_card_id field (relation to gift_cards, optional)
  collection.fields.add(new RelationField({
    name: "gift_card_id",
    required: false,
    presentable: false,
    collectionId: giftCardsCollection.id,
    cascadeDelete: true,
    maxSelect: 1
  }));

  // Add index for gift_card_id
  collection.indexes.push(
    "CREATE INDEX IF NOT EXISTS idx_notifications_gift_card_id ON notifications (gift_card_id)"
  );

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("notifications");

  // Remove the index on gift_card_id first
  const updatedIndexes = collection.indexes.filter(
    idx => !idx.includes('idx_notifications_gift_card_id')
  );
  collection.indexes = updatedIndexes;

  // Remove gift_card_id field
  const giftCardIdField = collection.fields.getByName("gift_card_id");
  if (giftCardIdField) {
    collection.fields.removeById(giftCardIdField.id);
  }

  return app.save(collection);
})
