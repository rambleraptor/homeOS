import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@rambleraptor/homestead-core/shared/components/Button';
import { Input } from '@rambleraptor/homestead-core/shared/components/Input';
import { getAllApps } from '@rambleraptor/homestead-core/apps/registry';
import type { AppConfig } from '@rambleraptor/homestead-core/apps/types';
import type { Capability, Effect } from '../resolve';
import type { RoleInput, RoleRecord } from '../hooks';

type Scope = 'all' | 'app' | 'collection';

interface GrantDraft {
  key: number;
  effect: Effect;
  capability: Capability;
  target_scope: Scope;
  target_app: string;
  resource_type: string;
  filter: string;
}

interface Props {
  initialRole?: RoleRecord;
  onSubmit: (data: RoleInput) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

let nextKey = 1;
function draft(over: Partial<GrantDraft> = {}): GrantDraft {
  return {
    key: nextKey++,
    effect: 'allow',
    capability: 'read',
    target_scope: 'collection',
    target_app: '',
    resource_type: '',
    filter: '',
    ...over,
  };
}

/** Walk the app registry (top-level + children) collecting ids and resource singulars. */
function collectAppsAndResources(): { appIds: string[]; resources: string[] } {
  const appIds = new Set<string>();
  const resources = new Set<string>();
  const visit = (app: AppConfig) => {
    appIds.add(app.id);
    // `resources` may be an array or a lazy thunk that returns one.
    const defs = typeof app.resources === 'function' ? app.resources() : app.resources ?? [];
    for (const r of defs) resources.add(r.singular);
    for (const child of app.children ?? []) visit(child);
  };
  for (const app of getAllApps()) visit(app);
  return {
    appIds: [...appIds].sort(),
    resources: [...resources].sort(),
  };
}

const selectClass =
  'rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-terracotta';

/**
 * Create/edit a role: a name, an optional description, and a list of grant rows.
 * Each grant is `capability` × `scope` (all / an app / a collection, with an
 * optional filter for collection scope) — the same shape a role stores. Empty
 * scope-specific fields are stripped on submit so an "all"-scope grant doesn't
 * carry a stray app or resource.
 */
export function RoleForm({ initialRole, onSubmit, onCancel, isSubmitting }: Props) {
  const isEdit = !!initialRole;
  const { appIds, resources } = useMemo(collectAppsAndResources, []);

  const [name, setName] = useState(initialRole?.name ?? '');
  const [description, setDescription] = useState(initialRole?.description ?? '');
  const [grants, setGrants] = useState<GrantDraft[]>(
    (initialRole?.grants ?? []).map((g) =>
      draft({
        effect: (g.effect as Effect) ?? 'allow',
        capability: (g.capability as Capability) ?? 'read',
        target_scope: (g.target_scope as Scope) ?? 'collection',
        target_app: g.target_app ?? '',
        resource_type: g.resource_type ?? '',
        filter: g.filter ?? '',
      }),
    ),
  );
  const [error, setError] = useState('');

  const patchGrant = (key: number, over: Partial<GrantDraft>) =>
    setGrants((gs) => gs.map((g) => (g.key === key ? { ...g, ...over } : g)));
  const removeGrant = (key: number) => setGrants((gs) => gs.filter((g) => g.key !== key));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    for (const g of grants) {
      if (g.target_scope === 'app' && !g.target_app) {
        setError('An app-scope grant needs an app');
        return;
      }
      if (g.target_scope === 'collection' && !g.resource_type.trim()) {
        setError('A collection-scope grant needs a resource');
        return;
      }
    }

    // Only stamp effect for a deny; the wire schema defaults to allow, so an
    // allow grant stays byte-identical to the pre-deny payload.
    const cleaned = grants.map((g) => {
      const eff = g.effect === 'deny' ? { effect: 'deny' as const } : {};
      if (g.target_scope === 'all') {
        return { target_scope: 'all' as const, capability: g.capability, ...eff };
      }
      if (g.target_scope === 'app') {
        return {
          target_scope: 'app' as const,
          target_app: g.target_app,
          capability: g.capability,
          ...eff,
        };
      }
      return {
        target_scope: 'collection' as const,
        resource_type: g.resource_type.trim(),
        capability: g.capability,
        ...(g.filter.trim() ? { filter: g.filter.trim() } : {}),
        ...eff,
      };
    });

    void onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      grants: cleaned,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm bg-red-50/20 text-red-600 rounded-md" data-testid="role-form-error">
          {error}
        </div>
      )}

      <Input
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Cook"
        data-testid="role-name-input"
        autoFocus
      />
      <Input
        label="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What can this role do?"
        data-testid="role-description-input"
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-900">Grants</span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setGrants((gs) => [...gs, draft()])}
            data-testid="role-add-grant"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add grant
          </Button>
        </div>

        {grants.length === 0 ? (
          <p className="text-sm text-gray-500">
            No grants — this role confers no access until you add one.
          </p>
        ) : (
          <ul className="space-y-2" data-testid="role-grants">
            {grants.map((g) => (
              <li key={g.key} className="flex flex-wrap items-center gap-2 rounded-md border border-gray-100 p-2">
                <select
                  className={selectClass}
                  value={g.effect}
                  onChange={(e) => patchGrant(g.key, { effect: e.target.value as Effect })}
                  aria-label="effect"
                >
                  <option value="allow">allow</option>
                  <option value="deny">deny</option>
                </select>
                <select
                  className={selectClass}
                  value={g.capability}
                  onChange={(e) => patchGrant(g.key, { capability: e.target.value as Capability })}
                  aria-label="capability"
                >
                  <option value="read">read</option>
                  <option value="write">write</option>
                  <option value="manage">manage</option>
                </select>
                <span className="text-sm text-gray-500">on</span>
                <select
                  className={selectClass}
                  value={g.target_scope}
                  onChange={(e) => patchGrant(g.key, { target_scope: e.target.value as Scope })}
                  aria-label="scope"
                >
                  <option value="all">everything</option>
                  <option value="app">an app</option>
                  <option value="collection">a collection</option>
                </select>

                {g.target_scope === 'app' && (
                  <select
                    className={selectClass}
                    value={g.target_app}
                    onChange={(e) => patchGrant(g.key, { target_app: e.target.value })}
                    aria-label="app"
                  >
                    <option value="">Select an app…</option>
                    {appIds.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))}
                  </select>
                )}

                {g.target_scope === 'collection' && (
                  <>
                    <input
                      className={selectClass}
                      list="role-resource-options"
                      value={g.resource_type}
                      onChange={(e) => patchGrant(g.key, { resource_type: e.target.value })}
                      placeholder="resource (e.g. recipe)"
                      aria-label="resource"
                    />
                    <input
                      className={`${selectClass} flex-1 min-w-[8rem]`}
                      value={g.filter}
                      onChange={(e) => patchGrant(g.key, { filter: e.target.value })}
                      placeholder="filter (optional, e.g. created_by == subject.id)"
                      aria-label="filter"
                    />
                  </>
                )}

                <button
                  type="button"
                  className="ml-auto text-gray-400 hover:text-red-600"
                  onClick={() => removeGrant(g.key)}
                  title="Remove grant"
                  aria-label="remove grant"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <datalist id="role-resource-options">
          {resources.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim() || isSubmitting} data-testid="role-submit">
          {isSubmitting ? 'Saving…' : isEdit ? 'Save' : 'Create role'}
        </Button>
      </div>
    </form>
  );
}
