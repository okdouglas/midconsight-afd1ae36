import { Users, TrendingUp, Flame, DollarSign, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface KPICardsProps {
  newThisWeek: number;
  /** Operators with at least one permit in the last 7 days. */
  activeOperators: number;
  hotLeads: number;
  pipelineValue: number;
  onNewThisWeek?: () => void;
  onActiveOperators?: () => void;
  onHotLeads?: () => void;
  onPipeline?: () => void;
}

export function KPICards({
  newThisWeek,
  activeOperators,
  hotLeads,
  pipelineValue,
  onNewThisWeek,
  onActiveOperators,
  onHotLeads,
  onPipeline,
}: KPICardsProps) {
  const cards = [
    {
      title: 'New This Week',
      value: newThisWeek.toLocaleString(),
      icon: TrendingUp,
      color: 'border-b-success',
      hint: 'See the new permits',
      onClick: onNewThisWeek,
    },
    {
      title: 'Operators active this week',
      value: activeOperators.toLocaleString(),
      icon: Users,
      color: 'border-b-primary',
      hint: 'See who filed',
      onClick: onActiveOperators ?? onNewThisWeek,
    },
    {
      title: 'Hot Leads',
      value: hotLeads.toLocaleString(),
      icon: Flame,
      color: 'border-b-score-hot',
      hint: 'Open the hot list',
      onClick: onHotLeads,
    },
    {
      title: 'Pipeline Value',
      value: `$${pipelineValue.toLocaleString()}`,
      icon: DollarSign,
      color: 'border-b-warning',
      hint: 'Open Deals',
      onClick: onPipeline,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const body = (
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                <p className="text-3xl font-semibold mt-1 tabular-nums">{card.value}</p>
              </div>
              <card.icon className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
            </div>
            {card.onClick && (
              <p className="mt-2 flex items-center gap-1 text-xs text-primary">
                {card.hint}
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </p>
            )}
          </CardContent>
        );
        return card.onClick ? (
          <button
            key={card.title}
            type="button"
            onClick={card.onClick}
            className="text-left rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className={`border-b-4 ${card.color} h-full transition-colors hover:border-primary/50`}>{body}</Card>
          </button>
        ) : (
          <Card key={card.title} className={`border-b-4 ${card.color}`}>
            {body}
          </Card>
        );
      })}
    </div>
  );
}
