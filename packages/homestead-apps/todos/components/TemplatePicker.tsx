import { useState } from 'react';
import { ChevronDown, LayoutTemplate } from 'lucide-react';
import { cn } from '@rambleraptor/homestead-core/shared/lib/utils';
import { useListTemplates } from '../hooks/useListTemplates';
import { useInstantiateTemplate } from '../hooks/useInstantiateTemplate';
import { Spinner } from '@rambleraptor/homestead-core/shared/components/Spinner';

interface TemplatePickerProps {
  /** Called with the new project's id once a template has been instantiated. */
  onInstantiated: (projectId: string) => void;
}

/**
 * Compact "start a list from a saved template" control for the project
 * switcher. Renders nothing until at least one template exists. Picking a
 * template creates a new project pre-filled with its items and switches the
 * active scope to it.
 */
export function TemplatePicker({ onInstantiated }: TemplatePickerProps) {
  const templatesQuery = useListTemplates();
  const instantiate = useInstantiateTemplate();
  const [open, setOpen] = useState(false);

  const templates = templatesQuery.data ?? [];
  if (templates.length === 0) return null;

  const handlePick = async (templateId: string, name: string) => {
    setOpen(false);
    const project = await instantiate.mutateAsync({ templateId, name });
    onInstantiated(project.id);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={instantiate.isPending}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="todos-template-picker"
        className={cn(
          'flex items-center gap-1 rounded-full px-3 py-1 text-sm font-body transition-colors',
          'bg-white text-brand-navy border border-dashed border-brand-navy/40',
          'hover:border-accent-terracotta hover:text-accent-terracotta',
          'disabled:opacity-40 disabled:cursor-not-allowed',
        )}
      >
        {instantiate.isPending ? (
          <Spinner size="sm" tone="inherit" label={null} />
        ) : (
          <LayoutTemplate className="w-4 h-4" />
        )}
        From template
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close template menu"
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            data-testid="todos-template-menu"
            className="absolute left-0 z-20 mt-1 min-w-48 max-w-64 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                role="menuitem"
                onClick={() => handlePick(template.id, template.name)}
                data-testid={`todos-template-menu-item-${template.id}`}
                className="block w-full truncate px-3 py-1.5 text-left text-sm font-body text-text-main hover:bg-bg-pearl transition-colors"
              >
                {template.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
