import { useState } from 'react';
import { Button } from '@rambleraptor/homestead-core/shared/components/Button';
import { Input } from '@rambleraptor/homestead-core/shared/components/Input';
import type { RoleInput, RoleRecord } from '../hooks';
import {
  GrantRowsEditor,
  cleanGrantDrafts,
  draftsFromGrants,
  newGrantDraft,
  validateGrantDrafts,
  type GrantDraft,
} from './GrantRowsEditor';

interface Props {
  initialRole?: RoleRecord;
  onSubmit: (data: RoleInput) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

/**
 * Create/edit a role: a name, an optional description, and a list of grant rows.
 * The grant rows are the shared {@link GrantRowsEditor}, so roles and personal
 * access tokens build permissions with the exact same controls. Empty
 * scope-specific fields are stripped on submit so an "all"-scope grant doesn't
 * carry a stray app or resource.
 */
export function RoleForm({ initialRole, onSubmit, onCancel, isSubmitting }: Props) {
  const isEdit = !!initialRole;

  const [name, setName] = useState(initialRole?.name ?? '');
  const [description, setDescription] = useState(initialRole?.description ?? '');
  const [grants, setGrants] = useState<GrantDraft[]>(draftsFromGrants(initialRole?.grants ?? []));
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
    const grantError = validateGrantDrafts(grants);
    if (grantError) {
      setError(grantError);
      return;
    }

    void onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      grants: cleanGrantDrafts(grants),
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

      <GrantRowsEditor
        grants={grants}
        onPatch={patchGrant}
        onRemove={removeGrant}
        onAdd={() => setGrants((gs) => [...gs, newGrantDraft()])}
        heading="Grants"
        addLabel="Add grant"
        addTestId="role-add-grant"
        rowsTestId="role-grants"
        emptyHint="No grants — this role confers no access until you add one."
        datalistId="role-resource-options"
      />

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
