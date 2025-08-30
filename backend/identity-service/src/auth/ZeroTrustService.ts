import crypto from 'crypto';
import geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';
import { config } from '../config';
import { logger } from '../utils/logger';
import { UserModel } from '../models/User';
import { AuditLogModel } from '../models/AuditLog';
import { CacheService } from '../services/cache';
import { generateId } from '@trade-marketing/shared';

export interface DeviceInfo {
  deviceId: string;
  fingerprint: string;
  userAgent: string;
  browser: {
    name?: string;
    version?: string;
  };
  os: {
    name?: string;
    version?: string;
  };
  device: {
    type?: string;
    model?: string;
    vendor?: string;
  };
  screen: {
    width?: number;
    height?: number;
    colorDepth?: number;
  };
  timezone?: string;
  language?: string;
  platform?: string;
}

export interface LocationInfo {
  ip: string;
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  isp?: string;
  isVPN?: boolean;
  isTor?: boolean;
}

export interface RiskAssessment {
  score: number; // 0-1, where 1 is highest risk
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: Array<{
    factor: string;
    score: number;
    weight: number;
    description: string;
  }>;
  recommendations: string[];
  requiresAdditionalAuth: boolean;
  allowAccess: boolean;
}

export interface TrustContext {
  userId: string;
  sessionId: string;
  deviceInfo: DeviceInfo;
  locationInfo: LocationInfo;
  timestamp: Date;
  previousSessions?: any[];
  userBehavior?: any;
}

export interface DeviceRegistration {
  deviceId: string;
  userId: string;
  name: string;
  trusted: boolean;
  lastUsed: Date;
  registeredAt: Date;
  deviceInfo: DeviceInfo;
  riskScore: number;
}

export class ZeroTrustService {
  // Assess risk for authentication attempt
  async assessRisk(context: TrustContext): Promise<RiskAssessment> {
    try {
      const factors: RiskAssessment['factors'] = [];
      let totalScore = 0;
      let totalWeight = 0;

      // Device trust assessment
      const deviceRisk = await this.assessDeviceRisk(context);
      factors.push(...deviceRisk.factors);
      totalScore += deviceRisk.score * deviceRisk.weight;
      totalWeight += deviceRisk.weight;

      // Location trust assessment
      const locationRisk = await this.assessLocationRisk(context);
      factors.push(...locationRisk.factors);
      totalScore += locationRisk.score * locationRisk.weight;
      totalWeight += locationRisk.weight;

      // Behavioral analysis
      const behaviorRisk = await this.assessBehaviorRisk(context);
      factors.push(...behaviorRisk.factors);
      totalScore += behaviorRisk.score * behaviorRisk.weight;
      totalWeight += behaviorRisk.weight;

      // Time-based analysis
      const timeRisk = await this.assessTimeRisk(context);
      factors.push(...timeRisk.factors);
      totalScore += timeRisk.score * timeRisk.weight;
      totalWeight += timeRisk.weight;

      // Calculate final risk score
      const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;
      const level = this.getRiskLevel(finalScore);

      // Generate recommendations
      const recommendations = this.generateRecommendations(factors, level);

      // Determine access decision
      const requiresAdditionalAuth = finalScore >= config.zeroTrust.riskAssessment.mediumRiskThreshold;
      const allowAccess = finalScore < config.zeroTrust.riskAssessment.highRiskThreshold;

      const assessment: RiskAssessment = {
        score: finalScore,
        level,
        factors,
        recommendations,
        requiresAdditionalAuth,
        allowAccess,
      };

      // Log risk assessment
      await AuditLogModel.create({
        entityType: 'User',
        entityId: context.userId,
        action: 'ACCESS',
        userId: context.userId,
        metadata: {
          action: 'risk_assessment',
          riskScore: finalScore,
          riskLevel: level,
          deviceId: context.deviceInfo.deviceId,
          ip: context.locationInfo.ip,
          requiresAdditionalAuth,
          allowAccess,
        },
      });

      return assessment;

    } catch (error) {
      logger.error('Risk assessment failed', { error, userId: context.userId });
      
      // Return high risk on error
      return {
        score: 1.0,
        level: 'critical',
        factors: [{
          factor: 'assessment_error',
          score: 1.0,
          weight: 1.0,
          description: 'Risk assessment failed',
        }],
        recommendations: ['Deny access due to assessment failure'],
        requiresAdditionalAuth: true,
        allowAccess: false,
      };
    }
  }

