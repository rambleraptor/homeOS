/**
 * Labeled resource-reference form field.
 *
 * A thin form-field wrapper around {@link ReferenceSelect}: it adds the chrome
 * every form needs around the raw picker — a label, an optional required
 * marker, help text, and an error line — while delegating the actual
 * searchable combobox to `ReferenceSelect`. Use it wherever a form needs to
 * pick a record of another collection to store in a `reference` field, so the
 * label + picker markup isn't re-hand-rolled per app.
 *
 * Value shape mirrors `ReferenceSelect`: `{collection}/{id}` paths, held as a
 * 0-or-1 array for single-select and a longer array with `multiple`.
 */

import {
  ReferenceSelect,
  type ReferenceSelectProps,
} from '@rambleraptor/homestead-core/shared/components/ReferenceSelect';

export interface ReferenceFieldProps extends ReferenceSelectProps {
  /** Field label shown above the picker. */
  label: string;
  /** Show the required marker and mark the control required for a11y. */
  required?: boolean;
  /** Optional help text rendered under the label. */
  description?: string;
  /** Validation error rendered under the picker. */
  error?: string;
}

export function ReferenceField({
  label,
  required = false,
  description,
  error,
  id,
  ...selectProps
}: ReferenceFieldProps) {
  const describedBy = description && id ? `${id}-description` : undefined;
  const errorId = error && id ? `${id}-error` : undefined;

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {description && (
        <p id={describedBy} className="text-sm text-gray-500 mb-1">
          {description}
        </p>
      )}
      <ReferenceSelect id={id} {...selectProps} />
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
