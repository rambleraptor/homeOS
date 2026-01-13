import type { GroceryItem, Store } from '../types';

const DB_NAME = 'homeOS_groceries_offline';
const DB_VERSION = 1;

const STORES = {
  GROCERIES: 'groceries',
  STORES: 'stores',
  PENDING_MUTATIONS: 'pendingMutations',
} as const;

export interface PendingMutation {
  id: string;
  type: 'create' | 'update' | 'delete';
  collection: 'groceries' | 'stores';
  timestamp: number;
  data?: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Can be GroceryItem, Store, or partial updates
  itemId?: string; // For update/delete operations
}

/**
 * Initialize IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.GROCERIES)) {
        db.createObjectStore(STORES.GROCERIES, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.STORES)) {
        db.createObjectStore(STORES.STORES, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.PENDING_MUTATIONS)) {
        db.createObjectStore(STORES.PENDING_MUTATIONS, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Generic function to get all records from a store
 */
async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic function to save all records to a store
 */
async function saveAllToStore<T extends { id: string }>(
  storeName: string,
  items: T[]
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    // Clear existing data
    store.clear();

    // Add all items
    items.forEach((item) => store.put(item));

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Generic function to add a single record to a store
 */
async function addToStore<T>(storeName: string, item: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic function to delete records by IDs
 */
async function deleteFromStore(
  storeName: string,
  ids: string[]
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    ids.forEach((id) => store.delete(id));

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// ============================================================================
// Groceries Storage
// ============================================================================

export async function getGroceriesLocally(): Promise<GroceryItem[]> {
  try {
    return await getAllFromStore<GroceryItem>(STORES.GROCERIES);
  } catch (error) {
    console.error('Failed to get groceries from IndexedDB:', error);
    return [];
  }
}

export async function saveGroceriesLocally(
  items: GroceryItem[]
): Promise<void> {
  try {
    await saveAllToStore(STORES.GROCERIES, items);
  } catch (error) {
    console.error('Failed to save groceries to IndexedDB:', error);
  }
}

// ============================================================================
// Stores Storage
// ============================================================================

export async function getStoresLocally(): Promise<Store[]> {
  try {
    return await getAllFromStore<Store>(STORES.STORES);
  } catch (error) {
    console.error('Failed to get stores from IndexedDB:', error);
    return [];
  }
}

export async function saveStoresLocally(stores: Store[]): Promise<void> {
  try {
    await saveAllToStore(STORES.STORES, stores);
  } catch (error) {
    console.error('Failed to save stores to IndexedDB:', error);
  }
}

// ============================================================================
// Pending Mutations Storage
// ============================================================================

export async function getPendingMutations(): Promise<PendingMutation[]> {
  try {
    return await getAllFromStore<PendingMutation>(STORES.PENDING_MUTATIONS);
  } catch (error) {
    console.error('Failed to get pending mutations from IndexedDB:', error);
    return [];
  }
}

export async function addPendingMutation(
  mutation: PendingMutation
): Promise<void> {
  try {
    await addToStore(STORES.PENDING_MUTATIONS, mutation);
  } catch (error) {
    console.error('Failed to add pending mutation to IndexedDB:', error);
  }
}

export async function clearPendingMutations(ids: string[]): Promise<void> {
  try {
    await deleteFromStore(STORES.PENDING_MUTATIONS, ids);
  } catch (error) {
    console.error('Failed to clear pending mutations from IndexedDB:', error);
  }
}

/**
 * Clear all pending mutations
 */
export async function clearAllPendingMutations(): Promise<void> {
  try {
    const mutations = await getPendingMutations();
    const ids = mutations.map((m) => m.id);
    await clearPendingMutations(ids);
  } catch (error) {
    console.error('Failed to clear all pending mutations:', error);
  }
}

/**
 * Clear all offline data (for testing)
 */
export async function clearAllOfflineData(): Promise<void> {
  try {
    await saveGroceriesLocally([]);
    await saveStoresLocally([]);
    await clearAllPendingMutations();
  } catch (error) {
    console.error('Failed to clear all offline data:', error);
  }
}
