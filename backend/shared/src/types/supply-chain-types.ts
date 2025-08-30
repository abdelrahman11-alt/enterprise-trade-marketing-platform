// Supply Chain Integration Types

export interface SupplyChainVisibility {
  id: string;
  companyId: string;
  product: Product;
  demandPlan: DemandPlan;
  supplyPlan: SupplyPlan;
  inventory: InventoryStatus;
  logistics: LogisticsInfo;
  sustainability: SustainabilityMetrics;
  alerts: SupplyChainAlert[];
  lastUpdated: Date;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  description: string;
  specifications: ProductSpecification[];
  packaging: PackagingInfo;
  lifecycle: ProductLifecycle;
  compliance: ComplianceInfo;
}

export interface ProductSpecification {
  name: string;
  value: string;
  unit?: string;
}

export interface PackagingInfo {
  type: PackagingType;
  dimensions: Dimensions;
  weight: Weight;
  materials: PackagingMaterial[];
  sustainability: PackagingSustainability;
}

export enum PackagingType {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  TERTIARY = 'tertiary'
}

export interface Dimensions {
  length: number;
  width: number;
  height: number;
  unit: 'mm' | 'cm' | 'in';
}

export interface Weight {
  value: number;
  unit: 'g' | 'kg' | 'lb' | 'oz';
}

export interface PackagingMaterial {
  type: string;
  percentage: number;
  recyclable: boolean;
  biodegradable: boolean;
}

export interface PackagingSustainability {
  recyclabilityScore: number;
  carbonFootprint: number;
  renewableContent: number;
}

export interface ProductLifecycle {
  stage: LifecycleStage;
  launchDate?: Date;
  discontinueDate?: Date;
  phaseOutPlan?: PhaseOutPlan;
}

export enum LifecycleStage {
  DEVELOPMENT = 'development',
  LAUNCH = 'launch',
  GROWTH = 'growth',
  MATURITY = 'maturity',
  DECLINE = 'decline',
  PHASE_OUT = 'phase_out',
  DISCONTINUED = 'discontinued'
}

export interface PhaseOutPlan {
  startDate: Date;
  endDate: Date;
  strategy: string;
  replacementProduct?: string;
}

export interface ComplianceInfo {
  certifications: Certification[];
  regulations: RegulatoryCompliance[];
  qualityStandards: QualityStandard[];
}

export interface Certification {
  name: string;
  issuer: string;
  validFrom: Date;
  validUntil: Date;
  status: CertificationStatus;
}

export enum CertificationStatus {
  VALID = 'valid',
  EXPIRED = 'expired',
  PENDING = 'pending',
  SUSPENDED = 'suspended'
}

export interface RegulatoryCompliance {
  regulation: string;
  jurisdiction: string;
  status: ComplianceStatus;
  lastAudit: Date;
  nextAudit: Date;
}

export enum ComplianceStatus {
  COMPLIANT = 'compliant',
  NON_COMPLIANT = 'non_compliant',
  UNDER_REVIEW = 'under_review',
  PENDING = 'pending'
}

export interface QualityStandard {
  name: string;
  version: string;
  compliance: ComplianceStatus;
  lastAssessment: Date;
}

// Demand Planning Types
export interface DemandPlan {
  id: string;
  productId: string;
  planningHorizon: PlanningHorizon;
  forecast: DemandForecast[];
  assumptions: PlanningAssumption[];
  scenarios: DemandScenario[];
  accuracy: ForecastAccuracy;
  lastUpdated: Date;
}

export interface PlanningHorizon {
  startDate: Date;
  endDate: Date;
  granularity: TimeGranularity;
}

export enum TimeGranularity {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly'
}

export interface DemandForecast {
  period: Date;
  baseline: number;
  promotional: number;
  total: number;
  confidence: ConfidenceInterval;
  drivers: DemandDriver[];
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  level: number; // e.g., 95 for 95% confidence
}

export interface DemandDriver {
  type: DriverType;
  impact: number;
  confidence: number;
  description: string;
}

export enum DriverType {
  SEASONALITY = 'seasonality',
  TREND = 'trend',
  PROMOTION = 'promotion',
  PRICE = 'price',
  COMPETITION = 'competition',
  ECONOMIC = 'economic',
  WEATHER = 'weather',
  EVENT = 'event'
}

