/**
 * Health insurance card — the member ID card a health plan issues, carrying the
 * member id, group number, plan name, and pharmacy routing details.
 *
 * See form-1099-int.ts for the authoring notes; the same rules apply. Every
 * `description` is handed to the model verbatim, so they name where a value sits
 * on the card and how to distinguish two look-alike numbers.
 *
 * A card is a small image, often photographed front-and-back — the values are
 * short codes, not prose. `carrier` is shared with the other insurance types on
 * purpose, so a member's insurer is one filter facet across cards, EOBs, and
 * policies.
 */

import type { DocType } from './docType';

const healthInsuranceCard: DocType = {
  id: 'health-insurance-card',
  label: 'Health insurance card',
  icon: () => import('lucide-react').then((m) => m.ShieldPlus),
  category: 'medical',
  title_template: 'Insurance Card — {carrier}',
  description:
    'A health insurance member ID card — the wallet card a medical, dental, or ' +
    'vision plan issues, shown at appointments and the pharmacy. Carries the ' +
    'member\'s name, a member/subscriber id, a group number, the plan name, and ' +
    'often pharmacy routing codes (RxBIN, RxPCN, RxGroup). Frequently a photo ' +
    'of the front and back of the card. Use this type for the ID card itself; ' +
    'do not use it for the plan\'s coverage documents, an Explanation of ' +
    'Benefits, or a bill.',
  fields: {
    carrier: {
      label: 'Insurer',
      type: 'string',
      description:
        'The insurance company or plan named on the card (e.g. "Cigna", ' +
        '"Kaiser Permanente", "Humana"). The insurer/plan brand only, not the ' +
        'employer or the network logo if they differ.',
    },
    member_name: {
      label: 'Member',
      type: 'string',
      person: true,
      description:
        'The member or subscriber named on the card. If the card lists ' +
        'dependents too, take the primary member printed most prominently.',
    },
    member_id: {
      label: 'Member ID',
      type: 'string',
      description:
        'The member or subscriber id used to identify the person to the plan — ' +
        'labelled "Member ID", "ID #", or "Subscriber ID". Record it exactly as ' +
        'printed, including any letter prefix. Not the group number.',
    },
    group_number: {
      label: 'Group number',
      type: 'string',
      description:
        'The employer or plan group number, labelled "Group", "Group No.", or ' +
        '"Grp". Identifies the plan the member belongs to, distinct from the ' +
        'member id. Record it exactly as printed.',
    },
    plan_name: {
      label: 'Plan',
      type: 'string',
      description:
        'The name of the specific plan or network, when printed (e.g. "PPO", ' +
        '"HMO Gold", "Choice Plus"). Leave blank if the card shows no plan name.',
    },
    rx_bin: {
      label: 'RxBIN',
      type: 'string',
      description:
        'The pharmacy benefit routing number, labelled "RxBIN" or "BIN", used ' +
        'to route prescription claims. A short numeric code. Leave blank if the ' +
        'card carries no pharmacy details.',
    },
    rx_group: {
      label: 'RxGroup',
      type: 'string',
      description:
        'The pharmacy benefit group code, labelled "RxGroup", "RxGRP", or ' +
        '"RxPCN". Record it exactly as printed. Leave blank if not shown.',
    },
  },
};

export default healthInsuranceCard;
