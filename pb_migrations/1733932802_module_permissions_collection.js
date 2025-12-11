/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = new Collection({
    "id": "module_permissions_id",
    "created": "2024-12-11 00:00:02.000Z",
    "updated": "2024-12-11 00:00:02.000Z",
    "name": "module_permissions",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "user_relation",
        "name": "user",
        "type": "relation",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "collectionId": "_pb_users_auth_",
          "cascadeDelete": true,
          "minSelect": null,
          "maxSelect": 1,
          "displayFields": ["name", "email"]
        }
      },
      {
        "system": false,
        "id": "module_id_text",
        "name": "module_id",
        "type": "text",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "min": 1,
          "max": 100,
          "pattern": "^[a-z_]+$"
        }
      },
      {
        "system": false,
        "id": "enabled_bool",
        "name": "enabled",
        "type": "bool",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {}
      },
      {
        "system": false,
        "id": "permissions_json",
        "name": "permissions",
        "type": "json",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "maxSize": 2000000
        }
      }
    ],
    "indexes": [
      "CREATE UNIQUE INDEX idx_user_module ON module_permissions (user, module_id)"
    ],
    "listRule": "@request.auth.id != \"\" && (user = @request.auth.id || @request.auth.role = \"admin\")",
    "viewRule": "@request.auth.id != \"\" && (user = @request.auth.id || @request.auth.role = \"admin\")",
    "createRule": "@request.auth.role = \"admin\"",
    "updateRule": "@request.auth.role = \"admin\"",
    "deleteRule": "@request.auth.role = \"admin\"",
    "options": {}
  });

  return Dao(db).saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("module_permissions");

  return dao.deleteCollection(collection);
});