export interface PlanningAssumption {
  category: string;
  description: string;
  value: any;
  confidence: number;
  source: string;
}

export interface DemandScenario {
  id: string;
  name: string;
  description: string;
  probability: number;
  adjustments: ScenarioAdjustment[];
  forecast: DemandForecast[];
}

export interface ScenarioAdjustment {
  driver: DriverType;
  adjustment: number;
  period?: DatePeriod;
}

export interface ForecastAccuracy {
  mape: number; // Mean Absolute Percentage Error
  bias: number;
  mad: number; // Mean Absolute Deviation
  trackingSignal: number;
  historicalAccuracy: AccuracyHistory[];
}

export interface AccuracyHistory {
  period: Date;
  forecast: number;
  actual: number;
  error: number;
  absoluteError: number;
  percentageError: number;
}

// Supply Planning Types
export interface SupplyPlan {
  id: string;
  productId: string;
  planningHorizon: PlanningHorizon;
  production: ProductionPlan[];
  procurement: ProcurementPlan[];
  capacity: CapacityPlan[];
  constraints: SupplyConstraint[];
  alternatives: SupplyAlternative[];
}

export interface ProductionPlan {
  facilityId: string;
  period: Date;
  plannedQuantity: number;
  capacity: number;
  utilization: number;
  cost: ProductionCost;
  leadTime: number;
}

export interface ProductionCost {
  fixed: number;
  variable: number;
  total: number;
  currency: string;
}

export interface ProcurementPlan {
  supplierId: string;
  materialId: string;
  period: Date;
  quantity: number;
  cost: number;
  leadTime: number;
  quality: QualityMetrics;
  risk: SupplierRisk;
}

export interface QualityMetrics {
  defectRate: number;
  onTimeDelivery: number;
  specification: number;
  overall: number;
}

