import { Client } from '@microsoft/microsoft-graph-client';
import { AuthenticationProvider } from '@microsoft/microsoft-graph-client';
import { PublicClientApplication, ConfidentialClientApplication } from '@azure/msal-node';
import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import { UserModel } from '../models/User';
import { SocialAccountModel } from '../models/SocialAccount';
import { AuditLogModel } from '../models/AuditLog';
import { CacheService } from '../services/cache';
import { generateId } from '@trade-marketing/shared';

export interface Office365User {
  id: string;
  displayName: string;
  givenName: string;
  surname: string;
  mail: string;
  userPrincipalName: string;
  jobTitle?: string;
  department?: string;
  companyName?: string;
  officeLocation?: string;
  mobilePhone?: string;
  businessPhones?: string[];
  photo?: string;
}

export interface Office365Group {
  id: string;
  displayName: string;
  description?: string;
  mail?: string;
  groupTypes: string[];
  securityEnabled: boolean;
  mailEnabled: boolean;
}

export interface Office365AuthResult {
  user: Office365User;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  groups?: Office365Group[];
}

class CustomAuthProvider implements AuthenticationProvider {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async getAccessToken(): Promise<string> {
    return this.accessToken;
  }
}

export class Office365AuthService {
  private msalApp: ConfidentialClientApplication;
  private graphClient: Client | null = null;

  constructor() {
    this.msalApp = new ConfidentialClientApplication({
      auth: {
        clientId: config.office365.clientId,
        clientSecret: config.office365.clientSecret,
        authority: `${config.office365.loginUrl}/${config.office365.tenantId}`,
      },
      cache: {
        cacheLocation: 'memory',
      },
    });
  }

