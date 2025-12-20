/**
 * Test Data for E2E Tests
 *
 * Centralized test data definitions
 */

export const testUsers = {
  user1: {
    email: 'user1@test.local',
    password: 'TestPassword123!',
    passwordConfirm: 'TestPassword123!',
    name: 'Test User 1',
  },
  user2: {
    email: 'user2@test.local',
    password: 'TestPassword123!',
    passwordConfirm: 'TestPassword123!',
    name: 'Test User 2',
  },
};

export const testGiftCards = [
  {
    merchant: 'Amazon',
    card_number: '1234-5678-9012-3456',
    amount: 50.00,
    notes: 'Birthday gift',
  },
  {
    merchant: 'Starbucks',
    card_number: '2345-6789-0123-4567',
    amount: 25.00,
    notes: 'Coffee gift card',
  },
  {
    merchant: 'Target',
    card_number: '3456-7890-1234-5678',
    amount: 100.00,
    notes: 'Holiday shopping',
  },
  {
    merchant: 'Amazon',
    card_number: '4567-8901-2345-6789',
    amount: 30.00,
    notes: 'Another Amazon card',
  },
];

export const testPeople = [
  {
    name: 'John Smith',
    address: '123 Main St, Anytown, USA',
    birthday: '1990-01-15',
    anniversary: '2015-06-20',
  },
  {
    name: 'Jane Doe',
    address: '456 Oak Ave, Someplace, USA',
    birthday: '1992-03-22',
  },
  {
    name: 'Peter Jones',
    address: '789 Pine Ln, Elsewhere, USA',
    anniversary: '2010-09-05',
  },
];

/**
 * Test grocery items
 */
export const testGroceryItems = [
  { name: 'Milk', notes: '2% organic', category: 'Dairy & Eggs' },
  { name: 'Apples', notes: 'Honeycrisp', category: 'Produce' },
  { name: 'Chicken Breast', notes: '2 lbs', category: 'Meat & Seafood' },
  { name: 'Bread', notes: 'Whole wheat', category: 'Bakery' },
  { name: 'Yogurt', notes: 'Greek yogurt', category: 'Dairy & Eggs' },
  { name: 'Bananas', category: 'Produce' },
  { name: 'Cereal', category: 'Pantry & Canned Goods' },
];
