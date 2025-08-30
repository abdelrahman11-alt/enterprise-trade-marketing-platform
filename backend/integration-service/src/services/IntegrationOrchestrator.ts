import { EventEmitter } from 'events';
import { config } from '../config';
import { logger } from '../utils/logger';
import { CacheService } from './cache';
import { KafkaService } from './kafka';
import { ERPConnector } from '../connectors/ERPConnector';
import { CRMConnector } from '../connectors/CRMConnector';
import { POSConnector } from '../connectors/POSConnector';
import { RetailConnector } from '../connectors/RetailConnector';
import { ECommerceConnector } from '../connectors/ECommerceConnector';
import { DataTransformer } from '../transformers/DataTransformer';
import { generateId } from '@trade-marketing/shared';

export interface IntegrationConfig {
  id: string;
  name: string;
  type: 'erp' | 'crm' | 'pos' | 'retail' | 'ecommerce' | 'analytics' | 'marketing' | 'finance';
  provider: string;
  status: 'active' | 'inactive' | 'error' | 'maintenance';
  connection: {
    endpoint: string;
    authentication: {
      type: 'api_key' | 'oauth' | 'basic' | 'jwt' | 'certificate';
      credentials: Record<string, any>;
    };
    timeout: number;
    retryPolicy: {
      maxRetries: number;
      backoffMultiplier: number;
      maxBackoffMs: number;
    };
  };
  sync: {
    enabled: boolean;
    frequency: 'real-time' | 'hourly' | 'daily' | 'weekly' | 'monthly';
    schedule?: string; // cron expression
    batchSize: number;
    direction: 'inbound' | 'outbound' | 'bidirectional';
  };
  mapping: {
    entities: Array<{
      source: string;
      target: string;
      fields: Array<{
        source: string;
        target: string;
        transform?: string;
        required: boolean;
      }>;
    }>;
  };
  filters: Array<{
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
    value: any;
  }>;
  validation: {
    enabled: boolean;
    rules: Array<{
      field: string;
      type: 'required' | 'format' | 'range' | 'custom';
      parameters: any;
    }>;
  };
  errorHandling: {
    strategy: 'skip' | 'retry' | 'fail' | 'transform';
    maxErrors: number;
    notificationThreshold: number;
  };
}

export interface SyncJob {
  id: string;
  integrationId: string;
  type: 'full' | 'incremental' | 'delta';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt?: Date;
  completedAt?: Date;
  progress: {
    total: number;
    processed: number;
    successful: number;
    failed: number;
    skipped: number;
  };
  errors: Array<{
    record: any;
    error: string;
    timestamp: Date;
  }>;
  metadata: Record<string, any>;
}

export interface DataFlow {
  id: string;
  name: string;
  description: string;
  source: {
    integrationId: string;
    entity: string;
    query?: any;
  };
  target: {
    integrationId: string;
    entity: string;
  };
  transformations: Array<{
    type: 'map' | 'filter' | 'aggregate' | 'enrich' | 'validate';
    config: any;
  }>;
  schedule: {
    enabled: boolean;
    frequency: string;
    timezone: string;
  };
  monitoring: {
    enabled: boolean;
    alerts: Array<{
      condition: string;
      threshold: any;
      recipients: string[];
    }>;
  };
}

export class IntegrationOrchestrator extends EventEmitter {
  private cacheService: CacheService;
  private kafkaService: KafkaService;
  private dataTransformer: DataTransformer;
  private connectors: Map<string, any> = new Map();
  private activeJobs: Map<string, SyncJob> = new Map();
  private integrations: Map<string, IntegrationConfig> = new Map();

  constructor() {
    super();
    this.cacheService = new CacheService();
    this.kafkaService = new KafkaService();
    this.dataTransformer = new DataTransformer();
    
    this.initializeConnectors();
  }

