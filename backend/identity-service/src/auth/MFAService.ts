import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';
import { UserModel } from '../models/User';
import { AuditLogModel } from '../models/AuditLog';
import { CacheService } from '../services/cache';
import { EmailService } from '../services/email';
import { generateId } from '@trade-marketing/shared';

export interface MFASetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  manualEntryKey: string;
}

export interface MFAVerificationResult {
  success: boolean;
  method: 'totp' | 'backup_code' | 'sms' | 'email';
  remainingBackupCodes?: number;
}

export interface MFAChallenge {
  challengeId: string;
  methods: Array<{
    type: 'totp' | 'sms' | 'email' | 'backup_code';
    masked?: string; // e.g., "***-***-1234" for phone
    enabled: boolean;
  }>;
  expiresAt: Date;
}

export class MFAService {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  // Setup TOTP (Time-based One-Time Password) for user
  async setupTOTP(userId: string, userEmail: string): Promise<MFASetupResult> {
    try {
      // Generate secret
      const secret = speakeasy.generateSecret({
        name: userEmail,
        issuer: config.mfa.issuer,
        length: 32,
      });

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

      // Store encrypted secret and backup codes
      await this.storeMFASecret(userId, secret.base32, backupCodes);

      // Log MFA setup
      await AuditLogModel.create({
        entityType: 'User',
        entityId: userId,
        action: 'UPDATE',
        userId,
        metadata: {
          action: 'mfa_setup',
          method: 'totp',
        },
      });

      logger.info('TOTP MFA setup completed', { userId });

      return {
        secret: secret.base32,
        qrCodeUrl,
        backupCodes,
        manualEntryKey: secret.base32,
      };

    } catch (error) {
      logger.error('TOTP MFA setup failed', { error, userId });
      throw new Error('Failed to setup MFA');
    }
  }

  // Verify TOTP token
  async verifyTOTP(userId: string, token: string): Promise<MFAVerificationResult> {
    try {
      const user = await UserModel.findById(userId);
      if (!user || !user.twoFactorSecret) {
        throw new Error('MFA not configured for user');
      }

      // Decrypt secret
      const secret = this.decryptSecret(user.twoFactorSecret);

      // Verify token
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: config.mfa.window,
        step: config.mfa.step,
      });

