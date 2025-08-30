import { Decimal } from 'decimal.js';
import { addDays, differenceInDays, isAfter, isBefore, parseISO } from 'date-fns';
import { config } from '../config';
import { logger } from '../utils/logger';
import { CacheService } from '../services/cache';
import { KafkaService } from '../services/kafka';
import { PromotionModel } from '../models/Promotion';
import { PromotionPerformanceModel } from '../models/PromotionPerformance';
import { ClaimModel } from '../models/Claim';
import { generateId } from '@trade-marketing/shared';

export interface PromotionCalculation {
  promotionId: string;
  basePrice: Decimal;
  discountAmount: Decimal;
  finalPrice: Decimal;
  discountPercentage: Decimal;
  volume: Decimal;
  totalDiscount: Decimal;
  incrementalVolume?: Decimal;
  roi?: Decimal;
}

export interface PromotionForecast {
  promotionId: string;
  forecastPeriod: string;
  expectedVolume: Decimal;
  expectedRevenue: Decimal;
  expectedCost: Decimal;
  expectedROI: Decimal;
  confidence: number;
  factors: Array<{
    factor: string;
    impact: number;
    weight: number;
  }>;
}

export interface PromotionOptimization {
  promotionId: string;
  currentPerformance: any;
  recommendations: Array<{
    type: string;
    description: string;
    expectedImpact: number;
    confidence: number;
    priority: 'low' | 'medium' | 'high';
  }>;
  optimizedParameters: {
    discount?: Decimal;
    duration?: number;
    channels?: string[];
    targeting?: any;
  };
}

export interface PromotionConflict {
  promotionId: string;
  conflictingPromotions: Array<{
    id: string;
    name: string;
    conflictType: 'overlap' | 'cannibalization' | 'budget' | 'resource';
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
  resolution: string;
}

export class PromotionEngine {
  private cacheService: CacheService;
  private kafkaService: KafkaService;

  constructor() {
    this.cacheService = new CacheService();
    this.kafkaService = new KafkaService();
  }

  // Calculate promotion pricing and discounts
  async calculatePromotion(
    promotionId: string,
    products: any[],
    volume: Decimal,
    customerId?: string
  ): Promise<PromotionCalculation> {
    try {
      const promotion = await PromotionModel.findById(promotionId);
      if (!promotion) {
        throw new Error('Promotion not found');
      }

      // Get base pricing
      const basePrice = await this.getBasePrice(products, customerId);
      
      // Calculate discount based on promotion mechanic
      const discountAmount = await this.calculateDiscount(promotion, basePrice, volume);
      
      // Apply volume tiers if applicable
      const tieredDiscount = await this.applyVolumeTiers(promotion, volume, discountAmount);
      
      // Calculate final pricing
      const finalPrice = basePrice.minus(tieredDiscount);
      const discountPercentage = tieredDiscount.dividedBy(basePrice).times(100);
      const totalDiscount = tieredDiscount.times(volume);

      // Calculate incremental volume and ROI
      const incrementalVolume = await this.calculateIncrementalVolume(
        promotionId,
        volume,
        products
      );
      
      const roi = await this.calculatePromotionROI(
        promotion,
        totalDiscount,
        incrementalVolume,
        basePrice
      );

      const calculation: PromotionCalculation = {
        promotionId,
        basePrice,
        discountAmount: tieredDiscount,
        finalPrice,
        discountPercentage,
        volume,
        totalDiscount,
        incrementalVolume,
        roi,
      };

      // Cache calculation
      await this.cacheService.set(
        `promotion_calc:${promotionId}:${volume}`,
        calculation,
        config.cache.campaigns.ttl
      );

      // Log calculation
      logger.info('Promotion calculation completed', {
        promotionId,
        volume: volume.toString(),
        totalDiscount: totalDiscount.toString(),
        roi: roi?.toString(),
      });

      return calculation;

    } catch (error) {
      logger.error('Promotion calculation failed', { error, promotionId });
      throw error;
    }
  }

