/**
 * Generic, schema-driven form for an aepbase resource. Give it a resource's
 * `fields` map (usually `resourceDef.fields`), optional initial values, and an
 * `onSubmit`; it renders one control per field via {@link FieldInput},
 * enforces `required`, and hands back the collected values.
 *
 * It fills the gap called out in `FieldDef`'s docs: the reference annotation is
 * already machine-readable and consumed server-side, but nothing turned it
 * into UI — here a `reference` field becomes a live record picker.
 *
 * Deliberately unopinionated about persistence: `onSubmit` receives the raw
 * values map (reference ids as strings/arrays, file fields as `File` objects)
 * so a caller can drop it straight into its existing create/update mutation.
 * {@link buildResourceRequestBody} turns that map into the `FormData`-or-JSON
 * body `aepbase.create`/`update` expect.
 */

import { useMemo, useState } from 'react';
import { Button } from '@rambleraptor/homestead-core/shared/components/Button';
import type { FieldDef } from '@rambleraptor/homestead-core/resources/types';
import { FieldInput, fieldLabel, isRenderableField } from './FieldInput';

export type ResourceFormValues = Record<string, unknown>;

export interface ResourceFormProps {
  /** The resource's fields, keyed by snake_case name — e.g. `resourceDef.fields`. */
  fields: Record<string, FieldDef>;
  /** Prefilled values (edit mode). Omitted fields start empty / at their default. */
  initialValues?: ResourceFormValues;
  onSubmit: (values: ResourceFormValues) => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  /**
   * Field names to leave out of the form — typically server-managed ones like
   * `created_by`. Excluded fields are neither rendered nor validated nor
   * returned.
   */
  exclude?: string[];
  /** Explicit field order; unlisted fields follow in declaration order. */
  order?: string[];
  disabled?: boolean;
  /** A submit-level error to show above the buttons (e.g. a failed request). */
  error?: string;
  /** data-testid for the <form>; the submit button gets `${testId}-submit`. */
  testId?: string;
}

/** Whether a value counts as "provided" for a required-field check. */
function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Seed form state from initial values, applying declared defaults. */
function seedValues(
  fields: Record<string, FieldDef>,
  names: string[],
  initial: ResourceFormValues,
): ResourceFormValues {
  const out: ResourceFormValues = {};
  for (const name of names) {
    if (name in initial) {
      out[name] = initial[name];
    } else if (fields[name]?.default !== undefined) {
      out[name] = fields[name].default;
    }
  }
  return out;
}

export function ResourceForm({
  fields,
  initialValues = {},
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  exclude = [],
  order,
  disabled = false,
  error,
  testId = 'resource-form',
}: ResourceFormProps) {
  // Fields to render: renderable, not excluded, in the requested order.
  const names = useMemo(() => {
    const excluded = new Set(exclude);
    const all = Object.keys(fields).filter(
      (n) => !excluded.has(n) && isRenderableField(fields[n]),
    );
    if (!order) return all;
    const ordered = order.filter((n) => all.includes(n));
    const rest = all.filter((n) => !ordered.includes(n));
    return [...ordered, ...rest];
  }, [fields, exclude, order]);

  const [values, setValues] = useState<ResourceFormValues>(() =>
    seedValues(fields, names, initialValues),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const setField = (name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {};
    for (const name of names) {
      if (fields[name].required && isEmpty(values[name])) {
        next[name] = `${fieldLabel(name, fields[name])} is required.`;
      }
    }
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || submitting) return;
    const found = validate();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  };

  const busy = disabled || submitting;

  return (
    <form onSubmit={handleSubmit} data-testid={testId} className="space-y-4" noValidate>
      {names.map((name) => (
        <FieldInput
          key={name}
          name={name}
          def={fields[name]}
          value={values[name]}
          onChange={(v) => setField(name, v)}
          disabled={busy}
          error={errors[name]}
          testId={`${testId}-${name}`}
        />
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={submitting}
            data-testid={`${testId}-cancel`}
          >
            {cancelLabel}
          </Button>
        )}
        <Button type="submit" disabled={busy} data-testid={`${testId}-submit`}>
          {submitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

/**
 * Turn a {@link ResourceForm} values map into the body `aepbase.create` /
 * `aepbase.update` accept. When any field holds a `File`, returns `FormData`
 * (multipart, the shape the engine's file fields need); otherwise a plain
 * JSON-ready object. `undefined` values are dropped so they don't overwrite
 * or clear server-side fields unintentionally.
 */
export function buildResourceRequestBody(
  values: ResourceFormValues,
): Record<string, unknown> | FormData {
  const hasFile = Object.values(values).some((v) => v instanceof File);
  if (!hasFile) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) {
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  const form = new FormData();
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined || v === null) continue;
    if (v instanceof File) {
      form.append(k, v);
    } else if (Array.isArray(v)) {
      // aepbase repeats the key for array values.
      for (const item of v) form.append(k, String(item));
    } else {
      form.append(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
  }
  return form;
}
