import { AuditLog as PrismaAuditLog, AuditAction, Prisma } from '@prisma/client';
import { db } from '../services/database';
import { logger } from '../utils/logger';
import { 
  PaginationParams,
  FilterParams,
  PaginationResult,
  generateId
} from '@trade-marketing/shared';

export class AuditLogModel {
  // Create a new audit log entry
  static async create(data: {
    entityType: string;
    entityId: string;
    action: AuditAction;
    oldValues?: any;
    newValues?: any;
    changes?: any;
    userId: string;
    companyId?: string;
    licenseId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
  }): Promise<PrismaAuditLog> {
    try {
      const auditLog = await db.getClient().auditLog.create({
        data: {
          id: generateId(),
          entityType: data.entityType,
          entityId: data.entityId,
          action: data.action,
          oldValues: data.oldValues || null,
          newValues: data.newValues || null,
          changes: data.changes || null,
          userId: data.userId,
          companyId: data.companyId || null,
          licenseId: data.licenseId || null,
          ipAddress: data.ipAddress || null,
          userAgent: data.userAgent || null,
          metadata: data.metadata || {},
        },
      });

      logger.debug('Audit log created', {
        auditLogId: auditLog.id,
        entityType: data.entityType,
        entityId: data.entityId,
        action: data.action,
        userId: data.userId,
      });

      return auditLog;
    } catch (error) {
      logger.error('Failed to create audit log', { error, data });
      throw error;
    }
  }

  // Find audit logs with pagination and filtering
  static async findMany(
    pagination: PaginationParams,
    filters: FilterParams = {}
  ): Promise<PaginationResult<PrismaAuditLog>> {
    try {
      const { page, limit, sortBy = 'timestamp', sortOrder = 'desc' } = pagination;
      const offset = (page - 1) * limit;

      // Build where clause
      const where: Prisma.AuditLogWhereInput = {};

      if (filters.entityType) {
        where.entityType = filters.entityType;
      }

      if (filters.entityId) {
        where.entityId = filters.entityId;
      }

      if (filters.action) {
        where.action = filters.action;
      }

      if (filters.userId) {
        where.userId = filters.userId;
      }

      if (filters.companyId) {
        where.companyId = filters.companyId;
      }

      if (filters.licenseId) {
        where.licenseId = filters.licenseId;
      }

      if (filters.dateFrom || filters.dateTo) {
        where.timestamp = {};
        if (filters.dateFrom) {
          where.timestamp.gte = new Date(filters.dateFrom as string);
        }
        if (filters.dateTo) {
          where.timestamp.lte = new Date(filters.dateTo as string);
        }
      }

      // Get total count
      const total = await db.getClient().auditLog.count({ where });

      // Get audit logs
      const auditLogs = await db.getClient().auditLog.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: offset,
        take: limit,
      });

      const totalPages = Math.ceil(total / limit);

