/**
 * A drop-in `SchemaForm` widget for `reference: { resource: 'person' }` fields
 * that adds favorites: the current user's starred people float to the top of
 * the picker and each option carries a star toggle. It's the favorites-aware
 * counterpart to the built-in reference widget — opt in per field with
 * `fields: { <field>: { widget: PersonReferenceField, bare: true } }`.
 *
 * Handles both single (`type: 'string'`) and to-many (`type: 'array'`) person
 * references, matching how the built-in reference / reference-multi widgets
 * read and write `people/{id}` paths.
 */

import type { FieldWidget, FieldWidgetProps } from '@rambleraptor/homestead-core/shared/forms';
import { fieldLabel } from '@rambleraptor/homestead-core/shared/forms';
import { ReferenceField } from '@rambleraptor/homestead-core/shared/components/ReferenceField';
import { useFavorites } from '@rambleraptor/homestead-core/shared/favorites';

export const PersonReferenceField: FieldWidget = (p: FieldWidgetProps) => {
  const favorites = useFavorites('person');
  const collection = p.config?.collection ?? 'people';
  const multiple = p.field.type === 'array';

  const value = multiple
    ? Array.isArray(p.value)
      ? (p.value as string[])
      : []
    : typeof p.value === 'string' && p.value
      ? [p.value]
      : [];

  return (
    <ReferenceField
      collection={collection}
      multiple={multiple}
      value={value}
      onChange={(next) => p.onChange(multiple ? next : (next[0] ?? ''))}
      favoriteIds={favorites.favoriteIds}
      onToggleFavorite={favorites.toggle}
      labelField={p.config?.labelField}
      id={p.id}
      testId={p.testId}
      label={fieldLabel(p.name, p.field, p.config)}
      required={p.required}
      description={p.config?.help}
      error={p.error}
      placeholder={p.config?.placeholder}
      {...(p.config?.emptyMessage ? { emptyMessage: p.config.emptyMessage } : {})}
    />
  );
};
