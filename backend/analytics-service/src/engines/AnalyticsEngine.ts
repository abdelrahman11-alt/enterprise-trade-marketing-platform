import { Decimal } from 'decimal.js';
import { 
  addDays, 
  subDays, 
  startOfDay, 
  endOfDay, 
  format, 
  parseISO,
  differenceInDays,
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  startOfYear
} from 'date-fns';
import * as math from 'mathjs';
import * as ss from 'simple-statistics';
import { config } from '../config';
import { logger } from '../utils/logger';
import { CacheService } from '../services/cache';
import { ElasticsearchService } from '../services/elasticsearch';
import { ClickHouseService } from '../services/clickhouse';
import { generateId } from '@trade-marketing/shared';

export interface AnalyticsQuery {
  metrics: string[];
  dimensions: string[];
  filters: Record<string, any>;
  dateRange: {
    start: string;
    end: string;
  };
  granularity: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
  limit?: number;
  offset?: number;
  orderBy?: Array<{
    field: string;
    direction: 'asc' | 'desc';
  }>;
}

export interface AnalyticsResult {
  data: Array<Record<string, any>>;
  metadata: {
    totalRows: number;
    executionTime: number;
    cacheHit: boolean;
    query: AnalyticsQuery;
  };
  aggregations?: Record<string, any>;
  trends?: Array<{
    metric: string;
    trend: 'up' | 'down' | 'stable';
    change: number;
    significance: number;
  }>;
}

export interface KPIDefinition {
  id: string;
  name: string;
  description: string;
  formula: string;
  category: string;
  unit: string;
  format: string;
  target?: number;
  benchmark?: number;
  thresholds: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
}

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  widgets: Widget[];
  filters: Record<string, any>;
  refreshInterval: number;
  permissions: string[];
}

export interface Widget {
  id: string;
  type: 'chart' | 'table' | 'metric' | 'gauge' | 'map' | 'text';
  title: string;
  query: AnalyticsQuery;
  visualization: {
    chartType?: 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap' | 'funnel';
    options: Record<string, any>;
  };
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface Insight {
  id: string;
  type: 'anomaly' | 'trend' | 'correlation' | 'forecast' | 'recommendation';
  title: string;
  description: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  category: string;
  data: any;
  actionable: boolean;
  actions?: Array<{
    title: string;
    description: string;
    type: string;
  }>;
  createdAt: Date;
  expiresAt?: Date;
}

export class AnalyticsEngine {
  private cacheService: CacheService;
  private elasticsearchService: ElasticsearchService;
  private clickhouseService: ClickHouseService;

  constructor() {
    this.cacheService = new CacheService();
    this.elasticsearchService = new ElasticsearchService();
    this.clickhouseService = new ClickHouseService();
  }

  // Execute analytics query
  async executeQuery(query: AnalyticsQuery): Promise<AnalyticsResult> {
    const startTime = Date.now();
    
    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(query);
      
      // Check cache first
      const cachedResult = await this.cacheService.get(cacheKey);
      if (cachedResult) {
        logger.debug('Analytics query cache hit', { cacheKey });
        return {
          ...cachedResult,
          metadata: {
            ...cachedResult.metadata,
            executionTime: Date.now() - startTime,
            cacheHit: true,
          },
        };
      }

      // Execute query based on data source
      const dataSource = this.selectDataSource(query);
      let result: AnalyticsResult;

      switch (dataSource) {
        case 'clickhouse':
          result = await this.executeClickHouseQuery(query);
          break;
        case 'elasticsearch':
          result = await this.executeElasticsearchQuery(query);
          break;
        default:
          throw new Error(`Unsupported data source: ${dataSource}`);
      }

      // Calculate trends
      result.trends = await this.calculateTrends(query, result.data);

      // Add metadata
      result.metadata = {
        totalRows: result.data.length,
        executionTime: Date.now() - startTime,
        cacheHit: false,
        query,
      };

      // Cache result
      const cacheTTL = this.calculateCacheTTL(query);
      await this.cacheService.set(cacheKey, result, cacheTTL);

      logger.info('Analytics query executed', {
        metrics: query.metrics,
        dimensions: query.dimensions,
        executionTime: result.metadata.executionTime,
        totalRows: result.metadata.totalRows,
      });

      return result;

    } catch (error) {
      logger.error('Analytics query execution failed', { error, query });
      throw error;
    }
  }

