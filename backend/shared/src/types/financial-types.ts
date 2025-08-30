// Financial Management Types

export interface FinancialOverview {
  companyId: string;
  period: FinancialPeriod;
  profitAndLoss: ProfitAndLoss;
  cashFlow: CashFlow;
  balanceSheet: BalanceSheet;
  kpis: FinancialKPI[];
  budgetVariance: BudgetVariance[];
  forecasts: FinancialForecast[];
  compliance: FinancialCompliance;
}

export interface FinancialPeriod {
  startDate: Date;
  endDate: Date;
  type: PeriodType;
  fiscalYear: number;
  quarter?: number;
  month?: number;
}

export enum PeriodType {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  YTD = 'ytd',
  CUSTOM = 'custom'
}

// Profit & Loss Types
export interface ProfitAndLoss {
  revenue: RevenueBreakdown;
  costOfGoodsSold: COGSBreakdown;
  grossProfit: number;
  grossMargin: number;
  operatingExpenses: OperatingExpenses;
  operatingIncome: number;
  operatingMargin: number;
  otherIncome: number;
  otherExpenses: number;
  ebitda: number;
  ebitdaMargin: number;
  interestExpense: number;
  taxExpense: number;
  netIncome: number;
  netMargin: number;
  currency: string;
}

export interface RevenueBreakdown {
  total: number;
  byChannel: ChannelRevenue[];
  byProduct: ProductRevenue[];
  byCustomer: CustomerRevenue[];
  byRegion: RegionRevenue[];
  growth: GrowthMetrics;
}

export interface ChannelRevenue {
  channelId: string;
  channelName: string;
  revenue: number;
  percentage: number;
  growth: number;
}

export interface ProductRevenue {
  productId: string;
  productName: string;
  brand: string;
  category: string;
  revenue: number;
  volume: number;
  averagePrice: number;
  margin: number;
  growth: number;
}

export interface CustomerRevenue {
  customerId: string;
  customerName: string;
  revenue: number;
  percentage: number;
  growth: number;
  profitability: number;
}

export interface RegionRevenue {
  regionId: string;
  regionName: string;
  revenue: number;
  percentage: number;
  growth: number;
}