  // Assess device risk
  private async assessDeviceRisk(context: TrustContext): Promise<{ score: number; weight: number; factors: any[] }> {
    const factors: any[] = [];
    let score = 0;
    const weight = 0.3; // 30% of total risk

    // Check if device is registered
    const isRegistered = await this.isDeviceRegistered(context.userId, context.deviceInfo.deviceId);
    if (!isRegistered) {
      factors.push({
        factor: 'unregistered_device',
        score: 0.7,
        weight: 0.4,
        description: 'Device is not registered',
      });
      score += 0.7 * 0.4;
    }

    // Check device trust level
    const deviceTrust = await this.getDeviceTrustLevel(context.userId, context.deviceInfo.deviceId);
    if (deviceTrust < 0.5) {
      factors.push({
        factor: 'low_device_trust',
        score: 1 - deviceTrust,
        weight: 0.3,
        description: 'Device has low trust score',
      });
      score += (1 - deviceTrust) * 0.3;
    }

    // Check for suspicious device characteristics
    if (this.isSuspiciousDevice(context.deviceInfo)) {
      factors.push({
        factor: 'suspicious_device',
        score: 0.8,
        weight: 0.3,
        description: 'Device has suspicious characteristics',
      });
      score += 0.8 * 0.3;
    }

    return { score, weight, factors };
  }

  // Assess location risk
  private async assessLocationRisk(context: TrustContext): Promise<{ score: number; weight: number; factors: any[] }> {
    const factors: any[] = [];
    let score = 0;
    const weight = 0.25; // 25% of total risk

    const location = context.locationInfo;

    // Check blocked countries
    if (location.country && config.zeroTrust.locationTrust.blockedCountries.includes(location.country)) {
      factors.push({
        factor: 'blocked_country',
        score: 1.0,
        weight: 0.5,
        description: `Access from blocked country: ${location.country}`,
      });
      score += 1.0 * 0.5;
    }

    // Check allowed countries
    if (location.country && 
        config.zeroTrust.locationTrust.allowedCountries.length > 0 && 
        !config.zeroTrust.locationTrust.allowedCountries.includes(location.country)) {
      factors.push({
        factor: 'non_allowed_country',
        score: 0.6,
        weight: 0.3,
        description: `Access from non-allowed country: ${location.country}`,
      });
      score += 0.6 * 0.3;
    }

    // Check for VPN/Proxy usage
    if (location.isVPN || location.isTor) {
      factors.push({
        factor: 'vpn_proxy_usage',
        score: 0.7,
        weight: 0.3,
        description: 'Access through VPN/Proxy/Tor',
      });
      score += 0.7 * 0.3;
    }

    // Check location consistency
    const locationConsistency = await this.checkLocationConsistency(context.userId, location);
    if (locationConsistency < 0.5) {
      factors.push({
        factor: 'location_inconsistency',
        score: 1 - locationConsistency,
        weight: 0.2,
        description: 'Unusual location for user',
      });
      score += (1 - locationConsistency) * 0.2;
    }

    return { score, weight, factors };
  }

  // Assess behavioral risk
  private async assessBehaviorRisk(context: TrustContext): Promise<{ score: number; weight: number; factors: any[] }> {
    const factors: any[] = [];
    let score = 0;
    const weight = 0.25; // 25% of total risk

    // Check login patterns
    const loginPattern = await this.analyzeLoginPattern(context.userId, context.timestamp);
    if (loginPattern.isAnomalous) {
      factors.push({
        factor: 'anomalous_login_pattern',
        score: loginPattern.riskScore,
        weight: 0.4,
        description: 'Unusual login time or frequency',
      });
      score += loginPattern.riskScore * 0.4;
    }

    // Check session behavior
    const sessionBehavior = await this.analyzeSessionBehavior(context.userId);
    if (sessionBehavior.isAnomalous) {
      factors.push({
        factor: 'anomalous_session_behavior',
        score: sessionBehavior.riskScore,
        weight: 0.3,
        description: 'Unusual session patterns',
      });
      score += sessionBehavior.riskScore * 0.3;
    }

    // Check for rapid successive attempts
    const rapidAttempts = await this.checkRapidAttempts(context.userId, context.locationInfo.ip);
    if (rapidAttempts.detected) {
      factors.push({
        factor: 'rapid_attempts',
        score: 0.8,
        weight: 0.3,
        description: 'Multiple rapid login attempts detected',
      });
      score += 0.8 * 0.3;
    }

    return { score, weight, factors };
  }

