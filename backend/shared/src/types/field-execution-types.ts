// Field Execution Types

export interface FieldExecution {
  id: string;
  companyId: string;
  name: string;
  type: FieldExecutionType;
  status: FieldExecutionStatus;
  assignedTo: string[];
  territory: Territory;
  objectives: FieldObjective[];
  tasks: FieldTask[];
  schedule: ExecutionSchedule;
  performance: FieldPerformance;
  createdAt: Date;
  updatedAt: Date;
}

export enum FieldExecutionType {
  STORE_VISIT = 'store_visit',
  AUDIT = 'audit',
  MERCHANDISING = 'merchandising',
  PROMOTION_SETUP = 'promotion_setup',
  TRAINING = 'training',
  SAMPLING = 'sampling',
  SURVEY = 'survey'
}

export enum FieldExecutionStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  OVERDUE = 'overdue'
}

export interface Territory {
  id: string;
  name: string;
  type: TerritoryType;
  boundaries: GeoBoundary[];
  stores: Store[];
  population: number;
  marketPotential: number;
}

export enum TerritoryType {
  GEOGRAPHIC = 'geographic',
  CUSTOMER_BASED = 'customer_based',
  CHANNEL_BASED = 'channel_based',
  BRAND_BASED = 'brand_based'
}

export interface GeoBoundary {
  type: 'polygon' | 'circle';
  coordinates: number[][];
  radius?: number;
}

export interface Store {
  id: string;
  name: string;
  code: string;
  type: StoreType;
  format: StoreFormat;
  address: Address;
  location: GeoLocation;
  contact: ContactInfo;
  characteristics: StoreCharacteristics;
  performance: StorePerformance;
  lastVisit?: Date;
  nextVisit?: Date;
}

export enum StoreType {
  SUPERMARKET = 'supermarket',
  HYPERMARKET = 'hypermarket',
  CONVENIENCE = 'convenience',
  DISCOUNT = 'discount',
  SPECIALTY = 'specialty',
  ONLINE = 'online',
  WAREHOUSE = 'warehouse'
}

export enum StoreFormat {
  LARGE = 'large',
  MEDIUM = 'medium',
  SMALL = 'small',
  EXPRESS = 'express'
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface ContactInfo {
  phone?: string;
  email?: string;
  manager?: string;
}

export interface StoreCharacteristics {
  size: number; // square feet
  footfall: number; // daily average
  demographics: Demographics;
  competition: CompetitorInfo[];
  seasonality: SeasonalityPattern[];
}

export interface Demographics {
  averageIncome: number;
  ageGroups: AgeGroup[];
  householdSize: number;
  urbanRural: 'urban' | 'suburban' | 'rural';
}

export interface AgeGroup {
  range: string;
  percentage: number;
}

export interface CompetitorInfo {
  name: string;
  distance: number; // in meters
  type: StoreType;
  threat: 'high' | 'medium' | 'low';
}

export interface SeasonalityPattern {
  period: string;
  multiplier: number;
}

export interface StorePerformance {
  revenue: number;
  volume: number;
  growth: number;
  marketShare: number;
  ranking: number;
  kpis: StoreKPI[];
}

export interface StoreKPI {
  name: string;
  value: number;
  target: number;
  trend: 'up' | 'down' | 'stable';
}

export interface FieldObjective {
  id: string;
  name: string;
  description: string;
  type: ObjectiveType;
  target: ObjectiveTarget;
  priority: Priority;
  dueDate: Date;
  status: ObjectiveStatus;
}

export enum ObjectiveType {
  SALES = 'sales',
  DISTRIBUTION = 'distribution',
  VISIBILITY = 'visibility',
  COMPLIANCE = 'compliance',
  RELATIONSHIP = 'relationship',
  TRAINING = 'training'
}

export interface ObjectiveTarget {
  metric: string;
  value: number;
  unit: string;
  baseline?: number;
}

export enum Priority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export enum ObjectiveStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  OVERDUE = 'overdue'
}

export interface FieldTask {
  id: string;
  name: string;
  description: string;
  type: TaskType;
  storeId: string;
  assignedTo: string;
  estimatedDuration: number; // minutes
  actualDuration?: number;
  status: TaskStatus;
  priority: Priority;
  checklist: TaskChecklistItem[];
  photos: TaskPhoto[];
  notes: string;
  gpsLocation?: GeoLocation;
  completedAt?: Date;
}

export enum TaskType {
  SHELF_AUDIT = 'shelf_audit',
  PLANOGRAM_CHECK = 'planogram_check',
  PRICE_CHECK = 'price_check',
  PROMOTION_SETUP = 'promotion_setup',
  DISPLAY_BUILD = 'display_build',
  INVENTORY_COUNT = 'inventory_count',
  TRAINING_SESSION = 'training_session',
  RELATIONSHIP_BUILDING = 'relationship_building'
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  FAILED = 'failed'
}

export interface TaskChecklistItem {
  id: string;
  description: string;
  required: boolean;
  completed: boolean;
  value?: any;
  photo?: string;
  notes?: string;
}

export interface TaskPhoto {
  id: string;
  url: string;
  caption: string;
  type: PhotoType;
  location?: GeoLocation;
  timestamp: Date;
  analysis?: PhotoAnalysis;
}

export enum PhotoType {
  BEFORE = 'before',
  AFTER = 'after',
  COMPLIANCE = 'compliance',
  ISSUE = 'issue',
  GENERAL = 'general'
}