  // Forecast promotion performance
  async forecastPromotion(
    promotionId: string,
    forecastPeriod: string = '30d'
  ): Promise<PromotionForecast> {
    try {
      const promotion = await PromotionModel.findById(promotionId);
      if (!promotion) {
        throw new Error('Promotion not found');
      }

      // Get historical performance data
      const historicalData = await this.getHistoricalPerformance(promotionId);
      
      // Get market factors
      const marketFactors = await this.getMarketFactors(promotion);
      
      // Get seasonal factors
      const seasonalFactors = await this.getSeasonalFactors(promotion);
      
      // Calculate base forecast
      const baseForecast = await this.calculateBaseForecast(
        promotion,
        historicalData,
        forecastPeriod
      );

      // Apply market and seasonal adjustments
      const adjustedForecast = this.applyForecastAdjustments(
        baseForecast,
        marketFactors,
        seasonalFactors
      );

      // Calculate confidence score
      const confidence = this.calculateForecastConfidence(
        historicalData,
        marketFactors,
        seasonalFactors
      );

      const forecast: PromotionForecast = {
        promotionId,
        forecastPeriod,
        expectedVolume: adjustedForecast.volume,
        expectedRevenue: adjustedForecast.revenue,
        expectedCost: adjustedForecast.cost,
        expectedROI: adjustedForecast.roi,
        confidence,
        factors: [
          ...marketFactors,
          ...seasonalFactors,
        ],
      };

      // Cache forecast
      await this.cacheService.set(
        `promotion_forecast:${promotionId}:${forecastPeriod}`,
        forecast,
        config.cache.performance.ttl
      );

      return forecast;

    } catch (error) {
      logger.error('Promotion forecasting failed', { error, promotionId });
      throw error;
    }
  }

  // Optimize promotion parameters
  async optimizePromotion(promotionId: string): Promise<PromotionOptimization> {
    try {
      const promotion = await PromotionModel.findById(promotionId);
      if (!promotion) {
        throw new Error('Promotion not found');
      }

      // Get current performance
      const currentPerformance = await this.getCurrentPerformance(promotionId);
      
      // Analyze performance gaps
      const performanceGaps = await this.analyzePerformanceGaps(
        promotion,
        currentPerformance
      );

      // Generate optimization recommendations
      const recommendations = await this.generateOptimizationRecommendations(
        promotion,
        performanceGaps
      );

      // Calculate optimized parameters
      const optimizedParameters = await this.calculateOptimizedParameters(
        promotion,
        recommendations
      );

      const optimization: PromotionOptimization = {
        promotionId,
        currentPerformance,
        recommendations,
        optimizedParameters,
      };

      // Log optimization
      logger.info('Promotion optimization completed', {
        promotionId,
        recommendationsCount: recommendations.length,
        optimizedParameters,
      });

      return optimization;

    } catch (error) {
      logger.error('Promotion optimization failed', { error, promotionId });
      throw error;
    }
  }

  // Detect promotion conflicts
  async detectPromotionConflicts(promotionId: string): Promise<PromotionConflict> {
    try {
      const promotion = await PromotionModel.findById(promotionId);
      if (!promotion) {
        throw new Error('Promotion not found');
      }

      const conflictingPromotions: PromotionConflict['conflictingPromotions'] = [];

      // Check for overlapping promotions
      const overlappingPromotions = await this.findOverlappingPromotions(promotion);
      conflictingPromotions.push(...overlappingPromotions);

      // Check for cannibalization
      const cannibalizingPromotions = await this.findCannibalizingPromotions(promotion);
      conflictingPromotions.push(...cannibalizingPromotions);

      // Check for budget conflicts
      const budgetConflicts = await this.findBudgetConflicts(promotion);
      conflictingPromotions.push(...budgetConflicts);

      // Check for resource conflicts
      const resourceConflicts = await this.findResourceConflicts(promotion);
      conflictingPromotions.push(...resourceConflicts);

      // Generate resolution recommendations
      const resolution = this.generateConflictResolution(conflictingPromotions);

      const conflict: PromotionConflict = {
        promotionId,
        conflictingPromotions,
        resolution,
      };

      return conflict;

    } catch (error) {
      logger.error('Promotion conflict detection failed', { error, promotionId });
      throw error;
    }
  }

