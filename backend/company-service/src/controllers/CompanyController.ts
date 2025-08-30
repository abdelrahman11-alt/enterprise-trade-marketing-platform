import { Request, Response, NextFunction } from 'express';
import { CompanyModel } from '../models/Company';
import { LicenseModel } from '../models/License';
import { AuditLogModel } from '../models/AuditLog';
import { EventPublisher } from '../services/eventPublisher';
import { CacheService } from '../services/cache';
import { 
  CreateCompanySchema, 
  UpdateCompanySchema,
  PaginationSchema,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  generateId
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

export class CompanyController {
  // Create a new company
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = CreateCompanySchema.parse(req.body);
      const userId = req.user!.id;

      // Check if company code is available
      const isCodeAvailable = await CompanyModel.isCodeAvailable(validatedData.code);
      if (!isCodeAvailable) {
        throw new ValidationError('Company code already exists');
      }

      // Check parent company exists if specified
      if (validatedData.parentCompanyId) {
        const parentCompany = await CompanyModel.findById(validatedData.parentCompanyId);
        if (!parentCompany) {
          throw new NotFoundError('Parent company not found');
        }
      }

      // Create company
      const company = await CompanyModel.create({
        id: generateId(),
        name: validatedData.name,
        code: validatedData.code,
        type: validatedData.type,
        parentCompanyId: validatedData.parentCompanyId,
        settings: validatedData.settings,
        licenseInfo: validatedData.licenseInfo,
        createdBy: userId,
        updatedBy: userId,
      });

      // Create initial license
      await LicenseModel.create({
        id: generateId(),
        companyId: company.id,
        edition: validatedData.licenseInfo.edition,
        licenseType: validatedData.licenseInfo.licenseType,
        maxUsers: validatedData.licenseInfo.maxUsers,
        maxCompanies: validatedData.licenseInfo.maxCompanies,
        features: validatedData.licenseInfo.features,
        addOns: validatedData.licenseInfo.addOns,
        validFrom: validatedData.licenseInfo.validFrom,
        validUntil: validatedData.licenseInfo.validUntil,
        autoRenewal: validatedData.licenseInfo.autoRenewal,
        createdBy: userId,
        updatedBy: userId,
      });

      // Log audit event
      await AuditLogModel.create({
        entityType: 'Company',
        entityId: company.id,
        action: 'CREATE',
        newValues: company,
        userId,
        companyId: company.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Publish event
      await EventPublisher.publishCompanyEvent('company.created', {
        companyId: company.id,
        name: company.name,
        type: company.type,
        createdBy: userId,
      });

      // Clear cache
      await CacheService.invalidatePattern('companies:*');

      logger.info('Company created successfully', {
        companyId: company.id,
        name: company.name,
        createdBy: userId,
      });

      res.status(201).json({
        success: true,
        data: company,
        message: 'Company created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Get company by ID
  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const cacheKey = `company:${id}`;

      // Try to get from cache first
      let company = await CacheService.get(cacheKey);
      
      if (!company) {
        company = await CompanyModel.findById(id);
        if (!company) {
          throw new NotFoundError('Company not found');
        }
        
        // Cache for 1 hour
        await CacheService.set(cacheKey, company, 3600);
      }

      res.json({
        success: true,
        data: company,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get companies with pagination and filtering
  static async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pagination = PaginationSchema.parse({
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
      });

      const filters = {
        status: req.query.status as string,
        type: req.query.type as string,
        parentCompanyId: req.query.parentCompanyId as string,
        search: req.query.search as string,
      };

      const cacheKey = `companies:${JSON.stringify({ pagination, filters })}`;
      
      // Try to get from cache first
      let result = await CacheService.get(cacheKey);
      
      if (!result) {
        result = await CompanyModel.findMany(pagination, filters);
        
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

  // Update company
  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const validatedData = UpdateCompanySchema.parse(req.body);
      const userId = req.user!.id;

      // Check if company exists
      const existingCompany = await CompanyModel.findById(id);
      if (!existingCompany) {
        throw new NotFoundError('Company not found');
      }

      // Check if user has permission to update this company
      if (req.user!.companyId !== id && !req.user!.permissions.includes('company:update:all')) {
        throw new ForbiddenError('Insufficient permissions to update this company');
      }

      // Check if code is available (if being changed)
      if (validatedData.code && validatedData.code !== existingCompany.code) {
        const isCodeAvailable = await CompanyModel.isCodeAvailable(validatedData.code, id);
        if (!isCodeAvailable) {
          throw new ValidationError('Company code already exists');
        }
      }

      // Update company
      const updatedCompany = await CompanyModel.update(id, {
        ...validatedData,
        updatedBy: userId,
      });

      // Log audit event
      await AuditLogModel.create({
        entityType: 'Company',
        entityId: id,
        action: 'UPDATE',
        oldValues: existingCompany,
        newValues: updatedCompany,
        changes: CompanyController.getChanges(existingCompany, updatedCompany),
        userId,
        companyId: id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Publish event
      await EventPublisher.publishCompanyEvent('company.updated', {
        companyId: id,
        changes: CompanyController.getChanges(existingCompany, updatedCompany),
        updatedBy: userId,
      });

      // Clear cache
      await CacheService.invalidatePattern(`company:${id}`);
      await CacheService.invalidatePattern('companies:*');

      logger.info('Company updated successfully', {
        companyId: id,
        updatedBy: userId,
      });

      res.json({
        success: true,
        data: updatedCompany,
        message: 'Company updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete company (soft delete)
  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // Check if company exists
      const existingCompany = await CompanyModel.findById(id);
      if (!existingCompany) {
        throw new NotFoundError('Company not found');
      }

      // Check if user has permission to delete this company
      if (!req.user!.permissions.includes('company:delete')) {
        throw new ForbiddenError('Insufficient permissions to delete company');
      }

      // Check if company has active subsidiaries
      const subsidiaries = await CompanyModel.findByParent(id);
      if (subsidiaries.length > 0) {
        throw new ValidationError('Cannot delete company with active subsidiaries');
      }

      // Soft delete company
      const deletedCompany = await CompanyModel.delete(id, userId);

      // Log audit event
      await AuditLogModel.create({
        entityType: 'Company',
        entityId: id,
        action: 'DELETE',
        oldValues: existingCompany,
        userId,
        companyId: id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Publish event
      await EventPublisher.publishCompanyEvent('company.deleted', {
        companyId: id,
        name: existingCompany.name,
        deletedBy: userId,
      });

      // Clear cache
      await CacheService.invalidatePattern(`company:${id}`);
      await CacheService.invalidatePattern('companies:*');

      logger.info('Company deleted successfully', {
        companyId: id,
        deletedBy: userId,
      });

      res.json({
        success: true,
        message: 'Company deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Get company hierarchy
  static async getHierarchy(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const cacheKey = `company:hierarchy:${id}`;

      // Try to get from cache first
      let hierarchy = await CacheService.get(cacheKey);
      
      if (!hierarchy) {
        hierarchy = await CompanyModel.getHierarchy(id);
        if (!hierarchy) {
          throw new NotFoundError('Company not found');
        }
        
        // Cache for 30 minutes
        await CacheService.set(cacheKey, hierarchy, 1800);
      }

      res.json({
        success: true,
        data: hierarchy,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get company statistics
  static async getStatistics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const cacheKey = `company:stats:${id || 'all'}`;

      // Try to get from cache first
      let stats = await CacheService.get(cacheKey);
      
      if (!stats) {
        stats = await CompanyModel.getStatistics(id);
        
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

  // Get root companies
  static async getRootCompanies(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const cacheKey = 'companies:root';

      // Try to get from cache first
      let companies = await CacheService.get(cacheKey);
      
      if (!companies) {
        companies = await CompanyModel.findRootCompanies();
        
        // Cache for 1 hour
        await CacheService.set(cacheKey, companies, 3600);
      }

      res.json({
        success: true,
        data: companies,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get subsidiaries
  static async getSubsidiaries(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const cacheKey = `company:subsidiaries:${id}`;

      // Try to get from cache first
      let subsidiaries = await CacheService.get(cacheKey);
      
      if (!subsidiaries) {
        subsidiaries = await CompanyModel.findByParent(id);
        
        // Cache for 30 minutes
        await CacheService.set(cacheKey, subsidiaries, 1800);
      }

      res.json({
        success: true,
        data: subsidiaries,
      });
    } catch (error) {
      next(error);
    }
  }

  // Bulk operations
  static async bulkCreate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companies } = req.body;
      const userId = req.user!.id;

      if (!Array.isArray(companies) || companies.length === 0) {
        throw new ValidationError('Companies array is required');
      }

      // Validate each company
      const validatedCompanies = companies.map(company => {
        const validated = CreateCompanySchema.parse(company);
        return {
          id: generateId(),
          ...validated,
          createdBy: userId,
          updatedBy: userId,
        };
      });

      // Bulk create
      const count = await CompanyModel.bulkCreate(validatedCompanies);

      // Clear cache
      await CacheService.invalidatePattern('companies:*');

      logger.info('Bulk company creation completed', {
        count,
        total: companies.length,
        createdBy: userId,
      });

      res.status(201).json({
        success: true,
        data: { created: count, total: companies.length },
        message: `${count} companies created successfully`,
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