# Defining Resources

A resource is a kind of thing your app stores — a gift card, a recipe, a
todo. You declare its shape once, and Homestead gives you a full REST API
for it: list, get, create, update, delete, file uploads, and per-user
ownership. No migrations, no SQL, no endpoint code.

Each app owns the resources it manages. You declare them in a
`resources.ts` file next to the app and wire them into the app config with
`resources: [...]`. On the next server boot, Homestead creates anything
new and patches anything that changed.

## Table of Contents

- [Declaring a Resource](#declaring-a-resource)
- [Field Types](#field-types)
- [Enums](#enums)
- [File Fields](#file-fields)
- [Parent / Child Resources](#parent-child-resources)
- [Wiring It Up](#wiring-it-up)
- [Adding or Changing a Resource](#adding-or-changing-a-resource)
- [Rules](#rules)

---

## Declaring a Resource

A resource definition lists the fields and a `singular` / `plural` name.
Export your collection's plural as a constant so your hooks can import it
instead of hard-coding a string.

```ts
// packages/homestead-apps/gift-cards/resources.ts
import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';

export const GIFT_CARDS = 'gift-cards' as const;

export const giftCardsResources: ResourceDefinition[] = [
  {
    singular: 'gift-card',
    plural: GIFT_CARDS,
    description: 'A stored-value gift card owned by the household.',
    user_settable_create: true,
    fields: {
      merchant: { type: 'string', required: true },
      card_number: { type: 'string', required: true },
      amount: { type: 'number', required: true },
      notes: { type: 'string' },
      archived: { type: 'boolean' },
      created_by: { type: 'string', description: 'users/{user_id}' },
    },
  },
];
```

You author fields in the friendly `FieldDef` shape — a `fields` map with
per-field options — never raw JSON schema. Homestead translates it to the
wire format for you.

---

## Field Types

| `type`     | Stores                                        |
| ---------- | --------------------------------------------- |
| `string`   | Text.                                         |
| `number`   | Integer or decimal.                           |
| `boolean`  | `true` / `false`.                             |
| `object`   | A nested JSON object.                         |
| `file`     | An uploaded file (see [File Fields](#file-fields)). |

Each field can also set:

- `required: true` — the field must be present on create.
- `description` — a short note, surfaced in the generated API docs and to
  the chat assistant.
- `enum: [...]` — restrict a string to a fixed set of values.
- `singular_name` / `plural_name` — optional display names.

---

## Enums

Restrict a string field to a fixed set of allowed values with `enum`:

```ts
fields: {
  status: { type: 'string', enum: ['pending', 'done'], required: true },
}
```

The allowed values show up in the API description and are passed to the
chat assistant as a real enum, so it never invents an invalid value.

---

## File Fields

Declare an upload with `type: 'file'`:

```ts
fields: {
  front_image: {
    type: 'file',
    description: 'Front-of-card image (jpeg/png/webp/gif, <=5MB)',
  },
}
```

Homestead stores the file on disk and exposes a download method for it.
Your create/update calls send file fields as `FormData`; everything else
goes as JSON.

---

## Parent / Child Resources

Some resources only exist under another — a transaction belongs to a gift
card, a redemption belongs to a perk. Declare the parent with `parents`:

```ts
{
  singular: 'transaction',
  plural: 'transactions',
  parents: ['gift-card'],
  fields: {
    amount_changed: { type: 'number', required: true },
    notes: { type: 'string' },
  },
}
```

A child lives at a nested URL — `/gift-cards/{id}/transactions/{id}` — and
the parent id is carried in the path, **not** stored as a field. Homestead
creates parents before children automatically.

---

## Wiring It Up

Reference the definitions from your app config:

```ts
// packages/homestead-apps/gift-cards/app.config.ts
import { giftCardsResources } from './resources';

export const giftCardsApp: AppConfig = {
  id: 'gift-cards',
  // ...
  resources: giftCardsResources,
};
```

Resources that don't belong to any feature app (platform-level things)
live in `packages/homestead-core/resources/builtins.ts` instead.

---

## Adding or Changing a Resource

1. Add or edit the definition in your app's `resources.ts`.
2. Restart the server.

On boot Homestead validates names, orders definitions so parents land
first, and applies them: **new** definitions are created, **drifted** ones
are patched, and anything already in sync is left alone. Schema changes
touch real data, so review them carefully.

---

## Rules

These are aepbase constraints — the sync runner enforces them and fails
fast at boot if you break one.

1. **`singular` and `plural` are kebab-case** — `gift-card`, not
   `giftCard`. Uppercase is rejected.
2. **Field names are snake_case** — `card_number`, `created_by`.
3. **`singular` is globally unique** across all apps.
4. **Don't add date fields** like `created` / `updated`. Homestead manages
   `create_time` and `update_time` itself.
5. **Allowed values go in `enum: [...]`** — there's no `minimum` /
   `maximum`.
6. **You can't change a field's `type` or a resource's `parents`** after
   it exists. That requires deleting and recreating the definition
   (destructive — it drops the data).
