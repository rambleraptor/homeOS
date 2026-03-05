import { ActionDetailPage } from '@/modules/developer/components/ActionDetailPage';

export default async function ActionPage({
  params,
}: {
  params: Promise<{ actionId: string }>;
}) {
  const { actionId } = await params;
  return <ActionDetailPage actionId={actionId} />;
}