export interface GrowthMetrics {
  absolute: number;
  percentage: number;
  cagr: number; // Compound Annual Growth Rate
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface COGSBreakdown {
  total: number;
  materials: number;
  labor: number;
  overhead: number;
  freight: number;
  packaging: number;
  other: number;
  percentage: number;
}

export interface OperatingExpenses {
  total: number;
  salesAndMarketing: SalesMarketingExpenses;
  generalAndAdmin: GeneralAdminExpenses;
  researchAndDevelopment: number;
  depreciation: number;
  amortization: number;
  other: number;
}

export interface SalesMarketingExpenses {
  total: number;
  tradeSpend: TradeSpendExpenses;
  advertising: number;
  promotions: number;
  salesForce: number;
  digitalMarketing: number;
  events: number;
  other: number;
}

export interface TradeSpendExpenses {
  total: number;
  volumeRebates: number;
  listingFees: number;
  displayAllowances: number;
  cooperativeAdvertising: number;
  slottingAllowances: number;
  other: number;
}

export interface GeneralAdminExpenses {
  total: number;
  salaries: number;
  benefits: number;
  rent: number;
  utilities: number;
  insurance: number;
  legal: number;
  accounting: number;
  technology: number;
  other: number;
}

// Cash Flow Types
export interface CashFlow {
  operatingCashFlow: OperatingCashFlow;
  investingCashFlow: InvestingCashFlow;
  financingCashFlow: FinancingCashFlow;
  netCashFlow: number;
  beginningCash: number;
  endingCash: number;
  freeCashFlow: number;
  cashConversionCycle: CashConversionCycle;
}

export interface OperatingCashFlow {
  netIncome: number;
  depreciation: number;
  amortization: number;
  workingCapitalChanges: WorkingCapitalChanges;
  other: number;
  total: number;
}

export interface WorkingCapitalChanges {
  accountsReceivable: number;
  inventory: number;
  accountsPayable: number;
  accruals: number;
  total: number;
}

export interface InvestingCashFlow {
  capitalExpenditures: number;
  acquisitions: number;
  assetSales: number;
  investments: number;
  other: number;
  total: number;
}

export interface FinancingCashFlow {
  debtIssuance: number;
  debtRepayment: number;
  equityIssuance: number;
  dividends: number;
  shareRepurchases: number;
  other: number;
  total: number;
}

export interface CashConversionCycle {
  daysInventoryOutstanding: number;
  daysSalesOutstanding: number;
  daysPayableOutstanding: number;
  cashCycleDays: number;
  trend: 'improving' | 'deteriorating' | 'stable';
}

// Balance Sheet Types
export interface BalanceSheet {
  assets: Assets;
  liabilities: Liabilities;
  equity: Equity;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  currency: string;
}

export interface Assets {
  currentAssets: CurrentAssets;
  nonCurrentAssets: NonCurrentAssets;
  total: number;
}

export interface CurrentAssets {
  cash: number;
  accountsReceivable: number;
  inventory: InventoryAssets;
  prepaidExpenses: number;
  other: number;
  total: number;
}

export interface InventoryAssets {
  rawMaterials: number;
  workInProgress: number;
  finishedGoods: number;
  total: number;
  turnover: number;
  daysOnHand: number;
}

export interface NonCurrentAssets {
  propertyPlantEquipment: PPEAssets;
  intangibleAssets: IntangibleAssets;
  investments: number;
  other: number;
  total: number;
}

export interface PPEAssets {
  land: number;
  buildings: number;
  machinery: number;
  vehicles: number;
  accumulatedDepreciation: number;
  net: number;
}

export interface IntangibleAssets {
  goodwill: number;
  patents: number;
  trademarks: number;
  software: number;
  other: number;
  total: number;
}

export interface Liabilities {
  currentLiabilities: CurrentLiabilities;
  nonCurrentLiabilities: NonCurrentLiabilities;
  total: number;
}

export interface CurrentLiabilities {
  accountsPayable: number;
  shortTermDebt: number;
  accruedExpenses: number;
  currentPortionLongTermDebt: number;
  other: number;
  total: number;
}

export interface NonCurrentLiabilities {
  longTermDebt: number;
  deferredTax: number;
  pensionObligations: number;
  other: number;
  total: number;
}

export interface Equity {
  shareCapital: number;
  retainedEarnings: number;
  accumulatedOtherIncome: number;
  total: number;
}

// Financial KPIs
export interface FinancialKPI {
  name: string;
  value: number;
  unit: string;
  target?: number;
  benchmark?: number;
  trend: KPITrend;
  category: KPICategory;
  period: FinancialPeriod;
}

export interface KPITrend {
  direction: 'up' | 'down' | 'stable';
  change: number;
  changePercent: number;
  periods: TrendPeriod[];
}

export interface TrendPeriod {
  period: Date;
  value: number;
}

export enum KPICategory {
  PROFITABILITY = 'profitability',
  LIQUIDITY = 'liquidity',
  EFFICIENCY = 'efficiency',
  LEVERAGE = 'leverage',
  GROWTH = 'growth',
  VALUATION = 'valuation'
}

// Budget & Variance Analysis
export interface BudgetVariance {
  category: string;
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number;
  status: VarianceStatus;
  explanation?: string;
  correctionPlan?: string;
}

export enum VarianceStatus {
  FAVORABLE = 'favorable',
  UNFAVORABLE = 'unfavorable',
  WITHIN_TOLERANCE = 'within_tolerance',
  REQUIRES_ATTENTION = 'requires_attention'
}

// Financial Forecasting
export interface FinancialForecast {
  id: string;
  name: string;
  type: ForecastType;
  horizon: ForecastHorizon;
  scenarios: ForecastScenario[];
  assumptions: ForecastAssumption[];
  accuracy: ForecastAccuracy;
  lastUpdated: Date;
}

export enum ForecastType {
  REVENUE = 'revenue',
  EXPENSES = 'expenses',
  CASH_FLOW = 'cash_flow',
  PROFIT_LOSS = 'profit_loss',
  BALANCE_SHEET = 'balance_sheet'
}

export interface ForecastHorizon {
  periods: number;
  granularity: TimeGranularity;
  startDate: Date;
  endDate: Date;
}

export enum TimeGranularity {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly'
}

export interface ForecastScenario {
  id: string;
  name: string;
  probability: number;
  description: string;
  adjustments: ScenarioAdjustment[];
  results: ForecastResult[];
}

export interface ScenarioAdjustment {
  category: string;
  adjustment: number;
  adjustmentType: 'absolute' | 'percentage';
  period?: FinancialPeriod;
}

export interface ForecastResult {
  period: Date;
  value: number;
  confidence: ConfidenceInterval;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  level: number;
}

export interface ForecastAssumption {
  category: string;
  description: string;
  value: any;
  confidence: number;
  source: string;
  impact: 'high' | 'medium' | 'low';
}

export interface ForecastAccuracy {
  mape: number;
  bias: number;
  mad: number;
  rmse: number;
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

// Financial Compliance
export interface FinancialCompliance {
  standards: ComplianceStandard[];
  audits: FinancialAudit[];
  controls: InternalControl[];
  risks: FinancialRisk[];
  certifications: ComplianceCertification[];
}

export interface ComplianceStandard {
  name: string;
  type: StandardType;
  jurisdiction: string;
  status: ComplianceStatus;
  lastAssessment: Date;
  nextAssessment: Date;
  requirements: ComplianceRequirement[];
}

export enum StandardType {
  IFRS = 'ifrs',
  GAAP = 'gaap',
  SOX = 'sox',
  BASEL = 'basel',
  LOCAL = 'local',
  INDUSTRY = 'industry'
}

export enum ComplianceStatus {
  COMPLIANT = 'compliant',
  NON_COMPLIANT = 'non_compliant',
  UNDER_REVIEW = 'under_review',
  PENDING = 'pending',
  EXEMPT = 'exempt'
}

export interface ComplianceRequirement {
  id: string;
  description: string;
  status: ComplianceStatus;
  dueDate?: Date;
  responsible: string;
  evidence?: string[];
}

export interface FinancialAudit {
  id: string;
  type: AuditType;
  scope: AuditScope;
  auditor: string;
  startDate: Date;
  endDate?: Date;
  status: AuditStatus;
  findings: AuditFinding[];
  recommendations: AuditRecommendation[];
  managementResponse?: string;
}

export enum AuditType {
  INTERNAL = 'internal',
  EXTERNAL = 'external',
  REGULATORY = 'regulatory',
  TAX = 'tax',
  OPERATIONAL = 'operational'
}

export enum AuditScope {
  FULL = 'full',
  LIMITED = 'limited',
  FOCUSED = 'focused',
  FOLLOW_UP = 'follow_up'
}

export enum AuditStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export interface AuditFinding {
  id: string;
  severity: FindingSeverity;
  category: string;
  description: string;
  impact: string;
  recommendation: string;
  status: FindingStatus;
  dueDate?: Date;
  responsible?: string;
}

export enum FindingSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  OBSERVATION = 'observation'
}

export enum FindingStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

export interface AuditRecommendation {
  id: string;
  priority: Priority;
  description: string;
  expectedBenefit: string;
  implementationCost: number;
  timeline: string;
  responsible: string;
  status: RecommendationStatus;
}

export enum Priority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export enum RecommendationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  IMPLEMENTED = 'implemented'
}

