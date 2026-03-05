/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("actions");

  // Check if record already exists (idempotent)
  try {
    const existing = app.findRecordsByFilter(collection, 'script_id = "safeway-coupons"', null, 1);
    if (existing && existing.length > 0) {
      return; // Already seeded
    }
  } catch (e) {
    // No records found, continue with creation
  }

  const record = new Record(collection);
  record.set("name", "Safeway Coupon Clipper");
  record.set("description", "Automatically clips all available digital coupons on Safeway.com");
  record.set("script_id", "safeway-coupons");
  record.set("parameters", {});

  return app.save(record);
}, (app) => {
  const collection = app.findCollectionByNameOrId("actions");

  try {
    const records = app.findRecordsByFilter(collection, 'script_id = "safeway-coupons"', null, 1);
    if (records && records.length > 0) {
      app.delete(records[0]);
    }
  } catch (e) {
    // Record doesn't exist, nothing to rollback
  }
});
