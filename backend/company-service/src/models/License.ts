import { License as PrismaLicense, LicenseEdition, LicenseType, LicenseStatus, Prisma } from '@prisma/client';
import { db } from '../services/database';
import { logger } from '../utils/logger';
import { 
  PaginationParams,
  FilterParams,
  PaginationResult
} from '@trade-marketing/shared';

export class LicenseModel {
  // Create a new license
  static async create(data: Prisma.LicenseCreateInput): Promise<PrismaLicense> {
    try {
      const license = await db.getClient().license.create({
        data,
        include: {
          company: {
            select: { id: true, name: true, code: true },
          },
          usageRecords: {
            orderBy: { timestamp: 'desc' },
            take: 10,
          },
        },
      });

      logger.info('License created', {
        licenseId: license.id,
        companyId: license.companyId,
        edition: license.edition,
        createdBy: license.createdBy,
      });

      return license;
    } catch (error) {
      logger.error('Failed to create license', { error, data });
      throw error;
    }
  }

  // Find license by ID
  static async findById(id: string): Promise<PrismaLicense | null> {
    try {
      return await db.getClient().license.findUnique({
        where: { id },
        include: {
          company: {
            select: { id: true, name: true, code: true },
          },
          usageRecords: {
            orderBy: { timestamp: 'desc' },
            take: 50,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to find license by ID', { error, id });
      throw error;
    }
  }

  // Find active license by company ID
  static async findActiveByCompanyId(companyId: string): Promise<PrismaLicense | null> {
    try {
      return await db.getClient().license.findFirst({
        where: { 
          companyId,
          status: 'ACTIVE',
          validFrom: { lte: new Date() },
          validUntil: { gte: new Date() },
        },
        include: {
          company: {
            select: { id: true, name: true, code: true },
          },
          usageRecords: {
            orderBy: { timestamp: 'desc' },
            take: 10,
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to find active license by company ID', { error, companyId });
      throw error;
    }
  }

  // Update license
  static async update(id: string, data: Prisma.LicenseUpdateInput): Promise<PrismaLicense> {
    try {
      const license = await db.getClient().license.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
        include: {
          company: {
            select: { id: true, name: true, code: true },
          },
          usageRecords: {
            orderBy: { timestamp: 'desc' },
            take: 10,
          },
        },
      });

      logger.info('License updated', {
        licenseId: license.id,
        updatedBy: data.updatedBy,
      });

      return license;
    } catch (error) {
      logger.error('Failed to update license', { error, id, data });
      throw error;
    }
  }

  // Find licenses with pagination and filtering
  static async findMany(
    pagination: PaginationParams,
    filters: FilterParams = {}
  ): Promise<PaginationResult<PrismaLicense>> {
    try {
      const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
      const offset = (page - 1) * limit;

      // Build where clause
      const where: Prisma.LicenseWhereInput = {};

      if (filters.companyId) {
        where.companyId = filters.companyId;
      }

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.edition) {
        where.edition = filters.edition;
      }

      if (filters.licenseType) {
        where.licenseType = filters.licenseType;
      }

      if (filters.expiringSoon) {
        const daysAhead = parseInt(filters.expiringSoon as string) || 30;
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + daysAhead);
        
        where.validUntil = {
          lte: futureDate,
          gte: new Date(),
        };
      }

      // Get total count
      const total = await db.getClient().license.count({ where });

      // Get licenses
      const licenses = await db.getClient().license.findMany({
        where,
        include: {
          company: {
            select: { id: true, name: true, code: true },
          },
          _count: {
            select: {
              usageRecords: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: offset,
        take: limit,
      });

      const totalPages = Math.ceil(total / limit);

      return {
        data: licenses,
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
      logger.error('Failed to find licenses', { error, pagination, filters });
      throw error;
    }
  }

  // Get license statistics
  static async getStatistics(): Promise<any> {
    try {
      const totalLicenses = await db.getClient().license.count();
      
      const statusStats = await db.getClient().license.groupBy({
        by: ['status'],
        _count: {
          id: true,
        },
      });

      const editionStats = await db.getClient().license.groupBy({
        by: ['edition'],
        _count: {
          id: true,
        },
      });

      const typeStats = await db.getClient().license.groupBy({
        by: ['licenseType'],
        _count: {
          id: true,
        },
      });

      // Get expiring licenses (next 30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const expiringLicenses = await db.getClient().license.count({
        where: {
          status: 'ACTIVE',
          validUntil: {
            lte: thirtyDaysFromNow,
            gte: new Date(),
          },
        },
      });

      // Get expired licenses
      const expiredLicenses = await db.getClient().license.count({
        where: {
          validUntil: {
            lt: new Date(),
          },
        },
      });

      return {
        total: totalLicenses,
        expiring: expiringLicenses,
        expired: expiredLicenses,
        byStatus: statusStats.reduce((acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        byEdition: editionStats.reduce((acc, item) => {
          acc[item.edition] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        byType: typeStats.reduce((acc, item) => {
          acc[item.licenseType] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
      };
    } catch (error) {
      logger.error('Failed to get license statistics', { error });
      throw error;
    }
  }

  // Check license validity
  static async checkValidity(licenseId: string): Promise<{
    isValid: boolean;
    reason?: string;
    license?: PrismaLicense;
  }> {
    try {
      const license = await LicenseModel.findById(licenseId);
      
      if (!license) {
        return { isValid: false, reason: 'License not found' };
      }

      if (license.status !== 'ACTIVE') {
        return { isValid: false, reason: 'License is not active', license };
      }

      const now = new Date();
      if (license.validFrom > now) {
        return { isValid: false, reason: 'License not yet valid', license };
      }

      if (license.validUntil < now) {
        return { isValid: false, reason: 'License has expired', license };
      }

      return { isValid: true, license };
    } catch (error) {
      logger.error('Failed to check license validity', { error, licenseId });
      return { isValid: false, reason: 'Error checking license validity' };
    }
  }

  // Check license limits
  static async checkLimits(licenseId: string): Promise<{
    withinLimits: boolean;
    limits: {
      users: { current: number; max: number; exceeded: boolean };
      companies: { current: number; max: number; exceeded: boolean };
    };
  }> {
    try {
      const license = await LicenseModel.findById(licenseId);
      
      if (!license) {
        throw new Error('License not found');
      }

      const userExceeded = license.maxUsers !== -1 && license.currentUsers > license.maxUsers;
      const companyExceeded = license.maxCompanies !== -1 && license.currentCompanies > license.maxCompanies;

      return {
        withinLimits: !userExceeded && !companyExceeded,
        limits: {
          users: {
            current: license.currentUsers,
            max: license.maxUsers,
            exceeded: userExceeded,
          },
          companies: {
            current: license.currentCompanies,
            max: license.maxCompanies,
            exceeded: companyExceeded,
          },
        },
      };
    } catch (error) {
      logger.error('Failed to check license limits', { error, licenseId });
      throw error;
    }
  }

  // Update usage counters
  static async updateUsage(licenseId: string, userDelta: number = 0, companyDelta: number = 0): Promise<PrismaLicense> {
    try {
      const license = await db.getClient().license.update({
        where: { id: licenseId },
        data: {
          currentUsers: {
            increment: userDelta,
          },
          currentCompanies: {
            increment: companyDelta,
          },
          updatedAt: new Date(),
        },
        include: {
          company: {
            select: { id: true, name: true, code: true },
          },
        },
      });

      logger.info('License usage updated', {
        licenseId,
        userDelta,
        companyDelta,
        currentUsers: license.currentUsers,
        currentCompanies: license.currentCompanies,
      });

      return license;
    } catch (error) {
      logger.error('Failed to update license usage', { error, licenseId, userDelta, companyDelta });
      throw error;
    }
  }

  // Get expiring licenses
  static async getExpiringLicenses(days: number = 30): Promise<PrismaLicense[]> {
    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      return await db.getClient().license.findMany({
        where: {
          status: 'ACTIVE',
          validUntil: {
            lte: futureDate,
            gte: new Date(),
          },
        },
        include: {
          company: {
            select: { id: true, name: true, code: true },
          },
        },
        orderBy: { validUntil: 'asc' },
      });
    } catch (error) {
      logger.error('Failed to get expiring licenses', { error, days });
      throw error;
    }
  }

  // Renew license
  static async renew(licenseId: string, newValidUntil: Date, updatedBy: string): Promise<PrismaLicense> {
    try {
      const license = await db.getClient().license.update({
        where: { id: licenseId },
        data: {
          validUntil: newValidUntil,
          status: 'ACTIVE',
          updatedBy,
          updatedAt: new Date(),
        },
        include: {
          company: {
            select: { id: true, name: true, code: true },
          },
        },
      });

      logger.info('License renewed', {
        licenseId,
        newValidUntil,
        updatedBy,
      });

      return license;
    } catch (error) {
      logger.error('Failed to renew license', { error, licenseId, newValidUntil, updatedBy });
      throw error;
    }
  }

  // Suspend license
  static async suspend(licenseId: string, updatedBy: string): Promise<PrismaLicense> {
    try {
      const license = await db.getClient().license.update({
        where: { id: licenseId },
        data: {
          status: 'SUSPENDED',
          updatedBy,
          updatedAt: new Date(),
        },
        include: {
          company: {
            select: { id: true, name: true, code: true },
          },
        },
      });

      logger.info('License suspended', {
        licenseId,
        updatedBy,
      });

      return license;
    } catch (error) {
      logger.error('Failed to suspend license', { error, licenseId, updatedBy });
      throw error;
    }
  }

  // Activate license
  static async activate(licenseId: string, updatedBy: string): Promise<PrismaLicense> {
    try {
      const license = await db.getClient().license.update({
        where: { id: licenseId },
        data: {
          status: 'ACTIVE',
          updatedBy,
          updatedAt: new Date(),
        },
        include: {
          company: {
            select: { id: true, name: true, code: true },
          },
        },
      });

      logger.info('License activated', {
        licenseId,
        updatedBy,
      });

      return license;
    } catch (error) {
      logger.error('Failed to activate license', { error, licenseId, updatedBy });
      throw error;
    }
  }
}