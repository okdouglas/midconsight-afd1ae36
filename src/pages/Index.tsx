import { useState } from 'react';
import { Database, BarChart3, Users, Map, FileSpreadsheet, DollarSign } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataImport } from '@/components/DataImport';
import { DatasetManager } from '@/components/DatasetManager';
import { KPICards } from '@/components/KPICards';
import { PermitMap } from '@/components/PermitMap';
import { CompaniesTab } from '@/components/CompaniesTab';
import { DealsTab } from '@/components/DealsTab';
import { useMidconData } from '@/hooks/useMidconData';

const Index = () => {
  const {
    permits,
    datasets,
    activeDataset,
    companies,
    deals,
    loading,
    refresh,
    switchDataset,
    removeDataset,
    stats,
  } = useMidconData();

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
              {activeDataset && (
                <span className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Active: <span className="font-medium text-foreground">{activeDataset.name}</span>
                </span>
              )}
              <span>{permits.length} permits loaded</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-5">
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
            <TabsTrigger value="deals" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Deals
            </TabsTrigger>
            <TabsTrigger value="data" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Data
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
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
                
                {/* Quick Stats Grid */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-xl border border-border bg-card p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
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

                  <div className="rounded-xl border border-border bg-card p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
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

                  <div className="rounded-xl border border-border bg-card p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Formation Types
                    </h3>
                    <div className="space-y-2 text-sm">
                      {Object.entries(
                        permits.reduce((acc, p) => {
                          const formation = p.formationName || 'Unknown';
                          acc[formation] = (acc[formation] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      )
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([formation, count]) => (
                          <div key={formation} className="flex justify-between">
                            <span className="text-muted-foreground truncate mr-2">{formation}</span>
                            <span className="font-medium">{count}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* Map Tab */}
          <TabsContent value="map" className="space-y-6">
            <div className="h-[600px]">
              <PermitMap permits={permits} />
            </div>
          </TabsContent>

          {/* Companies Tab */}
          <TabsContent value="companies" className="space-y-6">
            <CompaniesTab companies={companies} onRefresh={refresh} />
          </TabsContent>

          {/* Deals Tab */}
          <TabsContent value="deals" className="space-y-6">
            <DealsTab deals={deals} companies={companies} onRefresh={refresh} />
          </TabsContent>

          {/* Data Management Tab */}
          <TabsContent value="data" className="space-y-6">
            <DataImport onImportComplete={refresh} />
            <DatasetManager
              datasets={datasets}
              activeDataset={activeDataset}
              onSwitch={switchDataset}
              onDelete={removeDataset}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
