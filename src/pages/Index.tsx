import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Database, BarChart3, Users, Map, DollarSign, LogOut, Settings, Package, Search, ArrowLeft, Lock, Clock } from 'lucide-react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DataImport } from '@/components/DataImport';
import { DatasetManager } from '@/components/DatasetManager';
import { KPICards } from '@/components/KPICards';
import { NewPermitsList } from '@/components/NewPermitsList';
import { PermitMapAdvanced } from '@/components/PermitMapAdvanced';
import { CompaniesTab } from '@/components/CompaniesTab';
import { DealsTab } from '@/components/DealsTab';
import { ProductCatalog } from '@/components/ProductCatalog';
import { ResearchDesk } from '@/components/ResearchDesk';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { incrementPaywallHits, markActivated } from '@/lib/supabase-data';
import { toast } from 'sonner';
import { UpgradeDialog } from '@/components/UpgradeDialog';
import { AccountSettings } from '@/components/AccountSettings';

const NAV_ITEMS = [
  { value: 'dashboard', label: 'Dashboard', icon: BarChart3, minPlan: null },
  { value: 'map', label: 'Map', icon: Map, minPlan: null },
  { value: 'companies', label: 'Companies', icon: Users, minPlan: null },
  { value: 'research', label: 'Lead Research', icon: Search, minPlan: null },
  { value: 'deals', label: 'Deals', icon: DollarSign, minPlan: null },
  { value: 'products', label: 'Products', icon: Package, minPlan: null },
  { value: 'data', label: 'Data', icon: Database, minPlan: 'pro' },
] as const;

type MinPlan = 'starter' | 'pro' | null;

const TIER_INFO = {
  starter: { name: 'Starter', price: '$10/mo' },
  pro: { name: 'Pro', price: '$20/mo' },
} as const;

function UpgradePrompt({ label, tier, onUpgradeClick }: { label: string; tier: 'starter' | 'pro'; onUpgradeClick: () => void }) {
  const info = TIER_INFO[tier];
  return (
    <div className="text-center py-16">
      <Lock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
      <h2 className="text-xl font-semibold mb-2">{label} is on the {info.name} plan</h2>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        Importing your own permit files is on the Pro plan. Starter and Free use the shared Oklahoma feed, which updates every Monday.
      </p>
      <Button onClick={onUpgradeClick}>Upgrade to {info.name} ({info.price})</Button>
    </div>
  );
}

