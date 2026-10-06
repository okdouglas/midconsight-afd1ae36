import { BarChart3, TrendingUp, Flame, DollarSign } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface KPICardsProps {
  totalPermits: number;
  newThisWeek: number;
  hotLeads: number;
  pipelineValue: number;
}

export function KPICards({ totalPermits, newThisWeek, hotLeads, pipelineValue }: KPICardsProps) {
  const cards = [
    {
      title: 'Total Permits',
      value: totalPermits.toLocaleString(),
      icon: BarChart3,
      color: 'border-b-primary',
    },
    {
      title: 'New This Week',
      value: newThisWeek.toLocaleString(),
      icon: TrendingUp,
      color: 'border-b-success',
    },
    {
      title: 'Hot Leads',
      value: hotLeads.toLocaleString(),
      icon: Flame,
      color: 'border-b-score-hot',
    },
    {
      title: 'Pipeline Value',
      value: `$${pipelineValue.toLocaleString()}`,
      icon: DollarSign,
      color: 'border-b-warning',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className={`border-b-4 ${card.color}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                <p className="text-3xl font-bold mt-1 tabular-nums">{card.value}</p>
              </div>
              <card.icon className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
