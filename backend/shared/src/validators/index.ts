import { z } from 'zod';
import { REGEX, BUSINESS_RULES } from '../constants';

// Base Schemas
export const IdSchema = z.string().uuid();
export const EmailSchema = z.string().email();
export const PhoneSchema = z.string().regex(REGEX.PHONE);
export const UrlSchema = z.string().url();
export const SlugSchema = z.string().regex(REGEX.SLUG);
export const CurrencySchema = z.string().length(3);
export const LocaleSchema = z.string().min(2).max(10);
export const TimezoneSchema = z.string();

// Date Schemas
export const DateSchema = z.coerce.date();
export const DateRangeSchema = z.object({
  startDate: DateSchema,
  endDate: DateSchema
}).refine(data => data.startDate <= data.endDate, {
  message: "Start date must be before or equal to end date"
});

// Pagination Schemas
export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc')
});

// Company Schemas
export const CompanyTypeSchema = z.enum(['holding', 'subsidiary', 'division', 'brand']);
export const CompanyStatusSchema = z.enum(['active', 'inactive', 'suspended', 'pending']);

export const CompanySettingsSchema = z.object({
  timezone: TimezoneSchema,
  currency: CurrencySchema,
  locale: LocaleSchema,
  fiscalYearStart: z.string().regex(/^\d{2}-\d{2}$/), // MM-DD format
  features: z.object({
    tradeSpendManagement: z.boolean(),
    promotionPlanning: z.boolean(),
    fieldExecution: z.boolean(),
    supplyChainIntegration: z.boolean(),
    financialManagement: z.boolean(),
    aiAnalytics: z.boolean(),
    customReporting: z.boolean(),
    mobileApp: z.boolean()
  }),
  integrations: z.object({
    erp: z.array(z.object({
      id: IdSchema,
      name: z.string(),
      type: z.enum(['sap', 'oracle', 'microsoft_dynamics', 'netsuite', 'custom']),
      config: z.record(z.any()),
      status: z.enum(['active', 'inactive', 'error', 'syncing'])
    })),
    crm: z.array(z.object({
      id: IdSchema,
      name: z.string(),
      type: z.enum(['salesforce', 'microsoft_dynamics', 'hubspot', 'custom']),
      config: z.record(z.any()),
      status: z.enum(['active', 'inactive', 'error', 'syncing'])
    })),
    sso: z.array(z.object({
      id: IdSchema,
      name: z.string(),
      type: z.enum(['saml', 'oauth2', 'openid_connect', 'ldap', 'active_directory']),
      config: z.record(z.any()),
      status: z.enum(['active', 'inactive', 'error', 'syncing'])
    })),
    dataWarehouse: z.array(z.object({
      id: IdSchema,
      name: z.string(),
      type: z.enum(['snowflake', 'redshift', 'bigquery', 'databricks', 'custom']),
      config: z.record(z.any()),
      status: z.enum(['active', 'inactive', 'error', 'syncing'])
    }))
  })
});

export const LicenseEditionSchema = z.enum(['starter', 'professional', 'enterprise', 'platform']);
export const LicenseTypeSchema = z.enum(['named_user', 'concurrent_user', 'module_based', 'transaction_based']);

export const LicenseInfoSchema = z.object({
  edition: LicenseEditionSchema,
  licenseType: LicenseTypeSchema,
  maxUsers: z.number().int().min(-1),
  maxCompanies: z.number().int().min(-1),
  currentUsers: z.number().int().min(0),
  currentCompanies: z.number().int().min(0),
  features: z.array(z.string()),
  addOns: z.array(z.object({
    id: IdSchema,
    name: z.string(),
    type: z.string(),
    quantity: z.number().int().min(0),
    price: z.number().min(0),
    validUntil: DateSchema
  })),
  validFrom: DateSchema,
  validUntil: DateSchema,
  autoRenewal: z.boolean()
});

export const CreateCompanySchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(2).max(10).regex(/^[A-Z0-9]+$/),
  type: CompanyTypeSchema,
  parentCompanyId: IdSchema.optional(),
  settings: CompanySettingsSchema,
  licenseInfo: LicenseInfoSchema
});

