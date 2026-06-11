/**
 * Standard count pill rendered inside a top-bar app button.
 *
 * Apps that declare `AppConfig.topBarBadge` typically compose this: their
 * badge component fetches its own count (e.g. unread notifications) and
 * renders `<TopBarBadge count={n} />`. Renders nothing for zero counts.
 */

export function TopBarBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-accent-terracotta text-white text-xs font-semibold rounded-full flex items-center justify-center px-1">
      {count > 99 ? '99+' : count}
    </span>
  );
}
