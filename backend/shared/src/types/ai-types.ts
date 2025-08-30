// AI & Machine Learning Types

export interface AIAssistant {
  id: string;
  name: string;
  type: AIAssistantType;
  role: string;
  capabilities: AICapability[];
  model: AIModel;
  config: AIConfig;
  learningData: LearningData;
  status: AIAssistantStatus;
}

export enum AIAssistantType {
  TRADE_MARKETING = 'trade_marketing',
  ANALYTICS = 'analytics',
  FIELD_EXECUTION = 'field_execution',
  CUSTOMER_INSIGHTS = 'customer_insights',
  DEMAND_PLANNING = 'demand_planning',
  PRICING_OPTIMIZATION = 'pricing_optimization'
}

export interface AICapability {
  name: string;
  description: string;
  confidence: number;
  enabled: boolean;
}

export interface AIModel {
  name: string;
  version: string;
  type: ModelType;
  accuracy: number;
  lastTrainedAt: Date;
  parameters: ModelParameters;
}

export enum ModelType {
  CLASSIFICATION = 'classification',
  REGRESSION = 'regression',
  CLUSTERING = 'clustering',
  RECOMMENDATION = 'recommendation',
  FORECASTING = 'forecasting',
  NLP = 'nlp',
  COMPUTER_VISION = 'computer_vision'
}

export interface ModelParameters {
  [key: string]: any;
}

export interface AIConfig {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  customPrompts: CustomPrompt[];
}

export interface CustomPrompt {
  id: string;
  name: string;
  template: string;
  variables: string[];
}

export interface LearningData {
  interactions: number;
  feedbackScore: number;
  improvementRate: number;
  lastLearningAt: Date;
  dataPoints: DataPoint[];
}

export interface DataPoint {
  input: any;
  output: any;
  feedback: number;
  timestamp: Date;
}

export enum AIAssistantStatus {
  ACTIVE = 'active',
  TRAINING = 'training',
  INACTIVE = 'inactive',
  ERROR = 'error'
}

// Predictive Analytics Types
export interface PredictiveModel {
  id: string;
  name: string;
  type: PredictiveModelType;
  algorithm: MLAlgorithm;
  features: ModelFeature[];
  performance: ModelPerformance;
  predictions: Prediction[];
  status: ModelStatus;
  trainingData: TrainingDataset;
  validationData: ValidationDataset;
}

export enum PredictiveModelType {
  DEMAND_FORECASTING = 'demand_forecasting',
  PRICE_OPTIMIZATION = 'price_optimization',
  PROMOTION_EFFECTIVENESS = 'promotion_effectiveness',
  CUSTOMER_CHURN = 'customer_churn',
  INVENTORY_OPTIMIZATION = 'inventory_optimization',
  MARKET_SHARE_PREDICTION = 'market_share_prediction'
}

export enum MLAlgorithm {
  LINEAR_REGRESSION = 'linear_regression',
  RANDOM_FOREST = 'random_forest',
  GRADIENT_BOOSTING = 'gradient_boosting',
  NEURAL_NETWORK = 'neural_network',
  SVM = 'svm',
  ARIMA = 'arima',
  LSTM = 'lstm',
  TRANSFORMER = 'transformer'
}

export interface ModelFeature {
  name: string;
  type: FeatureType;
  importance: number;
  description: string;
}

export enum FeatureType {
  NUMERICAL = 'numerical',
  CATEGORICAL = 'categorical',
  TEMPORAL = 'temporal',
  TEXT = 'text',
  IMAGE = 'image'
}

export interface ModelPerformance {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  rmse?: number;
  mae?: number;
  r2Score?: number;
  confusionMatrix?: number[][];
}

export interface Prediction {
  id: string;
  modelId: string;
  input: any;
  output: any;
  confidence: number;
  createdAt: Date;
  actualValue?: any;
  feedback?: PredictionFeedback;
}

export interface PredictionFeedback {
  accuracy: number;
  usefulness: number;
  comments?: string;
  providedBy: string;
  providedAt: Date;
}

export enum ModelStatus {
  TRAINING = 'training',
  READY = 'ready',
  DEPLOYED = 'deployed',
  DEPRECATED = 'deprecated',
  ERROR = 'error'
}

export interface TrainingDataset {
  id: string;
  name: string;
  size: number;
  features: string[];
  target: string;
  quality: DataQuality;
  source: string;
  lastUpdated: Date;
}

export interface ValidationDataset {
  id: string;
  name: string;
  size: number;
  testResults: TestResult[];
  lastValidated: Date;
}

export interface DataQuality {
  completeness: number;
  accuracy: number;
  consistency: number;
  timeliness: number;
  validity: number;
}

export interface TestResult {
  metric: string;
  value: number;
  threshold: number;
  passed: boolean;
}

// Computer Vision Types
export interface ComputerVisionModel {
  id: string;
  name: string;
  type: VisionModelType;
  capabilities: VisionCapability[];
  accuracy: number;
  status: ModelStatus;
  trainingImages: number;
  lastTrainedAt: Date;
}

export enum VisionModelType {
  SHELF_RECOGNITION = 'shelf_recognition',
  PRODUCT_DETECTION = 'product_detection',
  PLANOGRAM_COMPLIANCE = 'planogram_compliance',
  PRICE_TAG_READING = 'price_tag_reading',
  PROMOTIONAL_DISPLAY = 'promotional_display',
  STORE_AUDIT = 'store_audit'
}

export interface VisionCapability {
  name: string;
  description: string;
  accuracy: number;
  enabled: boolean;
}