  private initializeConnectors(): void {
    // Initialize all connector types
    this.connectors.set('erp', new ERPConnector());
    this.connectors.set('crm', new CRMConnector());
    this.connectors.set('pos', new POSConnector());
    this.connectors.set('retail', new RetailConnector());
    this.connectors.set('ecommerce', new ECommerceConnector());
  }

  // Register a new integration
  async registerIntegration(integrationConfig: IntegrationConfig): Promise<void> {
    try {
      // Validate configuration
      await this.validateIntegrationConfig(integrationConfig);

      // Test connection
      await this.testConnection(integrationConfig);

      // Store configuration
      this.integrations.set(integrationConfig.id, integrationConfig);
      await this.cacheService.set(
        `integration:${integrationConfig.id}`,
        integrationConfig,
        86400 // 24 hours
      );

      // Initialize connector
      const connector = this.connectors.get(integrationConfig.type);
      if (connector) {
        await connector.initialize(integrationConfig);
      }

      // Set up sync schedule if enabled
      if (integrationConfig.sync.enabled && integrationConfig.sync.schedule) {
        await this.scheduleSync(integrationConfig);
      }

      // Emit event
      this.emit('integration.registered', {
        integrationId: integrationConfig.id,
        type: integrationConfig.type,
        provider: integrationConfig.provider,
      });

      logger.info('Integration registered successfully', {
        integrationId: integrationConfig.id,
        type: integrationConfig.type,
        provider: integrationConfig.provider,
      });

    } catch (error) {
      logger.error('Integration registration failed', {
        error,
        integrationId: integrationConfig.id,
      });
      throw error;
    }
  }

  // Execute data synchronization
  async executeSync(
    integrationId: string,
    syncType: 'full' | 'incremental' | 'delta' = 'incremental',
    options: {
      entities?: string[];
      filters?: any;
      batchSize?: number;
    } = {}
  ): Promise<SyncJob> {
    try {
      const integration = this.integrations.get(integrationId);
      if (!integration) {
        throw new Error(`Integration not found: ${integrationId}`);
      }

      // Create sync job
      const job: SyncJob = {
        id: generateId(),
        integrationId,
        type: syncType,
        status: 'pending',
        progress: {
          total: 0,
          processed: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
        },
        errors: [],
        metadata: {
          options,
          startedBy: 'system', // Would be actual user in real implementation
        },
      };

      this.activeJobs.set(job.id, job);

      // Start sync process
      this.processSyncJob(job, integration, options);

      return job;

    } catch (error) {
      logger.error('Sync execution failed', { error, integrationId });
      throw error;
    }
  }

  // Process sync job
  private async processSyncJob(
    job: SyncJob,
    integration: IntegrationConfig,
    options: any
  ): Promise<void> {
    try {
      job.status = 'running';
      job.startedAt = new Date();

      // Get connector
      const connector = this.connectors.get(integration.type);
      if (!connector) {
        throw new Error(`Connector not found for type: ${integration.type}`);
      }

      // Get entities to sync
      const entities = options.entities || integration.mapping.entities.map(e => e.source);

      for (const entityName of entities) {
        await this.syncEntity(job, integration, connector, entityName, options);
      }

      // Complete job
      job.status = 'completed';
      job.completedAt = new Date();

      // Emit completion event
      this.emit('sync.completed', {
        jobId: job.id,
        integrationId: integration.id,
        progress: job.progress,
      });

      logger.info('Sync job completed', {
        jobId: job.id,
        integrationId: integration.id,
        duration: job.completedAt.getTime() - job.startedAt!.getTime(),
        processed: job.progress.processed,
        successful: job.progress.successful,
        failed: job.progress.failed,
      });

    } catch (error) {
      job.status = 'failed';
      job.completedAt = new Date();
      job.errors.push({
        record: null,
        error: error.message,
        timestamp: new Date(),
      });

      this.emit('sync.failed', {
        jobId: job.id,
        integrationId: integration.id,
        error: error.message,
      });

      logger.error('Sync job failed', {
        error,
        jobId: job.id,
        integrationId: integration.id,
      });
    } finally {
      // Clean up job after some time
      setTimeout(() => {
        this.activeJobs.delete(job.id);
      }, 3600000); // 1 hour
    }
  }