export interface PhotoAnalysis {
  products: DetectedProduct[];
  compliance: ComplianceCheck[];
  issues: DetectedIssue[];
  confidence: number;
}

export interface DetectedProduct {
  sku: string;
  name: string;
  brand: string;
  position: BoundingBox;
  confidence: number;
  facings: number;
  price?: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ComplianceCheck {
  rule: string;
  status: 'compliant' | 'non_compliant';
  confidence: number;
  details: string;
}

export interface DetectedIssue {
  type: IssueType;
  description: string;
  severity: 'high' | 'medium' | 'low';
  position?: BoundingBox;
  confidence: number;
}

export enum IssueType {
  OUT_OF_STOCK = 'out_of_stock',
  WRONG_PRICE = 'wrong_price',
  POOR_VISIBILITY = 'poor_visibility',
  DAMAGED_PRODUCT = 'damaged_product',
  INCORRECT_PLACEMENT = 'incorrect_placement',
  MISSING_POS = 'missing_pos'
}

export interface ExecutionSchedule {
  startDate: Date;
  endDate: Date;
  frequency: ScheduleFrequency;
  timeSlots: TimeSlot[];
  exceptions: ScheduleException[];
}

export enum ScheduleFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  AD_HOC = 'ad_hoc'
}

export interface TimeSlot {
  dayOfWeek: number; // 0-6, Sunday = 0
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  storeIds: string[];
}

export interface ScheduleException {
  date: Date;
  type: 'skip' | 'reschedule';
  reason: string;
  newDate?: Date;
}

export interface FieldPerformance {
  completionRate: number;
  onTimeRate: number;
  qualityScore: number;
  efficiency: number;
  kpis: FieldKPI[];
  trends: PerformanceTrend[];
}

export interface FieldKPI {
  name: string;
  value: number;
  target: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  period: string;
}

export interface PerformanceTrend {
  metric: string;
  values: TrendPoint[];
  direction: 'improving' | 'declining' | 'stable';
}

export interface TrendPoint {
  date: Date;
  value: number;
}

// Perfect Store Metrics
export interface PerfectStoreMetrics {
  storeId: string;
  date: Date;
  overallScore: number;
  categories: PerfectStoreCategory[];
  recommendations: StoreRecommendation[];
  benchmarks: StoreBenchmark[];
}

export interface PerfectStoreCategory {
  name: string;
  weight: number;
  score: number;
  maxScore: number;
  metrics: PerfectStoreMetric[];
}

export interface PerfectStoreMetric {
  name: string;
  value: number;
  target: number;
  weight: number;
  score: number;
  status: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface StoreRecommendation {
  category: string;
  priority: Priority;
  action: string;
  impact: number;
  effort: number;
  timeline: string;
}

export interface StoreBenchmark {
  metric: string;
  storeValue: number;
  channelAverage: number;
  topQuartile: number;
  ranking: number;
  percentile: number;
}

// Mobile App Types
export interface MobileUser {
  id: string;
  employeeId: string;
  name: string;
  role: FieldRole;
  territory: string[];
  device: DeviceInfo;
  status: MobileUserStatus;
  lastSync: Date;
  location?: GeoLocation;
}

export enum FieldRole {
  FIELD_SALES_REP = 'field_sales_rep',
  MERCHANDISER = 'merchandiser',
  SUPERVISOR = 'supervisor',
  AREA_MANAGER = 'area_manager',
  AUDITOR = 'auditor'
}

export interface DeviceInfo {
  id: string;
  type: 'ios' | 'android';
  model: string;
  osVersion: string;
  appVersion: string;
  lastSeen: Date;
}

export enum MobileUserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  OFFLINE = 'offline',
  SUSPENDED = 'suspended'
}

export interface OfflineData {
  id: string;
  userId: string;
  type: OfflineDataType;
  data: any;
  timestamp: Date;
  synced: boolean;
  syncedAt?: Date;
}

export enum OfflineDataType {
  TASK_COMPLETION = 'task_completion',
  PHOTO_UPLOAD = 'photo_upload',
  FORM_SUBMISSION = 'form_submission',
  GPS_TRACKING = 'gps_tracking'
}

// Route Optimization
export interface RouteOptimization {
  id: string;
  userId: string;
  date: Date;
  stores: RouteStore[];
  optimizedRoute: OptimizedRoute;
  constraints: RouteConstraint[];
  performance: RoutePerformance;
}

export interface RouteStore {
  storeId: string;
  priority: Priority;
  estimatedDuration: number;
  timeWindow?: TimeWindow;
  tasks: string[];
}

export interface TimeWindow {
  start: string; // HH:MM
  end: string; // HH:MM
}

export interface OptimizedRoute {
  sequence: RouteStop[];
  totalDistance: number;
  totalTime: number;
  efficiency: number;
}

export interface RouteStop {
  storeId: string;
  sequence: number;
  arrivalTime: string;
  departureTime: string;
  duration: number;
  distance: number;
}

export interface RouteConstraint {
  type: ConstraintType;
  value: any;
  priority: Priority;
}

export enum ConstraintType {
  MAX_DISTANCE = 'max_distance',
  MAX_TIME = 'max_time',
  TIME_WINDOW = 'time_window',
  STORE_PRIORITY = 'store_priority',
  TASK_DEPENDENCY = 'task_dependency'
}

export interface RoutePerformance {
  plannedStores: number;
  visitedStores: number;
  completionRate: number;
  onTimeRate: number;
  totalDistance: number;
  totalTime: number;
  fuelCost: number;
}