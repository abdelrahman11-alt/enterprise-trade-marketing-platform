import { Kafka, Producer, KafkaMessage } from 'kafkajs';
import { config } from '../config';
import { logger } from '../utils/logger';
import { generateId } from '@trade-marketing/shared';

class EventPublisherService {
  private kafka: Kafka;
  private producer: Producer;
  private isConnected: boolean = false;

  constructor() {
    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    this.producer = this.kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.producer.on('producer.connect', () => {
      logger.info('Kafka producer connected');
      this.isConnected = true;
    });

    this.producer.on('producer.disconnect', () => {
      logger.info('Kafka producer disconnected');
      this.isConnected = false;
    });

    this.producer.on('producer.network.request_timeout', (payload) => {
      logger.warn('Kafka producer request timeout', payload);
    });
  }

  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      logger.info('Event publisher connected to Kafka');
    } catch (error) {
      logger.error('Failed to connect event publisher to Kafka', { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.producer.disconnect();
      logger.info('Event publisher disconnected from Kafka');
    } catch (error) {
      logger.error('Error disconnecting event publisher from Kafka', { error });
    }
  }

  private createEventMessage(eventType: string, data: any, metadata: any = {}): KafkaMessage {
    const event = {
      id: generateId(),
      type: eventType,
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: 'company-service',
      data,
      metadata: {
        ...metadata,
        correlationId: generateId(),
      },
    };

    return {
      key: data.companyId || data.licenseId || data.userId || event.id,
      value: JSON.stringify(event),
      timestamp: Date.now().toString(),
      headers: {
        eventType,
        version: '1.0',
        source: 'company-service',
      },
    };
  }

  async publishEvent(topic: string, eventType: string, data: any, metadata: any = {}): Promise<void> {
    try {
      if (!this.isConnected) {
        logger.warn('Event publisher not connected, attempting to reconnect');
        await this.connect();
      }

      const message = this.createEventMessage(eventType, data, metadata);

      await this.producer.send({
        topic,
        messages: [message],
      });

      logger.debug('Event published successfully', {
        topic,
        eventType,
        messageKey: message.key,
        correlationId: metadata.correlationId,
      });
    } catch (error) {
      logger.error('Failed to publish event', {
        error,
        topic,
        eventType,
        data,
      });
      throw error;
    }
  }

  // Company Events
  async publishCompanyEvent(eventType: string, data: any, metadata: any = {}): Promise<void> {
    await this.publishEvent(config.kafka.topics.companyEvents, eventType, data, metadata);
  }

  async publishCompanyCreated(data: {
    companyId: string;
    name: string;
    code: string;
    type: string;
    parentCompanyId?: string;
    createdBy: string;
  }): Promise<void> {
    await this.publishCompanyEvent('company.created', data);
  }

  async publishCompanyUpdated(data: {
    companyId: string;
    changes: any;
    updatedBy: string;
  }): Promise<void> {
    await this.publishCompanyEvent('company.updated', data);
  }

  async publishCompanyDeleted(data: {
    companyId: string;
    name: string;
    deletedBy: string;
  }): Promise<void> {
    await this.publishCompanyEvent('company.deleted', data);
  }

  async publishCompanyStatusChanged(data: {
    companyId: string;
    oldStatus: string;
    newStatus: string;
    changedBy: string;
  }): Promise<void> {
    await this.publishCompanyEvent('company.status_changed', data);
  }

  // License Events
  async publishLicenseEvent(eventType: string, data: any, metadata: any = {}): Promise<void> {
    await this.publishEvent(config.kafka.topics.licenseEvents, eventType, data, metadata);
  }

  async publishLicenseCreated(data: {
    licenseId: string;
    companyId: string;
    edition: string;
    licenseType: string;
    validFrom: string;
    validUntil: string;
    createdBy: string;
  }): Promise<void> {
    await this.publishLicenseEvent('license.created', data);
  }

  async publishLicenseUpdated(data: {
    licenseId: string;
    companyId: string;
    changes: any;
    updatedBy: string;
  }): Promise<void> {
    await this.publishLicenseEvent('license.updated', data);
  }

  async publishLicenseExpiring(data: {
    licenseId: string;
    companyId: string;
    validUntil: string;
    daysUntilExpiry: number;
  }): Promise<void> {
    await this.publishLicenseEvent('license.expiring', data);
  }

  async publishLicenseExpired(data: {
    licenseId: string;
    companyId: string;
    expiredAt: string;
  }): Promise<void> {
    await this.publishLicenseEvent('license.expired', data);
  }

  async publishLicenseRenewed(data: {
    licenseId: string;
    companyId: string;
    oldValidUntil: string;
    newValidUntil: string;
    renewedBy: string;
  }): Promise<void> {
    await this.publishLicenseEvent('license.renewed', data);
  }

  async publishLicenseSuspended(data: {
    licenseId: string;
    companyId: string;
    suspendedBy: string;
    reason?: string;
  }): Promise<void> {
    await this.publishLicenseEvent('license.suspended', data);
  }

  async publishLicenseActivated(data: {
    licenseId: string;
    companyId: string;
    activatedBy: string;
  }): Promise<void> {
    await this.publishLicenseEvent('license.activated', data);
  }

  async publishLicenseLimitExceeded(data: {
    licenseId: string;
    companyId: string;
    limitType: 'users' | 'companies';
    current: number;
    max: number;
  }): Promise<void> {
    await this.publishLicenseEvent('license.limit_exceeded', data);
  }

  // User Events
  async publishUserEvent(eventType: string, data: any, metadata: any = {}): Promise<void> {
    await this.publishEvent(config.kafka.topics.userEvents, eventType, data, metadata);
  }

  async publishUserCompanyAdded(data: {
    userId: string;
    companyId: string;
    roles: string[];
    addedBy: string;
  }): Promise<void> {
    await this.publishUserEvent('user.company_added', data);
  }

  async publishUserCompanyRemoved(data: {
    userId: string;
    companyId: string;
    removedBy: string;
  }): Promise<void> {
    await this.publishUserEvent('user.company_removed', data);
  }

  async publishUserRolesChanged(data: {
    userId: string;
    companyId: string;
    oldRoles: string[];
    newRoles: string[];
    changedBy: string;
  }): Promise<void> {
    await this.publishUserEvent('user.roles_changed', data);
  }

  // Batch publishing
  async publishBatch(events: Array<{
    topic: string;
    eventType: string;
    data: any;
    metadata?: any;
  }>): Promise<void> {
    try {
      if (!this.isConnected) {
        logger.warn('Event publisher not connected, attempting to reconnect');
        await this.connect();
      }

      const topicMessages: Record<string, KafkaMessage[]> = {};

      // Group messages by topic
      events.forEach(event => {
        if (!topicMessages[event.topic]) {
          topicMessages[event.topic] = [];
        }
        
        const message = this.createEventMessage(
          event.eventType,
          event.data,
          event.metadata || {}
        );
        
        topicMessages[event.topic].push(message);
      });

      // Send messages for each topic
      const sendPromises = Object.entries(topicMessages).map(([topic, messages]) =>
        this.producer.send({
          topic,
          messages,
        })
      );

      await Promise.all(sendPromises);

      logger.info('Batch events published successfully', {
        eventCount: events.length,
        topics: Object.keys(topicMessages),
      });
    } catch (error) {
      logger.error('Failed to publish batch events', {
        error,
        eventCount: events.length,
      });
      throw error;
    }
  }

  // Health check
  isHealthy(): boolean {
    return this.isConnected;
  }

  // Get producer metrics
  async getMetrics(): Promise<any> {
    try {
      // Kafka.js doesn't expose detailed metrics directly
      // In a production environment, you might want to use a metrics library
      return {
        connected: this.isConnected,
        // Add more metrics as needed
      };
    } catch (error) {
      logger.error('Failed to get producer metrics', { error });
      return null;
    }
  }
}

// Create singleton instance
export const EventPublisher = new EventPublisherService();

export default EventPublisher;