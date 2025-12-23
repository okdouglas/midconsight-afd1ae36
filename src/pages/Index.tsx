import { useState } from 'react';
import { Database, BarChart3, Users, Map, FileSpreadsheet, DollarSign, LogOut, Package, Search } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DataImport } from '@/components/DataImport';
import { DatasetManager } from '@/components/DatasetManager';
import { KPICards } from '@/components/KPICards';
import { PermitMap } from '@/components/PermitMap';
import { PermitMapAdvanced } from '@/components/PermitMapAdvanced';
import { CompaniesTab } from '@/components/CompaniesTab';
import { DealsTab } from '@/components/DealsTab';
import { ProductCatalog } from '@/components/ProductCatalog';
import { ResearchDesk } from '@/components/ResearchDesk';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const { user, signOut } = useAuth();
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
  } = useSupabaseData();

  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                <Database className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">MidconSight</h1>
                <p className="text-sm text-muted-foreground">Permit Intelligence Platform</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{stats.totalPermits} permits loaded</span>
              <span className="text-xs">{user?.email}</span>
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4 min-h-[calc(100vh-73px)]">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 h-full">
          <TabsList className="grid w-full max-w-4xl grid-cols-7">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="map" className="flex items-center gap-2">
              <Map className="h-4 w-4" />
              Map
            </TabsTrigger>
            <TabsTrigger value="companies" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Companies
            </TabsTrigger>
            <TabsTrigger value="research" className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Lead Research
            </TabsTrigger>
            <TabsTrigger value="deals" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Deals
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Products
            </TabsTrigger>
            <TabsTrigger value="data" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Data
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-3">
            {permits.length === 0 ? (
              <div className="text-center py-12">
                <Database className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                <h2 className="text-xl font-semibold mb-2">No Data Loaded</h2>
                <p className="text-muted-foreground mb-6">
                  Import your ITD wells/formations data to get started with permit intelligence.
                </p>
                <DataImport onImportComplete={refresh} />
              </div>
            ) : (
              <>
                <KPICards 
                  totalPermits={stats.totalPermits}
                  newThisWeek={stats.newThisWeek}
                  hotLeads={stats.hotLeads}
                  pipelineValue={stats.pipelineValue}
                />
                
                {/* New This Week Map - Expanded to 60-70% viewport */}
                {newThisWeekPermits.length > 0 && (
                  <div className="rounded-xl border border-border bg-card p-4 relative z-0 overflow-hidden isolate">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Map className="h-5 w-5 text-primary" />
                      New This Week ({newThisWeekPermits.length} permits)
                    </h3>
                    <div className="h-[calc(60vh-120px)] min-h-[400px] relative z-0">
                      <PermitMap permits={newThisWeekPermits} />
                    </div>
                  </div>
                )}
                
                {/* Quick Stats Grid */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-border bg-card p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Map className="h-5 w-5 text-primary" />
                      Geographic Distribution
                    </h3>
                    <div className="space-y-2 text-sm">
                      {Object.entries(
                        permits.reduce((acc, p) => {
                          const county = p.county || 'Unknown';
                          acc[county] = (acc[county] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      )
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([county, count]) => (
                          <div key={county} className="flex justify-between">
                            <span className="text-muted-foreground">{county}</span>
                            <span className="font-medium">{count}</span>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Top Operators
                    </h3>
                    <div className="space-y-2 text-sm">
                      {Object.entries(
                        permits.reduce((acc, p) => {
                          const op = p.operator || 'Unknown';
                          acc[op] = (acc[op] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      )
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([operator, count]) => (
                          <div key={operator} className="flex justify-between">
                            <span className="text-muted-foreground truncate mr-2">{operator}</span>
                            <span className="font-medium">{count}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* Research Desk Tab */}
          <TabsContent value="research" className="space-y-6">
            <ResearchDesk permits={permits} companies={companies} onRefresh={refresh} />
          </TabsContent>

          {/* Map Tab - Full featured with filters */}
          <TabsContent value="map" className="space-y-6">
            <div className="h-[700px]">
              <PermitMapAdvanced permits={permits} showFilters={true} />
            </div>
          </TabsContent>

          {/* Companies Tab */}
          <TabsContent value="companies" className="space-y-6">
            <CompaniesTab companies={companies} permits={permits} deals={deals} onRefresh={refresh} />
          </TabsContent>

          {/* Deals Tab */}
          <TabsContent value="deals" className="space-y-6">
            <DealsTab deals={deals} companies={companies} onRefresh={refresh} />
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-6">
            <ProductCatalog />
          </TabsContent>

          {/* Data Management Tab */}
          <TabsContent value="data" className="space-y-6">
            <DataImport onImportComplete={refresh} />
            <DatasetManager
              datasets={datasets}
              onDelete={removeDataset}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;