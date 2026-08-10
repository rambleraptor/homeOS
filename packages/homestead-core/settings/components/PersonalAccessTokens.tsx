import { useMemo, useState } from 'react';
import { Copy, KeyRound, Trash2 } from 'lucide-react';
import { Card } from '@rambleraptor/homestead-core/shared/components/Card';
import { Button } from '@rambleraptor/homestead-core/shared/components/Button';
import { Input } from '@rambleraptor/homestead-core/shared/components/Input';
import { Checkbox } from '@rambleraptor/homestead-core/shared/components/Checkbox';
import { Modal } from '@rambleraptor/homestead-core/shared/components/Modal';
import { Spinner } from '@rambleraptor/homestead-core/shared/components/Spinner';
import { ConfirmDialog } from '@rambleraptor/homestead-core/shared/components/ConfirmDialog';
import { useToast } from '@rambleraptor/homestead-core/shared/components/ToastProvider';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import type { Capability } from '@rambleraptor/homestead-core/permissions/resolve';
import {
  usePersonalAccessTokens,
  type AepPersonalAccessToken,
  type TokenScope,
} from '../hooks/usePersonalAccessTokens';
import { useMintPersonalAccessToken } from '../hooks/useMintPersonalAccessToken';
import { useRevokePersonalAccessToken } from '../hooks/useRevokePersonalAccessToken';
import {
  useTokenScopeOptions,
  capabilitiesUpTo,
  type ScopeOption,
} from '../hooks/useTokenScopeOptions';

/** Per-scope selection state: whether it's included and at what capability. */
interface Selection {
  checked: boolean;
  capability: Capability;
}

function describeScope(scope: TokenScope): string {
  const target =
    scope.target_scope === 'all'
      ? 'Everything'
      : scope.target_scope === 'app'
        ? `App: ${scope.target_app}`
        : `Collection: ${scope.resource_type}`;
  return `${scope.capability} · ${target}`;
}

function formatDate(value?: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString();
}