export const UpdateCompanySchema = CreateCompanySchema.partial().omit({ code: true });

// User Schemas
export const UserStatusSchema = z.enum(['active', 'inactive', 'suspended', 'pending_activation']);
export const AccessLevelSchema = z.enum(['full', 'limited', 'read_only']);

export const PermissionSchema = z.object({
  resource: z.string(),
  actions: z.array(z.string()),
  conditions: z.record(z.any()).optional()
});

export const UserRoleSchema = z.object({
  id: IdSchema,
  name: z.string(),
  permissions: z.array(PermissionSchema),
  companyId: IdSchema,
  isDefault: z.boolean()
});

export const UserCompanyAccessSchema = z.object({
  companyId: IdSchema,
  roles: z.array(z.string()),
  permissions: z.array(PermissionSchema),
  accessLevel: AccessLevelSchema
});

export const NotificationPreferencesSchema = z.object({
  email: z.boolean(),
  push: z.boolean(),
  sms: z.boolean(),
  inApp: z.boolean(),
  frequency: z.enum(['immediate', 'daily', 'weekly'])
});

export const DashboardWidgetSchema = z.object({
  id: IdSchema,
  type: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number()
  }),
  config: z.record(z.any())
});

export const UserPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']),
  language: z.string(),
  timezone: TimezoneSchema,
  notifications: NotificationPreferencesSchema,
  dashboard: z.object({
    layout: z.string(),
    widgets: z.array(DashboardWidgetSchema),
    defaultFilters: z.record(z.any())
  })
});

export const CreateUserSchema = z.object({
  email: EmailSchema,
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  password: z.string().regex(REGEX.STRONG_PASSWORD, {
    message: "Password must be at least 8 characters with uppercase, lowercase, number, and special character"
  }),
  roles: z.array(IdSchema),
  companies: z.array(UserCompanyAccessSchema),
  preferences: UserPreferencesSchema.optional(),
  licenseType: LicenseTypeSchema
});

export const UpdateUserSchema = CreateUserSchema.partial().omit({ password: true });

export const ChangePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().regex(REGEX.STRONG_PASSWORD),
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

// Authentication Schemas
export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1),
  rememberMe: z.boolean().optional()
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string()
});

export const ForgotPasswordSchema = z.object({
  email: EmailSchema
});

export const ResetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().regex(REGEX.STRONG_PASSWORD),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

// Trade Spend Schemas
export const TradeSpendTypeSchema = z.enum([
  'promotion',
  'listing_fee',
  'volume_rebate',
  'marketing_support',
  'display_allowance',
  'cooperative_advertising',
  'slotting_allowance',
  'other'
]);

export const TradeSpendCategorySchema = z.enum([
  'price_promotion',
  'volume_incentive',
  'display_support',
  'marketing_investment',
  'customer_development'
]);

export const TradeSpendStatusSchema = z.enum([
  'draft',
  'pending_approval',
  'approved',
  'active',
  'completed',
  'cancelled'
]);

export const ApprovalStatusSchema = z.enum(['pending', 'approved', 'rejected']);

export const ApprovalSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  status: ApprovalStatusSchema,
  comments: z.string().optional(),
  approvedAt: DateSchema.optional(),
  level: z.number().int().min(1)
});

