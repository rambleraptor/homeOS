/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = new Collection({
    "id": "audit_log_id",
    "created": "2024-12-11 00:00:03.000Z",
    "updated": "2024-12-11 00:00:03.000Z",
    "name": "audit_log",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "user_relation",
        "name": "user",
        "type": "relation",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "collectionId": "_pb_users_auth_",
          "cascadeDelete": false,
          "minSelect": null,
          "maxSelect": 1,
          "displayFields": ["name", "email"]
        }
      },
      {
        "system": false,
        "id": "action_text",
        "name": "action",
        "type": "text",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": 100,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "resource_text",
        "name": "resource",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": 200,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "details_json",
        "name": "details",
        "type": "json",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "maxSize": 2000000
        }
      },
      {
        "system": false,
        "id": "ip_address_text",
        "name": "ip_address",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": 45,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "user_agent_text",
        "name": "user_agent",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": 500,
          "pattern": ""
        }
      }
    ],
    "indexes": [
      "CREATE INDEX idx_user_created ON audit_log (user, created)",
      "CREATE INDEX idx_created ON audit_log (created)"
    ],
    "listRule": "@request.auth.role = \"admin\"",
    "viewRule": "@request.auth.role = \"admin\"",
    "createRule": "@request.auth.id != \"\"",
    "updateRule": null,
    "deleteRule": "@request.auth.role = \"admin\"",
    "options": {}
  });

  return Dao(db).saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("audit_log");

  return dao.deleteCollection(collection);
});
