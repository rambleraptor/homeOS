/**
 * List templates within the todos app — covers managing a template and its
 * items on the dedicated page, and instantiating a template into a new
 * project pre-filled with its items (from both the templates page and the
 * project switcher's "From template" picker).
 */

import { test } from '../../../../tests/e2e/fixtures/aepbase.fixture';
import { TodosPage } from './TodosPage';
import { TemplatesPage } from './TemplatesPage';
import {
  addTemplateItem,
  createListTemplate,
  deleteAllListTemplates,
  deleteAllProjects,
  deleteAllTodos,
} from './helpers';

test.describe('Todos list templates', () => {
  let todosPage: TodosPage;
  let templatesPage: TemplatesPage;

  test.beforeEach(async ({ adminToken, authenticatedAdminPage }) => {
    await deleteAllTodos(adminToken);
    await deleteAllProjects(adminToken);
    await deleteAllListTemplates(adminToken);
    todosPage = new TodosPage(authenticatedAdminPage);
    templatesPage = new TemplatesPage(authenticatedAdminPage);
  });

  test.afterEach(async ({ adminToken }) => {
    await deleteAllTodos(adminToken);
    await deleteAllProjects(adminToken);
    await deleteAllListTemplates(adminToken);
  });

  test('creates a template and manages its items on the templates page', async () => {
    await templatesPage.goto();
    await templatesPage.createTemplate('Camping Trip');

    await templatesPage.addItem('Camping Trip', 'Pack tent');
    await templatesPage.addItem('Camping Trip', 'Buy firewood');
    await templatesPage.expectItem('Camping Trip', 'Pack tent');
    await templatesPage.expectItem('Camping Trip', 'Buy firewood');

    await templatesPage.removeItem('Camping Trip', 'Buy firewood');
    await templatesPage.expectItemAbsent('Camping Trip', 'Buy firewood');
    await templatesPage.expectItem('Camping Trip', 'Pack tent');
  });

  test('instantiates a template into a new list from the templates page', async ({
    adminToken,
  }) => {
    const template = await createListTemplate(adminToken, {
      name: 'Camping Trip',
    });
    await addTemplateItem(adminToken, template.id, 'Pack tent');
    await addTemplateItem(adminToken, template.id, 'Buy firewood');

    await templatesPage.goto();
    await templatesPage.createListFrom('Camping Trip');

    // Lands on the new list with every template item as an active todo.
    await todosPage.expectInActive('Pack tent');
    await todosPage.expectInActive('Buy firewood');
  });

  test('instantiates a template from the project switcher picker', async ({
    adminToken,
  }) => {
    const template = await createListTemplate(adminToken, {
      name: 'Weekly Chores',
    });
    await addTemplateItem(adminToken, template.id, 'Vacuum');
    await addTemplateItem(adminToken, template.id, 'Laundry');

    await todosPage.goto();
    await todosPage.createListFromTemplate('Weekly Chores');

    await todosPage.expectInActive('Vacuum');
    await todosPage.expectInActive('Laundry');
  });

  test('deletes a template', async () => {
    await templatesPage.goto();
    await templatesPage.createTemplate('One Off');
    await templatesPage.deleteTemplate('One Off');
    await templatesPage.expectTemplateAbsent('One Off');
  });
});
