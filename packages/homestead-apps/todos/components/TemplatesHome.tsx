import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ListPlus, Loader2, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@rambleraptor/homestead-core/shared/lib/utils';
import { PageHeader } from '@rambleraptor/homestead-core/shared/components/PageHeader';
import { ConfirmDialog } from '@rambleraptor/homestead-core/shared/components/ConfirmDialog';
import { useListTemplates } from '../hooks/useListTemplates';
import { useCreateListTemplate } from '../hooks/useCreateListTemplate';
import { useDeleteListTemplate } from '../hooks/useDeleteListTemplate';
import { useTemplateItems } from '../hooks/useTemplateItems';
import { useCreateTemplateItem } from '../hooks/useCreateTemplateItem';
import { useDeleteTemplateItem } from '../hooks/useDeleteTemplateItem';
import { useInstantiateTemplate } from '../hooks/useInstantiateTemplate';
import type { ListTemplate } from '../types';

export function TemplatesHome() {
  const templatesQuery = useListTemplates();
  const createTemplate = useCreateListTemplate();
  const [draftName, setDraftName] = useState('');

  const templates = templatesQuery.data ?? [];

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const name = draftName.trim();
    if (!name) return;
    await createTemplate.mutateAsync({ name });
    setDraftName('');
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="space-y-4">
        <Link
          to="/todos"
          data-testid="templates-back"
          className="inline-flex items-center gap-1 text-sm font-body text-text-muted hover:text-accent-terracotta transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to todos
        </Link>
        <PageHeader
          title="List Templates"
          subtitle="Save a reusable checklist, then spin up a new list from it in one click."
        />
      </div>

      <form
        onSubmit={handleCreate}
        className={cn(
          'flex items-center gap-2 bg-surface-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3',
          'focus-within:border-accent-terracotta focus-within:ring-2 focus-within:ring-accent-terracotta/20',
          'transition-colors',
        )}
      >
        <input
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder="New template name"
          aria-label="New template name"
          disabled={createTemplate.isPending}
          data-testid="templates-add-input"
          className="flex-1 bg-transparent outline-none font-body text-base text-text-main placeholder:text-text-muted"
        />
        <button
          type="submit"
          disabled={createTemplate.isPending || draftName.trim() === ''}
          aria-label="Add template"
          data-testid="templates-add-submit"
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-full',
            'bg-accent-terracotta text-white shadow-sm',
            'hover:bg-accent-terracotta-hover transition-colors',
            'disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        >
          <Plus className="w-5 h-5" />
        </button>
      </form>

      {templatesQuery.isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-accent-terracotta animate-spin" />
        </div>
      )}

      {templatesQuery.isError && (
        <div className="bg-red-50/50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-700">
            {templatesQuery.error instanceof Error
              ? templatesQuery.error.message
              : 'Failed to load templates'}
          </p>
        </div>
      )}

      {!templatesQuery.isLoading && !templatesQuery.isError && (
        <div className="space-y-4" data-testid="templates-list">
          {templates.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-6 text-center">
              <p className="text-sm text-text-muted font-body italic">
                No templates yet — name one above to get started.
              </p>
            </div>
          ) : (
            templates.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TemplateCard({ template }: { template: ListTemplate }) {
  const navigate = useNavigate();
  const itemsQuery = useTemplateItems(template.id);
  const createItem = useCreateTemplateItem();
  const deleteItem = useDeleteTemplateItem();
  const deleteTemplate = useDeleteListTemplate();
  const instantiate = useInstantiateTemplate();
  const [draftItem, setDraftItem] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const items = itemsQuery.data ?? [];

  const handleAddItem = async (event: FormEvent) => {
    event.preventDefault();
    const title = draftItem.trim();
    if (!title) return;
    await createItem.mutateAsync({ templateId: template.id, title });
    setDraftItem('');
  };

  const handleCreateList = async () => {
    const project = await instantiate.mutateAsync({
      templateId: template.id,
      name: template.name,
    });
    navigate('/todos', { state: { scope: project.id } });
  };

  return (
    <div
      data-testid={`template-card-${template.id}`}
      className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <h2 className="flex-1 font-display text-lg text-brand-navy truncate">
          {template.name}
        </h2>
        <button
          type="button"
          onClick={handleCreateList}
          disabled={instantiate.isPending || items.length === 0}
          aria-label={`Create a list from ${template.name}`}
          data-testid={`template-card-${template.id}-instantiate`}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-body',
            'bg-accent-terracotta text-white hover:bg-accent-terracotta-hover transition-colors',
            'disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        >
          <ListPlus className="w-4 h-4" />
          Create list
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={deleteTemplate.isPending}
          aria-label={`Delete template ${template.name}`}
          data-testid={`template-card-${template.id}-delete`}
          className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-40"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <ul className="divide-y divide-gray-100" data-testid={`template-card-${template.id}-items`}>
        {items.length === 0 ? (
          <li className="px-4 py-3 text-sm text-text-muted font-body italic">
            No items yet — add one below.
          </li>
        ) : (
          items.map((item) => (
            <li
              key={item.id}
              data-testid={`template-item-${item.id}`}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <span className="flex-1 font-body text-base text-text-main">
                {item.title}
              </span>
              <button
                type="button"
                onClick={() =>
                  deleteItem.mutate({ templateId: template.id, itemId: item.id })
                }
                disabled={deleteItem.isPending}
                aria-label={`Remove ${item.title}`}
                data-testid={`template-item-${item.id}-delete`}
                className="p-1.5 rounded-lg text-text-muted hover:bg-red-500/10 hover:text-red-500 transition-colors disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </li>
          ))
        )}
      </ul>

      <form
        onSubmit={handleAddItem}
        className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-bg-pearl/40"
      >
        <input
          type="text"
          value={draftItem}
          onChange={(e) => setDraftItem(e.target.value)}
          placeholder="Add an item"
          aria-label={`Add an item to ${template.name}`}
          disabled={createItem.isPending}
          data-testid={`template-card-${template.id}-item-input`}
          className="flex-1 bg-transparent outline-none font-body text-base text-text-main placeholder:text-text-muted"
        />
        <button
          type="submit"
          disabled={createItem.isPending || draftItem.trim() === ''}
          aria-label="Add item"
          data-testid={`template-card-${template.id}-item-submit`}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full',
            'bg-brand-navy text-white hover:bg-brand-navy/90 transition-colors',
            'disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteTemplate.mutateAsync(template.id);
          setConfirmDelete(false);
        }}
        title="Delete template"
        message={`Delete "${template.name}" and its items? Lists already created from it are unaffected.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={deleteTemplate.isPending}
      />
    </div>
  );
}