  // Generate Office 365 login URL
  getAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: config.office365.clientId,
      response_type: 'code',
      redirect_uri: config.office365.redirectUri,
      response_mode: 'query',
      scope: config.office365.scopes.join(' '),
      state: state || generateId(),
    });

    return `${config.office365.loginUrl}/${config.office365.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(code: string): Promise<Office365AuthResult> {
    try {
      const tokenRequest = {
        code,
        scopes: config.office365.scopes,
        redirectUri: config.office365.redirectUri,
      };

      const response = await this.msalApp.acquireTokenByCode(tokenRequest);
      
      if (!response) {
        throw new Error('Failed to acquire token');
      }

      // Create Graph client with access token
      const authProvider = new CustomAuthProvider(response.accessToken);
      this.graphClient = Client.initWithMiddleware({ authProvider });

      // Get user information
      const user = await this.getUserInfo();
      
      // Get user groups if enabled
      let groups: Office365Group[] = [];
      if (config.office365.enableGroupSync) {
        groups = await this.getUserGroups();
      }

      return {
        user,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        expiresAt: response.expiresOn || new Date(Date.now() + 3600000), // 1 hour default
        groups,
      };

    } catch (error) {
      logger.error('Failed to exchange code for tokens', { error, code });
      throw new Error('Office 365 authentication failed');
    }
  }

  // Refresh access token
  async refreshAccessToken(refreshToken: string): Promise<Office365AuthResult> {
    try {
      const refreshRequest = {
        refreshToken,
        scopes: config.office365.scopes,
      };

      const response = await this.msalApp.acquireTokenByRefreshToken(refreshRequest);
      
      if (!response) {
        throw new Error('Failed to refresh token');
      }

      // Create Graph client with new access token
      const authProvider = new CustomAuthProvider(response.accessToken);
      this.graphClient = Client.initWithMiddleware({ authProvider });

      // Get updated user information
      const user = await this.getUserInfo();
      
      // Get updated user groups if enabled
      let groups: Office365Group[] = [];
      if (config.office365.enableGroupSync) {
        groups = await this.getUserGroups();
      }

      return {
        user,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        expiresAt: response.expiresOn || new Date(Date.now() + 3600000),
        groups,
      };

    } catch (error) {
      logger.error('Failed to refresh access token', { error });
      throw new Error('Token refresh failed');
    }
  }

  // Get user information from Microsoft Graph
  private async getUserInfo(): Promise<Office365User> {
    if (!this.graphClient) {
      throw new Error('Graph client not initialized');
    }

    try {
      const user = await this.graphClient.api('/me').get();
      
      // Get user photo
      let photo: string | undefined;
      try {
        const photoResponse = await this.graphClient.api('/me/photo/$value').get();
        if (photoResponse) {
          photo = `data:image/jpeg;base64,${Buffer.from(photoResponse).toString('base64')}`;
        }
      } catch (photoError) {
        // Photo not available, continue without it
        logger.debug('User photo not available', { userId: user.id });
      }

      return {
        id: user.id,
        displayName: user.displayName,
        givenName: user.givenName,
        surname: user.surname,
        mail: user.mail || user.userPrincipalName,
        userPrincipalName: user.userPrincipalName,
        jobTitle: user.jobTitle,
        department: user.department,
        companyName: user.companyName,
        officeLocation: user.officeLocation,
        mobilePhone: user.mobilePhone,
        businessPhones: user.businessPhones,
        photo,
      };

    } catch (error) {
      logger.error('Failed to get user info from Graph API', { error });
      throw new Error('Failed to retrieve user information');
    }
  }

  // Get user groups from Microsoft Graph
  private async getUserGroups(): Promise<Office365Group[]> {
    if (!this.graphClient) {
      throw new Error('Graph client not initialized');
    }

    try {
      const groups = await this.graphClient.api('/me/memberOf').get();
      
      return groups.value
        .filter((group: any) => group['@odata.type'] === '#microsoft.graph.group')
        .map((group: any) => ({
          id: group.id,
          displayName: group.displayName,
          description: group.description,
          mail: group.mail,
          groupTypes: group.groupTypes || [],
          securityEnabled: group.securityEnabled || false,
          mailEnabled: group.mailEnabled || false,
        }));

    } catch (error) {
      logger.error('Failed to get user groups from Graph API', { error });
      return [];
    }
  }

  // Authenticate user with Office 365
  async authenticateUser(
    authResult: Office365AuthResult,
    ipAddress?: string,
    userAgent?: string
  ): Promise<any> {
    try {
      const { user: o365User, accessToken, refreshToken, expiresAt, groups } = authResult;

      // Check if user exists
      let user = await UserModel.findByEmail(o365User.mail);
      
      if (!user) {
        // Create new user
        user = await UserModel.create({
          id: generateId(),
          email: o365User.mail,
          firstName: o365User.givenName,
          lastName: o365User.surname,
          displayName: o365User.displayName,
          avatar: o365User.photo,
          phone: o365User.mobilePhone,
          status: 'ACTIVE',
          emailVerified: true, // Office 365 users are pre-verified
          createdBy: 'system',
          updatedBy: 'system',
          metadata: {
            source: 'office365',
            jobTitle: o365User.jobTitle,
            department: o365User.department,
            companyName: o365User.companyName,
            officeLocation: o365User.officeLocation,
          },
        });

        logger.info('New user created from Office 365', {
          userId: user.id,
          email: user.email,
          displayName: user.displayName,
        });
      } else {
        // Update existing user with latest Office 365 info
        await UserModel.update(user.id, {
          firstName: o365User.givenName,
          lastName: o365User.surname,
          displayName: o365User.displayName,
          avatar: o365User.photo,
          phone: o365User.mobilePhone,
          lastLoginAt: new Date(),
          lastLoginIp: ipAddress,
          metadata: {
            ...user.metadata,
            jobTitle: o365User.jobTitle,
            department: o365User.department,
            companyName: o365User.companyName,
            officeLocation: o365User.officeLocation,
          },
        });
      }

      // Create or update social account
      let socialAccount = await SocialAccountModel.findByProviderAndUserId('MICROSOFT', user.id);
      
      if (!socialAccount) {
        socialAccount = await SocialAccountModel.create({
          id: generateId(),
          userId: user.id,
          provider: 'MICROSOFT',
          providerId: o365User.id,
          providerUsername: o365User.userPrincipalName,
          providerEmail: o365User.mail,
          accessToken,
          refreshToken,
          expiresAt,
          metadata: {
            groups: groups?.map(g => ({ id: g.id, name: g.displayName })) || [],
            tenant: config.office365.tenantId,
          },
        });
      } else {
        await SocialAccountModel.update(socialAccount.id, {
          accessToken,
          refreshToken,
          expiresAt,
          metadata: {
            ...socialAccount.metadata,
            groups: groups?.map(g => ({ id: g.id, name: g.displayName })) || [],
            lastSync: new Date().toISOString(),
          },
        });
      }

      // Sync groups to roles if enabled
      if (config.office365.enableGroupSync && groups) {
        await this.syncGroupsToRoles(user.id, groups);
      }

      // Log authentication event
      await AuditLogModel.create({
        entityType: 'User',
        entityId: user.id,
        action: 'LOGIN',
        userId: user.id,
        ipAddress,
        userAgent,
        metadata: {
          provider: 'office365',
          method: 'sso',
          groupsCount: groups?.length || 0,
        },
      });

      // Cache user session
      await CacheService.set(
        `office365:user:${user.id}`,
        {
          userId: user.id,
          accessToken,
          expiresAt: expiresAt.toISOString(),
          groups: groups?.map(g => g.id) || [],
        },
        3600 // 1 hour
      );

      return user;

    } catch (error) {
      logger.error('Office 365 user authentication failed', { error });
      throw error;
    }
  }

  // Sync Office 365 groups to user roles
  private async syncGroupsToRoles(userId: string, groups: Office365Group[]): Promise<void> {
    try {
      // This would integrate with the role management system
      // For now, we'll just log the groups
      logger.info('Syncing Office 365 groups to roles', {
        userId,
        groups: groups.map(g => ({ id: g.id, name: g.displayName })),
      });

      // In a real implementation, you would:
      // 1. Map Office 365 groups to application roles
      // 2. Update user roles based on group membership
      // 3. Handle role additions and removals
      
    } catch (error) {
      logger.error('Failed to sync groups to roles', { error, userId });
    }
  }

  // Validate Office 365 token
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const authProvider = new CustomAuthProvider(accessToken);
      const graphClient = Client.initWithMiddleware({ authProvider });
      
      // Try to get user info to validate token
      await graphClient.api('/me').get();
      return true;

    } catch (error) {
      logger.debug('Office 365 token validation failed', { error });
      return false;
    }
  }

  // Get user information by access token
  async getUserByToken(accessToken: string): Promise<Office365User | null> {
    try {
      const authProvider = new CustomAuthProvider(accessToken);
      const graphClient = Client.initWithMiddleware({ authProvider });
      
      const user = await graphClient.api('/me').get();
      
      return {
        id: user.id,
        displayName: user.displayName,
        givenName: user.givenName,
        surname: user.surname,
        mail: user.mail || user.userPrincipalName,
        userPrincipalName: user.userPrincipalName,
        jobTitle: user.jobTitle,
        department: user.department,
        companyName: user.companyName,
        officeLocation: user.officeLocation,
        mobilePhone: user.mobilePhone,
        businessPhones: user.businessPhones,
      };

    } catch (error) {
      logger.error('Failed to get user by token', { error });
      return null;
    }
  }

  // Revoke Office 365 token
  async revokeToken(accessToken: string): Promise<boolean> {
    try {
      // Microsoft Graph doesn't have a direct revoke endpoint
      // The token will expire naturally or can be invalidated by changing password
      
      // Remove from cache
      const user = await this.getUserByToken(accessToken);
      if (user) {
        await CacheService.del(`office365:user:${user.id}`);
      }

      return true;

    } catch (error) {
      logger.error('Failed to revoke Office 365 token', { error });
      return false;
    }
  }

  // Sync all users from Office 365 (admin function)
  async syncAllUsers(): Promise<{ synced: number; errors: number }> {
    if (!config.office365.enableGroupSync) {
      throw new Error('Office 365 sync is not enabled');
    }

    try {
      // This would require admin consent and appropriate permissions
      const authProvider = new CustomAuthProvider('admin-token'); // Would need admin token
      const graphClient = Client.initWithMiddleware({ authProvider });
      
      let synced = 0;
      let errors = 0;
      let nextLink: string | undefined;

      do {
        const response = await graphClient.api('/users').get();
        
        for (const o365User of response.value) {
          try {
            // Process each user
            await this.syncSingleUser(o365User);
            synced++;
          } catch (error) {
            logger.error('Failed to sync user', { error, userId: o365User.id });
            errors++;
          }
        }

        nextLink = response['@odata.nextLink'];
        
      } while (nextLink);

      logger.info('Office 365 user sync completed', { synced, errors });
      
      return { synced, errors };

    } catch (error) {
      logger.error('Office 365 user sync failed', { error });
      throw error;
    }
  }

  private async syncSingleUser(o365User: any): Promise<void> {
    // Implementation for syncing a single user
    // This would be similar to authenticateUser but for bulk sync
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      // Try to get tenant information
      const response = await axios.get(
        `${config.office365.loginUrl}/${config.office365.tenantId}/v2.0/.well-known/openid_configuration`
      );
      
      return response.status === 200;

    } catch (error) {
      logger.error('Office 365 health check failed', { error });
      return false;
    }
  }

  // Get Office 365 configuration for frontend
  getClientConfig(): any {
    return {
      clientId: config.office365.clientId,
      authority: `${config.office365.loginUrl}/${config.office365.tenantId}`,
      redirectUri: config.office365.redirectUri,
      scopes: config.office365.scopes,
      enabled: config.features.office365Sso,
    };
  }
}