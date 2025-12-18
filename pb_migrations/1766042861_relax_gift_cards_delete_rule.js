/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("gift_cards");

  // Relax delete rule to allow any authenticated user to delete gift cards
  // This enables shared household usage where any user can manage all gift cards
  collection.deleteRule = "@request.auth.id != ''";

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("gift_cards");

  // Revert to original stricter rule
  collection.deleteRule = "@request.auth.id != '' && (created_by = @request.auth.id || @request.auth.role = 'admin')";

  return app.save(collection);
});