  // Validate promotion setup
  async validatePromotion(promotionData: any): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate dates
      if (isAfter(parseISO(promotionData.startDate), parseISO(promotionData.endDate))) {
        errors.push('Start date must be before end date');
      }

      // Validate duration
      const duration = differenceInDays(
        parseISO(promotionData.endDate),
        parseISO(promotionData.startDate)
      );
      
      if (duration > config.business.promotion.maxDurationDays) {
        errors.push(`Promotion duration cannot exceed ${config.business.promotion.maxDurationDays} days`);
      }

      if (duration < config.business.promotion.minDurationDays) {
        errors.push(`Promotion duration must be at least ${config.business.promotion.minDurationDays} day(s)`);
      }

      // Validate lead time
      const leadTime = differenceInDays(parseISO(promotionData.startDate), new Date());
      if (leadTime < config.business.promotion.leadTimeDays) {
        warnings.push(`Promotion should have at least ${config.business.promotion.leadTimeDays} days lead time`);
      }

      // Validate budget
      if (promotionData.budget <= 0) {
        errors.push('Budget must be greater than zero');
      }

      // Validate discount percentage
      if (promotionData.mechanic === 'PERCENTAGE_DISCOUNT') {
        const discountPercentage = promotionData.terms?.discountPercentage || 0;
        if (discountPercentage > config.business.promotion.maxDiscountPercentage) {
          errors.push(`Discount percentage cannot exceed ${config.business.promotion.maxDiscountPercentage * 100}%`);
        }
      }

      // Validate products
      if (!promotionData.products || promotionData.products.length === 0) {
        errors.push('At least one product must be specified');
      }

      // Validate channels
      if (!promotionData.channels || promotionData.channels.length === 0) {
        errors.push('At least one channel must be specified');
      }

      // Check for conflicts
      const conflicts = await this.detectPromotionConflicts(promotionData.id);
      if (conflicts.conflictingPromotions.length > 0) {
        const highSeverityConflicts = conflicts.conflictingPromotions.filter(
          c => c.severity === 'high'
        );
        
        if (highSeverityConflicts.length > 0) {
          errors.push('High severity promotion conflicts detected');
        } else {
          warnings.push('Promotion conflicts detected - review recommended');
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };

    } catch (error) {
      logger.error('Promotion validation failed', { error });
      return {
        valid: false,
        errors: ['Validation failed due to system error'],
        warnings: [],
      };
    }
  }

  // Process promotion claims
  async processPromotionClaim(
    promotionId: string,
    claimData: any
  ): Promise<{ claimId: string; status: string; amount: Decimal }> {
    try {
      const promotion = await PromotionModel.findById(promotionId);
      if (!promotion) {
        throw new Error('Promotion not found');
      }

      // Validate claim eligibility
      const eligibility = await this.validateClaimEligibility(promotion, claimData);
      if (!eligibility.eligible) {
        throw new Error(`Claim not eligible: ${eligibility.reason}`);
      }

      // Calculate claim amount
      const claimAmount = await this.calculateClaimAmount(promotion, claimData);

      // Create claim record
      const claim = await ClaimModel.create({
        id: generateId(),
        promotionId,
        claimNumber: await this.generateClaimNumber(),
        type: this.mapPromotionTypeToClaimType(promotion.type),
        customerId: claimData.customerId,
        customerName: claimData.customerName,
        amount: claimAmount,
        currency: promotion.currency,
        claimDate: new Date(),
        periodStart: parseISO(claimData.periodStart),
        periodEnd: parseISO(claimData.periodEnd),
        products: claimData.products,
        documentation: claimData.documentation || [],
        createdBy: claimData.createdBy,
      });

      // Auto-validate if below threshold
      if (claimAmount.lessThanOrEqualTo(config.business.claims.autoValidationThreshold)) {
        await ClaimModel.update(claim.id, {
          validationStatus: 'VALIDATED',
          approvalStatus: 'APPROVED',
        });
      }

      // Publish claim event
      await this.kafkaService.publish(config.kafka.topics.claimEvents, {
        type: 'claim.created',
        claimId: claim.id,
        promotionId,
        amount: claimAmount.toString(),
        customerId: claimData.customerId,
        timestamp: new Date().toISOString(),
      });

      logger.info('Promotion claim processed', {
        claimId: claim.id,
        promotionId,
        amount: claimAmount.toString(),
        customerId: claimData.customerId,
      });

      return {
        claimId: claim.id,
        status: claim.status,
        amount: claimAmount,
      };

    } catch (error) {
      logger.error('Promotion claim processing failed', { error, promotionId });
      throw error;
    }
  }

