import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';
import { UserModel } from '../models/User';
import { LoginAttemptModel } from '../models/LoginAttempt';
import { AuditLogModel } from '../models/AuditLog';
import { CacheService } from './cache';
import { MFAService } from '../auth/MFAService';
import { ZeroTrustService, TrustContext, DeviceInfo, LocationInfo } from '../auth/ZeroTrustService';
import { Office365AuthService } from '../auth/Office365AuthService';
import { generateId } from '@trade-marketing/shared';

export interface AuthenticationRequest {
  email: string;
  password?: string;
  mfaToken?: string;
  mfaChallengeId?: string;
  deviceInfo?: DeviceInfo;
  ipAddress?: string;
  userAgent?: string;
  authMethod: 'password' | 'office365' | 'saml' | 'oauth';
  office365Code?: string;
  rememberDevice?: boolean;
}

export interface AuthenticationResult {
  success: boolean;
  user?: any;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  requiresMFA?: boolean;
  mfaChallenge?: any;
  riskAssessment?: any;
  sessionId?: string;
  error?: string;
}

export interface SecurityContext {
  userId: string;
  sessionId: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
  riskScore?: number;
  trustLevel?: string;
  lastActivity?: Date;
}

export class SecurityService {
  private mfaService: MFAService;
  private zeroTrustService: ZeroTrustService;
  private office365Service: Office365AuthService;

  constructor() {
    this.mfaService = new MFAService();
    this.zeroTrustService = new ZeroTrustService();
    this.office365Service = new Office365AuthService();
  }

  // Main authentication method
  async authenticate(request: AuthenticationRequest): Promise<AuthenticationResult> {
    const startTime = Date.now();
    
    try {
      // Log authentication attempt
      await this.logAuthenticationAttempt(request, false);

      // Check rate limiting
      const rateLimitCheck = await this.checkRateLimit(request.email, request.ipAddress);
      if (!rateLimitCheck.allowed) {
        return {
          success: false,
          error: 'Too many authentication attempts. Please try again later.',
        };
      }

      // Perform authentication based on method
      let authResult: AuthenticationResult;
      
      switch (request.authMethod) {
        case 'password':
          authResult = await this.authenticateWithPassword(request);
          break;
        case 'office365':
          authResult = await this.authenticateWithOffice365(request);
          break;
        case 'saml':
          authResult = await this.authenticateWithSAML(request);
          break;
        case 'oauth':
          authResult = await this.authenticateWithOAuth(request);
          break;
        default:
          return {
            success: false,
            error: 'Unsupported authentication method',
          };
      }

      if (!authResult.success || !authResult.user) {
        await this.logAuthenticationAttempt(request, false, authResult.error);
        return authResult;
      }

      // Perform zero trust risk assessment
      if (config.zeroTrust.enabled && request.deviceInfo && request.ipAddress) {
        const trustContext: TrustContext = {
          userId: authResult.user.id,
          sessionId: generateId(),
          deviceInfo: request.deviceInfo,
          locationInfo: this.zeroTrustService.parseLocationInfo(request.ipAddress),
          timestamp: new Date(),
        };

        const riskAssessment = await this.zeroTrustService.assessRisk(trustContext);
        authResult.riskAssessment = riskAssessment;

        // Block high-risk attempts
        if (!riskAssessment.allowAccess) {
          await this.logAuthenticationAttempt(request, false, 'High risk assessment');
          return {
            success: false,
            error: 'Access denied due to security policy',
          };
        }

        // Require additional authentication for medium/high risk
        if (riskAssessment.requiresAdditionalAuth && !request.mfaToken) {
          const mfaChallenge = await this.mfaService.createMFAChallenge(authResult.user.id);
          return {
            success: false,
            requiresMFA: true,
            mfaChallenge,
            riskAssessment,
          };
        }
      }

      // Handle MFA if required
      if (authResult.user.twoFactorEnabled && !request.mfaToken) {
        const mfaChallenge = await this.mfaService.createMFAChallenge(authResult.user.id);
        return {
          success: false,
          requiresMFA: true,
          mfaChallenge,
        };
      }

      // Verify MFA if provided
      if (request.mfaToken) {
        const mfaResult = await this.verifyMFA(authResult.user.id, request.mfaToken, request.mfaChallengeId);
        if (!mfaResult.success) {
          return {
            success: false,
            error: 'Invalid MFA token',
          };
        }
      }

      // Generate session tokens
      const sessionId = generateId();
      const { accessToken, refreshToken, expiresAt } = await this.generateTokens(
        authResult.user,
        sessionId,
        request.deviceInfo?.deviceId
      );

      // Create security context
      const securityContext: SecurityContext = {
        userId: authResult.user.id,
        sessionId,
        deviceId: request.deviceInfo?.deviceId,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        riskScore: authResult.riskAssessment?.score,
        trustLevel: authResult.riskAssessment?.level,
        lastActivity: new Date(),
      };

      // Store session
      await this.createSession(securityContext, accessToken, refreshToken, expiresAt);

      // Register device if requested
      if (request.rememberDevice && request.deviceInfo) {
        await this.zeroTrustService.registerDevice(
          authResult.user.id,
          request.deviceInfo,
          authResult.riskAssessment?.level === 'low'
        );
      }

      // Log successful authentication
      await this.logAuthenticationAttempt(request, true);
      
      const duration = Date.now() - startTime;
      logger.info('Authentication successful', {
        userId: authResult.user.id,
        email: request.email,
        method: request.authMethod,
        duration: `${duration}ms`,
        riskScore: authResult.riskAssessment?.score,
      });

      return {
        success: true,
        user: this.sanitizeUser(authResult.user),
        accessToken,
        refreshToken,
        expiresAt,
        sessionId,
        riskAssessment: authResult.riskAssessment,
      };

    } catch (error) {
      logger.error('Authentication failed', { error, email: request.email });
      await this.logAuthenticationAttempt(request, false, error.message);
      
      return {
        success: false,
        error: 'Authentication failed',
      };
    }
  }

