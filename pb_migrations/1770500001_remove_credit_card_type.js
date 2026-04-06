/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("credit_cards");

  const field = collection.fields.getByName("card_type");
  if (field) {
    collection.fields.removeById(field.id);
  }

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("credit_cards");

  collection.fields.add(new SelectField({
    name: "card_type",
    required: true,
    presentable: false,
    values: ["personal", "business"],
    maxSelect: 1
  }));

  return app.save(collection);
});