export interface SupplierRisk {
  financial: RiskLevel;
  operational: RiskLevel;
  geographical: RiskLevel;
  overall: RiskLevel;
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface CapacityPlan {
  resourceId: string;
  resourceType: ResourceType;
  period: Date;
  availableCapacity: number;
  plannedUtilization: number;
  bottleneck: boolean;
  constraints: string[];
}

export enum ResourceType {
  PRODUCTION_LINE = 'production_line',
  WAREHOUSE = 'warehouse',
  TRANSPORTATION = 'transportation',
  LABOR = 'labor',
  EQUIPMENT = 'equipment'
}

export interface SupplyConstraint {
  type: ConstraintType;
  resource: string;
  limit: number;
  period?: DatePeriod;
  priority: Priority;
}

export interface SupplyAlternative {
  id: string;
  description: string;
  type: AlternativeType;
  cost: number;
  leadTime: number;
  capacity: number;
  risk: RiskLevel;
  feasibility: number;
}

export enum AlternativeType {
  SUPPLIER = 'supplier',
  FACILITY = 'facility',
  ROUTE = 'route',
  MATERIAL = 'material',
  PROCESS = 'process'
}

// Inventory Management Types
export interface InventoryStatus {
  productId: string;
  locations: InventoryLocation[];
  totalOnHand: number;
  totalAvailable: number;
  totalReserved: number;
  totalInTransit: number;
  safetyStock: number;
  reorderPoint: number;
  turnover: InventoryTurnover;
  valuation: InventoryValuation;
}

export interface InventoryLocation {
  locationId: string;
  locationType: LocationType;
  onHand: number;
  available: number;
  reserved: number;
  inTransit: number;
  lastCounted: Date;
  accuracy: number;
}

export enum LocationType {
  WAREHOUSE = 'warehouse',
  DISTRIBUTION_CENTER = 'distribution_center',
  STORE = 'store',
  SUPPLIER = 'supplier',
  CUSTOMER = 'customer',
  IN_TRANSIT = 'in_transit'
}

export interface InventoryTurnover {
  annual: number;
  quarterly: number;
  monthly: number;
  daysOnHand: number;
  velocity: InventoryVelocity;
}

export enum InventoryVelocity {
  FAST = 'fast',
  MEDIUM = 'medium',
  SLOW = 'slow',
  OBSOLETE = 'obsolete'
}

export interface InventoryValuation {
  method: ValuationMethod;
  unitCost: number;
  totalValue: number;
  currency: string;
  lastUpdated: Date;
}

export enum ValuationMethod {
  FIFO = 'fifo',
  LIFO = 'lifo',
  WEIGHTED_AVERAGE = 'weighted_average',
  STANDARD_COST = 'standard_cost'
}

// Logistics Types
export interface LogisticsInfo {
  shipments: Shipment[];
  routes: LogisticsRoute[];
  carriers: CarrierInfo[];
  performance: LogisticsPerformance;
  costs: LogisticsCosts;
}

export interface Shipment {
  id: string;
  type: ShipmentType;
  status: ShipmentStatus;
  origin: Location;
  destination: Location;
  carrier: string;
  trackingNumber: string;
  plannedPickup: Date;
  actualPickup?: Date;
  plannedDelivery: Date;
  actualDelivery?: Date;
  items: ShipmentItem[];
  documents: ShipmentDocument[];
}

export enum ShipmentType {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
  TRANSFER = 'transfer',
  RETURN = 'return'
}

export enum ShipmentStatus {
  PLANNED = 'planned',
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  DELAYED = 'delayed',
  CANCELLED = 'cancelled'
}

export interface Location {
  id: string;
  name: string;
  address: Address;
  coordinates: GeoLocation;
  type: LocationType;
  contact: ContactInfo;
}

export interface ShipmentItem {
  productId: string;
  quantity: number;
  weight: number;
  volume: number;
  value: number;
  hazardous: boolean;
  temperature: TemperatureRequirement;
}

export interface TemperatureRequirement {
  min: number;
  max: number;
  unit: 'C' | 'F';
}

export interface ShipmentDocument {
  type: DocumentType;
  name: string;
  url: string;
  required: boolean;
  status: DocumentStatus;
}

export enum DocumentType {
  BILL_OF_LADING = 'bill_of_lading',
  INVOICE = 'invoice',
  PACKING_LIST = 'packing_list',
  CUSTOMS = 'customs',
  CERTIFICATE = 'certificate',
  INSURANCE = 'insurance'
}

export enum DocumentStatus {
  PENDING = 'pending',
  COMPLETE = 'complete',
  MISSING = 'missing',
  EXPIRED = 'expired'
}

export interface LogisticsRoute {
  id: string;
  name: string;
  origin: string;
  destination: string;
  distance: number;
  duration: number;
  cost: number;
  mode: TransportMode;
  frequency: string;
  capacity: number;
  utilization: number;
}

export enum TransportMode {
  ROAD = 'road',
  RAIL = 'rail',
  AIR = 'air',
  SEA = 'sea',
  MULTIMODAL = 'multimodal'
}

export interface CarrierInfo {
  id: string;
  name: string;
  type: CarrierType;
  services: CarrierService[];
  performance: CarrierPerformance;
  contract: CarrierContract;
}

export enum CarrierType {
  OWNED = 'owned',
  CONTRACTED = 'contracted',
  SPOT = 'spot',
  THIRD_PARTY = 'third_party'
}

export interface CarrierService {
  name: string;
  type: ServiceType;
  coverage: string[];
  transitTime: number;
  cost: number;
  reliability: number;
}

export enum ServiceType {
  STANDARD = 'standard',
  EXPRESS = 'express',
  OVERNIGHT = 'overnight',
  SAME_DAY = 'same_day',
  SCHEDULED = 'scheduled'
}

export interface CarrierPerformance {
  onTimeDelivery: number;
  damageRate: number;
  lossRate: number;
  customerSatisfaction: number;
  costPerUnit: number;
}

export interface CarrierContract {
  startDate: Date;
  endDate: Date;
  terms: ContractTerm[];
  sla: ServiceLevelAgreement[];
}

export interface ContractTerm {
  category: string;
  description: string;
  value: any;
}

export interface ServiceLevelAgreement {
  metric: string;
  target: number;
  penalty: number;
  measurement: string;
}

export interface LogisticsPerformance {
  onTimeDelivery: number;
  fillRate: number;
  orderAccuracy: number;
  damageRate: number;
  costPerShipment: number;
  transitTime: number;
}

export interface LogisticsCosts {
  transportation: number;
  warehousing: number;
  handling: number;
  insurance: number;
  customs: number;
  total: number;
  currency: string;
}

// Sustainability Types
export interface SustainabilityMetrics {
  carbonFootprint: CarbonFootprint;
  waterUsage: WaterUsage;
  wasteManagement: WasteManagement;
  energyConsumption: EnergyConsumption;
  socialImpact: SocialImpact;
  certifications: SustainabilityCertification[];
  goals: SustainabilityGoal[];
}

export interface CarbonFootprint {
  scope1: number; // Direct emissions
  scope2: number; // Indirect emissions from energy
  scope3: number; // Other indirect emissions
  total: number;
  unit: 'tCO2e' | 'kgCO2e';
  baseline: number;
  reduction: number;
  offsetCredits: number;
}

export interface WaterUsage {
  consumption: number;
  recycled: number;
  efficiency: number;
  unit: 'liters' | 'gallons' | 'm3';
  sources: WaterSource[];
}

export interface WaterSource {
  type: string;
  percentage: number;
  sustainability: number;
}

export interface WasteManagement {
  generated: number;
  recycled: number;
  landfill: number;
  incinerated: number;
  composted: number;
  unit: 'kg' | 'tons';
  recyclingRate: number;
  zeroWasteGoal: boolean;
}

export interface EnergyConsumption {
  total: number;
  renewable: number;
  nonRenewable: number;
  unit: 'kWh' | 'MWh' | 'GJ';
  renewablePercentage: number;
  efficiency: number;
  sources: EnergySource[];
}

export interface EnergySource {
  type: string;
  percentage: number;
  renewable: boolean;
  carbonIntensity: number;
}

export interface SocialImpact {
  employeeWellbeing: number;
  communityInvestment: number;
  supplierDiversity: number;
  fairTrade: boolean;
  ethicalSourcing: number;
  humanRights: ComplianceStatus;
}

export interface SustainabilityCertification {
  name: string;
  issuer: string;
  scope: string;
  validFrom: Date;
  validUntil: Date;
  status: CertificationStatus;
  score?: number;
}

export interface SustainabilityGoal {
  id: string;
  name: string;
  category: SustainabilityCategory;
  target: number;
  current: number;
  unit: string;
  deadline: Date;
  progress: number;
  status: GoalStatus;
}

export enum SustainabilityCategory {
  CARBON_REDUCTION = 'carbon_reduction',
  WATER_CONSERVATION = 'water_conservation',
  WASTE_REDUCTION = 'waste_reduction',
  RENEWABLE_ENERGY = 'renewable_energy',
  SUSTAINABLE_SOURCING = 'sustainable_sourcing',
  SOCIAL_RESPONSIBILITY = 'social_responsibility'
}

export enum GoalStatus {
  ON_TRACK = 'on_track',
  AT_RISK = 'at_risk',
  BEHIND = 'behind',
  ACHIEVED = 'achieved',
  MISSED = 'missed'
}

// Supply Chain Alerts
export interface SupplyChainAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  description: string;
  affectedProducts: string[];
  affectedLocations: string[];
  impact: AlertImpact;
  recommendations: string[];
  status: AlertStatus;
  createdAt: Date;
  resolvedAt?: Date;
}

