"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDistributionHistory } from '@/hooks/use-distribution-history';
import { DistributionEvent, exportDistributionsToCSV } from '@/lib/distribution-tracker';
import { Download, RefreshCw, TrendingUp, Users, Wallet, AlertCircle } from 'lucide-react';

export function DistributionHistoryViewer() {
  const { summary, events, loading, error, refresh } = useDistributionHistory();
  const [filter, setFilter] = useState<'all' | 'dev' | 'endowment'>('all');

  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true;
    return event.source === filter;
  });

  const handleExportCSV = () => {
    const csv = exportDistributionsToCSV(filteredEvents);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `distributions-${filter}-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Distribution History</CardTitle>
          <CardDescription>Loading distribution events...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Distribution History</CardTitle>
          <CardDescription>Error loading distribution events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
          <Button onClick={refresh} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Distributions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalDistributions}</div>
            <p className="text-xs text-muted-foreground">
              {summary.devDistributions} dev + {summary.endowmentDistributions} endowment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.totalAmountDistributed.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">BTC1USD distributed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recipients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalRecipients}</div>
            <p className="text-xs text-muted-foreground">
              {summary.totalFailed} failed transfers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.totalRecipients > 0
                ? (((summary.totalRecipients - summary.totalFailed) / summary.totalRecipients) * 100).toFixed(2)
                : '100.00'}%
            </div>
            <p className="text-xs text-muted-foreground">Overall success rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Distribution History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Distribution History</CardTitle>
              <CardDescription>
                All BatchTransferCompleted events from Dev and Endowment wallets
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                disabled={filteredEvents.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">
                All ({events.length})
              </TabsTrigger>
              <TabsTrigger value="dev">
                Dev Wallet ({summary.devDistributions})
              </TabsTrigger>
              <TabsTrigger value="endowment">
                Endowment ({summary.endowmentDistributions})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={filter} className="mt-6">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No distributions found
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredEvents.map((event, index) => (
                    <DistributionEventCard key={index} event={event} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function DistributionEventCard({ event }: { event: DistributionEvent }) {
  const date = new Date(event.timestamp * 1000);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <Badge variant={event.source === 'dev' ? 'default' : 'secondary'}>
                {event.source === 'dev' ? 'Dev Wallet' : 'Endowment Wallet'}
              </Badge>
              <Badge variant={event.totalFailed > 0 ? 'destructive' : 'outline'}>
                {event.successRate.toFixed(1)}% Success
              </Badge>
              <span className="text-xs text-muted-foreground">
                {date.toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Amount</div>
                <div className="font-mono font-semibold">
                  {event.amountFormatted.toFixed(8)} BTC1USD
                </div>
              </div>

              <div>
                <div className="text-muted-foreground">Recipients</div>
                <div className="font-semibold">{event.totalRecipients}</div>
              </div>

              <div>
                <div className="text-muted-foreground">Failed</div>
                <div className={`font-semibold ${event.totalFailed > 0 ? 'text-destructive' : ''}`}>
                  {event.totalFailed}
                </div>
              </div>

              <div>
                <div className="text-muted-foreground">Block</div>
                <div className="font-mono text-xs">{event.blockNumber.toString()}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Tx:</span>
              <a
                href={`https://basescan.org/tx/${event.transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-500 hover:underline truncate max-w-xs"
              >
                {event.transactionHash}
              </a>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