export interface ImageAnalysis {
  id: string;
  imageUrl: string;
  modelId: string;
  results: AnalysisResult[];
  confidence: number;
  processingTime: number;
  createdAt: Date;
}

export interface AnalysisResult {
  type: string;
  label: string;
  confidence: number;
  boundingBox?: BoundingBox;
  attributes: Record<string, any>;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Natural Language Processing Types
export interface NLPModel {
  id: string;
  name: string;
  type: NLPModelType;
  language: string;
  capabilities: NLPCapability[];
  accuracy: number;
  status: ModelStatus;
}

export enum NLPModelType {
  SENTIMENT_ANALYSIS = 'sentiment_analysis',
  ENTITY_EXTRACTION = 'entity_extraction',
  TEXT_CLASSIFICATION = 'text_classification',
  QUESTION_ANSWERING = 'question_answering',
  TEXT_SUMMARIZATION = 'text_summarization',
  LANGUAGE_TRANSLATION = 'language_translation'
}

export interface NLPCapability {
  name: string;
  description: string;
  accuracy: number;
  enabled: boolean;
}

export interface TextAnalysis {
  id: string;
  text: string;
  modelId: string;
  results: NLPResult[];
  confidence: number;
  processingTime: number;
  createdAt: Date;
}

export interface NLPResult {
  type: string;
  value: any;
  confidence: number;
  startIndex?: number;
  endIndex?: number;
}

// AutoML Types
export interface AutoMLExperiment {
  id: string;
  name: string;
  objective: MLObjective;
  dataset: string;
  targetColumn: string;
  features: string[];
  algorithms: MLAlgorithm[];
  hyperparameters: HyperparameterSpace;
  results: ExperimentResult[];
  bestModel: string;
  status: ExperimentStatus;
  startedAt: Date;
  completedAt?: Date;
}

export enum MLObjective {
  CLASSIFICATION = 'classification',
  REGRESSION = 'regression',
  FORECASTING = 'forecasting',
  CLUSTERING = 'clustering'
}

export interface HyperparameterSpace {
  [algorithm: string]: {
    [parameter: string]: {
      type: 'int' | 'float' | 'categorical';
      range?: [number, number];
      values?: any[];
    };
  };
}

export interface ExperimentResult {
  modelId: string;
  algorithm: MLAlgorithm;
  hyperparameters: Record<string, any>;
  performance: ModelPerformance;
  trainingTime: number;
  rank: number;
}

export enum ExperimentStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Marketing Mix Modeling Types
export interface MarketingMixModel {
  id: string;
  name: string;
  brand: string;
  geography: string;
  period: DatePeriod;
  channels: MarketingChannel[];
  variables: MarketingVariable[];
  results: MixModelResults;
  status: ModelStatus;
}

export interface MarketingChannel {
  name: string;
  type: ChannelType;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  contribution: number;
  roi: number;
  saturationCurve: SaturationPoint[];
}

export enum ChannelType {
  TV = 'tv',
  DIGITAL = 'digital',
  PRINT = 'print',
  RADIO = 'radio',
  OUTDOOR = 'outdoor',
  TRADE_PROMOTION = 'trade_promotion',
  CONSUMER_PROMOTION = 'consumer_promotion',
  PR = 'pr'
}

export interface MarketingVariable {
  name: string;
  type: VariableType;
  coefficient: number;
  pValue: number;
  significance: SignificanceLevel;
  elasticity: number;
}

export enum VariableType {
  MEDIA = 'media',
  PRICE = 'price',
  DISTRIBUTION = 'distribution',
  SEASONALITY = 'seasonality',
  TREND = 'trend',
  COMPETITIVE = 'competitive',
  ECONOMIC = 'economic'
}

export enum SignificanceLevel {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  NOT_SIGNIFICANT = 'not_significant'
}

export interface SaturationPoint {
  spend: number;
  response: number;
  efficiency: number;
}

export interface MixModelResults {
  baselineVolume: number;
  incrementalVolume: number;
  totalVolume: number;
  rSquared: number;
  mape: number;
  channelContribution: ChannelContribution[];
  recommendations: OptimizationRecommendation[];
}

export interface ChannelContribution {
  channel: string;
  contribution: number;
  percentage: number;
  roi: number;
  efficiency: number;
}

export interface OptimizationRecommendation {
  channel: string;
  currentSpend: number;
  recommendedSpend: number;
  expectedLift: number;
  confidence: number;
  rationale: string;
}

// Real-time Analytics Types
export interface RealTimeAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  data: any;
  conditions: AlertCondition[];
  actions: AlertAction[];
  status: AlertStatus;
  triggeredAt: Date;
  resolvedAt?: Date;
}

export enum AlertType {
  PERFORMANCE_ANOMALY = 'performance_anomaly',
  BUDGET_THRESHOLD = 'budget_threshold',
  FORECAST_DEVIATION = 'forecast_deviation',
  COMPETITIVE_ACTIVITY = 'competitive_activity',
  INVENTORY_ISSUE = 'inventory_issue',
  SYSTEM_ERROR = 'system_error'
}

export enum AlertSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

export interface AlertCondition {
  metric: string;
  operator: string;
  threshold: number;
  timeWindow: string;
}

export interface AlertAction {
  type: ActionType;
  config: Record<string, any>;
  executed: boolean;
  executedAt?: Date;
}

export enum ActionType {
  NOTIFICATION = 'notification',
  EMAIL = 'email',
  WEBHOOK = 'webhook',
  AUTO_ADJUSTMENT = 'auto_adjustment',
  ESCALATION = 'escalation'
}

export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  SUPPRESSED = 'suppressed'
}

export interface DatePeriod {
  startDate: Date;
  endDate: Date;
}