// Core Entity Types
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

// Company & Multi-Tenancy Types
export interface Company extends BaseEntity {
  name: string;
  code: string;
  type: CompanyType;
  parentCompanyId?: string;
  status: CompanyStatus;
  settings: CompanySettings;
  licenseInfo: LicenseInfo;
  metadata: Record<string, any>;
}

export enum CompanyType {
  HOLDING = 'holding',
  SUBSIDIARY = 'subsidiary',
  DIVISION = 'division',
  BRAND = 'brand'
}

export enum CompanyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending'
}

export interface CompanySettings {
  timezone: string;
  currency: string;
  locale: string;
  fiscalYearStart: string;
  features: CompanyFeatures;
  integrations: IntegrationSettings;
}

export interface CompanyFeatures {
  tradeSpendManagement: boolean;
  promotionPlanning: boolean;
  fieldExecution: boolean;
  supplyChainIntegration: boolean;
  financialManagement: boolean;
  aiAnalytics: boolean;
  customReporting: boolean;
  mobileApp: boolean;
}

export interface IntegrationSettings {
  erp: ERPIntegration[];
  crm: CRMIntegration[];
  sso: SSOIntegration[];
  dataWarehouse: DataWarehouseIntegration[];
}

// Licensing Types
export interface LicenseInfo {
  edition: LicenseEdition;
  licenseType: LicenseType;
  maxUsers: number;
  maxCompanies: number;
  currentUsers: number;
  currentCompanies: number;
  features: string[];
  addOns: LicenseAddOn[];
  validFrom: Date;
  validUntil: Date;
  autoRenewal: boolean;
}

export enum LicenseEdition {
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
  PLATFORM = 'platform'
}

export enum LicenseType {
  NAMED_USER = 'named_user',
  CONCURRENT_USER = 'concurrent_user',
  MODULE_BASED = 'module_based',
  TRANSACTION_BASED = 'transaction_based'
}

export interface LicenseAddOn {
  id: string;
  name: string;
  type: string;
  quantity: number;
  price: number;
  validUntil: Date;
}

// User & Identity Types
export interface User extends BaseEntity {
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  status: UserStatus;
  roles: UserRole[];
  companies: UserCompanyAccess[];
  preferences: UserPreferences;
  lastLoginAt?: Date;
  licenseType: LicenseType;
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_ACTIVATION = 'pending_activation'
}

export interface UserRole {
  id: string;
  name: string;
  permissions: Permission[];
  companyId: string;
  isDefault: boolean;
}

export interface Permission {
  resource: string;
  actions: string[];
  conditions?: Record<string, any>;
}

export interface UserCompanyAccess {
  companyId: string;
  roles: string[];
  permissions: Permission[];
  accessLevel: AccessLevel;
}

export enum AccessLevel {
  FULL = 'full',
  LIMITED = 'limited',
  READ_ONLY = 'read_only'
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
  notifications: NotificationPreferences;
  dashboard: DashboardPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  inApp: boolean;
  frequency: 'immediate' | 'daily' | 'weekly';
}

export interface DashboardPreferences {
  layout: string;
  widgets: DashboardWidget[];
  defaultFilters: Record<string, any>;
}

export interface DashboardWidget {
  id: string;
  type: string;
  position: { x: number; y: number; w: number; h: number };
  config: Record<string, any>;
}

// Trade Marketing Types
export interface TradeSpend extends BaseEntity {
  companyId: string;
  name: string;
  type: TradeSpendType;
  category: TradeSpendCategory;
  amount: number;
  currency: string;
  period: DatePeriod;
  status: TradeSpendStatus;
  approvals: Approval[];
  allocations: TradeSpendAllocation[];
  performance: TradeSpendPerformance;
  metadata: Record<string, any>;
}

export enum TradeSpendType {
  PROMOTION = 'promotion',
  LISTING_FEE = 'listing_fee',
  VOLUME_REBATE = 'volume_rebate',
  MARKETING_SUPPORT = 'marketing_support',
  DISPLAY_ALLOWANCE = 'display_allowance',
  COOPERATIVE_ADVERTISING = 'cooperative_advertising',
  SLOTTING_ALLOWANCE = 'slotting_allowance',
  OTHER = 'other'
}

