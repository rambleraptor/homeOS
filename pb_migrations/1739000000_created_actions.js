/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Check if collection already exists (idempotent)
  try {
    const existing = app.findCollectionByNameOrId("actions");
    if (existing) {
      return; // Collection already exists, skip creation
    }
  } catch (e) {
    // Collection doesn't exist, continue with creation
  }

  const collection = new Collection();
  collection.name = "actions";
  collection.type = "base";
  collection.system = false;

  // Action name
  collection.fields.add(new TextField({
    name: "name",
    required: true,
    presentable: true,
    max: 200
  }));

  // Action description
  collection.fields.add(new TextField({
    name: "description",
    required: false,
    presentable: false,
    max: 1000
  }));

  // Script identifier (e.g., "safeway_coupons")
  collection.fields.add(new TextField({
    name: "script_id",
    required: true,
    presentable: false,
    max: 100
  }));

  // Parameters for the script (JSON)
  collection.fields.add(new JSONField({
    name: "parameters",
    required: false,
    presentable: false
  }));

  // Last run timestamp
  collection.fields.add(new DateField({
    name: "last_run_at",
    required: false,
    presentable: false
  }));

  // Add created_by relation if users collection exists
  try {
    const usersCollection = app.findCollectionByNameOrId("users");
    collection.fields.add(new RelationField({
      name: "created_by",
      required: false,
      presentable: false,
      collectionId: usersCollection.id,
      cascadeDelete: false,
      maxSelect: 1
    }));
  } catch (e) {
    console.log("Users collection not found, creating actions without user relation");
  }

  // Set indexes
  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS idx_actions_script_id ON actions (script_id)",
    "CREATE INDEX IF NOT EXISTS idx_actions_created_by ON actions (created_by)"
  ];

  // Set rules
  collection.listRule = "@request.auth.id != ''";
  collection.viewRule = "@request.auth.id != ''";
  collection.createRule = "@request.auth.id != ''";
  collection.updateRule = "@request.auth.id != '' && (created_by = @request.auth.id || @request.auth.role = 'admin')";
  collection.deleteRule = "@request.auth.id != '' && (created_by = @request.auth.id || @request.auth.role = 'admin')";

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("actions");
  app.delete(collection);
});