export interface InternalControl {
  id: string;
  name: string;
  type: ControlType;
  objective: string;
  description: string;
  frequency: ControlFrequency;
  owner: string;
  effectiveness: ControlEffectiveness;
  lastTested: Date;
  nextTest: Date;
  deficiencies: ControlDeficiency[];
}

export enum ControlType {
  PREVENTIVE = 'preventive',
  DETECTIVE = 'detective',
  CORRECTIVE = 'corrective',
  COMPENSATING = 'compensating'
}

export enum ControlFrequency {
  CONTINUOUS = 'continuous',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUALLY = 'annually'
}

export enum ControlEffectiveness {
  EFFECTIVE = 'effective',
  PARTIALLY_EFFECTIVE = 'partially_effective',
  INEFFECTIVE = 'ineffective',
  NOT_TESTED = 'not_tested'
}

export interface ControlDeficiency {
  id: string;
  severity: DeficiencySeverity;
  description: string;
  impact: string;
  remediation: string;
  dueDate: Date;
  status: DeficiencyStatus;
}

export enum DeficiencySeverity {
  MATERIAL_WEAKNESS = 'material_weakness',
  SIGNIFICANT_DEFICIENCY = 'significant_deficiency',
  CONTROL_DEFICIENCY = 'control_deficiency'
}

