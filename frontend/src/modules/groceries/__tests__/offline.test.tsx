/**
 * Offline Functionality Tests
 *
 * Tests grocery module offline behavior including:
 * - Creating items while offline
 * - Toggling items while offline
 * - Cache management with IndexedDB
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useGroceries } from '../hooks/useGroceries';
import { useCreateGroceryItem } from '../hooks/useCreateGroceryItem';
import { useUpdateGroceryItem } from '../hooks/useUpdateGroceryItem';
import type { GroceryItem } from '../types';

// Mock offline-storage module
const mockGroceries: GroceryItem[] = [];
vi.mock('../utils/offline-storage', () => ({
  getGroceriesLocally: vi.fn(() => Promise.resolve([...mockGroceries])),
  saveGroceriesLocally: vi.fn((items: GroceryItem[]) => {
    mockGroceries.splice(0, mockGroceries.length, ...items);
    return Promise.resolve();
  }),
  getStoresLocally: vi.fn(() => Promise.resolve([])),
  saveStoresLocally: vi.fn(() => Promise.resolve()),
  getPendingMutations: vi.fn(() => Promise.resolve([])),
  addPendingMutation: vi.fn(() => Promise.resolve()),
  clearPendingMutations: vi.fn(() => Promise.resolve()),
  clearAllPendingMutations: vi.fn(() => Promise.resolve()),
  clearAllOfflineData: vi.fn(() => {
    mockGroceries.splice(0, mockGroceries.length);
    return Promise.resolve();
  }),
}));

// Mock PocketBase
vi.mock('@/core/api/pocketbase', () => ({
  Collections: {
    GROCERIES: 'groceries',
    STORES: 'stores',
  },
  getCollection: vi.fn(() => ({
    getFullList: vi.fn(() => Promise.resolve([])),
    create: vi.fn((data) => Promise.resolve({ id: 'server-id', ...data })),
    update: vi.fn((id, data) => Promise.resolve({ id, ...data })),
  })),
  pb: {
    authStore: {
      isValid: true,
    },
  },
}));

// Mock Gemini service
vi.mock('@/core/services/gemini', () => ({
  categorizeGroceryItem: vi.fn(() => Promise.resolve('Other')),
}));

// Mock logger
vi.mock('@/core/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Create wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('Offline Functionality', () => {
  let originalNavigatorOnLine: boolean;

  beforeEach(() => {
    // Clear mock groceries
    mockGroceries.splice(0, mockGroceries.length);

    // Save original navigator.onLine value
    originalNavigatorOnLine = navigator.onLine;
  });

  afterEach(() => {
    // Restore navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: originalNavigatorOnLine,
    });

    // Clear mock groceries
    mockGroceries.splice(0, mockGroceries.length);
  });

  describe('Creating items offline', () => {
    it('should create an item and update cache when offline', async () => {
      // Set up initial online state with some items
      const initialItems: GroceryItem[] = [
        {
          id: 'item-1',
          name: 'Bread',
          notes: '',
          store: '',
          checked: false,
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
        },
      ];
      mockGroceries.push(...initialItems);

      // Go offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      // Simulate offline event
      window.dispatchEvent(new Event('offline'));

      const wrapper = createWrapper();

      // Render the query hook
      const { result: queryResult } = renderHook(() => useGroceries(), { wrapper });

      // Wait for initial query to load from IndexedDB
      await waitFor(() => {
        expect(queryResult.current.isSuccess).toBe(true);
      });

      // Should have the initial item
      expect(queryResult.current.data).toHaveLength(1);
      expect(queryResult.current.data?.[0].name).toBe('Bread');

      // Render the mutation hook
      const { result: mutationResult } = renderHook(() => useCreateGroceryItem(), { wrapper });

      // Create a new item while offline
      mutationResult.current.mutate({
        name: 'Milk',
        notes: 'Whole milk',
        store: 'Safeway',
      });

      // Wait for mutation to complete
      await waitFor(() => {
        expect(mutationResult.current.isSuccess).toBe(true);
      });

      // Check that the item was added
      const newItem = mutationResult.current.data;
      expect(newItem).toBeDefined();
      expect(newItem?.name).toBe('Milk');
      expect(newItem?.id).toMatch(/^temp_/); // Should have temp ID

      // Wait for query to update
      await waitFor(() => {
        expect(queryResult.current.data).toHaveLength(2);
      }, { timeout: 3000 });

      // Check that both items are in the list
      const items = queryResult.current.data ?? [];
      expect(items).toHaveLength(2);
      expect(items.find(i => i.name === 'Bread')).toBeDefined();
      expect(items.find(i => i.name === 'Milk')).toBeDefined();

      // Verify mock storage was updated
      expect(mockGroceries).toHaveLength(2);
      expect(mockGroceries.find(i => i.name === 'Milk')).toBeDefined();
    });
  });

  describe('Updating items offline', () => {
    it('should toggle an item and update cache when offline', async () => {
      // Set up initial state with an item
      const initialItems: GroceryItem[] = [
        {
          id: 'item-1',
          name: 'Milk',
          notes: '',
          store: 'Safeway',
          checked: false,
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
        },
      ];
      mockGroceries.push(...initialItems);

      // Go offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      // Simulate offline event
      window.dispatchEvent(new Event('offline'));

      const wrapper = createWrapper();

      // Render the query hook
      const { result: queryResult } = renderHook(() => useGroceries(), { wrapper });

      // Wait for initial query to load
      await waitFor(() => {
        expect(queryResult.current.isSuccess).toBe(true);
      });

      // Item should be unchecked
      expect(queryResult.current.data?.[0].checked).toBe(false);

      // Render the mutation hook
      const { result: mutationResult } = renderHook(() => useUpdateGroceryItem(), { wrapper });

      // Toggle the item
      mutationResult.current.mutate({
        id: 'item-1',
        data: { checked: true },
      });

      // Wait for mutation to complete
      await waitFor(() => {
        expect(mutationResult.current.isSuccess).toBe(true);
      });

      // Wait for query to update
      await waitFor(() => {
        expect(queryResult.current.data?.[0].checked).toBe(true);
      }, { timeout: 3000 });

      // Verify mock storage was updated
      expect(mockGroceries[0].checked).toBe(true);
    });
  });

  describe('Multiple offline operations', () => {
    it('should handle creating multiple items while offline', async () => {
      // Start with empty state (already cleared in beforeEach)

      // Go offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });

      window.dispatchEvent(new Event('offline'));

      const wrapper = createWrapper();
      const { result: queryResult } = renderHook(() => useGroceries(), { wrapper });
      const { result: mutationResult } = renderHook(() => useCreateGroceryItem(), { wrapper });

      // Wait for initial query
      await waitFor(() => {
        expect(queryResult.current.isSuccess).toBe(true);
      });

      expect(queryResult.current.data).toHaveLength(0);

      // Create first item
      mutationResult.current.mutate({
        name: 'Milk',
        notes: '',
        store: 'Safeway',
      });

      await waitFor(() => {
        expect(mutationResult.current.isSuccess).toBe(true);
      });

      // Wait for query to update
      await waitFor(() => {
        expect(queryResult.current.data).toHaveLength(1);
      }, { timeout: 3000 });

      // Reset mutation
      mutationResult.current.reset();

      // Create second item
      mutationResult.current.mutate({
        name: 'Bread',
        notes: '',
        store: 'Safeway',
      });

      await waitFor(() => {
        expect(mutationResult.current.isSuccess).toBe(true);
      });

      // Wait for query to update again
      await waitFor(() => {
        expect(queryResult.current.data).toHaveLength(2);
      }, { timeout: 3000 });

      // Verify both items are in cache
      const items = queryResult.current.data ?? [];
      expect(items.find(i => i.name === 'Milk')).toBeDefined();
      expect(items.find(i => i.name === 'Bread')).toBeDefined();

      // Verify mock storage
      expect(mockGroceries).toHaveLength(2);
    });
  });
});
