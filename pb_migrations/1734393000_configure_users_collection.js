/// <reference path="../pb_data/types.d.ts" />

/**
 * Configure users collection for e2e tests
 *
 * Ensures the users collection has API rules that allow:
 * - Anyone to create users (for registration and e2e tests)
 * - Users to read/update their own records
 * - Admins to do everything
 */
migrate((app) => {
  const collection = app.findCollectionByNameOrId("users");

  // Update API rules to allow user creation for testing
  // These rules allow:
  // - Anyone can create (register) - needed for e2e tests
  // - Users can read all (family OS concept - no filtering)
  // - Users can only update their own record
  // - Users can only delete their own record
  collection.createRule = null; // Allow anyone to create users
  collection.listRule = ""; // Allow anyone to list users (family OS)
  collection.viewRule = ""; // Allow anyone to view users (family OS)
  collection.updateRule = "@request.auth.id = id"; // Users can update themselves
  collection.deleteRule = "@request.auth.id = id"; // Users can delete themselves

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("users");

  // Revert to more restrictive rules
  collection.createRule = "";
  collection.listRule = "";
  collection.viewRule = "";
  collection.updateRule = "@request.auth.id = id";
  collection.deleteRule = "@request.auth.id = id";

  return app.save(collection);
});