const Index = () => {
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading, plan, isPaid, hasStarter, isPro, refresh: refreshProfile } = useProfile();
  // Coming back from Stripe Checkout. The plan changes when Stripe's webhook lands, a few seconds
  // after payment. Keep checking (up to a minute) until the plan is no longer Free.
  const planRef = useRef(plan);
  planRef.current = plan;
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('checkout');
    if (!result) return;
    window.history.replaceState({}, '', window.location.pathname);
    if (result === 'cancelled') {
      toast('Checkout cancelled. You were not charged.');
      return;
    }
    toast.success('Payment received. Your plan is updating.');
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      refreshProfile();
      if (planRef.current !== 'free' || tries >= 20) window.clearInterval(timer);
    }, 3000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A new plan changes which permits and tabs the user can see, so reload the data when it changes.
  const lastPlan = useRef(plan);
  useEffect(() => {
    if (lastPlan.current !== plan) {
      const wasLoading = lastPlan.current === undefined;
      lastPlan.current = plan;
      if (!wasLoading) refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  // Also re-check the plan when the user comes back to this tab (for example after the billing portal).
  useEffect(() => {
    const onFocus = () => refreshProfile();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canAccess = (min: MinPlan) => min === null || profileLoading || (min === 'starter' ? hasStarter : isPro);
  const {
    permits,
    datasets,
    companies,
    deals,
    loading,
    refresh,
    removeDataset,
    newThisWeekPermits,
    stats,
    windowDays,
    hiddenCompanyCount,
    hiddenCompanies,
  } = useSupabaseData();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [upgradeSource, setUpgradeSource] = useState('');

  // Cross-module links (audit): open a company from anywhere, or jump to a tab.
  //   window.dispatchEvent(new CustomEvent('midconsight:open-company', { detail: { name } }))
  //   window.dispatchEvent(new CustomEvent('midconsight:goto-tab', { detail: { tab } }))
  const [pendingCompany, setPendingCompany] = useState<string | null>(null);
  const [pendingScoreFilter, setPendingScoreFilter] = useState<'hot' | 'warm' | 'cold' | null>(null);
  useEffect(() => {
    const onOpenCompany = (e: Event) => {
      const name = (e as CustomEvent<{ name?: string }>).detail?.name;
      if (!name) return;
      setPendingCompany(name);
      setActiveTab('companies');
    };
    window.addEventListener('midconsight:open-company', onOpenCompany);
    return () => window.removeEventListener('midconsight:open-company', onOpenCompany);
  }, []);
  useEffect(() => {
    const onGotoTab = (e: Event) => {
      const tab = (e as CustomEvent<{ tab?: string }>).detail?.tab;
      if (tab && (tab === 'account' || NAV_ITEMS.some((n) => n.value === tab))) setActiveTab(tab);
    };
    window.addEventListener('midconsight:goto-tab', onGotoTab);
    return () => window.removeEventListener('midconsight:goto-tab', onGotoTab);
  }, []);

  // Dashboard numbers that are not in the shared stats.
  const activeOperators = useMemo(
    () => new Set(newThisWeekPermits.map((p) => p.operator).filter(Boolean)).size,
    [newThisWeekPermits],
  );
  const latestApproval = useMemo(() => {
    let latest = '';
    for (const p of permits) if (p.approvalDate && p.approvalDate > latest) latest = p.approvalDate;
    if (!latest) return '';
    const d = new Date(`${latest.slice(0, 10)}T00:00:00`);
    return Number.isNaN(d.getTime()) ? latest : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [permits]);

  const openUpgradeDialog = (source: string) => {
    setUpgradeSource(source);
    setUpgradeDialogOpen(true);
  };
  // The database stops a free account at its limit (3 deals, 3 products); show the upgrade dialog.
  useEffect(() => {
    const onLimit = (e: Event) => openUpgradeDialog((e as CustomEvent<{ source?: string }>).detail?.source ?? 'free_limit');
    window.addEventListener('midconsight:free-limit', onLimit);
    return () => window.removeEventListener('midconsight:free-limit', onLimit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const activeItem = NAV_ITEMS.find((n) => n.value === activeTab);
  const activeLabel = activeTab === 'account' ? 'Account' : activeItem?.label ?? 'Dashboard';
  const isGatedTab = !!activeItem && !canAccess(activeItem.minPlan);

  // Log paywall hits when a free user lands on a gated tab (but not on
  // every re-render — only when the tab actually changes).
  useEffect(() => {
    if (isGatedTab) {
      incrementPaywallHits().catch(() => {
        // Non-critical — don't interrupt the user's flow if this fails.
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, hasStarter, isPro, profileLoading]);

  // Mark activation the first time the user has any permits to look at
  // (server-side no-op after the first call, safe to fire repeatedly).
  useEffect(() => {
    if (permits.length > 0) {
      markActivated().catch(() => {});
    }
  }, [permits.length]);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col h-screen sticky top-0 border-r border-sidebar-border">
        <div className="flex items-center px-4 h-16 border-b border-sidebar-border shrink-0">
          <Logo variant="reversed" height={26} />
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.value;
            const showLock = !canAccess(item.minPlan);
            return (
              <button
                key={item.value}
                onClick={() => setActiveTab(item.value)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                }`}
              >
                <item.icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-sidebar-ring' : ''}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {showLock && <Lock className="h-3 w-3 shrink-0 text-sidebar-foreground/40" />}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-2.5 space-y-2 shrink-0">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 rounded-md text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to site
          </Link>
          <div className="flex items-center justify-between gap-2 px-3 py-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('account')}
              title={user?.email ?? 'Account'}
              className={`flex items-center gap-2 text-sm truncate transition-colors ${activeTab === 'account' ? 'text-sidebar-foreground font-medium' : 'text-sidebar-foreground/60 hover:text-sidebar-foreground'}`}
            >
              <Settings className="h-4 w-4 shrink-0" />
              Account
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-sidebar-foreground/60 hover:text-sidebar-foreground shrink-0"
              onClick={signOut}
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 sticky top-0 z-10">
          <h1 className="font-semibold text-lg tracking-tight">{activeLabel}</h1>
          <div className="flex items-center gap-4">
            {latestApproval && (
              <span className="text-sm text-muted-foreground tabular-nums">Permits through {latestApproval}</span>
            )}
          </div>
        </header>

        <main className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {/* Dashboard Tab */}
            <TabsContent value="dashboard" className="space-y-4 mt-0">
              {!profileLoading && !isPaid && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0 text-primary" />
                  Free plan shows permits from the last 30 days. <button onClick={() => openUpgradeDialog('dashboard_banner')} className="text-primary font-medium hover:underline">Upgrade</button> for full history and more.
                </div>
              )}
              {permits.length === 0 ? (
                <div className="text-center py-12">
                  <Database className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h2 className="text-xl font-semibold mb-2">No Data Loaded</h2>
                  {canAccess('pro') ? (
                    <>
                      <p className="text-muted-foreground mb-6">
                        Import your ITD wells/formations data to get started with permit intelligence.
                      </p>
                      <DataImport onImportComplete={refresh} />
                    </>
                  ) : (
                    <p className="text-muted-foreground mb-6">
                      No permits in the last 30 days yet. New permits load every Monday.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <KPICards
                    newThisWeek={stats.newThisWeek}
                    activeOperators={activeOperators}
                    hotLeads={stats.hotLeads}
                    pipelineValue={stats.pipelineValue}
                    onNewThisWeek={() =>
                      document.getElementById('new-permits-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                    onHotLeads={() => {
                      setPendingScoreFilter('hot');
                      setActiveTab('companies');
                    }}
                    onPipeline={() => setActiveTab('deals')}
                  />
                  
                  {/* New This Week Map - Expanded to 60-70% viewport */}
                  {newThisWeekPermits.length > 0 && (
                    <div className="rounded-lg border border-border bg-card p-4 relative z-0 overflow-hidden isolate">
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Map className="h-5 w-5 text-primary" />
                        New This Week ({newThisWeekPermits.length} permits)
                      </h3>
                      <div className="h-[calc(60vh-120px)] min-h-[400px] relative z-0">
                        <PermitMapAdvanced permits={newThisWeekPermits} showFilters={false} windowDays={windowDays} />
                      </div>
                    </div>
                  )}
                  
                  {/* New permits as tiles */}
                  <NewPermitsList permits={newThisWeekPermits} allPermits={permits} windowDays={windowDays} />
                </>
              )}
            </TabsContent>

            {/* Research Desk Tab */}
            <TabsContent value="research" className="space-y-6 mt-0">
              <ResearchDesk permits={permits} companies={companies} onRefresh={refresh} windowDays={windowDays} />
            </TabsContent>

            {/* Map Tab - Full featured with filters (free plan sees the last 30 days, enforced server-side) */}
            <TabsContent value="map" className="space-y-6 mt-0">
              <div className="h-[700px]">
                <PermitMapAdvanced permits={permits} showFilters={true} windowDays={windowDays} />
              </div>
            </TabsContent>

            {/* Companies Tab */}
            <TabsContent value="companies" className="space-y-6 mt-0">
              <CompaniesTab
                companies={companies}
                permits={permits}
                deals={deals}
                onRefresh={refresh}
                windowDays={windowDays}
                hiddenCompanyCount={hiddenCompanyCount}
                hiddenCompanies={hiddenCompanies}
                openCompanyName={pendingCompany}
                onOpenCompanyHandled={() => setPendingCompany(null)}
                requestedScoreFilter={pendingScoreFilter}
                onRequestedScoreFilterHandled={() => setPendingScoreFilter(null)}
              />
            </TabsContent>

            {/* Deals Tab */}
            <TabsContent value="deals" className="space-y-6 mt-0">
              <DealsTab deals={deals} companies={companies} onRefresh={refresh} />
            </TabsContent>

            {/* Account Tab */}
            <TabsContent value="account" className="space-y-6 mt-0">
              <AccountSettings
                email={user?.email}
                profile={profile}
                plan={plan}
                onProfileSaved={refreshProfile}
                onUpgrade={() => openUpgradeDialog('account_page')}
                onSignOut={signOut}
              />
            </TabsContent>

            {/* Products Tab */}
            <TabsContent value="products" className="space-y-6 mt-0">
              <ProductCatalog />
            </TabsContent>

            {/* Data Management Tab */}
            <TabsContent value="data" className="space-y-6 mt-0">
              {canAccess('pro') ? (
                <>
                  <DataImport onImportComplete={refresh} />
                  <DatasetManager
                    datasets={datasets}
                    onDelete={removeDataset}
                  />
                </>
              ) : (
                <UpgradePrompt label="Data import" tier="pro" onUpgradeClick={() => openUpgradeDialog('data_tab')} />
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <UpgradeDialog
        open={upgradeDialogOpen}
        onOpenChange={setUpgradeDialogOpen}
        source={upgradeSource}
      />
    </div>
  );
};

export default Index;