export enum DeficiencyStatus {
  IDENTIFIED = 'identified',
  IN_REMEDIATION = 'in_remediation',
  REMEDIATED = 'remediated',
  VALIDATED = 'validated'
}

export interface FinancialRisk {
  id: string;
  name: string;
  category: RiskCategory;
  description: string;
  probability: RiskProbability;
  impact: RiskImpact;
  riskScore: number;
  mitigation: RiskMitigation[];
  owner: string;
  status: RiskStatus;
  lastAssessed: Date;
  nextAssessment: Date;
}

export enum RiskCategory {
  CREDIT = 'credit',
  MARKET = 'market',
  OPERATIONAL = 'operational',
  LIQUIDITY = 'liquidity',
  REGULATORY = 'regulatory',
  STRATEGIC = 'strategic',
  REPUTATIONAL = 'reputational'
}

export enum RiskProbability {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

export enum RiskImpact {
  NEGLIGIBLE = 'negligible',
  MINOR = 'minor',
  MODERATE = 'moderate',
  MAJOR = 'major',
  CATASTROPHIC = 'catastrophic'
}

export interface RiskMitigation {
  id: string;
  strategy: MitigationStrategy;
  description: string;
  cost: number;
  effectiveness: number;
  timeline: string;
  responsible: string;
  status: MitigationStatus;
}

export enum MitigationStrategy {
  AVOID = 'avoid',
  REDUCE = 'reduce',
  TRANSFER = 'transfer',
  ACCEPT = 'accept'
}

export enum MitigationStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  IMPLEMENTED = 'implemented',
  MONITORING = 'monitoring'
}

export enum RiskStatus {
  ACTIVE = 'active',
  MONITORING = 'monitoring',
  CLOSED = 'closed',
  ESCALATED = 'escalated'
}

export interface ComplianceCertification {
  name: string;
  issuer: string;
  validFrom: Date;
  validUntil: Date;
  status: CertificationStatus;
  scope: string;
  requirements: string[];
}

export enum CertificationStatus {
  VALID = 'valid',
  EXPIRED = 'expired',
  PENDING = 'pending',
  SUSPENDED = 'suspended',
  REVOKED = 'revoked'
}

// Cost Management Types
export interface CostCenter {
  id: string;
  name: string;
  type: CostCenterType;
  manager: string;
  budget: CostCenterBudget;
  actual: CostCenterActual;
  variance: CostCenterVariance;
  allocations: CostAllocation[];
}

export enum CostCenterType {
  REVENUE = 'revenue',
  COST = 'cost',
  PROFIT = 'profit',
  INVESTMENT = 'investment'
}

export interface CostCenterBudget {
  total: number;
  categories: BudgetCategory[];
  period: FinancialPeriod;
}

export interface BudgetCategory {
  name: string;
  amount: number;
  percentage: number;
}

export interface CostCenterActual {
  total: number;
  categories: ActualCategory[];
  period: FinancialPeriod;
}

export interface ActualCategory {
  name: string;
  amount: number;
  percentage: number;
}

export interface CostCenterVariance {
  total: number;
  totalPercent: number;
  categories: VarianceCategory[];
  status: VarianceStatus;
}

export interface VarianceCategory {
  name: string;
  variance: number;
  variancePercent: number;
  status: VarianceStatus;
}

export interface CostAllocation {
  fromCostCenter: string;
  toCostCenter: string;
  amount: number;
  method: AllocationMethod;
  driver: string;
  percentage: number;
}

export enum AllocationMethod {
  DIRECT = 'direct',
  STEP_DOWN = 'step_down',
  RECIPROCAL = 'reciprocal',
  ACTIVITY_BASED = 'activity_based'
}