import { useState, type FormEvent } from 'react';
import { Check, ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@rambleraptor/homestead-core/shared/lib/utils';
import type { Category } from '../types';
import { useCreateCategory } from '../hooks/useCreateCategory';
import { useUpdateCategory } from '../hooks/useUpdateCategory';
import { useDeleteCategory } from '../hooks/useDeleteCategory';

interface CategoryManagerProps {
  projectId: string;
  /** Categories in display order (already sorted by position). */
  categories: Category[];
}

/**
 * Compact per-project category manager: add, rename, reorder (move up/down),
 * and delete categories. Deleting a category leaves its todos in place — the
 * engine's `set-null` onDelete just makes them uncategorized.
 */
export function CategoryManager({ projectId, categories }: CategoryManagerProps) {
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const busy =
    createCategory.isPending ||
    updateCategory.isPending ||
    deleteCategory.isPending;

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    const name = draft.trim();
    if (!name) return;
    await createCategory.mutateAsync({
      projectId,
      name,
      position: categories.length,
    });
    setDraft('');
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setEditName(category.name);
  };

  const commitEdit = async () => {
    const name = editName.trim();
    if (editingId && name) {
      await updateCategory.mutateAsync({
        projectId,
        id: editingId,
        data: { name },
      });
    }
    setEditingId(null);
    setEditName('');
  };

  // Swap a category with its neighbor by exchanging stored positions, so
  // ordering stays correct even if positions have gaps.
  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= categories.length) return;
    const a = categories[index];
    const b = categories[target];
    const posA = a.position ?? index;
    const posB = b.position ?? target;
    await Promise.all([
      updateCategory.mutateAsync({ projectId, id: a.id, data: { position: posB } }),
      updateCategory.mutateAsync({ projectId, id: b.id, data: { position: posA } }),
    ]);
  };

  return (
    <div
      data-testid="todos-category-manager"
      className="rounded-2xl border border-gray-200 bg-surface-white shadow-sm"
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100">
        <h3 className="flex-1 font-display text-sm font-semibold text-brand-navy">
          Categories
        </h3>
      </div>

      {categories.length > 0 && (
        <ul className="divide-y divide-gray-100" data-testid="todos-category-list">
          {categories.map((category, index) => {
            const isEditing = editingId === category.id;
            return (
              <li
                key={category.id}
                data-testid={`todos-category-item-${category.id}`}
                className="flex items-center gap-2 px-4 py-2"
              >
                {isEditing ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void commitEdit();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    aria-label={`Rename ${category.name}`}
                    data-testid={`todos-category-item-${category.id}-name-input`}
                    autoFocus
                    className="flex-1 bg-transparent outline-none font-body text-sm text-text-main border-b border-accent-terracotta/40"
                  />
                ) : (
                  <span className="flex-1 font-body text-sm text-text-main truncate">
                    {category.name}
                  </span>
                )}

                {isEditing ? (
                  <button
                    type="button"
                    onClick={() => void commitEdit()}
                    disabled={busy || editName.trim() === ''}
                    aria-label="Save name"
                    data-testid={`todos-category-item-${category.id}-save`}
                    className="p-1.5 rounded-lg text-green-600 hover:bg-green-500/10 transition-colors disabled:opacity-40"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={busy || index === 0}
                      aria-label={`Move ${category.name} up`}
                      data-testid={`todos-category-item-${category.id}-up`}
                      className="p-1.5 rounded-lg text-text-muted hover:bg-brand-navy/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={busy || index === categories.length - 1}
                      aria-label={`Move ${category.name} down`}
                      data-testid={`todos-category-item-${category.id}-down`}
                      className="p-1.5 rounded-lg text-text-muted hover:bg-brand-navy/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(category)}
                      disabled={busy}
                      aria-label={`Rename ${category.name}`}
                      data-testid={`todos-category-item-${category.id}-edit`}
                      className="p-1.5 rounded-lg text-text-muted hover:bg-brand-navy/10 transition-colors disabled:opacity-40"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        deleteCategory.mutate({ projectId, id: category.id })
                      }
                      disabled={busy}
                      aria-label={`Delete category ${category.name}`}
                      data-testid={`todos-category-item-${category.id}-delete`}
                      className="p-1.5 rounded-lg text-text-muted hover:bg-red-500/10 hover:text-red-500 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form
        onSubmit={handleAdd}
        className="flex items-center gap-2 px-4 py-2.5 border-t border-gray-100 bg-bg-pearl/40"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a category"
          aria-label="Add a category"
          disabled={createCategory.isPending}
          data-testid="todos-category-add-input"
          className="flex-1 bg-transparent outline-none font-body text-sm text-text-main placeholder:text-text-muted"
        />
        <button
          type="submit"
          disabled={createCategory.isPending || draft.trim() === ''}
          aria-label="Add category"
          data-testid="todos-category-add-submit"
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full',
            'bg-brand-navy text-white hover:bg-brand-navy/90 transition-colors',
            'disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
