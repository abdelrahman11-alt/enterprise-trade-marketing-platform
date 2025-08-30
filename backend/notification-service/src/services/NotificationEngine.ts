import { EventEmitter } from 'events';
import { config } from '../config';
import { logger } from '../utils/logger';
import { CacheService } from './cache';
import { KafkaService } from './kafka';
import { EmailChannel } from '../channels/EmailChannel';
import { SMSChannel } from '../channels/SMSChannel';
import { PushChannel } from '../channels/PushChannel';
import { WebhookChannel } from '../channels/WebhookChannel';
import { SlackChannel } from '../channels/SlackChannel';
import { TeamsChannel } from '../channels/TeamsChannel';
import { TemplateEngine } from './TemplateEngine';
import { generateId } from '@trade-marketing/shared';

export interface NotificationRequest {
  id?: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  channels: Array<{
    type: 'email' | 'sms' | 'push' | 'webhook' | 'slack' | 'teams' | 'in_app';
    config: any;
  }>;
  recipients: Array<{
    id: string;
    type: 'user' | 'group' | 'role';
    preferences?: {
      channels: string[];
      timezone: string;
      language: string;
      frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
    };
  }>;
  template: {
    id: string;
    data: Record<string, any>;
  };
  scheduling: {
    sendAt?: Date;
    timezone?: string;
    recurring?: {
      frequency: 'daily' | 'weekly' | 'monthly';
      interval: number;
      endDate?: Date;
    };
  };
  tracking: {
    enabled: boolean;
    events: string[];
  };
  metadata: Record<string, any>;
}

