import { Request, Response, NextFunction } from 'express';
import { LicenseModel } from '../models/License';
import { AuditLogModel } from '../models/AuditLog';
import { EventPublisher } from '../services/eventPublisher';
import { CacheService } from '../services/cache';
import { 
  PaginationSchema,
  ValidationError,
  NotFoundError,
  ForbiddenError
} from '@trade-marketing/shared';
import { logger } from '../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    companyId: string;
    roles: string[];
    permissions: string[];
  };
}

export class LicenseController {
  // Get license by ID
  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const cacheKey = `license:${id}`;

      // Try to get from cache first
      let license = await CacheService.get(cacheKey);
      
      if (!license) {
        license = await LicenseModel.findById(id);
        if (!license) {
          throw new NotFoundError('License not found');
        }
        
        // Cache for 1 hour
        await CacheService.set(cacheKey, license, 3600);
      }

      res.json({
        success: true,
        data: license,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get licenses with pagination and filtering
  static async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pagination = PaginationSchema.parse({
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      });

      const filters = {
        companyId: req.query.companyId as string,
        status: req.query.status as string,
        edition: req.query.edition as string,
        licenseType: req.query.licenseType as string,
        expiringSoon: req.query.expiringSoon as string,
      };

      const cacheKey = `licenses:${JSON.stringify({ pagination, filters })}`;
      
      // Try to get from cache first
      let result = await CacheService.get(cacheKey);
      
      if (!result) {
        result = await LicenseModel.findMany(pagination, filters);
        
        // Cache for 15 minutes
        await CacheService.set(cacheKey, result, 900);
      }

      res.json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  // Update license
  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const userId = req.user!.id;

      // Check if license exists
      const existingLicense = await LicenseModel.findById(id);
      if (!existingLicense) {
        throw new NotFoundError('License not found');
      }

      // Check if user has permission to update this license
      if (!req.user!.permissions.includes('license:update')) {
        throw new ForbiddenError('Insufficient permissions to update license');
      }

      // Update license
      const updatedLicense = await LicenseModel.update(id, {
        ...updateData,
        updatedBy: userId,
      });

      // Log audit event
      await AuditLogModel.create({
        entityType: 'License',
        entityId: id,
        action: 'UPDATE',
        oldValues: existingLicense,
        newValues: updatedLicense,
        changes: LicenseController.getChanges(existingLicense, updatedLicense),
        userId,
        companyId: existingLicense.companyId,
        licenseId: id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Publish event
      await EventPublisher.publishLicenseUpdated({
        licenseId: id,
        companyId: existingLicense.companyId,
        changes: LicenseController.getChanges(existingLicense, updatedLicense),
        updatedBy: userId,
      });

      // Clear cache
      await CacheService.invalidatePattern(`license:${id}`);
      await CacheService.invalidatePattern('licenses:*');

      logger.info('License updated successfully', {
        licenseId: id,
        updatedBy: userId,
      });

      res.json({
        success: true,
        data: updatedLicense,
        message: 'License updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Get license statistics
  static async getStatistics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const cacheKey = 'license:stats';

      // Try to get from cache first
      let stats = await CacheService.get(cacheKey);
      
      if (!stats) {
        stats = await LicenseModel.getStatistics();
        
        // Cache for 5 minutes
        await CacheService.set(cacheKey, stats, 300);
      }

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get expiring licenses
  static async getExpiring(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const cacheKey = `licenses:expiring:${days}`;

      // Try to get from cache first
      let licenses = await CacheService.get(cacheKey);
      
      if (!licenses) {
        licenses = await LicenseModel.getExpiringLicenses(days);
        
        // Cache for 1 hour
        await CacheService.set(cacheKey, licenses, 3600);
      }

      res.json({
        success: true,
        data: licenses,
      });
    } catch (error) {
      next(error);
    }
  }

  // Renew license
  static async renew(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { validUntil } = req.body;
      const userId = req.user!.id;

      if (!validUntil) {
        throw new ValidationError('validUntil is required');
      }

      // Check if license exists
      const existingLicense = await LicenseModel.findById(id);
      if (!existingLicense) {
        throw new NotFoundError('License not found');
      }

      // Check if user has permission to renew license
      if (!req.user!.permissions.includes('license:renew')) {
        throw new ForbiddenError('Insufficient permissions to renew license');
      }

      const newValidUntil = new Date(validUntil);
      const renewedLicense = await LicenseModel.renew(id, newValidUntil, userId);

      // Log audit event
      await AuditLogModel.create({
        entityType: 'License',
        entityId: id,
        action: 'UPDATE',
        oldValues: { validUntil: existingLicense.validUntil },
        newValues: { validUntil: newValidUntil },
        userId,
        companyId: existingLicense.companyId,
        licenseId: id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { action: 'renew' },
      });

      // Publish event
      await EventPublisher.publishLicenseRenewed({
        licenseId: id,
        companyId: existingLicense.companyId,
        oldValidUntil: existingLicense.validUntil.toISOString(),
        newValidUntil: newValidUntil.toISOString(),
        renewedBy: userId,
      });

      // Clear cache
      await CacheService.invalidatePattern(`license:${id}`);
      await CacheService.invalidatePattern('licenses:*');

      logger.info('License renewed successfully', {
        licenseId: id,
        newValidUntil,
        renewedBy: userId,
      });

      res.json({
        success: true,
        data: renewedLicense,
        message: 'License renewed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Suspend license
  static async suspend(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const userId = req.user!.id;

      // Check if license exists
      const existingLicense = await LicenseModel.findById(id);
      if (!existingLicense) {
        throw new NotFoundError('License not found');
      }

      // Check if user has permission to suspend license
      if (!req.user!.permissions.includes('license:suspend')) {
        throw new ForbiddenError('Insufficient permissions to suspend license');
      }

      const suspendedLicense = await LicenseModel.suspend(id, userId);

      // Log audit event
      await AuditLogModel.create({
        entityType: 'License',
        entityId: id,
        action: 'UPDATE',
        oldValues: { status: existingLicense.status },
        newValues: { status: 'SUSPENDED' },
        userId,
        companyId: existingLicense.companyId,
        licenseId: id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { action: 'suspend', reason },
      });

      // Publish event
      await EventPublisher.publishLicenseSuspended({
        licenseId: id,
        companyId: existingLicense.companyId,
        suspendedBy: userId,
        reason,
      });

      // Clear cache
      await CacheService.invalidatePattern(`license:${id}`);
      await CacheService.invalidatePattern('licenses:*');

      logger.info('License suspended successfully', {
        licenseId: id,
        reason,
        suspendedBy: userId,
      });

      res.json({
        success: true,
        data: suspendedLicense,
        message: 'License suspended successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Activate license
  static async activate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // Check if license exists
      const existingLicense = await LicenseModel.findById(id);
      if (!existingLicense) {
        throw new NotFoundError('License not found');
      }

      // Check if user has permission to activate license
      if (!req.user!.permissions.includes('license:activate')) {
        throw new ForbiddenError('Insufficient permissions to activate license');
      }

      const activatedLicense = await LicenseModel.activate(id, userId);

      // Log audit event
      await AuditLogModel.create({
        entityType: 'License',
        entityId: id,
        action: 'UPDATE',
        oldValues: { status: existingLicense.status },
        newValues: { status: 'ACTIVE' },
        userId,
        companyId: existingLicense.companyId,
        licenseId: id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { action: 'activate' },
      });

      // Publish event
      await EventPublisher.publishLicenseActivated({
        licenseId: id,
        companyId: existingLicense.companyId,
        activatedBy: userId,
      });

      // Clear cache
      await CacheService.invalidatePattern(`license:${id}`);
      await CacheService.invalidatePattern('licenses:*');

      logger.info('License activated successfully', {
        licenseId: id,
        activatedBy: userId,
      });

      res.json({
        success: true,
        data: activatedLicense,
        message: 'License activated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Check license validity
  static async checkValidity(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const validityCheck = await LicenseModel.checkValidity(id);

      res.json({
        success: true,
        data: validityCheck,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get license by company ID
  static async getByCompanyId(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId } = req.params;
      const cacheKey = `license:company:${companyId}`;

      // Try to get from cache first
      let license = await CacheService.get(cacheKey);
      
      if (!license) {
        license = await LicenseModel.findActiveByCompanyId(companyId);
        if (!license) {
          throw new NotFoundError('Active license not found for this company');
        }
        
        // Cache for 1 hour
        await CacheService.set(cacheKey, license, 3600);
      }

      res.json({
        success: true,
        data: license,
      });
    } catch (error) {
      next(error);
    }
  }

  // Helper method to get changes between objects
  private static getChanges(oldObj: any, newObj: any): any {
    const changes: any = {};
    
    for (const key in newObj) {
      if (oldObj[key] !== newObj[key]) {
        changes[key] = {
          from: oldObj[key],
          to: newObj[key],
        };
      }
    }
    
    return changes;
  }
}