  // Sync individual entity
  private async syncEntity(
    job: SyncJob,
    integration: IntegrationConfig,
    connector: any,
    entityName: string,
    options: any
  ): Promise<void> {
    try {
      // Get entity mapping
      const entityMapping = integration.mapping.entities.find(e => e.source === entityName);
      if (!entityMapping) {
        logger.warn('Entity mapping not found', { entityName, integrationId: integration.id });
        return;
      }

      // Get data from source
      const sourceData = await connector.getData(entityName, {
        filters: options.filters,
        batchSize: options.batchSize || integration.sync.batchSize,
        lastSync: await this.getLastSyncTimestamp(integration.id, entityName),
      });

      job.progress.total += sourceData.length;

      // Process each record
      for (const record of sourceData) {
        try {
          // Apply filters
          if (!this.applyFilters(record, integration.filters)) {
            job.progress.skipped++;
            continue;
          }

          // Validate data
          if (integration.validation.enabled) {
            const validationResult = await this.validateRecord(record, integration.validation.rules);
            if (!validationResult.valid) {
              job.errors.push({
                record,
                error: `Validation failed: ${validationResult.errors.join(', ')}`,
                timestamp: new Date(),
              });
              job.progress.failed++;
              continue;
            }
          }

          // Transform data
          const transformedRecord = await this.dataTransformer.transform(
            record,
            entityMapping.fields
          );

          // Send to target system
          await this.sendToTarget(integration, entityMapping.target, transformedRecord);

          job.progress.successful++;

        } catch (error) {
          job.errors.push({
            record,
            error: error.message,
            timestamp: new Date(),
          });
          job.progress.failed++;

          // Handle error based on strategy
          if (integration.errorHandling.strategy === 'fail' && 
              job.progress.failed >= integration.errorHandling.maxErrors) {
            throw new Error(`Max errors exceeded: ${job.progress.failed}`);
          }
        }

        job.progress.processed++;

        // Emit progress update
        if (job.progress.processed % 100 === 0) {
          this.emit('sync.progress', {
            jobId: job.id,
            progress: job.progress,
          });
        }
      }

      // Update last sync timestamp
      await this.updateLastSyncTimestamp(integration.id, entityName, new Date());

    } catch (error) {
      logger.error('Entity sync failed', {
        error,
        entityName,
        integrationId: integration.id,
      });
      throw error;
    }
  }

  // Execute data flow
  async executeDataFlow(dataFlowId: string): Promise<{
    id: string;
    status: 'success' | 'error';
    recordsProcessed: number;
    errors: string[];
  }> {
    try {
      const dataFlow = await this.getDataFlow(dataFlowId);
      if (!dataFlow) {
        throw new Error(`Data flow not found: ${dataFlowId}`);
      }

      const executionId = generateId();
      let recordsProcessed = 0;
      const errors: string[] = [];

      // Get source integration
      const sourceIntegration = this.integrations.get(dataFlow.source.integrationId);
      if (!sourceIntegration) {
        throw new Error(`Source integration not found: ${dataFlow.source.integrationId}`);
      }

      // Get target integration
      const targetIntegration = this.integrations.get(dataFlow.target.integrationId);
      if (!targetIntegration) {
        throw new Error(`Target integration not found: ${dataFlow.target.integrationId}`);
      }

      // Get source connector
      const sourceConnector = this.connectors.get(sourceIntegration.type);
      if (!sourceConnector) {
        throw new Error(`Source connector not found: ${sourceIntegration.type}`);
      }

      // Get data from source
      const sourceData = await sourceConnector.getData(dataFlow.source.entity, {
        query: dataFlow.source.query,
      });

      // Apply transformations
      let transformedData = sourceData;
      for (const transformation of dataFlow.transformations) {
        transformedData = await this.applyTransformation(transformedData, transformation);
      }

      // Send to target
      const targetConnector = this.connectors.get(targetIntegration.type);
      if (targetConnector) {
        for (const record of transformedData) {
          try {
            await targetConnector.sendData(dataFlow.target.entity, record);
            recordsProcessed++;
          } catch (error) {
            errors.push(`Record processing failed: ${error.message}`);
          }
        }
      }

      // Emit completion event
      this.emit('dataflow.completed', {
        dataFlowId,
        executionId,
        recordsProcessed,
        errors: errors.length,
      });

      return {
        id: executionId,
        status: errors.length === 0 ? 'success' : 'error',
        recordsProcessed,
        errors,
      };

    } catch (error) {
      logger.error('Data flow execution failed', { error, dataFlowId });
      throw error;
    }
  }