  // Private helper methods
  private async getBasePrice(products: any[], customerId?: string): Promise<Decimal> {
    // Implementation would get pricing from product catalog or customer-specific pricing
    // For now, return a mock price
    return new Decimal(100);
  }

  private async calculateDiscount(
    promotion: any,
    basePrice: Decimal,
    volume: Decimal
  ): Promise<Decimal> {
    switch (promotion.mechanic) {
      case 'PERCENTAGE_DISCOUNT':
        const percentage = new Decimal(promotion.terms?.discountPercentage || 0);
        return basePrice.times(percentage).dividedBy(100);
      
      case 'FIXED_AMOUNT':
        return new Decimal(promotion.terms?.discountAmount || 0);
      
      case 'VOLUME_BASED':
        return this.calculateVolumeBasedDiscount(promotion, volume, basePrice);
      
      case 'TIERED_DISCOUNT':
        return this.calculateTieredDiscount(promotion, volume, basePrice);
      
      default:
        return new Decimal(0);
    }
  }

  private async applyVolumeTiers(
    promotion: any,
    volume: Decimal,
    baseDiscount: Decimal
  ): Promise<Decimal> {
    const tiers = promotion.terms?.volumeTiers || [];
    
    for (const tier of tiers.reverse()) { // Start from highest tier
      if (volume.greaterThanOrEqualTo(tier.minVolume)) {
        const tierMultiplier = new Decimal(tier.multiplier || 1);
        return baseDiscount.times(tierMultiplier);
      }
    }
    
    return baseDiscount;
  }

  private calculateVolumeBasedDiscount(
    promotion: any,
    volume: Decimal,
    basePrice: Decimal
  ): Decimal {
    const rate = new Decimal(promotion.terms?.volumeRate || 0);
    return volume.times(rate);
  }

  private calculateTieredDiscount(
    promotion: any,
    volume: Decimal,
    basePrice: Decimal
  ): Decimal {
    const tiers = promotion.terms?.discountTiers || [];
    let totalDiscount = new Decimal(0);
    let remainingVolume = volume;

    for (const tier of tiers) {
      const tierVolume = new Decimal(tier.maxVolume || 0).minus(tier.minVolume || 0);
      const volumeForTier = Decimal.min(remainingVolume, tierVolume);
      
      if (volumeForTier.greaterThan(0)) {
        const tierDiscount = basePrice.times(tier.discountPercentage || 0).dividedBy(100);
        totalDiscount = totalDiscount.plus(tierDiscount.times(volumeForTier));
        remainingVolume = remainingVolume.minus(volumeForTier);
      }
      
      if (remainingVolume.lessThanOrEqualTo(0)) break;
    }

    return totalDiscount.dividedBy(volume); // Return per-unit discount
  }

