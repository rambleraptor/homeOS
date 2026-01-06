/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("gift_cards");

  // Check if field already exists (idempotent)
  const existingField = collection.fields.getByName("expiration_date");
  if (existingField) {
    return; // Field already exists, skip addition
  }

  // Add expiration_date field (date, optional)
  collection.fields.add(new DateField({
    name: "expiration_date",
    required: false,
    presentable: false
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("gift_cards");

  // Remove expiration_date field
  const expirationDateField = collection.fields.getByName("expiration_date");
  if (expirationDateField) {
    collection.fields.removeById(expirationDateField.id);
  }

  return app.save(collection);
})
