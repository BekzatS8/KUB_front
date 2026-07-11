"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LoadingState } from '@/components/ui/loading';
import { ErrorState } from '@/components/ui/error-state';
import { Calendar, TrendingUp, Users, Target, DollarSign, ArrowUpRight, ArrowDownRight, Minus, Award, Building2, Phone, Mail, Globe } from 'lucide-react';
import * as ReportsAPI from '@/src/api/reports.api';
import type * as Models from '@/src/models/reports.model';

interface KPICardProps {
  title: string;
  value: string | number;
  trend?: number;
  icon: React.ReactNode;
  description?: string;
}

function KPICard({ title, value, trend, icon, description }: KPICardProps) {
  const getTrendIcon = () => {
    if (trend === undefined) return null;
    if (trend > 0) return <ArrowUpRight className="h-4 w-4 text-green-600" />;
    if (trend < 0) return <ArrowDownRight className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getTrendColor = () => {
    if (trend === undefined) return 'text-muted-foreground';
    if (trend > 0) return 'text-green-600';
    if (trend < 0) return 'text-red-600';
    return 'text-muted-foreground';
  };

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 right-0 p-2 opacity-10">
        {icon}
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-bold">{value}</div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 text-sm ${getTrendColor()}`}>
              {getTrendIcon()}
              <span>{Math.abs(trend)}%</span>
            </div>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

interface StatusItemProps {
  status: string;
  count: number;
  total: number;
  color: string;
}

function StatusItem({ status, count, total, color }: StatusItemProps) {
  const percentage = total > 0 ? (count / total * 100).toFixed(1) : '0';
  
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${color}`}></div>
        <div>
          <p className="font-medium">{status}</p>
          <p className="text-sm text-muted-foreground">{count.toLocaleString()} сделок</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-bold text-lg">{percentage}%</p>
        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full ${color} transition-all duration-500`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}

interface SourceItemProps {
  source: string;
  count: number;
  total: number;
  icon: React.ReactNode;
}

function SourceItem({ source, count, total, icon }: SourceItemProps) {
  const percentage = total > 0 ? (count / total * 100).toFixed(1) : '0';
  
  return (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted">
          {icon}
        </div>
        <div>
          <p className="font-medium">{source}</p>
          <p className="text-sm text-muted-foreground">{count.toLocaleString()} лидов</p>
        </div>
      </div>
      <div className="text-right">
        <Badge variant="secondary" className="text-sm">
          {percentage}%
        </Badge>
      </div>
    </div>
  );
}

interface ClientItemProps {
  client: Models.TopClientItem;
  index: number;
  totalRevenue: number;
}

function ClientItem({ client, index, totalRevenue }: ClientItemProps) {
  const percentage = totalRevenue > 0 ? (client.total_amount / totalRevenue * 100).toFixed(1) : '0';
  
  const getMedalIcon = () => {
    if (index === 0) return <Award className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Award className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Award className="h-5 w-5 text-orange-600" />;
    return <span className="text-sm font-bold text-muted-foreground">#{index + 1}</span>;
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-gradient-to-r from-muted/50 to-transparent hover:from-muted/70 transition-colors">
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-8 h-8">
          {getMedalIcon()}
        </div>
        <div>
          <p className="font-semibold">{client.client_name}</p>
          <p className="text-sm text-muted-foreground">ID: {client.client_id}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-bold text-lg text-primary">
          {formatCurrency(client.total_amount, client.currency)}
        </p>
        <p className="text-xs text-muted-foreground">{percentage}% от общей выручки</p>
      </div>
    </div>
  );
}

interface RevenuePeriodProps {
  period: string;
  amount: number;
  currency: string;
  isHighest?: boolean;
  isLowest?: boolean;
}

function RevenuePeriod({ period, amount, currency, isHighest, isLowest }: RevenuePeriodProps) {
  return (
    <div className={`p-4 rounded-lg border ${isHighest ? 'border-green-200 bg-green-50' : isLowest ? 'border-red-200 bg-red-50' : 'bg-card'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{period}</p>
          <p className="text-sm text-muted-foreground">Период</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-lg">{formatCurrency(amount, currency)}</p>
          {isHighest && <Badge variant="default" className="text-xs">Максимум</Badge>}
          {isLowest && <Badge variant="destructive" className="text-xs">Минимум</Badge>}
        </div>
      </div>
    </div>
  );
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: currency === 'KZT' ? 'KZT' : 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getStatusDisplayName(status: string) {
  const statusMap: Record<string, string> = {
    'new': 'Новые',
    'in_progress': 'В работе',
    'won': 'Выиграно',
    'lost': 'Проиграно',
    'pending': 'В ожидании',
    'contacted': 'Контактированы',
    'qualified': 'Квалифицированы',
    'converted': 'Конвертированы',
  };
  return statusMap[status] || status;
}

function getStatusColor(status: string) {
  const colorMap: Record<string, string> = {
    'new': 'bg-blue-500',
    'in_progress': 'bg-yellow-500',
    'won': 'bg-green-500',
    'lost': 'bg-red-500',
    'pending': 'bg-gray-500',
    'contacted': 'bg-purple-500',
    'qualified': 'bg-indigo-500',
    'converted': 'bg-emerald-500',
  };
  return colorMap[status] || 'bg-gray-500';
}

function getSourceDisplayName(source: string) {
  const sourceMap: Record<string, string> = {
    'website': 'Веб-сайт',
    'phone': 'Телефон',
    'email': 'Email',
    'social': 'Социальные сети',
    'referral': 'Рекомендация',
    'advertisement': 'Реклама',
  };
  return sourceMap[source] || source;
}

function getSourceIcon(source: string) {
  const iconMap: Record<string, React.ReactNode> = {
    'website': <Globe className="h-4 w-4" />,
    'phone': <Phone className="h-4 w-4" />,
    'email': <Mail className="h-4 w-4" />,
    'social': <Users className="h-4 w-4" />,
    'referral': <Award className="h-4 w-4" />,
    'advertisement': <TrendingUp className="h-4 w-4" />,
  };
  return iconMap[source] || <Building2 className="h-4 w-4" />;
}

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    funnel: Models.SalesFunnelResponse | null;
    leads: Models.LeadsSummaryResponse | null;
    revenue: Models.RevenueResponse | null;
  }>({
    funnel: null,
    leads: null,
    revenue: null,
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        from: dateRange.from,
        to: dateRange.to,
        period,
      };

      const [funnelData, leadsData, revenueData] = await Promise.all([
        ReportsAPI.funnel(params),
        ReportsAPI.leads_summary(params),
        ReportsAPI.revenue(params),
      ]);

      setData({
        funnel: funnelData,
        leads: leadsData,
        revenue: revenueData,
      });
    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
      setError(error instanceof Error ? error.message : 'Не удалось загрузить данные аналитики');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange, period]);


  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingState message="Загрузка аналитики..." size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <ErrorState 
          title="Ошибка загрузки аналитики"
          message={error}
          onRetry={fetchData}
        />
      </div>
    );
  }

  // Calculate KPIs
  const totalRevenue = data.revenue?.items.reduce((sum, item) => sum + item.total_amount, 0) || 0;
  const totalDeals = data.funnel?.items.reduce((sum, item) => sum + item.count, 0) || 0;
  const wonDeals = data.funnel?.items.find(item => item.status === 'won')?.count || 0;
  const conversionRate = totalDeals > 0 ? (wonDeals / totalDeals * 100) : 0;
  const totalLeads = data.leads?.items.reduce((sum, item) => sum + item.count, 0) || 0;

  // Find highest and lowest revenue periods
  const revenueItems = data.revenue?.items || [];
  const highestRevenue = revenueItems.length > 0 ? Math.max(...revenueItems.map(item => item.total_amount)) : 0;
  const lowestRevenue = revenueItems.length > 0 ? Math.min(...revenueItems.map(item => item.total_amount)) : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="sm:text-right sm:flex-1">
          <h1 className="text-3xl font-bold">Аналитика</h1>
          <p className="text-muted-foreground">Обзор показателей вашей CRM системы</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:flex-initial">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="px-3 py-2 border rounded-md text-sm"
            />
            <span className="text-muted-foreground">-</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="px-3 py-2 border rounded-md text-sm"
            />
          </div>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as 'month' | 'quarter' | 'year')}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value="month">Месяц</option>
            <option value="quarter">Квартал</option>
            <option value="year">Год</option>
          </select>
          <Button onClick={fetchData} variant="outline" size="sm">
            Обновить
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Общая выручка"
          value={formatCurrency(totalRevenue, data.revenue?.items[0]?.currency || 'KZT')}
          icon={<DollarSign className="h-6 w-6" />}
          description="За выбранный период"
        />
        <KPICard
          title="Всего сделок"
          value={totalDeals.toLocaleString()}
          icon={<Target className="h-6 w-6" />}
          description={`${wonDeals} выиграно`}
        />
        <KPICard
          title="Конверсия"
          value={`${conversionRate.toFixed(1)}%`}
          icon={<TrendingUp className="h-6 w-6" />}
          description="Выиграно / Всего"
        />
        <Link href="/leads" className="block transition-transform hover:scale-[1.01]" title="Открыть список лидов">
          <KPICard
            title="Всего лидов"
            value={totalLeads.toLocaleString()}
            icon={<Users className="h-6 w-6" />}
            description="За весь период — открыть список"
          />
        </Link>
      </div>

      {/* Sales Funnel Status Breakdown */}
      {data.funnel?.items && data.funnel.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Воронка продаж
            </CardTitle>
            <CardDescription>
              Распределение сделок по статусам ({data.funnel.items.reduce((sum, item) => sum + item.count, 0)} сделок)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.funnel.items
                .sort((a, b) => b.count - a.count)
                .map((item) => (
                  <StatusItem
                    key={item.status}
                    status={getStatusDisplayName(item.status)}
                    count={item.count}
                    total={data.funnel!.items.reduce((sum, i) => sum + i.count, 0)}
                    color={getStatusColor(item.status)}
                  />
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lead Sources */}
        {data.leads?.items && data.leads.items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Источники лидов
              </CardTitle>
              <CardDescription>
                Распределение лидов по источникам ({data.leads.items.reduce((sum, item) => sum + item.count, 0)} лидов)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.leads.items
                  .reduce((acc: any[], item) => {
                    const existing = acc.find(x => x.source === item.source);
                    if (existing) {
                      existing.count += item.count;
                    } else {
                      acc.push({
                        source: item.source,
                        count: item.count,
                      });
                    }
                    return acc;
                  }, [])
                  .sort((a, b) => b.count - a.count)
                  .map((item) => (
                    <Link
                      key={item.source}
                      href={`/leads?source=${encodeURIComponent(item.source)}`}
                      className="block transition-colors hover:bg-muted/40 rounded-lg"
                      title="Открыть лиды этого источника"
                    >
                      <SourceItem
                        source={getSourceDisplayName(item.source)}
                        count={item.count}
                        total={data.leads!.items.reduce((sum, i) => sum + i.count, 0)}
                        icon={getSourceIcon(item.source)}
                      />
                    </Link>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Revenue by Period */}
        {data.revenue?.items && data.revenue.items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Выручка по периодам
              </CardTitle>
              <CardDescription>
                Динамика выручки ({data.revenue.items.length} периодов)
              </CardDescription>
            </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.revenue.items
                .sort((a, b) => b.total_amount - a.total_amount)
                .map((item) => (
                  <RevenuePeriod
                    key={item.period}
                    period={item.period}
                    amount={item.total_amount}
                    currency={item.currency}
                    isHighest={item.total_amount === highestRevenue}
                    isLowest={item.total_amount === lowestRevenue}
                  />
                ))}
            </div>
          </CardContent>
        </Card>
      )}
      </div>

      {/* Top Clients */}
      {data.revenue?.top_clients && data.revenue.top_clients.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Топ клиентов по выручке
            </CardTitle>
            <CardDescription>
              Клиенты с наибольшей выручкой за период ({data.revenue.top_clients.length} клиентов)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.revenue.top_clients.map((client, index) => (
                <ClientItem
                  key={client.client_id}
                  client={client}
                  index={index}
                  totalRevenue={totalRevenue}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