  // Real-time data streaming
  async startRealTimeSync(integrationId: string, entities: string[]): Promise<void> {
    try {
      const integration = this.integrations.get(integrationId);
      if (!integration) {
        throw new Error(`Integration not found: ${integrationId}`);
      }

      const connector = this.connectors.get(integration.type);
      if (!connector || !connector.supportsRealTime) {
        throw new Error(`Real-time sync not supported for integration: ${integrationId}`);
      }

      // Start real-time listener
      await connector.startRealTimeListener(entities, (data: any) => {
        this.handleRealTimeData(integration, data);
      });

      logger.info('Real-time sync started', { integrationId, entities });

    } catch (error) {
      logger.error('Real-time sync start failed', { error, integrationId });
      throw error;
    }
  }

  // Handle real-time data
  private async handleRealTimeData(integration: IntegrationConfig, data: any): Promise<void> {
    try {
      // Apply transformations
      const transformedData = await this.dataTransformer.transform(data, integration.mapping);

      // Publish to Kafka for real-time processing
      await this.kafkaService.publish('integration.realtime', {
        integrationId: integration.id,
        data: transformedData,
        timestamp: new Date().toISOString(),
      });

      // Emit real-time event
      this.emit('realtime.data', {
        integrationId: integration.id,
        data: transformedData,
      });

    } catch (error) {
      logger.error('Real-time data handling failed', {
        error,
        integrationId: integration.id,
      });
    }
  }

  // Get integration status
  async getIntegrationStatus(integrationId: string): Promise<{
    status: string;
    lastSync?: Date;
    nextSync?: Date;
    health: 'healthy' | 'warning' | 'error';
    metrics: {
      totalSyncs: number;
      successfulSyncs: number;
      failedSyncs: number;
      averageDuration: number;
      lastError?: string;
    };
  }> {
    try {
      const integration = this.integrations.get(integrationId);
      if (!integration) {
        throw new Error(`Integration not found: ${integrationId}`);
      }

      // Get metrics from cache
      const metrics = await this.cacheService.get(`integration:metrics:${integrationId}`) || {
        totalSyncs: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        averageDuration: 0,
      };

      // Calculate health status
      const successRate = metrics.totalSyncs > 0 
        ? metrics.successfulSyncs / metrics.totalSyncs 
        : 1;
      
      let health: 'healthy' | 'warning' | 'error' = 'healthy';
      if (successRate < 0.5) {
        health = 'error';
      } else if (successRate < 0.8) {
        health = 'warning';
      }

      return {
        status: integration.status,
        health,
        metrics,
      };

    } catch (error) {
      logger.error('Get integration status failed', { error, integrationId });
      throw error;
    }
  }

  // Private helper methods
  private async validateIntegrationConfig(config: IntegrationConfig): Promise<void> {
    // Validate required fields
    if (!config.id || !config.name || !config.type) {
      throw new Error('Missing required integration configuration fields');
    }

    // Validate connection configuration
    if (!config.connection.endpoint) {
      throw new Error('Connection endpoint is required');
    }

    // Validate mapping configuration
    if (!config.mapping.entities || config.mapping.entities.length === 0) {
      throw new Error('At least one entity mapping is required');
    }
  }