  // Authenticate with password
  private async authenticateWithPassword(request: AuthenticationRequest): Promise<AuthenticationResult> {
    if (!request.password) {
      return {
        success: false,
        error: 'Password is required',
      };
    }

    const user = await UserModel.findByEmail(request.email);
    if (!user) {
      return {
        success: false,
        error: 'Invalid credentials',
      };
    }

    // Check if account is locked
    if (user.status === 'LOCKED') {
      return {
        success: false,
        error: 'Account is locked',
      };
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(request.password, user.id);
    if (!isValidPassword) {
      await this.handleFailedLogin(user.id, request.ipAddress);
      return {
        success: false,
        error: 'Invalid credentials',
      };
    }

    // Update last login
    await UserModel.update(user.id, {
      lastLoginAt: new Date(),
      lastLoginIp: request.ipAddress,
    });

    return {
      success: true,
      user,
    };
  }

  // Authenticate with Office 365
  private async authenticateWithOffice365(request: AuthenticationRequest): Promise<AuthenticationResult> {
    if (!request.office365Code) {
      return {
        success: false,
        error: 'Office 365 authorization code is required',
      };
    }

    try {
      const authResult = await this.office365Service.exchangeCodeForTokens(request.office365Code);
      const user = await this.office365Service.authenticateUser(
        authResult,
        request.ipAddress,
        request.userAgent
      );

      return {
        success: true,
        user,
      };

    } catch (error) {
      logger.error('Office 365 authentication failed', { error });
      return {
        success: false,
        error: 'Office 365 authentication failed',
      };
    }
  }

  // Authenticate with SAML
  private async authenticateWithSAML(request: AuthenticationRequest): Promise<AuthenticationResult> {
    // SAML authentication implementation
    // This would integrate with SAML identity providers
    return {
      success: false,
      error: 'SAML authentication not implemented',
    };
  }

  // Authenticate with OAuth
  private async authenticateWithOAuth(request: AuthenticationRequest): Promise<AuthenticationResult> {
    // OAuth authentication implementation
    // This would integrate with OAuth providers (Google, etc.)
    return {
      success: false,
      error: 'OAuth authentication not implemented',
    };
  }

  // Verify MFA token
  private async verifyMFA(userId: string, token: string, challengeId?: string): Promise<{ success: boolean }> {
    try {
      // Try TOTP first
      const totpResult = await this.mfaService.verifyTOTP(userId, token);
      if (totpResult.success) {
        return { success: true };
      }

      // Try backup code
      const backupResult = await this.mfaService.verifyBackupCode(userId, token);
      if (backupResult.success) {
        return { success: true };
      }

      // Try SMS/Email if challenge ID provided
      if (challengeId) {
        const smsResult = await this.mfaService.verifySMSCode(challengeId, token);
        if (smsResult.success) {
          return { success: true };
        }

        const emailResult = await this.mfaService.verifyEmailCode(challengeId, token);
        if (emailResult.success) {
          return { success: true };
        }
      }

      return { success: false };

    } catch (error) {
      logger.error('MFA verification failed', { error, userId });
      return { success: false };
    }
  }

  // Generate JWT tokens
  private async generateTokens(user: any, sessionId: string, deviceId?: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

    const payload = {
      sub: user.id,
      email: user.email,
      sessionId,
      deviceId,
      iat: Math.floor(now.getTime() / 1000),
      exp: Math.floor(expiresAt.getTime() / 1000),
      iss: config.jwt.issuer,
      aud: config.jwt.audience,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      algorithm: 'HS256',
    });

    const refreshPayload = {
      sub: user.id,
      sessionId,
      type: 'refresh',
      iat: Math.floor(now.getTime() / 1000),
      exp: Math.floor((now.getTime() + 7 * 24 * 60 * 60 * 1000) / 1000), // 7 days
    };

    const refreshToken = jwt.sign(refreshPayload, config.jwt.secret, {
      algorithm: 'HS256',
    });

    return { accessToken, refreshToken, expiresAt };
  }

