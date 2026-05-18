import { useQuery } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { USERS } from '@rambleraptor/homestead-core/resources/builtins';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { parseTagList } from '@rambleraptor/homestead-core/settings/visibility';
import type { ManagedUser } from '../types';

// On the wire `tags` is a comma-separated string (see api/aepbase.ts).
// Decode it client-side so the rest of the module can work with the
// natural `string[]` shape.
interface RawManagedUser extends Omit<ManagedUser, 'tags'> {
  tags?: string | string[];
}

function decodeTags(raw: string | string[] | undefined): string[] | undefined {
  if (raw === undefined) return undefined;
  if (Array.isArray(raw)) return raw.length > 0 ? raw : undefined;
  const parsed = parseTagList(raw);
  return parsed.length > 0 ? parsed : undefined;
}

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: async () => {
      const raw = await aepbase.list<RawManagedUser>(USERS);
      const users: ManagedUser[] = raw.map((u) => ({
        ...u,
        tags: decodeTags(u.tags),
      }));
      users.sort((a, b) => a.email.localeCompare(b.email));
      return users;
    },
  });
}
