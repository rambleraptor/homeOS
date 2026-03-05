/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("actions");

  // Allow any authenticated user to update actions
  // Seeded records have no created_by, so the old ownership rule blocks updates
  collection.updateRule = "@request.auth.id != ''";

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("actions");

  // Restore original ownership-based update rule
  collection.updateRule = "@request.auth.id != '' && (created_by = @request.auth.id || @request.auth.role = 'admin')";

  return app.save(collection);
});