  private async calculateIncrementalVolume(
    promotionId: string,
    currentVolume: Decimal,
    products: any[]
  ): Promise<Decimal> {
    // Get baseline volume from historical data
    const baselineVolume = await this.getBaselineVolume(products);
    return Decimal.max(0, currentVolume.minus(baselineVolume));
  }

  private async calculatePromotionROI(
    promotion: any,
    totalDiscount: Decimal,
    incrementalVolume: Decimal | undefined,
    basePrice: Decimal
  ): Promise<Decimal> {
    if (!incrementalVolume || incrementalVolume.lessThanOrEqualTo(0)) {
      return new Decimal(0);
    }

    const incrementalRevenue = incrementalVolume.times(basePrice);
    const promotionCost = totalDiscount.plus(promotion.actualSpend || 0);
    
    if (promotionCost.lessThanOrEqualTo(0)) {
      return new Decimal(0);
    }

    return incrementalRevenue.dividedBy(promotionCost);
  }

  private async getBaselineVolume(products: any[]): Promise<Decimal> {
    // Implementation would calculate baseline from historical sales data
    return new Decimal(1000); // Mock baseline
  }

  private async getHistoricalPerformance(promotionId: string): Promise<any[]> {
    return await PromotionPerformanceModel.findByPromotion(promotionId);
  }

  private async getMarketFactors(promotion: any): Promise<any[]> {
    // Implementation would get market factors like competitor activity, economic indicators, etc.
    return [
      { factor: 'competitor_activity', impact: -0.1, weight: 0.3 },
      { factor: 'market_growth', impact: 0.05, weight: 0.2 },
    ];
  }

  private async getSeasonalFactors(promotion: any): Promise<any[]> {
    // Implementation would get seasonal factors based on historical patterns
    return [
      { factor: 'seasonal_demand', impact: 0.15, weight: 0.4 },
      { factor: 'holiday_effect', impact: 0.2, weight: 0.3 },
    ];
  }

  private async calculateBaseForecast(
    promotion: any,
    historicalData: any[],
    forecastPeriod: string
  ): Promise<any> {
    // Implementation would use statistical models to calculate base forecast
    return {
      volume: new Decimal(5000),
      revenue: new Decimal(500000),
      cost: new Decimal(50000),
      roi: new Decimal(2.5),
    };
  }

  private applyForecastAdjustments(
    baseForecast: any,
    marketFactors: any[],
    seasonalFactors: any[]
  ): any {
    let adjustmentFactor = new Decimal(1);
    
    [...marketFactors, ...seasonalFactors].forEach(factor => {
      const impact = new Decimal(factor.impact).times(factor.weight);
      adjustmentFactor = adjustmentFactor.plus(impact);
    });

    return {
      volume: baseForecast.volume.times(adjustmentFactor),
      revenue: baseForecast.revenue.times(adjustmentFactor),
      cost: baseForecast.cost,
      roi: baseForecast.revenue.times(adjustmentFactor).dividedBy(baseForecast.cost),
    };
  }

  private calculateForecastConfidence(
    historicalData: any[],
    marketFactors: any[],
    seasonalFactors: any[]
  ): number {
    // Implementation would calculate confidence based on data quality and factor reliability
    const dataQuality = historicalData.length > 10 ? 0.8 : 0.5;
    const factorReliability = 0.7;
    
    return Math.min(0.95, dataQuality * factorReliability);
  }

  private async getCurrentPerformance(promotionId: string): Promise<any> {
    const performance = await PromotionPerformanceModel.findLatestByPromotion(promotionId);
    return performance || {};
  }

  private async analyzePerformanceGaps(promotion: any, currentPerformance: any): Promise<any[]> {
    const gaps = [];
    
    // Compare against targets
    if (currentPerformance.roi && promotion.targetROI) {
      const roiGap = new Decimal(promotion.targetROI).minus(currentPerformance.roi);
      if (roiGap.greaterThan(0)) {
        gaps.push({
          metric: 'roi',
          gap: roiGap.toNumber(),
          severity: roiGap.greaterThan(0.5) ? 'high' : 'medium',
        });
      }
    }

    return gaps;
  }

