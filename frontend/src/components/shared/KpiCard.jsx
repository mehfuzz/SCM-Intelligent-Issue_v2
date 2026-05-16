import { Card, CardContent } from '../ui/card';
import { cn } from '../../lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

export const KpiCard = ({ label, value, delta, deltaType, icon: Icon, accent = false, testId, onClick, onDoubleClick }) => {
  const isUp = deltaType === 'up';
  const interactive = Boolean(onClick || onDoubleClick);
  return (
    <Card
      data-testid={testId}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      role={interactive ? 'button' : undefined}
      title={interactive ? 'Click to drill into the underlying tickets' : undefined}
      className={cn(
        'border-gray-200 shadow-sm hover:shadow-md transition-shadow',
        accent && 'border-red-200 bg-red-50/40',
        interactive && 'cursor-pointer'
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
            <p className="mt-2 font-display text-3xl font-bold text-gray-900">{value}</p>
            {delta != null && (
              <div className={cn(
                'mt-2 inline-flex items-center gap-1 text-xs font-medium',
                isUp ? 'text-emerald-600' : 'text-red-600'
              )}>
                {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span>{delta}</span>
              </div>
            )}
          </div>
          {Icon && (
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              accent ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-700'
            )}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