  // Calculate KPIs
  async calculateKPIs(
    kpiIds: string[],
    filters: Record<string, any> = {},
    dateRange: { start: string; end: string }
  ): Promise<Array<{
    kpi: KPIDefinition;
    value: number;
    previousValue?: number;
    change?: number;
    changePercentage?: number;
    status: 'excellent' | 'good' | 'fair' | 'poor';
    trend: 'up' | 'down' | 'stable';
  }>> {
    try {
      const results = [];

      for (const kpiId of kpiIds) {
        const kpi = await this.getKPIDefinition(kpiId);
        if (!kpi) continue;

        // Calculate current value
        const currentValue = await this.calculateKPIValue(kpi, filters, dateRange);

        // Calculate previous period value for comparison
        const previousDateRange = this.getPreviousPeriod(dateRange);
        const previousValue = await this.calculateKPIValue(kpi, filters, previousDateRange);

        // Calculate change
        const change = currentValue - previousValue;
        const changePercentage = previousValue !== 0 ? (change / previousValue) * 100 : 0;

        // Determine status
        const status = this.getKPIStatus(currentValue, kpi.thresholds);

        // Determine trend
        const trend = this.getKPITrend(change, changePercentage);

        results.push({
          kpi,
          value: currentValue,
          previousValue,
          change,
          changePercentage,
          status,
          trend,
        });
      }

      return results;

    } catch (error) {
      logger.error('KPI calculation failed', { error, kpiIds });
      throw error;
    }
  }

  // Generate insights
  async generateInsights(
    companyId: string,
    categories: string[] = [],
    limit: number = 10
  ): Promise<Insight[]> {
    try {
      const insights: Insight[] = [];

      // Detect anomalies
      const anomalies = await this.detectAnomalies(companyId, categories);
      insights.push(...anomalies);

      // Identify trends
      const trends = await this.identifyTrends(companyId, categories);
      insights.push(...trends);

      // Find correlations
      const correlations = await this.findCorrelations(companyId, categories);
      insights.push(...correlations);

      // Generate forecasts
      const forecasts = await this.generateForecasts(companyId, categories);
      insights.push(...forecasts);

      // Create recommendations
      const recommendations = await this.createRecommendations(companyId, categories);
      insights.push(...recommendations);

      // Sort by impact and confidence
      insights.sort((a, b) => {
        const aScore = this.calculateInsightScore(a);
        const bScore = this.calculateInsightScore(b);
        return bScore - aScore;
      });

      return insights.slice(0, limit);

    } catch (error) {
      logger.error('Insight generation failed', { error, companyId });
      throw error;
    }
  }

  // Create dashboard
  async createDashboard(dashboardData: Partial<Dashboard>): Promise<Dashboard> {
    try {
      const dashboard: Dashboard = {
        id: generateId(),
        name: dashboardData.name || 'New Dashboard',
        description: dashboardData.description || '',
        widgets: dashboardData.widgets || [],
        filters: dashboardData.filters || {},
        refreshInterval: dashboardData.refreshInterval || 300000, // 5 minutes
        permissions: dashboardData.permissions || [],
      };

      // Validate widgets
      for (const widget of dashboard.widgets) {
        await this.validateWidget(widget);
      }

      // Store dashboard
      await this.storeDashboard(dashboard);

      logger.info('Dashboard created', {
        dashboardId: dashboard.id,
        name: dashboard.name,
        widgetCount: dashboard.widgets.length,
      });

      return dashboard;

    } catch (error) {
      logger.error('Dashboard creation failed', { error });
      throw error;
    }
  }

