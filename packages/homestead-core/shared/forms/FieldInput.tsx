/**
 * Renders a single form control for one `FieldDef`, dispatching on the
 * field's declared shape. This is the switchboard the generic `ResourceForm`
 * maps over; it is the client-side mirror of the wire translation in
 * `resources/translate.ts` — same authoring metadata, rendered as inputs
 * instead of JSON schema.
 *
 * Coverage (the common field set):
 *   - reference (string)           → single {@link ReferencePicker}
 *   - array of reference (items)   → multi {@link ReferencePicker}
 *   - enum (string)                → native <select>
 *   - array of string (plain)      → {@link TagInput}
 *   - boolean                      → {@link Checkbox}
 *   - number / integer             → numeric <Input>
 *   - string, format date-time     → date / datetime-local <Input>
 *   - string                       → text <Input>
 *   - file                         → file <input> (value is a File)
 *
 * Nested `object` fields and tagged-union `variants` are intentionally not
 * rendered yet; `ResourceForm` filters them out before it reaches this
 * component (see {@link isRenderableField}).
 */

import { Input } from '@rambleraptor/homestead-core/shared/components/Input';
import { Checkbox } from '@rambleraptor/homestead-core/shared/components/Checkbox';
import { TagInput } from '@rambleraptor/homestead-core/shared/components/TagInput';
import type { FieldDef } from '@rambleraptor/homestead-core/resources/types';
import { ReferencePicker } from './ReferencePicker';

/** Turn a snake_case field name into a Title Case label. */
export function humanizeFieldName(name: string): string {
  return name
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Display label for a field: explicit `singular_name`, else the humanized key. */
export function fieldLabel(name: string, def: FieldDef): string {
  return def.singular_name ?? humanizeFieldName(name);
}

/**
 * Whether the generic form knows how to render this field. Nested `object`
 * fields, tagged-union `variants`, and arrays of non-strings fall outside the
 * common set and are skipped by `ResourceForm`.
 */
export function isRenderableField(def: FieldDef): boolean {
  if (def.type === 'object' || def.variants) return false;
  if (def.type === 'array') {
    // Only arrays of strings (plain, enum, or reference) are handled.
    return (def.items?.type ?? 'string') === 'string';
  }
  return true;
}

export interface FieldInputProps {
  name: string;
  def: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  error?: string;
  /** data-testid for the control (wrapper for pickers, input otherwise). */
  testId?: string;
}

const LABEL_CLASS = 'block text-sm font-medium text-gray-900 mb-1';
const DESC_CLASS = 'mt-1 text-xs text-gray-500';

/** Wraps a control with a label (+ required marker) and description. */
function Labelled({
  htmlFor,
  label,
  required,
  description,
  error,
  children,
}: {
  htmlFor?: string;
  label: string;
  required?: boolean;
  description?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={LABEL_CLASS}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {description && <p className={DESC_CLASS}>{description}</p>}
    </div>
  );
}

export function FieldInput({
  name,
  def,
  value,
  onChange,
  disabled,
  error,
  testId,
}: FieldInputProps) {
  const label = fieldLabel(name, def);
  const fieldId = testId ?? `field-${name}`;

  // --- References (single + to-many) ------------------------------------
  if (def.reference) {
    return (
      <Labelled label={label} required={def.required} description={def.description} error={error}>
        <ReferencePicker
          resource={def.reference.resource}
          value={value as string | undefined}
          onChange={onChange}
          required={def.required}
          disabled={disabled}
          testId={fieldId}
        />
      </Labelled>
    );
  }
  if (def.type === 'array' && def.items?.reference) {
    return (
      <Labelled label={label} required={def.required} description={def.description} error={error}>
        <ReferencePicker
          resource={def.items.reference.resource}
          value={(value as string[] | undefined) ?? []}
          onChange={onChange}
          multiple
          required={def.required}
          disabled={disabled}
          testId={fieldId}
        />
      </Labelled>
    );
  }

  // --- Array of plain strings -> tag input -------------------------------
  if (def.type === 'array') {
    return (
      <Labelled label={label} required={def.required} description={def.description} error={error}>
        <TagInput
          id={fieldId}
          value={(value as string[] | undefined) ?? []}
          onChange={(next) => onChange(next)}
          disabled={disabled}
          testId={fieldId}
        />
      </Labelled>
    );
  }

  // --- Enum -> native select ---------------------------------------------
  if (def.enum) {
    return (
      <Labelled
        htmlFor={fieldId}
        label={label}
        required={def.required}
        description={def.description}
        error={error}
      >
        <select
          id={fieldId}
          value={(value as string | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          disabled={disabled}
          data-testid={testId}
          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-accent-terracotta focus:outline-none focus:ring-1 focus:ring-accent-terracotta disabled:opacity-50"
        >
          <option value="">{def.required ? 'Select…' : '—'}</option>
          {def.enum.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </Labelled>
    );
  }

  // --- Boolean -> checkbox -----------------------------------------------
  if (def.type === 'boolean') {
    return (
      <div className="flex items-start gap-3">
        <Checkbox
          id={fieldId}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(Boolean(checked))}
          disabled={disabled}
          data-testid={testId}
        />
        <div>
          <label htmlFor={fieldId} className="text-sm font-medium text-gray-900 cursor-pointer">
            {label}
          </label>
          {def.description && <p className="text-xs text-gray-500">{def.description}</p>}
        </div>
      </div>
    );
  }

  // --- Number / integer --------------------------------------------------
  if (def.type === 'number' || def.type === 'integer') {
    return (
      <Labelled
        htmlFor={fieldId}
        label={label}
        required={def.required}
        description={def.description}
        error={error}
      >
        <Input
          id={fieldId}
          type="number"
          step={def.type === 'integer' ? '1' : 'any'}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') {
              onChange(undefined);
              return;
            }
            const n = Number(raw);
            if (Number.isFinite(n)) onChange(n);
          }}
          disabled={disabled}
          data-testid={testId}
        />
      </Labelled>
    );
  }

  // --- File --------------------------------------------------------------
  if (def.type === 'file') {
    const current = value as File | undefined;
    return (
      <Labelled
        htmlFor={fieldId}
        label={label}
        required={def.required}
        description={def.description}
        error={error}
      >
        <input
          id={fieldId}
          type="file"
          disabled={disabled}
          data-testid={testId}
          onChange={(e) => onChange(e.target.files?.[0])}
          className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-gray-200"
        />
        {current && (
          <p className="mt-1 text-xs text-gray-500">Selected: {current.name}</p>
        )}
      </Labelled>
    );
  }

  // --- String (date-time or plain text) ----------------------------------
  const inputType = def.format === 'date-time' ? 'datetime-local' : def.format === 'date' ? 'date' : 'text';
  return (
    <Labelled
      htmlFor={fieldId}
      label={label}
      required={def.required}
      description={def.description}
      error={error}
    >
      <Input
        id={fieldId}
        type={inputType}
        value={(value as string | undefined) ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        disabled={disabled}
        data-testid={testId}
      />
    </Labelled>
  );
}