      if (verified) {
        // Log successful verification
        await AuditLogModel.create({
          entityType: 'User',
          entityId: userId,
          action: 'ACCESS',
          userId,
          metadata: {
            action: 'mfa_verify',
            method: 'totp',
            success: true,
          },
        });

        return {
          success: true,
          method: 'totp',
        };
      } else {
        // Log failed verification
        await AuditLogModel.create({
          entityType: 'User',
          entityId: userId,
          action: 'ACCESS',
          userId,
          metadata: {
            action: 'mfa_verify',
            method: 'totp',
            success: false,
          },
        });

        return {
          success: false,
          method: 'totp',
        };
      }

    } catch (error) {
      logger.error('TOTP verification failed', { error, userId });
      return {
        success: false,
        method: 'totp',
      };
    }
  }

  // Verify backup code
  async verifyBackupCode(userId: string, code: string): Promise<MFAVerificationResult> {
    try {
      const user = await UserModel.findById(userId);
      if (!user || !user.metadata?.backupCodes) {
        throw new Error('Backup codes not configured for user');
      }

      const backupCodes = user.metadata.backupCodes as string[];
      const hashedCode = this.hashBackupCode(code);

      const codeIndex = backupCodes.findIndex(bc => bc === hashedCode);
      
      if (codeIndex !== -1) {
        // Remove used backup code
        backupCodes.splice(codeIndex, 1);
        
        await UserModel.update(userId, {
          metadata: {
            ...user.metadata,
            backupCodes,
          },
        });

        // Log successful verification
        await AuditLogModel.create({
          entityType: 'User',
          entityId: userId,
          action: 'ACCESS',
          userId,
          metadata: {
            action: 'mfa_verify',
            method: 'backup_code',
            success: true,
            remainingCodes: backupCodes.length,
          },
        });

        // Warn if running low on backup codes
        if (backupCodes.length <= 2) {
          await this.sendLowBackupCodesWarning(userId);
        }

        return {
          success: true,
          method: 'backup_code',
          remainingBackupCodes: backupCodes.length,
        };
      } else {
        // Log failed verification
        await AuditLogModel.create({
          entityType: 'User',
          entityId: userId,
          action: 'ACCESS',
          userId,
          metadata: {
            action: 'mfa_verify',
            method: 'backup_code',
            success: false,
          },
        });

        return {
          success: false,
          method: 'backup_code',
        };
      }

    } catch (error) {
      logger.error('Backup code verification failed', { error, userId });
      return {
        success: false,
        method: 'backup_code',
      };
    }
  }

  // Send SMS challenge
  async sendSMSChallenge(userId: string, phoneNumber: string): Promise<string> {
    try {
      const challengeId = generateId();
      const code = this.generateSMSCode();

      // Store challenge in cache
      await CacheService.set(
        `mfa:sms:${challengeId}`,
        {
          userId,
          code: this.hashSMSCode(code),
          phoneNumber,
          attempts: 0,
        },
        300 // 5 minutes
      );

      // Send SMS (integrate with SMS provider)
      await this.sendSMS(phoneNumber, `Your verification code is: ${code}`);

      // Log SMS challenge
      await AuditLogModel.create({
        entityType: 'User',
        entityId: userId,
        action: 'ACCESS',
        userId,
        metadata: {
          action: 'mfa_challenge',
          method: 'sms',
          phoneNumber: this.maskPhoneNumber(phoneNumber),
        },
      });

      logger.info('SMS MFA challenge sent', { userId, challengeId });

      return challengeId;

    } catch (error) {
      logger.error('SMS MFA challenge failed', { error, userId });
      throw new Error('Failed to send SMS challenge');
    }
  }

  // Verify SMS code
  async verifySMSCode(challengeId: string, code: string): Promise<MFAVerificationResult> {
    try {
      const challenge = await CacheService.get(`mfa:sms:${challengeId}`);
      if (!challenge) {
        return {
          success: false,
          method: 'sms',
        };
      }

      // Check attempts
      if (challenge.attempts >= 3) {
        await CacheService.del(`mfa:sms:${challengeId}`);
        return {
          success: false,
          method: 'sms',
        };
      }

      // Verify code
      const hashedCode = this.hashSMSCode(code);
      if (hashedCode === challenge.code) {
        // Clean up challenge
        await CacheService.del(`mfa:sms:${challengeId}`);

        // Log successful verification
        await AuditLogModel.create({
          entityType: 'User',
          entityId: challenge.userId,
          action: 'ACCESS',
          userId: challenge.userId,
          metadata: {
            action: 'mfa_verify',
            method: 'sms',
            success: true,
          },
        });

        return {
          success: true,
          method: 'sms',
        };
      } else {
        // Increment attempts
        challenge.attempts++;
        await CacheService.set(`mfa:sms:${challengeId}`, challenge, 300);

        // Log failed verification
        await AuditLogModel.create({
          entityType: 'User',
          entityId: challenge.userId,
          action: 'ACCESS',
          userId: challenge.userId,
          metadata: {
            action: 'mfa_verify',
            method: 'sms',
            success: false,
            attempts: challenge.attempts,
          },
        });

        return {
          success: false,
          method: 'sms',
        };
      }

    } catch (error) {
      logger.error('SMS code verification failed', { error, challengeId });
      return {
        success: false,
        method: 'sms',
      };
    }
  }

  // Send email challenge
  async sendEmailChallenge(userId: string, email: string): Promise<string> {
    try {
      const challengeId = generateId();
      const code = this.generateEmailCode();

      // Store challenge in cache
      await CacheService.set(
        `mfa:email:${challengeId}`,
        {
          userId,
          code: this.hashEmailCode(code),
          email,
          attempts: 0,
        },
        300 // 5 minutes
      );

      // Send email
      await this.emailService.sendMFACode(email, code);

      // Log email challenge
      await AuditLogModel.create({
        entityType: 'User',
        entityId: userId,
        action: 'ACCESS',
        userId,
        metadata: {
          action: 'mfa_challenge',
          method: 'email',
          email: this.maskEmail(email),
        },
      });

      logger.info('Email MFA challenge sent', { userId, challengeId });

      return challengeId;

    } catch (error) {
      logger.error('Email MFA challenge failed', { error, userId });
      throw new Error('Failed to send email challenge');
    }
  }

  // Verify email code
  async verifyEmailCode(challengeId: string, code: string): Promise<MFAVerificationResult> {
    try {
      const challenge = await CacheService.get(`mfa:email:${challengeId}`);
      if (!challenge) {
        return {
          success: false,
          method: 'email',
        };
      }

      // Check attempts
      if (challenge.attempts >= 3) {
        await CacheService.del(`mfa:email:${challengeId}`);
        return {
          success: false,
          method: 'email',
        };
      }

      // Verify code
      const hashedCode = this.hashEmailCode(code);
      if (hashedCode === challenge.code) {
        // Clean up challenge
        await CacheService.del(`mfa:email:${challengeId}`);

        // Log successful verification
        await AuditLogModel.create({
          entityType: 'User',
          entityId: challenge.userId,
          action: 'ACCESS',
          userId: challenge.userId,
          metadata: {
            action: 'mfa_verify',
            method: 'email',
            success: true,
          },
        });

        return {
          success: true,
          method: 'email',
        };
      } else {
        // Increment attempts
        challenge.attempts++;
        await CacheService.set(`mfa:email:${challengeId}`, challenge, 300);

        // Log failed verification
        await AuditLogModel.create({
          entityType: 'User',
          entityId: challenge.userId,
          action: 'ACCESS',
          userId: challenge.userId,
          metadata: {
            action: 'mfa_verify',
            method: 'email',
            success: false,
            attempts: challenge.attempts,
          },
        });

        return {
          success: false,
          method: 'email',
        };
      }

    } catch (error) {
      logger.error('Email code verification failed', { error, challengeId });
      return {
        success: false,
        method: 'email',
      };
    }
  }

  // Create MFA challenge
  async createMFAChallenge(userId: string): Promise<MFAChallenge> {
    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const challengeId = generateId();
      const methods: MFAChallenge['methods'] = [];

      // TOTP method
      if (user.twoFactorEnabled && user.twoFactorSecret) {
        methods.push({
          type: 'totp',
          enabled: true,
        });
      }

      // Backup codes
      if (user.metadata?.backupCodes && user.metadata.backupCodes.length > 0) {
        methods.push({
          type: 'backup_code',
          enabled: true,
        });
      }

      // SMS method
      if (user.phone && user.phoneVerified) {
        methods.push({
          type: 'sms',
          masked: this.maskPhoneNumber(user.phone),
          enabled: true,
        });
      }

      // Email method
      if (user.email && user.emailVerified) {
        methods.push({
          type: 'email',
          masked: this.maskEmail(user.email),
          enabled: true,
        });
      }

      const challenge: MFAChallenge = {
        challengeId,
        methods,
        expiresAt: new Date(Date.now() + 300000), // 5 minutes
      };

      // Store challenge
      await CacheService.set(`mfa:challenge:${challengeId}`, challenge, 300);

      return challenge;

    } catch (error) {
      logger.error('Failed to create MFA challenge', { error, userId });
      throw error;
    }
  }

  // Disable MFA for user
  async disableMFA(userId: string): Promise<void> {
    try {
      await UserModel.update(userId, {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        metadata: {
          backupCodes: [],
        },
      });

      // Log MFA disable
      await AuditLogModel.create({
        entityType: 'User',
        entityId: userId,
        action: 'UPDATE',
        userId,
        metadata: {
          action: 'mfa_disable',
        },
      });

      logger.info('MFA disabled for user', { userId });

    } catch (error) {
      logger.error('Failed to disable MFA', { error, userId });
      throw error;
    }
  }

  // Generate new backup codes
  async generateNewBackupCodes(userId: string): Promise<string[]> {
    try {
      const backupCodes = this.generateBackupCodes();
      
      await UserModel.update(userId, {
        metadata: {
          backupCodes: backupCodes.map(code => this.hashBackupCode(code)),
        },
      });

      // Log backup codes generation
      await AuditLogModel.create({
        entityType: 'User',
        entityId: userId,
        action: 'UPDATE',
        userId,
        metadata: {
          action: 'mfa_backup_codes_generated',
          count: backupCodes.length,
        },
      });

      return backupCodes;

    } catch (error) {
      logger.error('Failed to generate backup codes', { error, userId });
      throw error;
    }
  }

  // Private helper methods
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < config.mfa.backupCodes.count; i++) {
      codes.push(this.generateRandomCode(config.mfa.backupCodes.length));
    }
    return codes;
  }

  private generateRandomCode(length: number): string {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private generateSMSCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
  }

  private generateEmailCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
  }

  private hashBackupCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private hashSMSCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private hashEmailCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private async storeMFASecret(userId: string, secret: string, backupCodes: string[]): Promise<void> {
    const encryptedSecret = this.encryptSecret(secret);
    const hashedBackupCodes = backupCodes.map(code => this.hashBackupCode(code));

    await UserModel.update(userId, {
      twoFactorEnabled: true,
      twoFactorSecret: encryptedSecret,
      metadata: {
        backupCodes: hashedBackupCodes,
      },
    });
  }

  private encryptSecret(secret: string): string {
    const cipher = crypto.createCipher('aes-256-cbc', config.encryption.masterKey);
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  private decryptSecret(encryptedSecret: string): string {
    const decipher = crypto.createDecipher('aes-256-cbc', config.encryption.masterKey);
    let decrypted = decipher.update(encryptedSecret, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private maskPhoneNumber(phone: string): string {
    if (phone.length <= 4) return phone;
    return phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (local.length <= 2) return email;
    return local.slice(0, 2) + '*'.repeat(local.length - 2) + '@' + domain;
  }

  private async sendSMS(phoneNumber: string, message: string): Promise<void> {
    // Integrate with SMS provider (Twilio, AWS SNS, etc.)
    logger.info('SMS sent', { phoneNumber: this.maskPhoneNumber(phoneNumber), message });
  }

  private async sendLowBackupCodesWarning(userId: string): Promise<void> {
    const user = await UserModel.findById(userId);
    if (user && user.email) {
      await this.emailService.sendLowBackupCodesWarning(user.email);
    }
  }

  // Health check
  isHealthy(): boolean {
    return config.features.twoFactorAuth;
  }

  // Get MFA status for user
  async getMFAStatus(userId: string): Promise<any> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      enabled: user.twoFactorEnabled,
      methods: {
        totp: user.twoFactorEnabled && !!user.twoFactorSecret,
        sms: user.phoneVerified,
        email: user.emailVerified,
        backupCodes: user.metadata?.backupCodes?.length || 0,
      },
    };
  }
}