  // Execute dashboard
  async executeDashboard(dashboardId: string, filters: Record<string, any> = {}): Promise<{
    dashboard: Dashboard;
    results: Array<{
      widgetId: string;
      data: AnalyticsResult;
      error?: string;
    }>;
  }> {
    try {
      const dashboard = await this.getDashboard(dashboardId);
      if (!dashboard) {
        throw new Error('Dashboard not found');
      }

      const results = [];

      // Execute each widget query
      for (const widget of dashboard.widgets) {
        try {
          // Merge dashboard filters with widget query filters
          const mergedQuery = {
            ...widget.query,
            filters: {
              ...widget.query.filters,
              ...dashboard.filters,
              ...filters,
            },
          };

          const data = await this.executeQuery(mergedQuery);
          results.push({
            widgetId: widget.id,
            data,
          });

        } catch (error) {
          logger.error('Widget execution failed', { error, widgetId: widget.id });
          results.push({
            widgetId: widget.id,
            data: { data: [], metadata: { totalRows: 0, executionTime: 0, cacheHit: false, query: widget.query } },
            error: error.message,
          });
        }
      }

      return {
        dashboard,
        results,
      };

    } catch (error) {
      logger.error('Dashboard execution failed', { error, dashboardId });
      throw error;
    }
  }

  // Perform cohort analysis
  async performCohortAnalysis(
    cohortDefinition: {
      cohortEvent: string;
      returnEvent: string;
      cohortPeriod: 'day' | 'week' | 'month';
      periods: number;
      filters: Record<string, any>;
      dateRange: { start: string; end: string };
    }
  ): Promise<{
    cohorts: Array<{
      cohortPeriod: string;
      cohortSize: number;
      periods: Array<{
        period: number;
        users: number;
        percentage: number;
      }>;
    }>;
    summary: {
      averageRetention: number;
      bestCohort: string;
      worstCohort: string;
    };
  }> {
    try {
      // Implementation would perform cohort analysis
      // This is a complex analysis that tracks user behavior over time
      
      const cohorts = [];
      const startDate = parseISO(cohortDefinition.dateRange.start);
      const endDate = parseISO(cohortDefinition.dateRange.end);

      // Generate cohort periods
      let currentDate = startDate;
      while (currentDate <= endDate) {
        const cohortPeriod = format(currentDate, 'yyyy-MM-dd');
        const cohortData = await this.calculateCohortData(
          cohortDefinition,
          currentDate
        );

        cohorts.push({
          cohortPeriod,
          cohortSize: cohortData.size,
          periods: cohortData.periods,
        });

        // Move to next period
        switch (cohortDefinition.cohortPeriod) {
          case 'day':
            currentDate = addDays(currentDate, 1);
            break;
          case 'week':
            currentDate = addDays(currentDate, 7);
            break;
          case 'month':
            currentDate = addDays(currentDate, 30);
            break;
        }
      }

      // Calculate summary statistics
      const averageRetention = this.calculateAverageRetention(cohorts);
      const bestCohort = this.findBestCohort(cohorts);
      const worstCohort = this.findWorstCohort(cohorts);

      return {
        cohorts,
        summary: {
          averageRetention,
          bestCohort,
          worstCohort,
        },
      };

    } catch (error) {
      logger.error('Cohort analysis failed', { error });
      throw error;
    }
  }