export interface NotificationResult {
  id: string;
  status: 'sent' | 'failed' | 'scheduled' | 'cancelled';
  channels: Array<{
    type: string;
    status: 'sent' | 'failed' | 'pending';
    messageId?: string;
    error?: string;
    sentAt?: Date;
  }>;
  metrics: {
    totalRecipients: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    pendingDeliveries: number;
  };
  createdAt: Date;
  sentAt?: Date;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  description: string;
  type: string;
  category: string;
  channels: Array<{
    type: string;
    subject?: string;
    content: string;
    format: 'text' | 'html' | 'markdown';
    attachments?: Array<{
      name: string;
      url: string;
      type: string;
    }>;
  }>;
  variables: Array<{
    name: string;
    type: 'string' | 'number' | 'date' | 'boolean' | 'object';
    required: boolean;
    description: string;
    defaultValue?: any;
  }>;
  localization: Record<string, any>;
  settings: {
    priority: 'low' | 'medium' | 'high' | 'critical';
    retryPolicy: {
      maxRetries: number;
      backoffMultiplier: number;
    };
    tracking: {
      enabled: boolean;
      events: string[];
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferences {
  userId: string;
  channels: {
    email: {
      enabled: boolean;
      address: string;
      frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
      categories: string[];
    };
    sms: {
      enabled: boolean;
      phoneNumber: string;
      frequency: 'immediate' | 'hourly' | 'daily';
      categories: string[];
    };
    push: {
      enabled: boolean;
      devices: Array<{
        token: string;
        platform: 'ios' | 'android' | 'web';
        active: boolean;
      }>;
      frequency: 'immediate' | 'hourly' | 'daily';
      categories: string[];
    };
    inApp: {
      enabled: boolean;
      frequency: 'immediate';
      categories: string[];
    };
  };
  timezone: string;
  language: string;
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm format
    end: string;   // HH:mm format
  };
  doNotDisturb: {
    enabled: boolean;
    until?: Date;
  };
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  type: 'broadcast' | 'triggered' | 'drip' | 'transactional';
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
  audience: {
    segments: string[];
    filters: Array<{
      field: string;
      operator: string;
      value: any;
    }>;
    excludeSegments?: string[];
  };
  content: {
    templateId: string;
    variations?: Array<{
      id: string;
      name: string;
      weight: number;
      templateData: Record<string, any>;
    }>;
  };
  scheduling: {
    startDate: Date;
    endDate?: Date;
    timezone: string;
    frequency?: {
      type: 'once' | 'daily' | 'weekly' | 'monthly';
      interval: number;
      daysOfWeek?: number[];
      timeOfDay?: string;
    };
  };
  tracking: {
    enabled: boolean;
    goals: Array<{
      name: string;
      type: 'click' | 'conversion' | 'engagement';
      target: number;
    }>;
  };
  abTesting: {
    enabled: boolean;
    variants: Array<{
      id: string;
      name: string;
      percentage: number;
      templateId: string;
    }>;
    winnerCriteria: {
      metric: string;
      threshold: number;
      duration: number; // hours
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export class NotificationEngine extends EventEmitter {
  private cacheService: CacheService;
  private kafkaService: KafkaService;
  private templateEngine: TemplateEngine;
  private channels: Map<string, any> = new Map();
  private activeNotifications: Map<string, NotificationResult> = new Map();

  constructor() {
    super();
    this.cacheService = new CacheService();
    this.kafkaService = new KafkaService();
    this.templateEngine = new TemplateEngine();
    
    this.initializeChannels();
    this.setupEventListeners();
  }

  private initializeChannels(): void {
    this.channels.set('email', new EmailChannel());
    this.channels.set('sms', new SMSChannel());
    this.channels.set('push', new PushChannel());
    this.channels.set('webhook', new WebhookChannel());
    this.channels.set('slack', new SlackChannel());
    this.channels.set('teams', new TeamsChannel());
  }

  private setupEventListeners(): void {
    // Listen for Kafka events
    this.kafkaService.subscribe('notification.requests', async (message) => {
      await this.processNotificationRequest(message.value);
    });

    // Listen for campaign events
    this.kafkaService.subscribe('campaign.events', async (message) => {
      await this.processCampaignEvent(message.value);
    });
  }

  // Send notification
  async sendNotification(request: NotificationRequest): Promise<NotificationResult> {
    try {
      const notificationId = request.id || generateId();
      
      // Create notification result
      const result: NotificationResult = {
        id: notificationId,
        status: 'scheduled',
        channels: [],
        metrics: {
          totalRecipients: 0,
          successfulDeliveries: 0,
          failedDeliveries: 0,
          pendingDeliveries: 0,
        },
        createdAt: new Date(),
      };

      this.activeNotifications.set(notificationId, result);

      // Resolve recipients
      const recipients = await this.resolveRecipients(request.recipients);
      result.metrics.totalRecipients = recipients.length;

      // Check if scheduled for later
      if (request.scheduling.sendAt && request.scheduling.sendAt > new Date()) {
        await this.scheduleNotification(request, recipients);
        return result;
      }

      // Send immediately
      await this.processNotification(request, recipients, result);

      return result;

    } catch (error) {
      logger.error('Notification sending failed', { error, requestId: request.id });
      throw error;
    }
  }

  // Process notification
  private async processNotification(
    request: NotificationRequest,
    recipients: any[],
    result: NotificationResult
  ): Promise<void> {
    try {
      result.status = 'sent';
      result.sentAt = new Date();

      // Get template
      const template = await this.getTemplate(request.template.id);
      if (!template) {
        throw new Error(`Template not found: ${request.template.id}`);
      }

      // Process each channel
      for (const channelConfig of request.channels) {
        const channelResult = {
          type: channelConfig.type,
          status: 'pending' as const,
        };
        result.channels.push(channelResult);

        try {
          const channel = this.channels.get(channelConfig.type);
          if (!channel) {
            throw new Error(`Channel not supported: ${channelConfig.type}`);
          }

          // Filter recipients by channel preferences
          const channelRecipients = this.filterRecipientsByChannel(
            recipients,
            channelConfig.type
          );

          if (channelRecipients.length === 0) {
            channelResult.status = 'failed';
            channelResult.error = 'No recipients for this channel';
            continue;
          }

          // Render template for channel
          const renderedContent = await this.templateEngine.render(
            template,
            channelConfig.type,
            request.template.data
          );

          // Send via channel
          const channelResponse = await channel.send({
            recipients: channelRecipients,
            content: renderedContent,
            config: channelConfig.config,
            tracking: request.tracking,
          });

          channelResult.status = 'sent';
          channelResult.messageId = channelResponse.messageId;
          channelResult.sentAt = new Date();

          result.metrics.successfulDeliveries += channelRecipients.length;

          // Emit success event
          this.emit('notification.sent', {
            notificationId: result.id,
            channel: channelConfig.type,
            recipients: channelRecipients.length,
          });

        } catch (error) {
          channelResult.status = 'failed';
          channelResult.error = error.message;
          result.metrics.failedDeliveries += recipients.length;

          logger.error('Channel delivery failed', {
            error,
            notificationId: result.id,
            channel: channelConfig.type,
          });

          // Emit failure event
          this.emit('notification.failed', {
            notificationId: result.id,
            channel: channelConfig.type,
            error: error.message,
          });
        }
      }

      // Update final status
      const hasSuccessful = result.channels.some(c => c.status === 'sent');
      const hasFailures = result.channels.some(c => c.status === 'failed');
      
      if (hasSuccessful && !hasFailures) {
        result.status = 'sent';
      } else if (hasFailures && !hasSuccessful) {
        result.status = 'failed';
      } else {
        result.status = 'sent'; // Partial success
      }

      // Store result
      await this.storeNotificationResult(result);

      logger.info('Notification processed', {
        notificationId: result.id,
        status: result.status,
        channels: result.channels.length,
        recipients: result.metrics.totalRecipients,
        successful: result.metrics.successfulDeliveries,
        failed: result.metrics.failedDeliveries,
      });

    } catch (error) {
      result.status = 'failed';
      logger.error('Notification processing failed', {
        error,
        notificationId: result.id,
      });
      throw error;
    }
  }

  // Create campaign
  async createCampaign(campaignData: Partial<Campaign>): Promise<Campaign> {
    try {
      const campaign: Campaign = {
        id: generateId(),
        name: campaignData.name || 'New Campaign',
        description: campaignData.description || '',
        type: campaignData.type || 'broadcast',
        status: 'draft',
        audience: campaignData.audience || { segments: [], filters: [] },
        content: campaignData.content || { templateId: '' },
        scheduling: campaignData.scheduling || {
          startDate: new Date(),
          timezone: 'UTC',
        },
        tracking: campaignData.tracking || { enabled: true, goals: [] },
        abTesting: campaignData.abTesting || { enabled: false, variants: [], winnerCriteria: { metric: 'click', threshold: 0.05, duration: 24 } },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store campaign
      await this.storeCampaign(campaign);

      // Schedule if needed
      if (campaign.status === 'scheduled') {
        await this.scheduleCampaign(campaign);
      }

      logger.info('Campaign created', {
        campaignId: campaign.id,
        name: campaign.name,
        type: campaign.type,
      });

      return campaign;

    } catch (error) {
      logger.error('Campaign creation failed', { error });
      throw error;
    }
  }

  // Execute campaign
  async executeCampaign(campaignId: string): Promise<{
    campaignId: string;
    status: 'success' | 'error';
    notificationsSent: number;
    errors: string[];
  }> {
    try {
      const campaign = await this.getCampaign(campaignId);
      if (!campaign) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }

      // Get audience
      const audience = await this.resolveAudience(campaign.audience);
      
      // Handle A/B testing
      let variants = [{ id: 'default', templateId: campaign.content.templateId, percentage: 100 }];
      if (campaign.abTesting.enabled) {
        variants = campaign.abTesting.variants;
      }

      let notificationsSent = 0;
      const errors: string[] = [];

      // Send to each variant
      for (const variant of variants) {
        try {
          const variantAudience = this.splitAudience(audience, variant.percentage);
          
          const notificationRequest: NotificationRequest = {
            type: `campaign_${campaign.type}`,
            priority: 'medium',
            channels: [{ type: 'email', config: {} }], // Would be configured based on campaign
            recipients: variantAudience.map(user => ({ id: user.id, type: 'user' as const })),
            template: {
              id: variant.templateId,
              data: campaign.content.variations?.find(v => v.id === variant.id)?.templateData || {},
            },
            scheduling: {},
            tracking: campaign.tracking,
            metadata: {
              campaignId,
              variantId: variant.id,
            },
          };

          const result = await this.sendNotification(notificationRequest);
          notificationsSent += result.metrics.successfulDeliveries;

        } catch (error) {
          errors.push(`Variant ${variant.id}: ${error.message}`);
        }
      }

      // Update campaign status
      await this.updateCampaignStatus(campaignId, 'active');

      return {
        campaignId,
        status: errors.length === 0 ? 'success' : 'error',
        notificationsSent,
        errors,
      };

    } catch (error) {
      logger.error('Campaign execution failed', { error, campaignId });
      throw error;
    }
  }

  // Manage user preferences
  async updateUserPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<void> {
    try {
      const currentPreferences = await this.getUserPreferences(userId);
      const updatedPreferences = { ...currentPreferences, ...preferences };

      await this.storeUserPreferences(userId, updatedPreferences);

      // Emit preferences updated event
      this.emit('preferences.updated', {
        userId,
        preferences: updatedPreferences,
      });

      logger.info('User preferences updated', { userId });

    } catch (error) {
      logger.error('User preferences update failed', { error, userId });
      throw error;
    }
  }

  // Track notification events
  async trackEvent(
    notificationId: string,
    event: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'unsubscribed',
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      const trackingData = {
        notificationId,
        event,
        timestamp: new Date(),
        metadata,
      };

      // Store tracking data
      await this.storeTrackingEvent(trackingData);

      // Update notification metrics
      await this.updateNotificationMetrics(notificationId, event);

      // Emit tracking event
      this.emit('notification.tracked', trackingData);

      logger.debug('Notification event tracked', {
        notificationId,
        event,
      });

    } catch (error) {
      logger.error('Event tracking failed', { error, notificationId, event });
    }
  }

  // Get notification analytics
  async getAnalytics(filters: {
    dateRange: { start: Date; end: Date };
    channels?: string[];
    campaigns?: string[];
    templates?: string[];
  }): Promise<{
    summary: {
      totalNotifications: number;
      deliveryRate: number;
      openRate: number;
      clickRate: number;
      bounceRate: number;
    };
    byChannel: Array<{
      channel: string;
      sent: number;
      delivered: number;
      opened: number;
      clicked: number;
    }>;
    byTemplate: Array<{
      templateId: string;
      templateName: string;
      sent: number;
      performance: number;
    }>;
    trends: Array<{
      date: string;
      sent: number;
      delivered: number;
      opened: number;
      clicked: number;
    }>;
  }> {
    try {
      // Implementation would query analytics data
      return {
        summary: {
          totalNotifications: 0,
          deliveryRate: 0,
          openRate: 0,
          clickRate: 0,
          bounceRate: 0,
        },
        byChannel: [],
        byTemplate: [],
        trends: [],
      };

    } catch (error) {
      logger.error('Analytics retrieval failed', { error });
      throw error;
    }
  }

  // Private helper methods
  private async resolveRecipients(recipients: NotificationRequest['recipients']): Promise<any[]> {
    const resolved = [];

    for (const recipient of recipients) {
      switch (recipient.type) {
        case 'user':
          const user = await this.getUser(recipient.id);
          if (user) resolved.push(user);
          break;
        case 'group':
          const groupUsers = await this.getGroupUsers(recipient.id);
          resolved.push(...groupUsers);
          break;
        case 'role':
          const roleUsers = await this.getRoleUsers(recipient.id);
          resolved.push(...roleUsers);
          break;
      }
    }

    return resolved;
  }

  private filterRecipientsByChannel(recipients: any[], channelType: string): any[] {
    return recipients.filter(recipient => {
      const preferences = recipient.notificationPreferences;
      if (!preferences) return true;

      const channelPrefs = preferences.channels[channelType];
      return channelPrefs && channelPrefs.enabled;
    });
  }

  private async scheduleNotification(
    request: NotificationRequest,
    recipients: any[]
  ): Promise<void> {
    // Implementation would schedule notification using job queue
    logger.info('Notification scheduled', {
      notificationId: request.id,
      sendAt: request.scheduling.sendAt,
    });
  }

  private async scheduleCampaign(campaign: Campaign): Promise<void> {
    // Implementation would schedule campaign execution
    logger.info('Campaign scheduled', {
      campaignId: campaign.id,
      startDate: campaign.scheduling.startDate,
    });
  }

  private splitAudience(audience: any[], percentage: number): any[] {
    const count = Math.floor(audience.length * (percentage / 100));
    return audience.slice(0, count);
  }

  private async resolveAudience(audienceConfig: Campaign['audience']): Promise<any[]> {
    // Implementation would resolve audience based on segments and filters
    return [];
  }

  // Data access methods (would be implemented with actual database)
  private async getTemplate(templateId: string): Promise<NotificationTemplate | null> {
    return null;
  }

  private async getUser(userId: string): Promise<any> {
    return null;
  }

  private async getGroupUsers(groupId: string): Promise<any[]> {
    return [];
  }

  private async getRoleUsers(roleId: string): Promise<any[]> {
    return [];
  }

  private async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    // Return default preferences if none exist
    return {
      userId,
      channels: {
        email: { enabled: true, address: '', frequency: 'immediate', categories: [] },
        sms: { enabled: false, phoneNumber: '', frequency: 'immediate', categories: [] },
        push: { enabled: true, devices: [], frequency: 'immediate', categories: [] },
        inApp: { enabled: true, frequency: 'immediate', categories: [] },
      },
      timezone: 'UTC',
      language: 'en',
      quietHours: { enabled: false, start: '22:00', end: '08:00' },
      doNotDisturb: { enabled: false },
    };
  }

  private async storeUserPreferences(userId: string, preferences: NotificationPreferences): Promise<void> {
    // Implementation would store in database
  }

  private async storeNotificationResult(result: NotificationResult): Promise<void> {
    // Implementation would store in database
  }

  private async storeCampaign(campaign: Campaign): Promise<void> {
    // Implementation would store in database
  }

  private async getCampaign(campaignId: string): Promise<Campaign | null> {
    return null;
  }

  private async updateCampaignStatus(campaignId: string, status: Campaign['status']): Promise<void> {
    // Implementation would update campaign status
  }

  private async storeTrackingEvent(trackingData: any): Promise<void> {
    // Implementation would store tracking data
  }

  private async updateNotificationMetrics(notificationId: string, event: string): Promise<void> {
    // Implementation would update metrics
  }

  private async processNotificationRequest(message: any): Promise<void> {
    try {
      const request: NotificationRequest = JSON.parse(message);
      await this.sendNotification(request);
    } catch (error) {
      logger.error('Failed to process notification request', { error });
    }
  }

  private async processCampaignEvent(message: any): Promise<void> {
    try {
      const event = JSON.parse(message);
      
      switch (event.type) {
        case 'campaign.execute':
          await this.executeCampaign(event.campaignId);
          break;
        case 'campaign.pause':
          await this.updateCampaignStatus(event.campaignId, 'paused');
          break;
        case 'campaign.resume':
          await this.updateCampaignStatus(event.campaignId, 'active');
          break;
      }
    } catch (error) {
      logger.error('Failed to process campaign event', { error });
    }
  }
}