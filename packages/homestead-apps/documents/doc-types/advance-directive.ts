/**
 * Advance directive — the legal document stating a person's wishes for medical
 * care if they can't speak for themselves, and/or naming someone to decide.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. Every
 * `description` is handed to the model verbatim, so they say where a value sits
 * on the document and how to tell the principal apart from the agent they name.
 *
 * `patient` is the principal — shared with the other medical types so the person
 * joins the same filter facet. `agent_name` and `alternate_agent` are person
 * fields too, so the appointed decision-makers join the person facet.
 */

import type { DocType } from './docType';

const advanceDirective: DocType = {
  id: 'advance-directive',
  label: 'Advance directive',
  icon: () => import('lucide-react').then((m) => m.FileHeart),
  category: 'medical',
  title_template: 'Advance Directive — {patient}',
  description:
    'An advance healthcare directive — a legal document recording a person\'s ' +
    'wishes for medical care if they become unable to decide, and/or naming ' +
    'someone to make decisions for them. Covers living wills, durable powers of ' +
    'attorney for healthcare, healthcare proxies, and DNR (do-not-resuscitate) ' +
    'orders. Use this type for such a directive; do not use it for a general ' +
    'power of attorney over finances, a will/estate document, or a visit ' +
    'summary.',
  fields: {
    patient: {
      label: 'Principal',
      type: 'string',
      person: true,
      description:
        'The person the directive is for — the principal or declarant whose ' +
        'care wishes it records. Not the appointed agent.',
    },
    directive_type: {
      label: 'Type',
      type: 'string',
      description:
        'What kind of directive this is (e.g. "Living will", "Durable power ' +
        'of attorney for healthcare", "Healthcare proxy", "DNR order"). Infer ' +
        'it from the title and contents.',
    },
    agent_name: {
      label: 'Healthcare agent',
      type: 'string',
      person: true,
      description:
        'The person appointed to make healthcare decisions — the agent, proxy, ' +
        'or attorney-in-fact for healthcare. The primary agent named, not an ' +
        'alternate. Leave blank if the document names none (e.g. a plain living ' +
        'will).',
    },
    alternate_agent: {
      label: 'Alternate agent',
      type: 'string',
      person: true,
      description:
        'The backup or successor agent named to act if the primary agent ' +
        'cannot. Leave blank if none is named.',
    },
    execution_date: {
      label: 'Date signed',
      type: 'string',
      description:
        'The date the directive was signed or executed. Prefer an ISO date ' +
        '(YYYY-MM-DD) when unambiguous; otherwise record it exactly as shown.',
    },
    witnesses: {
      label: 'Witnesses',
      type: 'string',
      description:
        'The witnesses who signed the document, when named, as a ' +
        'comma-separated list of names. Leave blank if none are named.',
    },
    notarized: {
      label: 'Notarized',
      type: 'string',
      description:
        'Whether the document was notarized: "yes" if it carries a notary ' +
        'acknowledgment or seal, "no" if it was witnessed only. Leave blank if ' +
        'unclear.',
    },
  },
};

export default advanceDirective;