  private async generateOptimizationRecommendations(
    promotion: any,
    performanceGaps: any[]
  ): Promise<PromotionOptimization['recommendations']> {
    const recommendations = [];

    for (const gap of performanceGaps) {
      switch (gap.metric) {
        case 'roi':
          if (gap.severity === 'high') {
            recommendations.push({
              type: 'discount_adjustment',
              description: 'Reduce discount percentage to improve ROI',
              expectedImpact: 0.3,
              confidence: 0.8,
              priority: 'high' as const,
            });
          }
          break;
      }
    }

    return recommendations;
  }

  private async calculateOptimizedParameters(
    promotion: any,
    recommendations: any[]
  ): Promise<PromotionOptimization['optimizedParameters']> {
    const optimized: PromotionOptimization['optimizedParameters'] = {};

    for (const rec of recommendations) {
      switch (rec.type) {
        case 'discount_adjustment':
          const currentDiscount = new Decimal(promotion.terms?.discountPercentage || 0);
          optimized.discount = currentDiscount.times(0.9); // Reduce by 10%
          break;
      }
    }

    return optimized;
  }

  private async findOverlappingPromotions(promotion: any): Promise<any[]> {
    // Implementation would find promotions with overlapping dates and products
    return [];
  }

  private async findCannibalizingPromotions(promotion: any): Promise<any[]> {
    // Implementation would find promotions that might cannibalize each other
    return [];
  }

  private async findBudgetConflicts(promotion: any): Promise<any[]> {
    // Implementation would find promotions competing for the same budget
    return [];
  }

  private async findResourceConflicts(promotion: any): Promise<any[]> {
    // Implementation would find promotions competing for the same resources
    return [];
  }

  private generateConflictResolution(conflicts: any[]): string {
    if (conflicts.length === 0) {
      return 'No conflicts detected';
    }

    const highSeverity = conflicts.filter(c => c.severity === 'high').length;
    if (highSeverity > 0) {
      return 'High severity conflicts require immediate attention. Consider adjusting dates, budgets, or targeting.';
    }

    return 'Medium/low severity conflicts detected. Review and optimize for better performance.';
  }

  private async validateClaimEligibility(promotion: any, claimData: any): Promise<{
    eligible: boolean;
    reason?: string;
  }> {
    // Check if promotion is active
    if (promotion.status !== 'ACTIVE') {
      return { eligible: false, reason: 'Promotion is not active' };
    }

    // Check if claim period is within promotion period
    const claimStart = parseISO(claimData.periodStart);
    const claimEnd = parseISO(claimData.periodEnd);
    const promoStart = parseISO(promotion.startDate);
    const promoEnd = parseISO(promotion.endDate);

    if (isBefore(claimStart, promoStart) || isAfter(claimEnd, promoEnd)) {
      return { eligible: false, reason: 'Claim period is outside promotion period' };
    }

    return { eligible: true };
  }

  private async calculateClaimAmount(promotion: any, claimData: any): Promise<Decimal> {
    const volume = new Decimal(claimData.volume || 0);
    const calculation = await this.calculatePromotion(
      promotion.id,
      claimData.products,
      volume,
      claimData.customerId
    );
    
    return calculation.totalDiscount;
  }

  private async generateClaimNumber(): Promise<string> {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `CLM-${timestamp}-${random}`.toUpperCase();
  }

  private mapPromotionTypeToClaimType(promotionType: string): string {
    const mapping: Record<string, string> = {
      'TRADE_ALLOWANCE': 'TRADE_ALLOWANCE',
      'VOLUME_DISCOUNT': 'VOLUME_DISCOUNT',
      'REBATE': 'REBATE',
      'COOPERATIVE_ADVERTISING': 'COOPERATIVE_ADVERTISING',
    };
    
    return mapping[promotionType] || 'OTHER';
  }
}