export enum AlertCategory {
  DEMAND = 'demand',
  SUPPLY = 'supply',
  INVENTORY = 'inventory',
  LOGISTICS = 'logistics',
  QUALITY = 'quality',
  COMPLIANCE = 'compliance',
  SUSTAINABILITY = 'sustainability',
  RISK = 'risk'
}

export interface AlertImpact {
  revenue: number;
  volume: number;
  customers: number;
  duration: number;
  probability: number;
}

export interface DatePeriod {
  startDate: Date;
  endDate: Date;
}

export interface Priority {
  HIGH: 'high';
  MEDIUM: 'medium';
  LOW: 'low';
}

export interface AlertType {
  PERFORMANCE_ANOMALY: 'performance_anomaly';
  BUDGET_THRESHOLD: 'budget_threshold';
  FORECAST_DEVIATION: 'forecast_deviation';
  COMPETITIVE_ACTIVITY: 'competitive_activity';
  INVENTORY_ISSUE: 'inventory_issue';
  SYSTEM_ERROR: 'system_error';
}

export interface AlertSeverity {
  CRITICAL: 'critical';
  HIGH: 'high';
  MEDIUM: 'medium';
  LOW: 'low';
  INFO: 'info';
}

export interface AlertStatus {
  ACTIVE: 'active';
  ACKNOWLEDGED: 'acknowledged';
  RESOLVED: 'resolved';
  SUPPRESSED: 'suppressed';
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