export enum TradeSpendCategory {
  PRICE_PROMOTION = 'price_promotion',
  VOLUME_INCENTIVE = 'volume_incentive',
  DISPLAY_SUPPORT = 'display_support',
  MARKETING_INVESTMENT = 'marketing_investment',
  CUSTOMER_DEVELOPMENT = 'customer_development'
}

export enum TradeSpendStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export interface DatePeriod {
  startDate: Date;
  endDate: Date;
}

export interface Approval {
  id: string;
  userId: string;
  status: ApprovalStatus;
  comments?: string;
  approvedAt?: Date;
  level: number;
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export interface TradeSpendAllocation {
  id: string;
  customerId: string;
  productId: string;
  amount: number;
  percentage: number;
  conditions: AllocationCondition[];
}

export interface AllocationCondition {
  type: string;
  operator: string;
  value: any;
}

export interface TradeSpendPerformance {
  plannedROI: number;
  actualROI?: number;
  plannedVolume: number;
  actualVolume?: number;
  plannedRevenue: number;
  actualRevenue?: number;
  incrementalVolume?: number;
  incrementalRevenue?: number;
  efficiency: number;
}

// Promotion Types
export interface Promotion extends BaseEntity {
  companyId: string;
  name: string;
  description: string;
  type: PromotionType;
  mechanics: PromotionMechanics;
  period: DatePeriod;
  status: PromotionStatus;
  products: PromotionProduct[];
  customers: PromotionCustomer[];
  budget: PromotionBudget;
  performance: PromotionPerformance;
  approvals: Approval[];
}

export enum PromotionType {
  PRICE_REDUCTION = 'price_reduction',
  BOGO = 'bogo',
  MULTI_BUY = 'multi_buy',
  CASHBACK = 'cashback',
  CONTEST = 'contest',
  SAMPLING = 'sampling',
  DISPLAY = 'display'
}

export interface PromotionMechanics {
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;
  minQuantity?: number;
  maxQuantity?: number;
  conditions: PromotionCondition[];
}

export interface PromotionCondition {
  type: string;
  operator: string;
  value: any;
}

export enum PromotionStatus {
  PLANNING = 'planning',
  APPROVED = 'approved',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export interface PromotionProduct {
  productId: string;
  sku: string;
  name: string;
  category: string;
  brand: string;
  unitPrice: number;
  promotionalPrice: number;
  expectedVolume: number;
}

export interface PromotionCustomer {
  customerId: string;
  name: string;
  type: CustomerType;
  channels: string[];
  regions: string[];
  expectedVolume: number;
  allocatedBudget: number;
}

export enum CustomerType {
  RETAILER = 'retailer',
  WHOLESALER = 'wholesaler',
  DISTRIBUTOR = 'distributor',
  ONLINE = 'online',
  FOODSERVICE = 'foodservice'
}

export interface PromotionBudget {
  totalBudget: number;
  spentAmount: number;
  remainingAmount: number;
  breakdown: BudgetBreakdown[];
}

export interface BudgetBreakdown {
  category: string;
  plannedAmount: number;
  actualAmount: number;
}

export interface PromotionPerformance {
  plannedVolume: number;
  actualVolume: number;
  plannedRevenue: number;
  actualRevenue: number;
  roi: number;
  incrementalVolume: number;
  incrementalRevenue: number;
  marketShare: number;
  customerParticipation: number;
}

// Analytics Types
export interface AnalyticsReport extends BaseEntity {
  companyId: string;
  name: string;
  type: ReportType;
  category: ReportCategory;
  parameters: ReportParameters;
  data: any;
  insights: AnalyticsInsight[];
  schedule?: ReportSchedule;
  recipients: string[];
}

export enum ReportType {
  DASHBOARD = 'dashboard',
  DETAILED = 'detailed',
  SUMMARY = 'summary',
  COMPARATIVE = 'comparative',
  PREDICTIVE = 'predictive'
}

export enum ReportCategory {
  TRADE_SPEND = 'trade_spend',
  PROMOTION_PERFORMANCE = 'promotion_performance',
  CUSTOMER_ANALYSIS = 'customer_analysis',
  PRODUCT_PERFORMANCE = 'product_performance',
  FINANCIAL = 'financial',
  OPERATIONAL = 'operational'
}

export interface ReportParameters {
  dateRange: DatePeriod;
  filters: Record<string, any>;
  groupBy: string[];
  metrics: string[];
  dimensions: string[];
}

export interface AnalyticsInsight {
  type: InsightType;
  title: string;
  description: string;
  impact: InsightImpact;
  confidence: number;
  recommendations: string[];
  data: any;
}

export enum InsightType {
  TREND = 'trend',
  ANOMALY = 'anomaly',
  OPPORTUNITY = 'opportunity',
  RISK = 'risk',
  CORRELATION = 'correlation'
}

export enum InsightImpact {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface ReportSchedule {
  frequency: ScheduleFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  time: string;
  timezone: string;
}

export enum ScheduleFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly'
}

// Integration Types
export interface ERPIntegration {
  id: string;
  name: string;
  type: ERPType;
  config: Record<string, any>;
  status: IntegrationStatus;
  lastSyncAt?: Date;
}

export enum ERPType {
  SAP = 'sap',
  ORACLE = 'oracle',
  MICROSOFT_DYNAMICS = 'microsoft_dynamics',
  NETSUITE = 'netsuite',
  CUSTOM = 'custom'
}

export interface CRMIntegration {
  id: string;
  name: string;
  type: CRMType;
  config: Record<string, any>;
  status: IntegrationStatus;
  lastSyncAt?: Date;
}

export enum CRMType {
  SALESFORCE = 'salesforce',
  MICROSOFT_DYNAMICS = 'microsoft_dynamics',
  HUBSPOT = 'hubspot',
  CUSTOM = 'custom'
}

export interface SSOIntegration {
  id: string;
  name: string;
  type: SSOType;
  config: Record<string, any>;
  status: IntegrationStatus;
}

export enum SSOType {
  SAML = 'saml',
  OAUTH2 = 'oauth2',
  OPENID_CONNECT = 'openid_connect',
  LDAP = 'ldap',
  ACTIVE_DIRECTORY = 'active_directory'
}

export interface DataWarehouseIntegration {
  id: string;
  name: string;
  type: DataWarehouseType;
  config: Record<string, any>;
  status: IntegrationStatus;
  lastSyncAt?: Date;
}

export enum DataWarehouseType {
  SNOWFLAKE = 'snowflake',
  REDSHIFT = 'redshift',
  BIGQUERY = 'bigquery',
  DATABRICKS = 'databricks',
  CUSTOM = 'custom'
}

export enum IntegrationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  SYNCING = 'syncing'
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  [key: string]: any;
}

// Event Types
export interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  data: any;
  metadata: EventMetadata;
  occurredAt: Date;
}

export interface EventMetadata {
  userId: string;
  companyId: string;
  correlationId: string;
  causationId?: string;
  source: string;
}

// Notification Types
export interface Notification extends BaseEntity {
  userId: string;
  companyId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  channels: NotificationChannel[];
  status: NotificationStatus;
  readAt?: Date;
  expiresAt?: Date;
}

export enum NotificationType {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  SUCCESS = 'success',
  REMINDER = 'reminder'
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  SMS = 'sms',
  PUSH = 'push'
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  READ = 'read'
}

// File & Document Types
export interface FileUpload extends BaseEntity {
  companyId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
  tags: string[];
  metadata: FileMetadata;
}

export interface FileMetadata {
  uploadedBy: string;
  category: string;
  description?: string;
  isPublic: boolean;
  expiresAt?: Date;
  virusScanStatus: 'pending' | 'clean' | 'infected';
}

export * from './ai-types';
export * from './field-execution-types';
export * from './supply-chain-types';
export * from './financial-types';