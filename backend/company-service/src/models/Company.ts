import { Company as PrismaCompany, CompanyType, CompanyStatus, Prisma } from '@prisma/client';
import { db } from '../services/database';
import { logger } from '../utils/logger';
import { 
  Company, 
  CreateCompanySchema, 
  UpdateCompanySchema,
  PaginationParams,
  FilterParams,
  PaginationResult
} from '@trade-marketing/shared';

export class CompanyModel {
  // Create a new company
  static async create(data: Prisma.CompanyCreateInput): Promise<PrismaCompany> {
    try {
      const company = await db.getClient().company.create({
        data,
        include: {
          parentCompany: true,
          subsidiaries: true,
          licenses: true,
        },
      });

      logger.info('Company created', {
        companyId: company.id,
        name: company.name,
        type: company.type,
        createdBy: company.createdBy,
      });

      return company;
    } catch (error) {
      logger.error('Failed to create company', { error, data });
      throw error;
    }
  }

  // Find company by ID
  static async findById(id: string): Promise<PrismaCompany | null> {
    try {
      return await db.getClient().company.findUnique({
        where: { id },
        include: {
          parentCompany: true,
          subsidiaries: true,
          licenses: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
          },
          users: {
            where: { status: 'ACTIVE' },
          },
        },
      });
    } catch (error) {
      logger.error('Failed to find company by ID', { error, id });
      throw error;
    }
  }

  // Find company by code
  static async findByCode(code: string): Promise<PrismaCompany | null> {
    try {
      return await db.getClient().company.findUnique({
        where: { code },
        include: {
          parentCompany: true,
          subsidiaries: true,
          licenses: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    } catch (error) {
      logger.error('Failed to find company by code', { error, code });
      throw error;
    }
  }

  // Update company
  static async update(id: string, data: Prisma.CompanyUpdateInput): Promise<PrismaCompany> {
    try {
      const company = await db.getClient().company.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
        include: {
          parentCompany: true,
          subsidiaries: true,
          licenses: true,
        },
      });

      logger.info('Company updated', {
        companyId: company.id,
        updatedBy: data.updatedBy,
      });

      return company;
    } catch (error) {
      logger.error('Failed to update company', { error, id, data });
      throw error;
    }
  }

  // Delete company (soft delete by setting status to INACTIVE)
  static async delete(id: string, deletedBy: string): Promise<PrismaCompany> {
    try {
      const company = await db.getClient().company.update({
        where: { id },
        data: {
          status: CompanyStatus.INACTIVE,
          updatedBy: deletedBy,
          updatedAt: new Date(),
        },
      });

      logger.info('Company deleted (soft)', {
        companyId: company.id,
        deletedBy,
      });

      return company;
    } catch (error) {
      logger.error('Failed to delete company', { error, id, deletedBy });
      throw error;
    }
  }

  // Find companies with pagination and filtering
  static async findMany(
    pagination: PaginationParams,
    filters: FilterParams = {}
  ): Promise<PaginationResult<PrismaCompany>> {
    try {
      const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
      const offset = (page - 1) * limit;

      // Build where clause
      const where: Prisma.CompanyWhereInput = {};

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.type) {
        where.type = filters.type;
      }

      if (filters.parentCompanyId) {
        where.parentCompanyId = filters.parentCompanyId;
      }

      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { code: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      // Get total count
      const total = await db.getClient().company.count({ where });

      // Get companies
      const companies = await db.getClient().company.findMany({
        where,
        include: {
          parentCompany: {
            select: { id: true, name: true, code: true },
          },
          subsidiaries: {
            select: { id: true, name: true, code: true, type: true },
          },
          licenses: {
            where: { status: 'ACTIVE' },
            select: { id: true, edition: true, validUntil: true },
          },
          _count: {
            select: {
              users: { where: { status: 'ACTIVE' } },
              subsidiaries: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: offset,
        take: limit,
      });

      const totalPages = Math.ceil(total / limit);

      return {
        data: companies,
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
      logger.error('Failed to find companies', { error, pagination, filters });
      throw error;
    }
  }

  // Get company hierarchy
  static async getHierarchy(rootCompanyId: string): Promise<any> {
    try {
      const buildHierarchy = async (companyId: string): Promise<any> => {
        const company = await db.getClient().company.findUnique({
          where: { id: companyId },
          include: {
            subsidiaries: {
              where: { status: 'ACTIVE' },
              select: { id: true, name: true, code: true, type: true },
            },
            licenses: {
              where: { status: 'ACTIVE' },
              select: { id: true, edition: true, validUntil: true },
            },
            _count: {
              select: {
                users: { where: { status: 'ACTIVE' } },
              },
            },
          },
        });

        if (!company) return null;

        const children = await Promise.all(
          company.subsidiaries.map(sub => buildHierarchy(sub.id))
        );

        return {
          ...company,
          children: children.filter(Boolean),
        };
      };

      return await buildHierarchy(rootCompanyId);
    } catch (error) {
      logger.error('Failed to get company hierarchy', { error, rootCompanyId });
      throw error;
    }
  }

  // Get company statistics
  static async getStatistics(companyId?: string): Promise<any> {
    try {
      const where: Prisma.CompanyWhereInput = companyId 
        ? { id: companyId }
        : {};

      const stats = await db.getClient().company.aggregate({
        where,
        _count: {
          id: true,
        },
      });

      const statusStats = await db.getClient().company.groupBy({
        by: ['status'],
        where,
        _count: {
          id: true,
        },
      });

      const typeStats = await db.getClient().company.groupBy({
        by: ['type'],
        where,
        _count: {
          id: true,
        },
      });

      return {
        total: stats._count.id,
        byStatus: statusStats.reduce((acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        byType: typeStats.reduce((acc, item) => {
          acc[item.type] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
      };
    } catch (error) {
      logger.error('Failed to get company statistics', { error, companyId });
      throw error;
    }
  }

  // Check if company code is available
  static async isCodeAvailable(code: string, excludeId?: string): Promise<boolean> {
    try {
      const where: Prisma.CompanyWhereInput = { code };
      
      if (excludeId) {
        where.id = { not: excludeId };
      }

      const existing = await db.getClient().company.findFirst({ where });
      return !existing;
    } catch (error) {
      logger.error('Failed to check code availability', { error, code, excludeId });
      throw error;
    }
  }

  // Get companies by parent
  static async findByParent(parentCompanyId: string): Promise<PrismaCompany[]> {
    try {
      return await db.getClient().company.findMany({
        where: { 
          parentCompanyId,
          status: 'ACTIVE',
        },
        include: {
          subsidiaries: {
            select: { id: true, name: true, code: true, type: true },
          },
          licenses: {
            where: { status: 'ACTIVE' },
            select: { id: true, edition: true, validUntil: true },
          },
          _count: {
            select: {
              users: { where: { status: 'ACTIVE' } },
            },
          },
        },
        orderBy: { name: 'asc' },
      });
    } catch (error) {
      logger.error('Failed to find companies by parent', { error, parentCompanyId });
      throw error;
    }
  }

  // Get root companies (no parent)
  static async findRootCompanies(): Promise<PrismaCompany[]> {
    try {
      return await db.getClient().company.findMany({
        where: { 
          parentCompanyId: null,
          status: 'ACTIVE',
        },
        include: {
          subsidiaries: {
            select: { id: true, name: true, code: true, type: true },
          },
          licenses: {
            where: { status: 'ACTIVE' },
            select: { id: true, edition: true, validUntil: true },
          },
          _count: {
            select: {
              users: { where: { status: 'ACTIVE' } },
              subsidiaries: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });
    } catch (error) {
      logger.error('Failed to find root companies', { error });
      throw error;
    }
  }

  // Bulk operations
  static async bulkCreate(companies: Prisma.CompanyCreateInput[]): Promise<number> {
    try {
      const result = await db.getClient().company.createMany({
        data: companies,
        skipDuplicates: true,
      });

      logger.info('Bulk company creation completed', {
        count: result.count,
        total: companies.length,
      });

      return result.count;
    } catch (error) {
      logger.error('Failed to bulk create companies', { error, count: companies.length });
      throw error;
    }
  }

  static async bulkUpdate(
    where: Prisma.CompanyWhereInput,
    data: Prisma.CompanyUpdateInput
  ): Promise<number> {
    try {
      const result = await db.getClient().company.updateMany({
        where,
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });

      logger.info('Bulk company update completed', {
        count: result.count,
      });

      return result.count;
    } catch (error) {
      logger.error('Failed to bulk update companies', { error, where, data });
      throw error;
    }
  }
}