  // Create session
  private async createSession(
    context: SecurityContext,
    accessToken: string,
    refreshToken: string,
    expiresAt: Date
  ): Promise<void> {
    const session = {
      ...context,
      accessToken,
      refreshToken,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
    };

    // Store in cache
    await CacheService.set(`session:${context.sessionId}`, session, 7 * 24 * 3600); // 7 days

    // Store user session mapping
    const userSessions = await CacheService.get(`user_sessions:${context.userId}`) || [];
    userSessions.push(context.sessionId);
    
    // Limit concurrent sessions
    if (userSessions.length > config.session.maxConcurrentSessions) {
      const oldestSession = userSessions.shift();
      await CacheService.del(`session:${oldestSession}`);
    }
    
    await CacheService.set(`user_sessions:${context.userId}`, userSessions, 7 * 24 * 3600);
  }

  // Verify password
  private async verifyPassword(password: string, userId: string): Promise<boolean> {
    try {
      const userPassword = await UserModel.getActivePassword(userId);
      if (!userPassword) {
        return false;
      }

      return await bcrypt.compare(password, userPassword.passwordHash);

    } catch (error) {
      logger.error('Password verification failed', { error, userId });
      return false;
    }
  }

  // Handle failed login
  private async handleFailedLogin(userId: string, ipAddress?: string): Promise<void> {
    try {
      const attempts = await this.getFailedLoginAttempts(userId, ipAddress);
      
      if (attempts >= config.security.maxLoginAttempts) {
        // Lock account
        await UserModel.update(userId, {
          status: 'LOCKED',
        });

        // Log account lock
        await AuditLogModel.create({
          entityType: 'User',
          entityId: userId,
          action: 'UPDATE',
          userId,
          ipAddress,
          metadata: {
            action: 'account_locked',
            reason: 'max_login_attempts_exceeded',
            attempts,
          },
        });

        logger.warn('Account locked due to failed login attempts', {
          userId,
          attempts,
          ipAddress,
        });
      }

    } catch (error) {
      logger.error('Failed to handle failed login', { error, userId });
    }
  }

