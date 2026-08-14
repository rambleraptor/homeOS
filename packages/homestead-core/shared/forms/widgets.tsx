/**
 * Built-in field widgets and the `FieldFrame` chrome (label / required marker /
 * help text / error line) that wraps every non-`bare` field. Custom overrides
 * receive the same {@link FieldWidgetProps} and, unless `bare`, the same frame.
 */

import type { ReactNode } from 'react';
import { ReferenceField } from '../components/ReferenceField';
import { TagInput } from '../components/TagInput';
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
  children,
}: {
  id: string;
  label: string;
  required: boolean;
  help?: string;
  error?: string;
  hideLabel?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="w-full">
      {!hideLabel && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}
      {help && <p className="text-sm text-gray-500 mb-1">{help}</p>}
      {children}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

const commonProps = (p: FieldWidgetProps) => ({
  id: p.id,
  required: p.required,
  disabled: p.disabled,
  autoFocus: p.autoFocus,
  'data-testid': p.testId,
  'aria-invalid': p.error ? true : undefined,
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
        step={p.field.multipleOf ?? 1}
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

function FileWidget(p: FieldWidgetProps) {
  return (
    <input
      {...commonProps(p)}
      type="file"
      onChange={(e) => p.onChange(e.target.files?.[0] ?? null)}
      className={INPUT}
    />
  );
}

/** Naive singular→plural guess for a reference target; override via
 *  `config.collection` for irregular plurals (person → people). */
function guessCollection(singular: string): string {
  return `${singular}s`;
}

function ReferenceWidget(p: FieldWidgetProps) {
  const collection = p.config?.collection ?? guessCollection(p.field.reference?.resource ?? '');
  const id = typeof p.value === 'string' && p.value ? p.value : '';
  const paths = id ? [`${collection}/${id}`] : [];
  return (
    <ReferenceField
      collection={collection}
      value={paths}
      onChange={(next) => p.onChange(next[0]?.split('/').pop() ?? '')}
      labelField={p.config?.labelField}
      id={p.id}
      testId={p.testId}
      label={fieldLabel(p.name, p.field, p.config)}
      required={p.required}
      description={p.config?.help}
      error={p.error}
      placeholder={p.config?.placeholder}
    />
  );
}

function ReferenceMultiWidget(p: FieldWidgetProps) {
  const singular = p.field.items?.reference?.resource ?? '';
  const collection = p.config?.collection ?? guessCollection(singular);
  const ids = Array.isArray(p.value) ? (p.value as string[]) : [];
  const paths = ids.map((v) => `${collection}/${v}`);
  return (
    <ReferenceField
      collection={collection}
      multiple
      value={paths}
      onChange={(next) => p.onChange(next.map((path) => path.split('/').pop() ?? ''))}
      labelField={p.config?.labelField}
      id={p.id}
      testId={p.testId}
      label={fieldLabel(p.name, p.field, p.config)}
      required={p.required}
      description={p.config?.help}
      error={p.error}
      placeholder={p.config?.placeholder}
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
  file: FileWidget,
  reference: ReferenceWidget,
  'reference-multi': ReferenceMultiWidget,
  tags: TagsWidget,
};