  // Assess time-based risk
  private async assessTimeRisk(context: TrustContext): Promise<{ score: number; weight: number; factors: any[] }> {
    const factors: any[] = [];
    let score = 0;
    const weight = 0.2; // 20% of total risk

    const hour = context.timestamp.getHours();
    const dayOfWeek = context.timestamp.getDay();

    // Check for unusual hours
    if (hour < 6 || hour > 22) {
      factors.push({
        factor: 'unusual_hour',
        score: 0.4,
        weight: 0.3,
        description: 'Login during unusual hours',
      });
      score += 0.4 * 0.3;
    }

    // Check for weekend access (if unusual for user)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      const weekendPattern = await this.getUserWeekendPattern(context.userId);
      if (!weekendPattern.usuallyAccessesWeekends) {
        factors.push({
          factor: 'unusual_weekend_access',
          score: 0.3,
          weight: 0.2,
          description: 'Unusual weekend access',
        });
        score += 0.3 * 0.2;
      }
    }

    return { score, weight, factors };
  }

  // Register a new device
  async registerDevice(userId: string, deviceInfo: DeviceInfo, trusted: boolean = false): Promise<DeviceRegistration> {
    try {
      const registration: DeviceRegistration = {
        deviceId: deviceInfo.deviceId,
        userId,
        name: this.generateDeviceName(deviceInfo),
        trusted,
        lastUsed: new Date(),
        registeredAt: new Date(),
        deviceInfo,
        riskScore: trusted ? 0.1 : 0.5,
      };

      // Store device registration
      await CacheService.set(
        `device:${userId}:${deviceInfo.deviceId}`,
        registration,
        30 * 24 * 3600 // 30 days
      );

      // Log device registration
      await AuditLogModel.create({
        entityType: 'User',
        entityId: userId,
        action: 'CREATE',
        userId,
        metadata: {
          action: 'device_registration',
          deviceId: deviceInfo.deviceId,
          deviceName: registration.name,
          trusted,
        },
      });

      logger.info('Device registered', { userId, deviceId: deviceInfo.deviceId, trusted });

      return registration;

    } catch (error) {
      logger.error('Device registration failed', { error, userId, deviceId: deviceInfo.deviceId });
      throw error;
    }
  }

  // Check if device is registered
  private async isDeviceRegistered(userId: string, deviceId: string): Promise<boolean> {
    const device = await CacheService.get(`device:${userId}:${deviceId}`);
    return !!device;
  }

  // Get device trust level
  private async getDeviceTrustLevel(userId: string, deviceId: string): Promise<number> {
    const device = await CacheService.get(`device:${userId}:${deviceId}`);
    if (!device) return 0;
    
    return device.trusted ? 0.9 : device.riskScore || 0.5;
  }

  // Check for suspicious device characteristics
  private isSuspiciousDevice(deviceInfo: DeviceInfo): boolean {
    // Check for headless browsers
    if (!deviceInfo.screen || deviceInfo.screen.width === 0 || deviceInfo.screen.height === 0) {
      return true;
    }

    // Check for automation tools
    const suspiciousUserAgents = ['selenium', 'phantomjs', 'headless', 'bot', 'crawler'];
    const userAgent = deviceInfo.userAgent.toLowerCase();
    if (suspiciousUserAgents.some(ua => userAgent.includes(ua))) {
      return true;
    }

    return false;
  }

  // Check location consistency
  private async checkLocationConsistency(userId: string, location: LocationInfo): Promise<number> {
    try {
      // Get user's location history
      const locationHistory = await CacheService.get(`location_history:${userId}`) || [];
      
      if (locationHistory.length === 0) {
        // First login, assume consistent
        return 0.8;
      }

      // Check if current location is similar to recent locations
      const recentLocations = locationHistory.slice(-10); // Last 10 locations
      let consistencyScore = 0;

      for (const prevLocation of recentLocations) {
        if (prevLocation.country === location.country) {
          consistencyScore += 0.5;
          if (prevLocation.region === location.region) {
            consistencyScore += 0.3;
            if (prevLocation.city === location.city) {
              consistencyScore += 0.2;
            }
          }
        }
      }

      return Math.min(consistencyScore / recentLocations.length, 1.0);

    } catch (error) {
      logger.error('Location consistency check failed', { error, userId });
      return 0.5; // Default to medium consistency
    }
  }

  // Analyze login patterns
  private async analyzeLoginPattern(userId: string, timestamp: Date): Promise<{ isAnomalous: boolean; riskScore: number }> {
    try {
      const loginHistory = await CacheService.get(`login_history:${userId}`) || [];
      
      if (loginHistory.length < 5) {
        return { isAnomalous: false, riskScore: 0.2 };
      }

      const hour = timestamp.getHours();
      const dayOfWeek = timestamp.getDay();

      // Analyze typical login hours
      const typicalHours = loginHistory.map((login: any) => new Date(login.timestamp).getHours());
      const hourFrequency = typicalHours.reduce((acc: any, h: number) => {
        acc[h] = (acc[h] || 0) + 1;
        return acc;
      }, {});

      const currentHourFreq = hourFrequency[hour] || 0;
      const maxFreq = Math.max(...Object.values(hourFrequency) as number[]);
      const hourScore = 1 - (currentHourFreq / maxFreq);

      // Analyze typical days
      const typicalDays = loginHistory.map((login: any) => new Date(login.timestamp).getDay());
      const dayFrequency = typicalDays.reduce((acc: any, d: number) => {
        acc[d] = (acc[d] || 0) + 1;
        return acc;
      }, {});

      const currentDayFreq = dayFrequency[dayOfWeek] || 0;
      const maxDayFreq = Math.max(...Object.values(dayFrequency) as number[]);
      const dayScore = 1 - (currentDayFreq / maxDayFreq);

      const riskScore = (hourScore + dayScore) / 2;
      const isAnomalous = riskScore > 0.6;

      return { isAnomalous, riskScore };

    } catch (error) {
      logger.error('Login pattern analysis failed', { error, userId });
      return { isAnomalous: false, riskScore: 0.5 };
    }
  }

  // Analyze session behavior
  private async analyzeSessionBehavior(userId: string): Promise<{ isAnomalous: boolean; riskScore: number }> {
    // Placeholder for session behavior analysis
    // In a real implementation, this would analyze:
    // - Session duration patterns
    // - Activity patterns within sessions
    // - Navigation patterns
    // - API usage patterns
    
    return { isAnomalous: false, riskScore: 0.2 };
  }

  // Check for rapid successive attempts
  private async checkRapidAttempts(userId: string, ip: string): Promise<{ detected: boolean; count: number }> {
    try {
      const key = `rapid_attempts:${userId}:${ip}`;
      const attempts = await CacheService.get(key) || [];
      
      const now = Date.now();
      const recentAttempts = attempts.filter((attempt: number) => now - attempt < 300000); // 5 minutes
      
      // Update attempts
      recentAttempts.push(now);
      await CacheService.set(key, recentAttempts, 300); // 5 minutes

      return {
        detected: recentAttempts.length > 5,
        count: recentAttempts.length,
      };

    } catch (error) {
      logger.error('Rapid attempts check failed', { error, userId, ip });
      return { detected: false, count: 0 };
    }
  }

  // Get user weekend pattern
  private async getUserWeekendPattern(userId: string): Promise<{ usuallyAccessesWeekends: boolean }> {
    try {
      const loginHistory = await CacheService.get(`login_history:${userId}`) || [];
      
      if (loginHistory.length < 10) {
        return { usuallyAccessesWeekends: true }; // Assume yes for new users
      }

      const weekendLogins = loginHistory.filter((login: any) => {
        const day = new Date(login.timestamp).getDay();
        return day === 0 || day === 6; // Sunday or Saturday
      });

      const weekendRatio = weekendLogins.length / loginHistory.length;
      
      return { usuallyAccessesWeekends: weekendRatio > 0.1 }; // 10% threshold

    } catch (error) {
      logger.error('Weekend pattern analysis failed', { error, userId });
      return { usuallyAccessesWeekends: true };
    }
  }

  // Generate device name
  private generateDeviceName(deviceInfo: DeviceInfo): string {
    const browser = deviceInfo.browser.name || 'Unknown Browser';
    const os = deviceInfo.os.name || 'Unknown OS';
    const device = deviceInfo.device.type || 'Desktop';
    
    return `${browser} on ${os} (${device})`;
  }

  // Get risk level from score
  private getRiskLevel(score: number): RiskAssessment['level'] {
    if (score >= config.zeroTrust.riskAssessment.highRiskThreshold) {
      return 'critical';
    } else if (score >= config.zeroTrust.riskAssessment.mediumRiskThreshold) {
      return 'high';
    } else if (score >= 0.3) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  // Generate recommendations
  private generateRecommendations(factors: any[], level: RiskAssessment['level']): string[] {
    const recommendations: string[] = [];

    if (level === 'critical') {
      recommendations.push('Deny access immediately');
      recommendations.push('Require administrator approval');
    } else if (level === 'high') {
      recommendations.push('Require additional authentication');
      recommendations.push('Limit session duration');
      recommendations.push('Monitor user activity closely');
    } else if (level === 'medium') {
      recommendations.push('Require MFA verification');
      recommendations.push('Send security notification');
    }

    // Factor-specific recommendations
    factors.forEach(factor => {
      switch (factor.factor) {
        case 'unregistered_device':
          recommendations.push('Register device before allowing access');
          break;
        case 'blocked_country':
          recommendations.push('Block access from this location');
          break;
        case 'vpn_proxy_usage':
          recommendations.push('Verify legitimate VPN usage');
          break;
        case 'rapid_attempts':
          recommendations.push('Implement rate limiting');
          break;
      }
    });

    return [...new Set(recommendations)]; // Remove duplicates
  }

  // Parse device information from request
  parseDeviceInfo(userAgent: string, additionalInfo?: any): DeviceInfo {
    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    return {
      deviceId: this.generateDeviceFingerprint(userAgent, additionalInfo),
      fingerprint: this.generateDeviceFingerprint(userAgent, additionalInfo),
      userAgent,
      browser: {
        name: result.browser.name,
        version: result.browser.version,
      },
      os: {
        name: result.os.name,
        version: result.os.version,
      },
      device: {
        type: result.device.type,
        model: result.device.model,
        vendor: result.device.vendor,
      },
      screen: additionalInfo?.screen,
      timezone: additionalInfo?.timezone,
      language: additionalInfo?.language,
      platform: result.os.name,
    };
  }

  // Parse location information from IP
  parseLocationInfo(ip: string): LocationInfo {
    const geo = geoip.lookup(ip);
    
    return {
      ip,
      country: geo?.country,
      region: geo?.region,
      city: geo?.city,
      latitude: geo?.ll?.[0],
      longitude: geo?.ll?.[1],
      timezone: geo?.timezone,
      // Note: VPN/Tor detection would require additional services
      isVPN: false,
      isTor: false,
    };
  }

  // Generate device fingerprint
  private generateDeviceFingerprint(userAgent: string, additionalInfo?: any): string {
    const data = [
      userAgent,
      additionalInfo?.screen?.width,
      additionalInfo?.screen?.height,
      additionalInfo?.screen?.colorDepth,
      additionalInfo?.timezone,
      additionalInfo?.language,
      additionalInfo?.platform,
    ].filter(Boolean).join('|');

    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Health check
  isHealthy(): boolean {
    return config.zeroTrust.enabled;
  }

  // Get user devices
  async getUserDevices(userId: string): Promise<DeviceRegistration[]> {
    try {
      const pattern = `device:${userId}:*`;
      const keys = await CacheService.keys(pattern);
      const devices: DeviceRegistration[] = [];

      for (const key of keys) {
        const device = await CacheService.get(key);
        if (device) {
          devices.push(device);
        }
      }

      return devices.sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime());

    } catch (error) {
      logger.error('Failed to get user devices', { error, userId });
      return [];
    }
  }

  // Remove device
  async removeDevice(userId: string, deviceId: string): Promise<void> {
    try {
      await CacheService.del(`device:${userId}:${deviceId}`);

      // Log device removal
      await AuditLogModel.create({
        entityType: 'User',
        entityId: userId,
        action: 'DELETE',
        userId,
        metadata: {
          action: 'device_removal',
          deviceId,
        },
      });

      logger.info('Device removed', { userId, deviceId });

    } catch (error) {
      logger.error('Device removal failed', { error, userId, deviceId });
      throw error;
    }
  }
}