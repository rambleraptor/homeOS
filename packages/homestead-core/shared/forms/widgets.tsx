/**
 * Built-in field widgets and the `FieldFrame` chrome (label / required marker /
 * help text / error line) that wraps every non-`bare` field. Custom overrides
 * receive the same {@link FieldWidgetProps} and, unless `bare`, the same frame.
 */

import type { ReactNode } from 'react';
import { ReferenceField } from '../components/ReferenceField';
import { TagInput } from '../components/TagInput';
import { fileField } from './FileField';
import { fieldLabel, humanize } from './helpers';
import type { FieldWidget, FieldWidgetProps, WidgetName } from './types';

const INPUT =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent-terracotta focus:border-accent-terracotta';

export function FieldFrame({
  id,
  label,
  required,
  help,
  error,
  hideLabel,
  helpId,
  errorId,
  children,
}: {
  id: string;
  label: string;
  required: boolean;
  help?: string;
  error?: string;
  hideLabel?: boolean;
  /** Ids stamped on the help/error text so the control's `aria-describedby`
   *  can point at them. */
  helpId?: string;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <div className="w-full">
      {!hideLabel && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && (
            <span className="text-red-500" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
      )}
      {help && (
        <p id={helpId} className="text-sm text-gray-500 mb-1">
          {help}
        </p>
      )}
      {children}
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

// `required` is conveyed via `aria-required` (not the native `required`
// attribute) so our JS validation — which produces the inline messages
// screen readers reach through `aria-describedby` — is the single, consistent
// validation path rather than being pre-empted by native browser bubbles.
const commonProps = (p: FieldWidgetProps) => ({
  id: p.id,
  disabled: p.disabled,
  autoFocus: p.autoFocus,
  'data-testid': p.testId,
  'aria-required': p.required || undefined,
  'aria-invalid': p.error ? true : undefined,
  'aria-describedby': p.describedBy,
});

function TextWidget(p: FieldWidgetProps) {
  return (
    <input
      {...commonProps(p)}
      type="text"
      value={(p.value as string) ?? ''}
      onChange={(e) => p.onChange(e.target.value)}
      placeholder={p.config?.placeholder}
      maxLength={p.field.maxLength}
      className={INPUT}
    />
  );
}

function TextareaWidget(p: FieldWidgetProps) {
  return (
    <textarea
      {...commonProps(p)}
      rows={2}
      value={(p.value as string) ?? ''}
      onChange={(e) => p.onChange(e.target.value)}
      placeholder={p.config?.placeholder}
      className={INPUT}
    />
  );
}

function NumberWidget(p: FieldWidgetProps) {
  const raw = p.value === '' || p.value === undefined ? '' : (p.value as number);
  return (
    <input
      {...commonProps(p)}
      type="number"
      value={raw}
      min={p.field.minimum}
      max={p.field.maximum}
      step={p.field.multipleOf}
      onChange={(e) => p.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
      placeholder={p.config?.placeholder}
      className={INPUT}
    />
  );
}

function CurrencyWidget(p: FieldWidgetProps) {
  const raw = p.value === '' || p.value === undefined ? '' : (p.value as number);
  return (
    <div className="relative">
      <span className="absolute left-3 top-2 text-gray-500">$</span>
      <input
        {...commonProps(p)}
        type="number"
        value={raw}
        min={p.field.minimum ?? 0}
        max={p.field.maximum}
        step={p.field.multipleOf ?? 0.01}
        onChange={(e) => p.onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
        placeholder={p.config?.placeholder}
        className={`${INPUT} pl-7`}
      />
    </div>
  );
}

function DateWidget(p: FieldWidgetProps) {
  return (
    <input
      {...commonProps(p)}
      type="date"
      value={(p.value as string) ?? ''}
      onChange={(e) => p.onChange(e.target.value)}
      className={INPUT}
    />
  );
}

function SelectWidget(p: FieldWidgetProps) {
  const options = p.field.enum ?? [];
  return (
    <select
      {...commonProps(p)}
      value={(p.value as string) ?? ''}
      onChange={(e) => p.onChange(e.target.value)}
      className={INPUT}
    >
      {!p.required && <option value="">Select…</option>}
      {options.map((v) => (
        <option key={v} value={v}>
          {p.config?.enumLabels?.[v] ?? humanize(v)}
        </option>
      ))}
    </select>
  );
}

function CheckboxWidget(p: FieldWidgetProps) {
  return (
    <label className="flex items-center gap-2">
      <input
        id={p.id}
        data-testid={p.testId}
        type="checkbox"
        checked={!!p.value}
        disabled={p.disabled}
        onChange={(e) => p.onChange(e.target.checked)}
        className="w-4 h-4 text-accent-terracotta border-gray-300 rounded focus:ring-accent-terracotta"
      />
      <span className="text-sm font-medium text-gray-700">
        {fieldLabel(p.name, p.field, p.config)}
      </span>
    </label>
  );
}

/** Default file widget: the shared FileField with permissive, unconfigured
 *  limits. A form that needs a specific accept/size or an image preview passes
 *  its own `fileField({...})` via `config.widget`. Self-chromed. */
const DefaultFileWidget = fileField({
  accept: '',
  maxSizeBytes: 25 * 1024 * 1024,
  preview: 'auto',
});

/** Naive singular→plural guess for a reference target; override via
 *  `config.collection` for irregular plurals (person → people). */
function guessCollection(singular: string): string {
  return `${singular}s`;
}

function ReferenceWidget(p: FieldWidgetProps) {
  // Selections are stored as `{collection}/{id}` paths — the shape the engine
  // and existing data use — so the value round-trips through ReferenceField
  // (which is also path-based) without translation.
  const collection = p.config?.collection ?? guessCollection(p.field.reference?.resource ?? '');
  const path = typeof p.value === 'string' && p.value ? p.value : '';
  return (
    <ReferenceField
      collection={collection}
      value={path ? [path] : []}
      onChange={(next) => p.onChange(next[0] ?? '')}
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
}

function ReferenceMultiWidget(p: FieldWidgetProps) {
  const singular = p.field.items?.reference?.resource ?? '';
  const collection = p.config?.collection ?? guessCollection(singular);
  const paths = Array.isArray(p.value) ? (p.value as string[]) : [];
  return (
    <ReferenceField
      collection={collection}
      multiple
      value={paths}
      onChange={(next) => p.onChange(next)}
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
}

function TagsWidget(p: FieldWidgetProps) {
  return (
    <TagInput
      id={p.id}
      testId={p.testId}
      value={Array.isArray(p.value) ? (p.value as string[]) : []}
      onChange={(next) => p.onChange(next)}
      placeholder={p.config?.placeholder}
      disabled={p.disabled}
    />
  );
}

/** Widgets that render their own label/error chrome — the frame must not. */
export const SELF_CHROMED: ReadonlySet<WidgetName> = new Set([
  'reference',
  'reference-multi',
  'file',
]);

/** Widgets that supply their own inline label (the frame hides its label). */
export const SELF_LABELED: ReadonlySet<WidgetName> = new Set(['checkbox']);

export const BUILTIN_WIDGETS: Record<WidgetName, FieldWidget> = {
  text: TextWidget,
  textarea: TextareaWidget,
  number: NumberWidget,
  currency: CurrencyWidget,
  date: DateWidget,
  select: SelectWidget,
  checkbox: CheckboxWidget,
  file: DefaultFileWidget,
  reference: ReferenceWidget,
  'reference-multi': ReferenceMultiWidget,
  tags: TagsWidget,
};