  // Get failed login attempts
  private async getFailedLoginAttempts(userId: string, ipAddress?: string): Promise<number> {
    try {
      const since = new Date(Date.now() - config.security.lockoutDurationMinutes * 60 * 1000);
      
      return await LoginAttemptModel.countFailedAttempts(userId, ipAddress, since);

    } catch (error) {
      logger.error('Failed to get login attempts', { error, userId });
      return 0;
    }
  }

  // Check rate limiting
  private async checkRateLimit(email: string, ipAddress?: string): Promise<{ allowed: boolean; remaining: number }> {
    try {
      const key = `rate_limit:auth:${email}:${ipAddress}`;
      const attempts = await CacheService.get(key) || 0;
      
      if (attempts >= 10) { // 10 attempts per 15 minutes
        return { allowed: false, remaining: 0 };
      }

      await CacheService.set(key, attempts + 1, 900); // 15 minutes
      
      return { allowed: true, remaining: 10 - attempts - 1 };

    } catch (error) {
      logger.error('Rate limit check failed', { error, email });
      return { allowed: true, remaining: 10 };
    }
  }

  // Log authentication attempt
  private async logAuthenticationAttempt(
    request: AuthenticationRequest,
    success: boolean,
    failureReason?: string
  ): Promise<void> {
    try {
      await LoginAttemptModel.create({
        id: generateId(),
        email: request.email,
        ipAddress: request.ipAddress || '',
        userAgent: request.userAgent,
        success,
        failureReason,
        deviceInfo: request.deviceInfo ? {
          deviceId: request.deviceInfo.deviceId,
          browser: request.deviceInfo.browser,
          os: request.deviceInfo.os,
        } : undefined,
      });

    } catch (error) {
      logger.error('Failed to log authentication attempt', { error });
    }
  }

  // Sanitize user data for response
  private sanitizeUser(user: any): any {
    const { twoFactorSecret, metadata, ...sanitized } = user;
    return {
      ...sanitized,
      metadata: {
        ...metadata,
        backupCodes: undefined, // Never expose backup codes
      },
    };
  }

  // Refresh access token
  async refreshToken(refreshToken: string): Promise<AuthenticationResult> {
    try {
      const decoded = jwt.verify(refreshToken, config.jwt.secret) as any;
      
      if (decoded.type !== 'refresh') {
        return {
          success: false,
          error: 'Invalid refresh token',
        };
      }

      const session = await CacheService.get(`session:${decoded.sessionId}`);
      if (!session || session.refreshToken !== refreshToken) {
        return {
          success: false,
          error: 'Invalid session',
        };
      }

      const user = await UserModel.findById(decoded.sub);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      // Generate new tokens
      const { accessToken, refreshToken: newRefreshToken, expiresAt } = await this.generateTokens(
        user,
        decoded.sessionId,
        session.deviceId
      );

      // Update session
      session.accessToken = accessToken;
      session.refreshToken = newRefreshToken;
      session.expiresAt = expiresAt.toISOString();
      session.lastActivity = new Date().toISOString();

      await CacheService.set(`session:${decoded.sessionId}`, session, 7 * 24 * 3600);

      return {
        success: true,
        user: this.sanitizeUser(user),
        accessToken,
        refreshToken: newRefreshToken,
        expiresAt,
        sessionId: decoded.sessionId,
      };

    } catch (error) {
      logger.error('Token refresh failed', { error });
      return {
        success: false,
        error: 'Token refresh failed',
      };
    }
  }

