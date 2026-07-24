/**
 * Generic, schema-driven form primitives. Turn a resource's authoring-side
 * `FieldDef` map into a working create/edit form, with `reference` fields
 * rendered as live record pickers.
 *
 *   import { ResourceForm } from '@rambleraptor/homestead-core/shared/forms';
 *
 * See `ResourceForm` for the entry point and `buildResourceRequestBody` for
 * wiring its values into an `aepbase.create` / `update` call.
 */

export { ResourceForm, buildResourceRequestBody } from './ResourceForm';
export type { ResourceFormProps, ResourceFormValues } from './ResourceForm';
export { FieldInput, fieldLabel, humanizeFieldName, isRenderableField } from './FieldInput';
export type { FieldInputProps } from './FieldInput';
export { ReferencePicker } from './ReferencePicker';
export type { ReferencePickerProps } from './ReferencePicker';
export { useResourceList } from './useResourceList';
export { pickRecordLabel } from './pickRecordLabel';
export type { AepRecord } from './pickRecordLabel';
export {
  resourceDefBySingular,
  pluralForSingular,
  isTopLevelReference,
} from './resourceLookup';