export const AllocationConditionSchema = z.object({
  type: z.string(),
  operator: z.enum(['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'in']),
  value: z.any()
});

export const TradeSpendAllocationSchema = z.object({
  id: IdSchema,
  customerId: IdSchema,
  productId: IdSchema,
  amount: z.number().min(0),
  percentage: z.number().min(0).max(100),
  conditions: z.array(AllocationConditionSchema)
});

export const TradeSpendPerformanceSchema = z.object({
  plannedROI: z.number(),
  actualROI: z.number().optional(),
  plannedVolume: z.number().min(0),
  actualVolume: z.number().min(0).optional(),
  plannedRevenue: z.number().min(0),
  actualRevenue: z.number().min(0).optional(),
  incrementalVolume: z.number().optional(),
  incrementalRevenue: z.number().optional(),
  efficiency: z.number().min(0).max(100)
});

export const CreateTradeSpendSchema = z.object({
  companyId: IdSchema,
  name: z.string().min(1).max(255),
  type: TradeSpendTypeSchema,
  category: TradeSpendCategorySchema,
  amount: z.number().min(BUSINESS_RULES.TRADE_SPEND.MIN_AMOUNT).max(BUSINESS_RULES.TRADE_SPEND.MAX_AMOUNT),
  currency: CurrencySchema,
  period: DateRangeSchema,
  allocations: z.array(TradeSpendAllocationSchema),
  performance: TradeSpendPerformanceSchema.optional(),
  metadata: z.record(z.any()).optional()
});

export const UpdateTradeSpendSchema = CreateTradeSpendSchema.partial().omit({ companyId: true });

// Promotion Schemas
export const PromotionTypeSchema = z.enum([
  'price_reduction',
  'bogo',
  'multi_buy',
  'cashback',
  'contest',
  'sampling',
  'display'
]);

export const PromotionStatusSchema = z.enum([
  'planning',
  'approved',
  'active',
  'completed',
  'cancelled'
]);

export const CustomerTypeSchema = z.enum([
  'retailer',
  'wholesaler',
  'distributor',
  'online',
  'foodservice'
]);

export const PromotionConditionSchema = z.object({
  type: z.string(),
  operator: z.enum(['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'in']),
  value: z.any()
});

export const PromotionMechanicsSchema = z.object({
  discountType: z.enum(['percentage', 'fixed_amount']),
  discountValue: z.number().min(0),
  minQuantity: z.number().int().min(0).optional(),
  maxQuantity: z.number().int().min(0).optional(),
  conditions: z.array(PromotionConditionSchema)
});

export const PromotionProductSchema = z.object({
  productId: IdSchema,
  sku: z.string(),
  name: z.string(),
  category: z.string(),
  brand: z.string(),
  unitPrice: z.number().min(0),
  promotionalPrice: z.number().min(0),
  expectedVolume: z.number().min(0)
});

export const PromotionCustomerSchema = z.object({
  customerId: IdSchema,
  name: z.string(),
  type: CustomerTypeSchema,
  channels: z.array(z.string()),
  regions: z.array(z.string()),
  expectedVolume: z.number().min(0),
  allocatedBudget: z.number().min(0)
});

export const BudgetBreakdownSchema = z.object({
  category: z.string(),
  plannedAmount: z.number().min(0),
  actualAmount: z.number().min(0)
});

export const PromotionBudgetSchema = z.object({
  totalBudget: z.number().min(0),
  spentAmount: z.number().min(0),
  remainingAmount: z.number().min(0),
  breakdown: z.array(BudgetBreakdownSchema)
});

export const PromotionPerformanceSchema = z.object({
  plannedVolume: z.number().min(0),
  actualVolume: z.number().min(0),
  plannedRevenue: z.number().min(0),
  actualRevenue: z.number().min(0),
  roi: z.number(),
  incrementalVolume: z.number(),
  incrementalRevenue: z.number(),
  marketShare: z.number().min(0).max(100),
  customerParticipation: z.number().min(0).max(100)
});

export const CreatePromotionSchema = z.object({
  companyId: IdSchema,
  name: z.string().min(1).max(255),
  description: z.string().max(1000),
  type: PromotionTypeSchema,
  mechanics: PromotionMechanicsSchema,
  period: DateRangeSchema.refine(data => {
    const durationDays = Math.ceil((data.endDate.getTime() - data.startDate.getTime()) / (1000 * 60 * 60 * 24));
    return durationDays >= BUSINESS_RULES.PROMOTION.MIN_DURATION_DAYS && 
           durationDays <= BUSINESS_RULES.PROMOTION.MAX_DURATION_DAYS;
  }, {
    message: `Promotion duration must be between ${BUSINESS_RULES.PROMOTION.MIN_DURATION_DAYS} and ${BUSINESS_RULES.PROMOTION.MAX_DURATION_DAYS} days`
  }),
  products: z.array(PromotionProductSchema).min(1),
  customers: z.array(PromotionCustomerSchema).min(1),
  budget: PromotionBudgetSchema,
  performance: PromotionPerformanceSchema.optional()
});

export const UpdatePromotionSchema = CreatePromotionSchema.partial().omit({ companyId: true });

// Analytics Schemas
export const ReportTypeSchema = z.enum(['dashboard', 'detailed', 'summary', 'comparative', 'predictive']);
export const ReportCategorySchema = z.enum([
  'trade_spend',
  'promotion_performance',
  'customer_analysis',
  'product_performance',
  'financial',
  'operational'
]);

export const ScheduleFrequencySchema = z.enum(['daily', 'weekly', 'monthly', 'quarterly']);

export const ReportParametersSchema = z.object({
  dateRange: DateRangeSchema,
  filters: z.record(z.any()),
  groupBy: z.array(z.string()),
  metrics: z.array(z.string()),
  dimensions: z.array(z.string())
});

export const ReportScheduleSchema = z.object({
  frequency: ScheduleFrequencySchema,
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  time: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  timezone: TimezoneSchema
});

export const InsightTypeSchema = z.enum(['trend', 'anomaly', 'opportunity', 'risk', 'correlation']);
export const InsightImpactSchema = z.enum(['high', 'medium', 'low']);

export const AnalyticsInsightSchema = z.object({
  type: InsightTypeSchema,
  title: z.string(),
  description: z.string(),
  impact: InsightImpactSchema,
  confidence: z.number().min(0).max(1),
  recommendations: z.array(z.string()),
  data: z.any()
});

export const CreateAnalyticsReportSchema = z.object({
  companyId: IdSchema,
  name: z.string().min(1).max(255),
  type: ReportTypeSchema,
  category: ReportCategorySchema,
  parameters: ReportParametersSchema,
  schedule: ReportScheduleSchema.optional(),
  recipients: z.array(EmailSchema)
});

export const UpdateAnalyticsReportSchema = CreateAnalyticsReportSchema.partial().omit({ companyId: true });

// File Upload Schemas
export const FileMetadataSchema = z.object({
  uploadedBy: IdSchema,
  category: z.string(),
  description: z.string().optional(),
  isPublic: z.boolean(),
  expiresAt: DateSchema.optional(),
  virusScanStatus: z.enum(['pending', 'clean', 'infected'])
});

export const CreateFileUploadSchema = z.object({
  companyId: IdSchema,
  fileName: z.string().min(1).max(255),
  originalName: z.string().min(1).max(255),
  mimeType: z.string(),
  size: z.number().int().min(1),
  tags: z.array(z.string()),
  metadata: FileMetadataSchema
});

// Notification Schemas
export const NotificationTypeSchema = z.enum(['info', 'warning', 'error', 'success', 'reminder']);
export const NotificationChannelSchema = z.enum(['in_app', 'email', 'sms', 'push']);
export const NotificationStatusSchema = z.enum(['pending', 'sent', 'delivered', 'failed', 'read']);

export const CreateNotificationSchema = z.object({
  userId: IdSchema,
  companyId: IdSchema,
  type: NotificationTypeSchema,
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(1000),
  data: z.any().optional(),
  channels: z.array(NotificationChannelSchema).min(1),
  expiresAt: DateSchema.optional()
});

// Search Schemas
export const SearchSchema = z.object({
  query: z.string().min(1).max(255),
  filters: z.record(z.any()).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20)
});

// Bulk Operation Schemas
export const BulkOperationSchema = z.object({
  operation: z.enum(['create', 'update', 'delete']),
  data: z.array(z.any()).min(1).max(1000),
  options: z.record(z.any()).optional()
});

// Export all schemas
export * from './field-execution-validators';
export * from './ai-validators';
export * from './supply-chain-validators';
export * from './financial-validators';