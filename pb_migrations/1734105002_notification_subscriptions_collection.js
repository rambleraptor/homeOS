/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Check if collection already exists (idempotent)
  try {
    const existing = app.findCollectionByNameOrId("notification_subscriptions");
    if (existing) {
      return; // Collection already exists, skip creation
    }
  } catch (e) {
    // Collection doesn't exist, continue with creation
  }

  // Get the users collection ID
  const usersCollection = app.findCollectionByNameOrId("users");

  const collection = new Collection({
    "name": "notification_subscriptions",
    "type": "base",
    "system": false,
    "fields": [
      {
        "name": "user_id",
        "type": "relation",
        "required": true,
        "presentable": false,
        "collectionId": usersCollection.id,
        "cascadeDelete": true,
        "maxSelect": 1
      },
      {
        "name": "subscription_data",
        "type": "json",
        "required": true,
        "presentable": false
      },
      {
        "name": "enabled",
        "type": "bool",
        "required": false,
        "presentable": false
      }
    ],
    "indexes": [
      "CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_user_id ON notification_subscriptions (user_id)",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_subscriptions_user_subscription ON notification_subscriptions (user_id)"
    ],
    "listRule": "@request.auth.id != '' && user_id = @request.auth.id",
    "viewRule": "@request.auth.id != '' && user_id = @request.auth.id",
    "createRule": "@request.auth.id != ''",
    "updateRule": "@request.auth.id != '' && user_id = @request.auth.id",
    "deleteRule": "@request.auth.id != '' && user_id = @request.auth.id"
  });

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("notification_subscriptions");
  app.delete(collection);
});
