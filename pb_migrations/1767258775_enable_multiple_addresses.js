/// <reference path="../pb_data/types.d.ts" />

/**
 * Enables multiple addresses per person/couple by changing address_id
 * from single-select (maxSelect: 1) to multi-select (maxSelect: null).
 *
 * This migration:
 * 1. Reads existing address_id values (strings)
 * 2. Changes the field to multi-select
 * 3. Converts existing data from strings to arrays
 */
migrate(
  (app) => {
    const addressesCollection = app.findCollectionByNameOrId('addresses');
    const sharedDataCollection = app.findCollectionByNameOrId('person_shared_data');
    const dao = new Dao(app);

    // Step 1: Read all existing shared_data records and their address_ids
    const existingData = [];
    try {
      const records = dao.findRecordsByFilter(
        'person_shared_data',
        '', // no filter, get all
        '-created', // sort
        0, // limit (0 = no limit)
        0 // offset
      );

      for (const record of records) {
        const addressId = record.get('address_id');
        if (addressId) {
          existingData.push({
            id: record.id,
            addressId: addressId
          });
        }
      }
    } catch (e) {
      // Collection might be empty or not exist yet
    }

    // Step 2: Remove old address_id field (single select)
    const oldAddressIdField = sharedDataCollection.fields.getByName('address_id');
    if (oldAddressIdField) {
      sharedDataCollection.fields.removeById(oldAddressIdField.id);
    }

    // Step 3: Add new address_id field with multi-select enabled
    sharedDataCollection.fields.add(
      new RelationField({
        name: 'address_id',
        required: false,
        collectionId: addressesCollection.id,
        cascadeDelete: false,
        maxSelect: null, // Allow multiple addresses
      })
    );

    // Save the collection with the new field
    app.save(sharedDataCollection);

    // Step 4: Migrate existing data - convert single address_id to array
    for (const data of existingData) {
      try {
        const record = dao.findRecordById('person_shared_data', data.id);
        // Convert single address ID to array
        record.set('address_id', [data.addressId]);
        dao.saveRecord(record);
      } catch (e) {
        // Record might have been deleted, skip it
      }
    }

    return null;
  },
  (app) => {
    // Rollback: Change address_id back to single-select
    const addressesCollection = app.findCollectionByNameOrId('addresses');
    const sharedDataCollection = app.findCollectionByNameOrId('person_shared_data');
    const dao = new Dao(app);

    // Step 1: Read all existing shared_data records and their address_ids (arrays)
    const existingData = [];
    try {
      const records = dao.findRecordsByFilter(
        'person_shared_data',
        '',
        '-created',
        0,
        0
      );

      for (const record of records) {
        const addressIds = record.get('address_id');
        if (addressIds && addressIds.length > 0) {
          existingData.push({
            id: record.id,
            addressId: addressIds[0] // Take only the first address
          });
        }
      }
    } catch (e) {
      // Collection might be empty
    }

    // Step 2: Remove multi-select address_id field
    const multiAddressIdField = sharedDataCollection.fields.getByName('address_id');
    if (multiAddressIdField) {
      sharedDataCollection.fields.removeById(multiAddressIdField.id);
    }

    // Step 3: Restore single-select address_id field
    sharedDataCollection.fields.add(
      new RelationField({
        name: 'address_id',
        required: false,
        collectionId: addressesCollection.id,
        cascadeDelete: false,
        maxSelect: 1, // Single address only
      })
    );

    // Save the collection
    app.save(sharedDataCollection);

    // Step 4: Migrate data back - convert array to single address_id
    for (const data of existingData) {
      try {
        const record = dao.findRecordById('person_shared_data', data.id);
        record.set('address_id', data.addressId);
        dao.saveRecord(record);
      } catch (e) {
        // Record might have been deleted
      }
    }

    return null;
  }
);