  // Perform funnel analysis
  async performFunnelAnalysis(
    funnelDefinition: {
      steps: Array<{
        name: string;
        event: string;
        filters?: Record<string, any>;
      }>;
      conversionWindow: number; // hours
      filters: Record<string, any>;
      dateRange: { start: string; end: string };
    }
  ): Promise<{
    steps: Array<{
      step: number;
      name: string;
      users: number;
      conversionRate: number;
      dropoffRate: number;
    }>;
    overallConversion: number;
    insights: string[];
  }> {
    try {
      const steps = [];
      let previousUsers = 0;

      for (let i = 0; i < funnelDefinition.steps.length; i++) {
        const step = funnelDefinition.steps[i];
        
        // Calculate users for this step
        const users = await this.calculateFunnelStepUsers(
          step,
          funnelDefinition,
          i === 0 ? null : funnelDefinition.steps[i - 1]
        );

        const conversionRate = i === 0 ? 100 : (users / previousUsers) * 100;
        const dropoffRate = 100 - conversionRate;

        steps.push({
          step: i + 1,
          name: step.name,
          users,
          conversionRate,
          dropoffRate,
        });

        previousUsers = users;
      }

      const overallConversion = steps.length > 0 
        ? (steps[steps.length - 1].users / steps[0].users) * 100 
        : 0;

      // Generate insights
      const insights = this.generateFunnelInsights(steps);

      return {
        steps,
        overallConversion,
        insights,
      };

    } catch (error) {
      logger.error('Funnel analysis failed', { error });
      throw error;
    }
  }

  // Private helper methods
  private generateCacheKey(query: AnalyticsQuery): string {
    const queryString = JSON.stringify(query);
    return `analytics:query:${Buffer.from(queryString).toString('base64')}`;
  }

  private selectDataSource(query: AnalyticsQuery): 'clickhouse' | 'elasticsearch' {
    // Select data source based on query characteristics
    if (query.metrics.some(m => m.includes('text') || m.includes('search'))) {
      return 'elasticsearch';
    }
    return 'clickhouse'; // Default for numerical analytics
  }

  private async executeClickHouseQuery(query: AnalyticsQuery): Promise<AnalyticsResult> {
    // Implementation would execute query against ClickHouse
    return {
      data: [],
      metadata: {
        totalRows: 0,
        executionTime: 0,
        cacheHit: false,
        query,
      },
    };
  }

  private async executeElasticsearchQuery(query: AnalyticsQuery): Promise<AnalyticsResult> {
    // Implementation would execute query against Elasticsearch
    return {
      data: [],
      metadata: {
        totalRows: 0,
        executionTime: 0,
        cacheHit: false,
        query,
      },
    };
  }

  private async calculateTrends(query: AnalyticsQuery, data: any[]): Promise<AnalyticsResult['trends']> {
    const trends = [];

    for (const metric of query.metrics) {
      const values = data.map(row => row[metric]).filter(v => v != null);
      
      if (values.length < 2) continue;

      // Calculate trend using linear regression
      const indices = values.map((_, i) => i);
      const regression = ss.linearRegression(indices.map((x, i) => [x, values[i]]));
      
      const slope = regression.m;
      const trend = slope > 0.01 ? 'up' : slope < -0.01 ? 'down' : 'stable';
      const change = slope * (values.length - 1);
      const significance = Math.abs(slope) / Math.max(...values);

      trends.push({
        metric,
        trend,
        change,
        significance,
      });
    }

    return trends;
  }

  private calculateCacheTTL(query: AnalyticsQuery): number {
    // Calculate cache TTL based on query characteristics
    const now = new Date();
    const endDate = parseISO(query.dateRange.end);
    
    // If query includes current data, use shorter TTL
    if (endDate >= now) {
      return 300; // 5 minutes
    }
    
    // Historical data can be cached longer
    return 3600; // 1 hour
  }

  private async getKPIDefinition(kpiId: string): Promise<KPIDefinition | null> {
    // Implementation would fetch KPI definition from database
    return null;
  }

  private async calculateKPIValue(
    kpi: KPIDefinition,
    filters: Record<string, any>,
    dateRange: { start: string; end: string }
  ): Promise<number> {
    // Implementation would calculate KPI value based on formula
    return 0;
  }

