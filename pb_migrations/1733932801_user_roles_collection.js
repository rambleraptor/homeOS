/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = new Collection({
    "id": "user_roles_id",
    "created": "2024-12-11 00:00:01.000Z",
    "updated": "2024-12-11 00:00:01.000Z",
    "name": "user_roles",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "role_text",
        "name": "role",
        "type": "text",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "min": 1,
          "max": 50,
          "pattern": "^[a-z_]+$"
        }
      },
      {
        "system": false,
        "id": "name_text",
        "name": "name",
        "type": "text",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "min": 1,
          "max": 100,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "description_text",
        "name": "description",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": 500,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "permissions_json",
        "name": "permissions",
        "type": "json",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "maxSize": 2000000
        }
      }
    ],
    "indexes": [
      "CREATE UNIQUE INDEX idx_role ON user_roles (role)"
    ],
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "createRule": "@request.auth.role = \"admin\"",
    "updateRule": "@request.auth.role = \"admin\"",
    "deleteRule": "@request.auth.role = \"admin\"",
    "options": {}
  });

  return Dao(db).saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("user_roles");

  return dao.deleteCollection(collection);
});