      return {
        data: auditLogs,
        meta: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error('Failed to find audit logs', { error, pagination, filters });
      throw error;
    }
  }

  // Find audit logs by entity
  static async findByEntity(
    entityType: string,
    entityId: string,
    pagination: PaginationParams
  ): Promise<PaginationResult<PrismaAuditLog>> {
    try {
      return await AuditLogModel.findMany(pagination, { entityType, entityId });
    } catch (error) {
      logger.error('Failed to find audit logs by entity', { error, entityType, entityId });
      throw error;
    }
  }

  // Find audit logs by user
  static async findByUser(
    userId: string,
    pagination: PaginationParams,
    filters: FilterParams = {}
  ): Promise<PaginationResult<PrismaAuditLog>> {
    try {
      return await AuditLogModel.findMany(pagination, { ...filters, userId });
    } catch (error) {
      logger.error('Failed to find audit logs by user', { error, userId });
      throw error;
    }
  }

  // Find audit logs by company
  static async findByCompany(
    companyId: string,
    pagination: PaginationParams,
    filters: FilterParams = {}
  ): Promise<PaginationResult<PrismaAuditLog>> {
    try {
      return await AuditLogModel.findMany(pagination, { ...filters, companyId });
    } catch (error) {
      logger.error('Failed to find audit logs by company', { error, companyId });
      throw error;
    }
  }

  // Get audit log statistics
  static async getStatistics(filters: FilterParams = {}): Promise<any> {
    try {
      const where: Prisma.AuditLogWhereInput = {};

      if (filters.companyId) {
        where.companyId = filters.companyId;
      }

      if (filters.dateFrom || filters.dateTo) {
        where.timestamp = {};
        if (filters.dateFrom) {
          where.timestamp.gte = new Date(filters.dateFrom as string);
        }
        if (filters.dateTo) {
          where.timestamp.lte = new Date(filters.dateTo as string);
        }
      }

      const totalLogs = await db.getClient().auditLog.count({ where });

      const actionStats = await db.getClient().auditLog.groupBy({
        by: ['action'],
        where,
        _count: {
          id: true,
        },
      });

      const entityTypeStats = await db.getClient().auditLog.groupBy({
        by: ['entityType'],
        where,
        _count: {
          id: true,
        },
      });

      // Get activity by day for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const dailyActivity = await db.getClient().$queryRaw<Array<{ date: string; count: number }>>`
        SELECT 
          DATE(timestamp) as date,
          COUNT(*)::int as count
        FROM audit_logs 
        WHERE timestamp >= ${thirtyDaysAgo}
        ${filters.companyId ? Prisma.sql`AND company_id = ${filters.companyId}` : Prisma.empty}
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
        LIMIT 30
      `;

      return {
        total: totalLogs,
        byAction: actionStats.reduce((acc, item) => {
          acc[item.action] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        byEntityType: entityTypeStats.reduce((acc, item) => {
          acc[item.entityType] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        dailyActivity: dailyActivity.map(item => ({
          date: item.date,
          count: item.count,
        })),
      };
    } catch (error) {
      logger.error('Failed to get audit log statistics', { error, filters });
      throw error;
    }
  }

  // Get recent activity
  static async getRecentActivity(
    limit: number = 50,
    filters: FilterParams = {}
  ): Promise<PrismaAuditLog[]> {
    try {
      const where: Prisma.AuditLogWhereInput = {};

      if (filters.companyId) {
        where.companyId = filters.companyId;
      }

      if (filters.userId) {
        where.userId = filters.userId;
      }

      if (filters.entityType) {
        where.entityType = filters.entityType;
      }

      return await db.getClient().auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
      });
    } catch (error) {
      logger.error('Failed to get recent activity', { error, limit, filters });
      throw error;
    }
  }

  // Clean up old audit logs
  static async cleanup(olderThanDays: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await db.getClient().auditLog.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      logger.info('Audit log cleanup completed', {
        deletedCount: result.count,
        cutoffDate,
        olderThanDays,
      });

      return result.count;
    } catch (error) {
      logger.error('Failed to cleanup audit logs', { error, olderThanDays });
      throw error;
    }
  }

  // Export audit logs
  static async export(
    filters: FilterParams = {},
    format: 'json' | 'csv' = 'json'
  ): Promise<any> {
    try {
      const where: Prisma.AuditLogWhereInput = {};

      if (filters.companyId) {
        where.companyId = filters.companyId;
      }

      if (filters.userId) {
        where.userId = filters.userId;
      }

      if (filters.entityType) {
        where.entityType = filters.entityType;
      }

      if (filters.action) {
        where.action = filters.action;
      }

      if (filters.dateFrom || filters.dateTo) {
        where.timestamp = {};
        if (filters.dateFrom) {
          where.timestamp.gte = new Date(filters.dateFrom as string);
        }
        if (filters.dateTo) {
          where.timestamp.lte = new Date(filters.dateTo as string);
        }
      }

      const auditLogs = await db.getClient().auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
      });

      if (format === 'csv') {
        // Convert to CSV format
        const headers = [
          'ID',
          'Entity Type',
          'Entity ID',
          'Action',
          'User ID',
          'Company ID',
          'IP Address',
          'Timestamp',
        ];

        const rows = auditLogs.map(log => [
          log.id,
          log.entityType,
          log.entityId,
          log.action,
          log.userId,
          log.companyId || '',
          log.ipAddress || '',
          log.timestamp.toISOString(),
        ]);

        return {
          headers,
          rows,
          data: [headers, ...rows],
        };
      }

      return auditLogs;
    } catch (error) {
      logger.error('Failed to export audit logs', { error, filters, format });
      throw error;
    }
  }

  // Get user activity summary
  static async getUserActivitySummary(
    userId: string,
    days: number = 30
  ): Promise<any> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const totalActions = await db.getClient().auditLog.count({
        where: {
          userId,
          timestamp: { gte: startDate },
        },
      });

      const actionBreakdown = await db.getClient().auditLog.groupBy({
        by: ['action'],
        where: {
          userId,
          timestamp: { gte: startDate },
        },
        _count: {
          id: true,
        },
      });

      const entityBreakdown = await db.getClient().auditLog.groupBy({
        by: ['entityType'],
        where: {
          userId,
          timestamp: { gte: startDate },
        },
        _count: {
          id: true,
        },
      });

      return {
        userId,
        period: `${days} days`,
        totalActions,
        byAction: actionBreakdown.reduce((acc, item) => {
          acc[item.action] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        byEntityType: entityBreakdown.reduce((acc, item) => {
          acc[item.entityType] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
      };
    } catch (error) {
      logger.error('Failed to get user activity summary', { error, userId, days });
      throw error;
    }
  }
}