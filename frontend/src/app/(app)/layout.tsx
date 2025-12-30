import { AppShell } from '@/core/layout/AppShell';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
