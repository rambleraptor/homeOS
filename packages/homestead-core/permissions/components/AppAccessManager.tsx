/**
 * App-access manager (superuser). Blocks a user or group from an app by writing
 * an app-scope deny grant — the engine keeps them out of the app's data and the
 * nav mirror hides the app. Complements roles (which grant app access): this is
 * the subtractive side, "keep this person out of that app."
 *
 * Superuser-only apps aren't listed — only superusers see them, and superusers
 * bypass every grant, so a block there would be meaningless.
 */

import { useMemo, useState } from 'react';
import { Ban, Loader2, Trash2 } from 'lucide-react';
import { Card } from '@rambleraptor/homestead-core/shared/components/Card';
import { Button } from '@rambleraptor/homestead-core/shared/components/Button';
import { useToast } from '@rambleraptor/homestead-core/shared/components/ToastProvider';
import { getNavigationApps } from '@rambleraptor/homestead-core/apps/registry';
import { isSuperuserOnlyApp } from '@rambleraptor/homestead-core/apps/useAppVisibility';
import {
  bareId,
  useAllUsers,
  useAppAccessGrants,
  useBlockAppAccess,
  useGroups,
  useRevokeGrant,
} from '../hooks';

const selectClass =
  'mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

/** Encode a subject as `type:id` for the single <select>. */
function subjectValue(type: 'user' | 'group', id: string): string {
  return `${type}:${id}`;
}

export function AppAccessManager() {
  const toast = useToast();
  const { data: users } = useAllUsers();
  const { data: groups } = useGroups();
  const { data: grants, isLoading } = useAppAccessGrants();
  const block = useBlockAppAccess();
  const revoke = useRevokeGrant();

  const [subject, setSubject] = useState('');
  const [appId, setAppId] = useState('');

  // Feature apps a block makes sense for (superuser-only apps excluded).
  const apps = useMemo(
    () => getNavigationApps().filter((a) => !isSuperuserOnlyApp(a)),
    [],
  );
  const appName = (id: string) => apps.find((a) => a.id === id)?.name ?? id;
  const subjectName = (type: string, id: string | undefined) => {
    if (!id) return 'Someone';
    if (type === 'group') return groups?.find((g) => g.id === id)?.name ?? `Group ${id}`;
    const u = users?.find((x) => x.id === bareId(id));
    return u?.display_name || u?.email || id;
  };

  // Only deny grants are "blocks"; an app-scope allow (rare, hand-made) isn't shown.
  const blocks = (grants ?? []).filter((g) => g.effect === 'deny');
  const alreadyBlocked = (t: string, id: string, app: string) =>
    blocks.some((b) => b.subject_type === t && bareId(b.subject_id ?? '') === id && b.target_app === app);

  const [type, id] = subject.includes(':')
    ? (subject.split(':') as ['user' | 'group', string])
    : (['user', ''] as const);
  const isDuplicate = !!subject && !!appId && alreadyBlocked(type, id, appId);
  const canBlock = !!subject && !!appId && !isDuplicate && !block.isPending;

  const handleBlock = async () => {
    if (!canBlock) return;
    try {
      await block.mutateAsync({ appId, subject: { type, id } });
      toast.success(`Blocked ${subjectName(type, id)} from ${appName(appId)}`);
      setSubject('');
      setAppId('');
    } catch {
      /* global mutation error toast surfaces the reason */
    }
  };

  const handleUnblock = async (grantId: string) => {
    try {
      await revoke.mutateAsync(grantId);
      toast.success('Block removed');
    } catch {
      /* surfaced globally */
    }
  };

  return (
    <section className="space-y-4" data-testid="app-access-manager">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">App access</h2>
        <p className="text-sm text-gray-600">
          Block a person or group from an app. A block hides the app from their
          navigation and denies its data — even if a role or share would otherwise
          grant it (a block always wins).
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="app-access-subject" className="block text-xs font-medium text-gray-700">
              Person or group
            </label>
            <select
              id="app-access-subject"
              className={selectClass}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              data-testid="app-access-subject"
            >
              <option value="">Select…</option>
              {(groups ?? []).length > 0 && (
                <optgroup label="Groups">
                  {(groups ?? []).map((g) => (
                    <option key={`group:${g.id}`} value={subjectValue('group', g.id)}>
                      {g.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="People">
                {(users ?? []).map((u) => (
                  <option key={`user:${u.id}`} value={subjectValue('user', u.id)}>
                    {u.display_name || u.email}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="min-w-[10rem] flex-1">
            <label htmlFor="app-access-app" className="block text-xs font-medium text-gray-700">
              App
            </label>
            <select
              id="app-access-app"
              className={selectClass}
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              data-testid="app-access-app"
            >
              <option value="">Select an app…</option>
              {apps.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <Button
            type="button"
            variant="danger"
            onClick={handleBlock}
            disabled={!canBlock}
            data-testid="app-access-block"
          >
            {block.isPending ? (
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            ) : (
              <Ban className="mr-2 inline h-4 w-4" />
            )}
            Block
          </Button>
        </div>
        {isDuplicate && (
          <p className="mt-2 text-xs text-gray-500" data-testid="app-access-duplicate">
            {subjectName(type, id)} is already blocked from {appName(appId)}.
          </p>
        )}
      </Card>

      <div>
        <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">Current blocks</h3>
        {isLoading ? (
          <div className="py-4 text-center">
            <Loader2 className="inline h-4 w-4 animate-spin text-gray-400" />
          </div>
        ) : blocks.length === 0 ? (
          <p className="py-3 text-sm text-gray-500" data-testid="app-access-empty">
            No app blocks. Everyone can reach every app their role allows.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100" data-testid="app-access-list">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-800">
                  <span className="font-medium">{subjectName(b.subject_type, b.subject_id)}</span>
                  <span className="text-gray-500"> blocked from </span>
                  <span className="font-medium">{appName(b.target_app ?? '')}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void handleUnblock(b.id)}
                  disabled={revoke.isPending}
                  className="inline-flex items-center gap-1 rounded p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
                  aria-label="Remove block"
                  data-testid={`app-access-unblock-${b.subject_id}-${b.target_app}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
