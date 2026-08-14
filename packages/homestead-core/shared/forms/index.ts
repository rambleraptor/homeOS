/**
 * Schema-driven form: generate a form from a resource's `FieldDef` map, with a
 * sparse per-field override diff and a swappable widget registry.
 */

export { SchemaForm } from './SchemaForm';
export { useSchemaForm } from './useSchemaForm';
export type {
  UseSchemaFormOptions,
  UseSchemaFormReturn,
  ExtraFieldDef,
  FieldBinding,
  NativeBinding,
} from './useSchemaForm';
export { BUILTIN_WIDGETS, FieldFrame } from './widgets';
export { fileField } from './FileField';
export type { FileFieldOptions } from './FileField';
export { inferWidget, humanize, fieldLabel } from './helpers';
export { deriveValidator, mapServerError } from './validation';
export type {
  SchemaFormProps,
  FieldConfig,
  FieldWidget,
  FieldWidgetProps,
  WidgetName,
} from './types';
