import express from 'express';
import { body, validationResult } from 'express-validator';
import { SecurityService } from '../services/SecurityService';
import { ZeroTrustService } from '../auth/ZeroTrustService';
import { Office365AuthService } from '../auth/Office365AuthService';
import { logger } from '../utils/logger';
import { config } from '../config';

const router = express.Router();
const securityService = new SecurityService();
const zeroTrustService = new ZeroTrustService();
const office365Service = new Office365AuthService();

// Login with password
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 1 }),
  body('deviceInfo').optional().isObject(),
  body('rememberDevice').optional().isBoolean(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { email, password, deviceInfo, rememberDevice, mfaToken, mfaChallengeId } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    // Parse device info if provided
    let parsedDeviceInfo;
    if (deviceInfo) {
      parsedDeviceInfo = zeroTrustService.parseDeviceInfo(userAgent || '', deviceInfo);
    }

    const authResult = await securityService.authenticate({
      email,
      password,
      mfaToken,
      mfaChallengeId,
      deviceInfo: parsedDeviceInfo,
      ipAddress,
      userAgent,
      authMethod: 'password',
      rememberDevice,
    });

    if (!authResult.success) {
      return res.status(401).json({
        error: authResult.error,
        requiresMFA: authResult.requiresMFA,
        mfaChallenge: authResult.mfaChallenge,
        riskAssessment: authResult.riskAssessment,
      });
    }

    res.json({
      success: true,
      user: authResult.user,
      accessToken: authResult.accessToken,
      refreshToken: authResult.refreshToken,
      expiresAt: authResult.expiresAt,
      sessionId: authResult.sessionId,
      riskAssessment: authResult.riskAssessment,
    });

  } catch (error) {
    logger.error('Login failed', { error, email: req.body.email });
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// Office 365 SSO login initiation
router.get('/office365/login', (req, res) => {
  try {
    if (!config.features.office365Sso) {
      return res.status(404).json({
        error: 'Office 365 SSO is not enabled',
      });
    }

    const state = req.query.state as string;
    const authUrl = office365Service.getAuthUrl(state);

    res.json({
      authUrl,
      clientConfig: office365Service.getClientConfig(),
    });

  } catch (error) {
    logger.error('Office 365 login initiation failed', { error });
    res.status(500).json({
      error: 'Failed to initiate Office 365 login',
    });
  }
});

// Office 365 SSO callback
router.post('/office365/callback', [
  body('code').isLength({ min: 1 }),
  body('state').optional().isString(),
  body('deviceInfo').optional().isObject(),
  body('rememberDevice').optional().isBoolean(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    if (!config.features.office365Sso) {
      return res.status(404).json({
        error: 'Office 365 SSO is not enabled',
      });
    }

    const { code, deviceInfo, rememberDevice } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    // Parse device info if provided
    let parsedDeviceInfo;
    if (deviceInfo) {
      parsedDeviceInfo = zeroTrustService.parseDeviceInfo(userAgent || '', deviceInfo);
    }

    const authResult = await securityService.authenticate({
      email: '', // Will be populated from Office 365
      office365Code: code,
      deviceInfo: parsedDeviceInfo,
      ipAddress,
      userAgent,
      authMethod: 'office365',
      rememberDevice,
    });

    if (!authResult.success) {
      return res.status(401).json({
        error: authResult.error,
        requiresMFA: authResult.requiresMFA,
        mfaChallenge: authResult.mfaChallenge,
        riskAssessment: authResult.riskAssessment,
      });
    }

    res.json({
      success: true,
      user: authResult.user,
      accessToken: authResult.accessToken,
      refreshToken: authResult.refreshToken,
      expiresAt: authResult.expiresAt,
      sessionId: authResult.sessionId,
      riskAssessment: authResult.riskAssessment,
    });

  } catch (error) {
    logger.error('Office 365 callback failed', { error });
    res.status(500).json({
      error: 'Office 365 authentication failed',
    });
  }
});

// Refresh token
router.post('/refresh', [
  body('refreshToken').isLength({ min: 1 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { refreshToken } = req.body;

    const authResult = await securityService.refreshToken(refreshToken);

    if (!authResult.success) {
      return res.status(401).json({
        error: authResult.error,
      });
    }

    res.json({
      success: true,
      user: authResult.user,
      accessToken: authResult.accessToken,
      refreshToken: authResult.refreshToken,
      expiresAt: authResult.expiresAt,
      sessionId: authResult.sessionId,
    });

  } catch (error) {
    logger.error('Token refresh failed', { error });
    res.status(500).json({
      error: 'Token refresh failed',
    });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const sessionId = req.body.sessionId || req.headers['x-session-id'];
    const userId = req.body.userId;

    if (sessionId) {
      await securityService.logout(sessionId, userId);
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });

  } catch (error) {
    logger.error('Logout failed', { error });
    res.status(500).json({
      error: 'Logout failed',
    });
  }
});

// Get authentication methods
router.get('/methods', (req, res) => {
  try {
    const methods = {
      password: true,
      office365: config.features.office365Sso,
      saml: false, // TODO: Implement SAML
      oauth: config.features.socialLogin,
      mfa: config.features.twoFactorAuth,
      biometric: config.features.biometricAuth,
    };

    res.json({
      methods,
      config: {
        passwordComplexity: config.features.passwordComplexity,
        sessionTimeout: config.session.inactivityTimeout,
        maxConcurrentSessions: config.session.maxConcurrentSessions,
        zeroTrust: config.zeroTrust.enabled,
      },
    });

  } catch (error) {
    logger.error('Failed to get auth methods', { error });
    res.status(500).json({
      error: 'Failed to get authentication methods',
    });
  }
});

export default router;