  // Logout
  async logout(sessionId: string, userId?: string): Promise<void> {
    try {
      // Remove session
      await CacheService.del(`session:${sessionId}`);

      // Remove from user sessions
      if (userId) {
        const userSessions = await CacheService.get(`user_sessions:${userId}`) || [];
        const updatedSessions = userSessions.filter((id: string) => id !== sessionId);
        await CacheService.set(`user_sessions:${userId}`, updatedSessions, 7 * 24 * 3600);

        // Log logout
        await AuditLogModel.create({
          entityType: 'User',
          entityId: userId,
          action: 'LOGOUT',
          userId,
          metadata: {
            sessionId,
          },
        });
      }

      logger.info('User logged out', { sessionId, userId });

    } catch (error) {
      logger.error('Logout failed', { error, sessionId, userId });
    }
  }

  // Validate session
  async validateSession(sessionId: string): Promise<{ valid: boolean; user?: any; context?: SecurityContext }> {
    try {
      const session = await CacheService.get(`session:${sessionId}`);
      if (!session) {
        return { valid: false };
      }

      // Check expiration
      const expiresAt = new Date(session.expiresAt);
      if (expiresAt < new Date()) {
        await CacheService.del(`session:${sessionId}`);
        return { valid: false };
      }

      // Get user
      const user = await UserModel.findById(session.userId);
      if (!user || user.status !== 'ACTIVE') {
        return { valid: false };
      }

      // Update last activity
      session.lastActivity = new Date().toISOString();
      await CacheService.set(`session:${sessionId}`, session, 7 * 24 * 3600);

      return {
        valid: true,
        user: this.sanitizeUser(user),
        context: {
          userId: session.userId,
          sessionId,
          deviceId: session.deviceId,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          riskScore: session.riskScore,
          trustLevel: session.trustLevel,
          lastActivity: new Date(session.lastActivity),
        },
      };

    } catch (error) {
      logger.error('Session validation failed', { error, sessionId });
      return { valid: false };
    }
  }

  // Get security dashboard data
  async getSecurityDashboard(userId: string): Promise<any> {
    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get active sessions
      const userSessions = await CacheService.get(`user_sessions:${userId}`) || [];
      const sessions = [];
      
      for (const sessionId of userSessions) {
        const session = await CacheService.get(`session:${sessionId}`);
        if (session) {
          sessions.push({
            sessionId,
            deviceId: session.deviceId,
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
            lastActivity: session.lastActivity,
            riskScore: session.riskScore,
            trustLevel: session.trustLevel,
          });
        }
      }

      // Get registered devices
      const devices = await this.zeroTrustService.getUserDevices(userId);

      // Get recent login attempts
      const recentAttempts = await LoginAttemptModel.getRecentAttempts(userId, 30); // Last 30 days

      // Get MFA status
      const mfaStatus = await this.mfaService.getMFAStatus(userId);

      return {
        user: {
          id: user.id,
          email: user.email,
          twoFactorEnabled: user.twoFactorEnabled,
          lastLoginAt: user.lastLoginAt,
          lastLoginIp: user.lastLoginIp,
        },
        sessions,
        devices,
        recentAttempts,
        mfaStatus,
        securityScore: this.calculateSecurityScore(user, mfaStatus, devices.length),
      };

    } catch (error) {
      logger.error('Failed to get security dashboard', { error, userId });
      throw error;
    }
  }

  // Calculate security score
  private calculateSecurityScore(user: any, mfaStatus: any, deviceCount: number): number {
    let score = 0;

    // MFA enabled
    if (mfaStatus.enabled) score += 30;

    // Strong password (if we track password strength)
    score += 20;

    // Email verified
    if (user.emailVerified) score += 15;

    // Phone verified
    if (user.phoneVerified) score += 10;

    // Recent login activity
    if (user.lastLoginAt && new Date(user.lastLoginAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
      score += 10;
    }

    // Reasonable number of devices
    if (deviceCount <= 3) score += 10;
    else if (deviceCount <= 5) score += 5;

    // Account not locked
    if (user.status === 'ACTIVE') score += 5;

    return Math.min(score, 100);
  }

  // Health check
  isHealthy(): boolean {
    return this.mfaService.isHealthy() && this.zeroTrustService.isHealthy();
  }
}