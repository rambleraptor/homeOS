/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Check if collection already exists (idempotent)
  try {
    const existing = app.findCollectionByNameOrId("action_runs");
    if (existing) {
      return; // Collection already exists, skip creation
    }
  } catch (e) {
    // Collection doesn't exist, continue with creation
  }

  const collection = new Collection();
  collection.name = "action_runs";
  collection.type = "base";
  collection.system = false;

  // Relation to action
  try {
    const actionsCollection = app.findCollectionByNameOrId("actions");
    collection.fields.add(new RelationField({
      name: "action",
      required: true,
      presentable: false,
      collectionId: actionsCollection.id,
      cascadeDelete: true,
      maxSelect: 1
    }));
  } catch (e) {
    throw new Error("Actions collection must exist before creating action_runs");
  }

  // Status (pending, running, awaiting_input, success, error)
  collection.fields.add(new SelectField({
    name: "status",
    required: true,
    presentable: true,
    values: ["pending", "running", "awaiting_input", "success", "error"]
  }));

  // Started timestamp
  collection.fields.add(new DateField({
    name: "started_at",
    required: false,
    presentable: false
  }));

  // Completed timestamp
  collection.fields.add(new DateField({
    name: "completed_at",
    required: false,
    presentable: false
  }));

  // Duration in milliseconds
  collection.fields.add(new NumberField({
    name: "duration_ms",
    required: false,
    presentable: false,
    min: 0
  }));

  // Logs (JSON array of log entries)
  collection.fields.add(new JSONField({
    name: "logs",
    required: false,
    presentable: false
  }));

  // Error message
  collection.fields.add(new TextField({
    name: "error",
    required: false,
    presentable: false,
    max: 5000
  }));

  // Result data (JSON)
  collection.fields.add(new JSONField({
    name: "result",
    required: false,
    presentable: false
  }));

  // Input request (for awaiting_input status)
  // Format: { prompt: string, field_name: string, field_type: string }
  collection.fields.add(new JSONField({
    name: "input_request",
    required: false,
    presentable: false
  }));

  // User input response
  collection.fields.add(new JSONField({
    name: "input_response",
    required: false,
    presentable: false
  }));

  // Set indexes
  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS idx_action_runs_action ON action_runs (action)",
    "CREATE INDEX IF NOT EXISTS idx_action_runs_status ON action_runs (status)",
    "CREATE INDEX IF NOT EXISTS idx_action_runs_started_at ON action_runs (started_at)"
  ];

  // Set rules
  collection.listRule = "@request.auth.id != ''";
  collection.viewRule = "@request.auth.id != ''";
  collection.createRule = "@request.auth.id != ''";
  collection.updateRule = "@request.auth.id != ''";
  collection.deleteRule = "@request.auth.id != ''";

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("action_runs");
  app.delete(collection);
});
