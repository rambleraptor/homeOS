/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Check if collection already exists (idempotent)
  try {
    const existing = app.findCollectionByNameOrId("events");
    if (existing) {
      return; // Collection already exists, skip creation
    }
  } catch (e) {
    // Collection doesn't exist, continue with creation
  }

  // Get the users collection ID (if it exists)
  let usersCollectionId;
  try {
    const usersCollection = app.findCollectionByNameOrId("users");
    usersCollectionId = usersCollection.id;
  } catch (e) {
    // Users collection doesn't exist yet - create relation without specific collection
    console.log("Users collection not found, creating events without user relation");
  }

  const collection = new Collection({
    "name": "events",
    "type": "base",
    "system": false,
    "fields": [
      {
        "name": "event_type",
        "type": "select",
        "required": true,
        "presentable": false,
        "values": ["birthday", "anniversary"]
      },
      {
        "name": "title",
        "type": "text",
        "required": true,
        "presentable": true,
        "max": 200
      },
      {
        "name": "people_involved",
        "type": "text",
        "required": true,
        "presentable": false,
        "max": 500
      },
      {
        "name": "event_date",
        "type": "date",
        "required": true,
        "presentable": false
      },
      {
        "name": "recurring_yearly",
        "type": "bool",
        "required": false,
        "presentable": false
      },
      {
        "name": "details",
        "type": "text",
        "required": false,
        "presentable": false,
        "max": 2000
      },
      {
        "name": "notification_preferences",
        "type": "json",
        "required": false,
        "presentable": false
      }
    ].concat(usersCollectionId ? [{
      "name": "created_by",
      "type": "relation",
      "required": false,
      "presentable": false,
      "collectionId": usersCollectionId,
      "cascadeDelete": false,
      "maxSelect": 1
    }] : []),
    "indexes": [
      "CREATE INDEX IF NOT EXISTS idx_events_event_type ON events (event_type)",
      "CREATE INDEX IF NOT EXISTS idx_events_event_date ON events (event_date)",
      "CREATE INDEX IF NOT EXISTS idx_events_created_by ON events (created_by)"
    ],
    "listRule": "@request.auth.id != ''",
    "viewRule": "@request.auth.id != ''",
    "createRule": "@request.auth.id != ''",
    "updateRule": "@request.auth.id != '' && (created_by = @request.auth.id || @request.auth.role = 'admin')",
    "deleteRule": "@request.auth.id != '' && (created_by = @request.auth.id || @request.auth.role = 'admin')"
  });

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("events");
  app.delete(collection);
});
