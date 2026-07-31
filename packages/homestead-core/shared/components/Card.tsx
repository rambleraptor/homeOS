import type { ReactNode } from 'react';
import { Card as ShadcnCard, CardContent } from '@rambleraptor/homestead-core/shared/components/ui/card';

interface CardProps {
  children: ReactNode;
  className?: string;
  'data-testid'?: string;
}

export function Card({ children, className = '', 'data-testid': testId }: CardProps) {
  return (
    <ShadcnCard className={className} data-testid={testId}>
      <CardContent className="p-6">
        {children}
      </CardContent>
    </ShadcnCard>
  );
}

// Re-export shadcn Card subcomponents for more advanced usage
export { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@rambleraptor/homestead-core/shared/components/ui/card';