  private getPreviousPeriod(dateRange: { start: string; end: string }): { start: string; end: string } {
    const start = parseISO(dateRange.start);
    const end = parseISO(dateRange.end);
    const duration = differenceInDays(end, start);
    
    return {
      start: format(subDays(start, duration + 1), 'yyyy-MM-dd'),
      end: format(subDays(end, duration + 1), 'yyyy-MM-dd'),
    };
  }

  private getKPIStatus(value: number, thresholds: KPIDefinition['thresholds']): 'excellent' | 'good' | 'fair' | 'poor' {
    if (value >= thresholds.excellent) return 'excellent';
    if (value >= thresholds.good) return 'good';
    if (value >= thresholds.fair) return 'fair';
    return 'poor';
  }

  private getKPITrend(change: number, changePercentage: number): 'up' | 'down' | 'stable' {
    if (Math.abs(changePercentage) < 1) return 'stable';
    return change > 0 ? 'up' : 'down';
  }

  private async detectAnomalies(companyId: string, categories: string[]): Promise<Insight[]> {
    // Implementation would detect statistical anomalies in data
    return [];
  }

  private async identifyTrends(companyId: string, categories: string[]): Promise<Insight[]> {
    // Implementation would identify significant trends
    return [];
  }

  private async findCorrelations(companyId: string, categories: string[]): Promise<Insight[]> {
    // Implementation would find correlations between metrics
    return [];
  }

  private async generateForecasts(companyId: string, categories: string[]): Promise<Insight[]> {
    // Implementation would generate forecasts using ML models
    return [];
  }

  private async createRecommendations(companyId: string, categories: string[]): Promise<Insight[]> {
    // Implementation would create actionable recommendations
    return [];
  }

  private calculateInsightScore(insight: Insight): number {
    const impactScore = { low: 1, medium: 2, high: 3 }[insight.impact];
    return insight.confidence * impactScore;
  }

  private async validateWidget(widget: Widget): Promise<void> {
    // Validate widget configuration
    if (!widget.query.metrics || widget.query.metrics.length === 0) {
      throw new Error('Widget must have at least one metric');
    }
  }

  private async storeDashboard(dashboard: Dashboard): Promise<void> {
    // Implementation would store dashboard in database
  }

  private async getDashboard(dashboardId: string): Promise<Dashboard | null> {
    // Implementation would fetch dashboard from database
    return null;
  }

  private async calculateCohortData(
    cohortDefinition: any,
    cohortDate: Date
  ): Promise<{ size: number; periods: any[] }> {
    // Implementation would calculate cohort data
    return { size: 0, periods: [] };
  }

  private calculateAverageRetention(cohorts: any[]): number {
    // Implementation would calculate average retention across cohorts
    return 0;
  }

  private findBestCohort(cohorts: any[]): string {
    // Implementation would find the best performing cohort
    return '';
  }

  private findWorstCohort(cohorts: any[]): string {
    // Implementation would find the worst performing cohort
    return '';
  }

  private async calculateFunnelStepUsers(
    step: any,
    funnelDefinition: any,
    previousStep: any
  ): Promise<number> {
    // Implementation would calculate users for funnel step
    return 0;
  }

  private generateFunnelInsights(steps: any[]): string[] {
    const insights = [];
    
    // Find biggest drop-off
    let maxDropoff = 0;
    let maxDropoffStep = 0;
    
    for (let i = 1; i < steps.length; i++) {
      if (steps[i].dropoffRate > maxDropoff) {
        maxDropoff = steps[i].dropoffRate;
        maxDropoffStep = i;
      }
    }
    
    if (maxDropoff > 50) {
      insights.push(`Biggest drop-off occurs at step ${maxDropoffStep + 1}: ${steps[maxDropoffStep].name} (${maxDropoff.toFixed(1)}% drop-off)`);
    }
    
    return insights;
  }
}