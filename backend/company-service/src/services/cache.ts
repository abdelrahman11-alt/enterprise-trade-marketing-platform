import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';

class CacheService {
  private client: RedisClientType;
  private isConnected: boolean = false;

  constructor() {
    this.client = createClient({
      url: config.redis.url,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis connection failed after 10 retries');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 50, 1000);
        },
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Cache service connected to Redis');
    });

    this.client.on('ready', () => {
      logger.info('Cache service ready');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      logger.error('Cache service error', { error: error.message });
      this.isConnected = false;
    });

    this.client.on('end', () => {
      logger.info('Cache service disconnected');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      logger.info('Cache service reconnecting');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      logger.info('Cache service connection established');
    } catch (error) {
      logger.error('Failed to connect cache service to Redis', { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
      logger.info('Cache service connection closed');
    } catch (error) {
      logger.error('Error closing cache service connection', { error });
    }
  }

  // Basic cache operations
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      const value = await this.client.get(fullKey);
      
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache GET error', { key, error });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl: number = config.redis.defaultTTL): Promise<boolean> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      const serializedValue = JSON.stringify(value);
      
      await this.client.setEx(fullKey, ttl, serializedValue);
      return true;
    } catch (error) {
      logger.error('Cache SET error', { key, error });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      const result = await this.client.del(fullKey);
      return result > 0;
    } catch (error) {
      logger.error('Cache DEL error', { key, error });
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      const result = await this.client.exists(fullKey);
      return result > 0;
    } catch (error) {
      logger.error('Cache EXISTS error', { key, error });
      return false;
    }
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      const result = await this.client.expire(fullKey, ttl);
      return result;
    } catch (error) {
      logger.error('Cache EXPIRE error', { key, ttl, error });
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      return await this.client.ttl(fullKey);
    } catch (error) {
      logger.error('Cache TTL error', { key, error });
      return -1;
    }
  }

  // Pattern-based operations
  async keys(pattern: string): Promise<string[]> {
    try {
      const fullPattern = `${config.redis.keyPrefix}${pattern}`;
      const keys = await this.client.keys(fullPattern);
      // Remove prefix from returned keys
      return keys.map(key => key.replace(config.redis.keyPrefix, ''));
    } catch (error) {
      logger.error('Cache KEYS error', { pattern, error });
      return [];
    }
  }

  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.keys(pattern);
      if (keys.length === 0) return 0;

      const fullKeys = keys.map(key => `${config.redis.keyPrefix}${key}`);
      return await this.client.del(fullKeys);
    } catch (error) {
      logger.error('Cache invalidate pattern error', { pattern, error });
      return 0;
    }
  }

  // Hash operations
  async hget<T>(key: string, field: string): Promise<T | null> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      const value = await this.client.hGet(fullKey, field);
      
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache HGET error', { key, field, error });
      return null;
    }
  }

  async hset<T>(key: string, field: string, value: T): Promise<boolean> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      const serializedValue = JSON.stringify(value);
      
      const result = await this.client.hSet(fullKey, field, serializedValue);
      return result >= 0;
    } catch (error) {
      logger.error('Cache HSET error', { key, field, error });
      return false;
    }
  }

  async hgetall<T>(key: string): Promise<Record<string, T> | null> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      const hash = await this.client.hGetAll(fullKey);
      
      if (!hash || Object.keys(hash).length === 0) {
        return null;
      }

      const result: Record<string, T> = {};
      for (const [field, value] of Object.entries(hash)) {
        result[field] = JSON.parse(value) as T;
      }
      
      return result;
    } catch (error) {
      logger.error('Cache HGETALL error', { key, error });
      return null;
    }
  }

  async hdel(key: string, field: string): Promise<boolean> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      const result = await this.client.hDel(fullKey, field);
      return result > 0;
    } catch (error) {
      logger.error('Cache HDEL error', { key, field, error });
      return false;
    }
  }

  // Set operations
  async sadd(key: string, member: string): Promise<boolean> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      const result = await this.client.sAdd(fullKey, member);
      return result > 0;
    } catch (error) {
      logger.error('Cache SADD error', { key, member, error });
      return false;
    }
  }

  async srem(key: string, member: string): Promise<boolean> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      const result = await this.client.sRem(fullKey, member);
      return result > 0;
    } catch (error) {
      logger.error('Cache SREM error', { key, member, error });
      return false;
    }
  }

  async sismember(key: string, member: string): Promise<boolean> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      return await this.client.sIsMember(fullKey, member);
    } catch (error) {
      logger.error('Cache SISMEMBER error', { key, member, error });
      return false;
    }
  }

  async smembers(key: string): Promise<string[]> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      return await this.client.sMembers(fullKey);
    } catch (error) {
      logger.error('Cache SMEMBERS error', { key, error });
      return [];
    }
  }

  // Advanced caching patterns
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = config.redis.defaultTTL
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      // Fetch data
      const data = await fetcher();

      // Store in cache
      await this.set(key, data, ttl);

      return data;
    } catch (error) {
      logger.error('Cache getOrSet error', { key, error });
      // Fallback to fetcher if cache fails
      return await fetcher();
    }
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const fullKeys = keys.map(key => `${config.redis.keyPrefix}${key}`);
      const values = await this.client.mGet(fullKeys);
      
      return values.map(value => {
        if (!value) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      logger.error('Cache MGET error', { keys, error });
      return keys.map(() => null);
    }
  }

  async mset<T>(keyValuePairs: Array<{ key: string; value: T; ttl?: number }>): Promise<boolean> {
    try {
      const pipeline = this.client.multi();
      
      keyValuePairs.forEach(({ key, value, ttl = config.redis.defaultTTL }) => {
        const fullKey = `${config.redis.keyPrefix}${key}`;
        const serializedValue = JSON.stringify(value);
        pipeline.setEx(fullKey, ttl, serializedValue);
      });
      
      await pipeline.exec();
      return true;
    } catch (error) {
      logger.error('Cache MSET error', { keyValuePairs: keyValuePairs.length, error });
      return false;
    }
  }

  // Cache warming
  async warmCache<T>(
    keys: string[],
    fetcher: (key: string) => Promise<T>,
    ttl: number = config.redis.defaultTTL
  ): Promise<void> {
    try {
      const promises = keys.map(async (key) => {
        const exists = await this.exists(key);
        if (!exists) {
          const data = await fetcher(key);
          await this.set(key, data, ttl);
        }
      });

      await Promise.all(promises);
      
      logger.info('Cache warming completed', { keyCount: keys.length });
    } catch (error) {
      logger.error('Cache warming error', { keys: keys.length, error });
    }
  }

  // Cache statistics
  async getStats(): Promise<any> {
    try {
      const info = await this.client.info('memory');
      const keyspace = await this.client.info('keyspace');
      
      return {
        connected: this.isConnected,
        memory: info,
        keyspace: keyspace,
      };
    } catch (error) {
      logger.error('Failed to get cache stats', { error });
      return null;
    }
  }

  // Health check
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Cache PING error', { error });
      return false;
    }
  }

  isHealthy(): boolean {
    return this.isConnected;
  }

  // Utility methods
  async flushdb(): Promise<boolean> {
    try {
      await this.client.flushDb();
      return true;
    } catch (error) {
      logger.error('Cache FLUSHDB error', { error });
      return false;
    }
  }

  // Get raw client for advanced operations
  getClient(): RedisClientType {
    return this.client;
  }
}

// Create singleton instance
export const CacheService = new CacheService();

export default CacheService;