export function PersonalAccessTokens() {
  const toast = useToast();
  const { data: tokens = [], isLoading } = usePersonalAccessTokens();
  const { data: scopeOptions = [], isLoading: scopesLoading } = useTokenScopeOptions();
  const mint = useMintPersonalAccessToken();
  const revoke = useRevokePersonalAccessToken();

  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [mintedSecret, setMintedSecret] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<AepPersonalAccessToken | null>(null);

  const selectedScopes = useMemo<TokenScope[]>(() => {
    const out: TokenScope[] = [];
    for (const option of scopeOptions) {
      const sel = selections[option.key];
      if (!sel?.checked) continue;
      out.push({
        capability: sel.capability,
        target_scope: option.target_scope,
        target_app: option.target_app,
        resource_type: option.resource_type,
      });
    }
    return out;
  }, [scopeOptions, selections]);

  const setSelection = (option: ScopeOption, patch: Partial<Selection>) => {
    setSelections((prev) => ({
      ...prev,
      [option.key]: {
        checked: prev[option.key]?.checked ?? false,
        capability: prev[option.key]?.capability ?? option.maxCapability,
        ...patch,
      },
    }));
  };

  const resetForm = () => {
    setName('');
    setExpiresAt('');
    setSelections({});
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Give the token a name.');
      return;
    }
    try {
      const result = await mint.mutateAsync({
        name: name.trim(),
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        scopes: selectedScopes,
      });
      setMintedSecret(result.token);
      resetForm();
    } catch (error) {
      logger.error('Failed to mint token', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create token.');
    }
  };

  const handleRevoke = async (token: AepPersonalAccessToken) => {
    try {
      await revoke.mutateAsync(token.id);
      toast.success('Token revoked.');
    } catch (error) {
      logger.error('Failed to revoke token', error);
      toast.error('Failed to revoke token. Please try again.');
    } finally {
      setConfirmTarget(null);
    }
  };

  const copySecret = async () => {
    if (!mintedSecret) return;
    try {
      await navigator.clipboard.writeText(mintedSecret);
      toast.success('Token copied to clipboard.');
    } catch {
      toast.error('Could not copy — select and copy it manually.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <Card>
      <div className="space-y-6" data-testid="personal-access-tokens">
        <div className="flex items-start gap-4">
          <KeyRound className="w-6 h-6 text-gray-600 mt-1" />
          <div>
            <h3 className="font-semibold text-gray-900">Personal Access Tokens</h3>
            <p className="text-sm text-gray-600">
              Issue a token to call the API. A token can only ever do what you can,
              and only within the scopes you grant it.
            </p>
          </div>
        </div>

        {/* Existing tokens */}
        {tokens.length === 0 ? (
          <p className="text-sm text-gray-500" data-testid="no-tokens">
            You haven&apos;t issued any tokens yet.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {tokens.map((token) => {
              const expires = formatDate(token.expires_at);
              const lastUsed = formatDate(token.last_used_at);
              return (
                <li
                  key={token.id}
                  className="flex items-center justify-between gap-4 py-3"
                  data-testid="token-row"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">{token.name}</span>
                      {token.token_prefix && (
                        <code className="text-xs text-gray-500">{token.token_prefix}…</code>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {token.scopes && token.scopes.length > 0
                        ? token.scopes.map(describeScope).join(', ')
                        : 'No access (inert)'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {expires ? `Expires ${expires}` : 'Never expires'}
                      {lastUsed ? ` · Last used ${lastUsed}` : ' · Never used'}
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setConfirmTarget(token)}
                    data-testid="revoke-token"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Revoke
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Create form */}
        <form onSubmit={handleCreate} className="space-y-4 border-t border-gray-100 pt-4">
          <h4 className="font-medium text-gray-900">New token</h4>
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Home Assistant"
            data-testid="token-name"
          />
          <Input
            label="Expiration (optional)"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            data-testid="token-expiry"
          />

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Scopes</p>
            {scopesLoading ? (
              <Spinner size="sm" />
            ) : scopeOptions.length === 0 ? (
              <p className="text-sm text-gray-500">
                You have no grantable permissions, so a token would be inert.
              </p>
            ) : (
              <ul className="space-y-2" data-testid="scope-options">
                {scopeOptions.map((option) => {
                  const sel = selections[option.key];
                  const caps = capabilitiesUpTo(option.maxCapability);
                  return (
                    <li key={option.key} className="flex items-center gap-3">
                      <Checkbox
                        checked={sel?.checked ?? false}
                        onCheckedChange={(checked) =>
                          setSelection(option, { checked: checked === true })
                        }
                        data-testid={`scope-${option.key}`}
                      />
                      <span className="text-sm text-gray-800 flex-1">{option.label}</span>
                      <select
                        className="text-sm border border-gray-200 rounded px-2 py-1 disabled:opacity-50"
                        value={sel?.capability ?? option.maxCapability}
                        disabled={!sel?.checked}
                        onChange={(e) =>
                          setSelection(option, { capability: e.target.value as Capability })
                        }
                        data-testid={`capability-${option.key}`}
                      >
                        {caps.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Button type="submit" disabled={mint.isPending} data-testid="create-token">
            {mint.isPending ? 'Creating…' : 'Create token'}
          </Button>
        </form>
      </div>

      {/* One-time secret reveal */}
      <Modal
        isOpen={mintedSecret !== null}
        onClose={() => setMintedSecret(null)}
        title="Copy your new token"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This is the only time the token will be shown. Copy it now and store it
            somewhere safe — you won&apos;t be able to see it again.
          </p>
          <div className="flex items-center gap-2">
            <code
              className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded px-3 py-2 break-all"
              data-testid="minted-secret"
            >
              {mintedSecret}
            </code>
            <Button variant="secondary" size="sm" onClick={copySecret}>
              <Copy className="w-4 h-4 mr-1" />
              Copy
            </Button>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setMintedSecret(null)}>Done</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        onConfirm={() => confirmTarget && handleRevoke(confirmTarget)}
        title="Revoke token"
        message={`Revoke "${confirmTarget?.name ?? 'this token'}"? Any client using it will immediately lose access.`}
        confirmLabel="Revoke"
        variant="danger"
        isLoading={revoke.isPending}
      />
    </Card>
  );
}
