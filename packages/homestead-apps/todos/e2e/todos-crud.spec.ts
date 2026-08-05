/**
 * Todos app E2E tests
 *
 * Uses `adminToken` + `authenticatedAdminPage` so the persistent superuser
 * session survives the whole worker (matches the recipes spec rationale).
 */

import { test } from '../../../../tests/e2e/fixtures/aepbase.fixture';
import { TodosPage } from './TodosPage';
import {
  createTodo,
  deleteAllPersonalTodos,
  deleteAllTodos,
} from './helpers';

test.describe('Todos CRUD', () => {
  let todosPage: TodosPage;

  test.beforeEach(async ({ adminToken, adminCreds, authenticatedAdminPage }) => {
    await deleteAllTodos(adminToken);
    await deleteAllPersonalTodos(adminToken, adminCreds.id);
    todosPage = new TodosPage(authenticatedAdminPage);
    await todosPage.goto();
  });

  test.afterEach(async ({ adminToken, adminCreds }) => {
    await deleteAllTodos(adminToken);
    await deleteAllPersonalTodos(adminToken, adminCreds.id);
  });

  test('adds a new todo via the inline input', async () => {
    await todosPage.addTodo('Buy milk');
    await todosPage.expectInActive('Buy milk');
    await todosPage.expectGreenSegmentZero();
  });

  test('adds a personal todo by default (no family marker)', async () => {
    await todosPage.addPersonalTodo('Solo task');
    await todosPage.expectInActive('Solo task');
    await todosPage.expectNoFamilyMarker('Solo task');
  });

  test('adds a family todo via the family button (shows 👪 marker)', async () => {
    await todosPage.addFamilyTodo('Shared task');
    await todosPage.expectInActive('Shared task');
    await todosPage.expectFamilyMarker('Shared task');
  });

  test('marks a todo complete and shows it under Completed', async ({ adminToken }) => {
    await createTodo(adminToken, { title: 'Pay rent' });
    await todosPage.goto();

    await todosPage.markComplete('Pay rent');
    await todosPage.expectInCompleted('Pay rent');
    await todosPage.expectGreenSegmentNonZero();
  });

  test('moves a todo to Do Later', async ({ adminToken }) => {
    await createTodo(adminToken, { title: 'Book flights' });
    await todosPage.goto();

    await todosPage.moveToDoLater('Book flights');
    await todosPage.expectInDoLater('Book flights');
  });
});