  private async testConnection(config: IntegrationConfig): Promise<void> {
    const connector = this.connectors.get(config.type);
    if (!connector) {
      throw new Error(`Connector not found for type: ${config.type}`);
    }

    await connector.testConnection(config);
  }

  private async scheduleSync(config: IntegrationConfig): Promise<void> {
    // Implementation would set up cron job for scheduled sync
    logger.info('Sync scheduled', {
      integrationId: config.id,
      schedule: config.sync.schedule,
    });
  }

  private applyFilters(record: any, filters: IntegrationConfig['filters']): boolean {
    for (const filter of filters) {
      const value = record[filter.field];
      
      switch (filter.operator) {
        case 'equals':
          if (value !== filter.value) return false;
          break;
        case 'not_equals':
          if (value === filter.value) return false;
          break;
        case 'contains':
          if (!value || !value.toString().includes(filter.value)) return false;
          break;
        case 'greater_than':
          if (value <= filter.value) return false;
          break;
        case 'less_than':
          if (value >= filter.value) return false;
          break;
      }
    }
    
    return true;
  }

  private async validateRecord(record: any, rules: any[]): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    for (const rule of rules) {
      const value = record[rule.field];
      
      switch (rule.type) {
        case 'required':
          if (value == null || value === '') {
            errors.push(`Field ${rule.field} is required`);
          }
          break;
        case 'format':
          // Implementation would validate format based on parameters
          break;
        case 'range':
          if (value < rule.parameters.min || value > rule.parameters.max) {
            errors.push(`Field ${rule.field} is out of range`);
          }
          break;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private async sendToTarget(
    integration: IntegrationConfig,
    targetEntity: string,
    data: any
  ): Promise<void> {
    // Implementation would send data to target system
    // This could be via API, database, file, etc.
  }

  private async getLastSyncTimestamp(integrationId: string, entity: string): Promise<Date | null> {
    const timestamp = await this.cacheService.get(`sync:last:${integrationId}:${entity}`);
    return timestamp ? new Date(timestamp) : null;
  }

  private async updateLastSyncTimestamp(
    integrationId: string,
    entity: string,
    timestamp: Date
  ): Promise<void> {
    await this.cacheService.set(
      `sync:last:${integrationId}:${entity}`,
      timestamp.toISOString(),
      86400 * 30 // 30 days
    );
  }

  private async getDataFlow(dataFlowId: string): Promise<DataFlow | null> {
    // Implementation would fetch data flow configuration
    return null;
  }

  private async applyTransformation(data: any[], transformation: any): Promise<any[]> {
    // Implementation would apply various transformations
    return data;
  }

  // Public API methods
  async listIntegrations(): Promise<IntegrationConfig[]> {
    return Array.from(this.integrations.values());
  }

  async getIntegration(integrationId: string): Promise<IntegrationConfig | null> {
    return this.integrations.get(integrationId) || null;
  }

  async updateIntegration(
    integrationId: string,
    updates: Partial<IntegrationConfig>
  ): Promise<void> {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new Error(`Integration not found: ${integrationId}`);
    }

    const updatedIntegration = { ...integration, ...updates };
    await this.registerIntegration(updatedIntegration);
  }

  async deleteIntegration(integrationId: string): Promise<void> {
    this.integrations.delete(integrationId);
    await this.cacheService.del(`integration:${integrationId}`);
    
    this.emit('integration.deleted', { integrationId });
    logger.info('Integration deleted', { integrationId });
  }

  async getSyncJob(jobId: string): Promise<SyncJob | null> {
    return this.activeJobs.get(jobId) || null;
  }

  async cancelSyncJob(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (job && job.status === 'running') {
      job.status = 'cancelled';
      job.completedAt = new Date();
      
      this.emit('sync.cancelled', { jobId });
      logger.info('Sync job cancelled', { jobId });
    }
  }
}