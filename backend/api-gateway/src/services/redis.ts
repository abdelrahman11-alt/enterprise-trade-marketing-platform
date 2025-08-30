import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';

class RedisService {
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
      logger.info('Redis client connected');
    });

    this.client.on('ready', () => {
      logger.info('Redis client ready');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error', { error: error.message });
      this.isConnected = false;
    });

    this.client.on('end', () => {
      logger.info('Redis client disconnected');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis client reconnecting');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      logger.info('Redis connection established');
    } catch (error) {
      logger.error('Failed to connect to Redis', { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error closing Redis connection', { error });
    }
  }

  // Key-value operations
  async get(key: string): Promise<string | null> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      return await this.client.get(fullKey);
    } catch (error) {
      logger.error('Redis GET error', { key, error });
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      if (ttl) {
        await this.client.setEx(fullKey, ttl, value);
      } else {
        await this.client.set(fullKey, value);
      }
      return true;
    } catch (error) {
      logger.error('Redis SET error', { key, error });
      return false;
    }
  }

  async setex(key: string, ttl: number, value: string): Promise<boolean> {
    return this.set(key, value, ttl);
  }

  async del(key: string): Promise<boolean> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      const result = await this.client.del(fullKey);
      return result > 0;
    } catch (error) {
      logger.error('Redis DEL error', { key, error });
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      const result = await this.client.exists(fullKey);
      return result > 0;
    } catch (error) {
      logger.error('Redis EXISTS error', { key, error });
      return false;
    }
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      const result = await this.client.expire(fullKey, ttl);
      return result;
    } catch (error) {
      logger.error('Redis EXPIRE error', { key, ttl, error });
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      return await this.client.ttl(fullKey);
    } catch (error) {
      logger.error('Redis TTL error', { key, error });
      return -1;
    }
  }

  // Hash operations
  async hget(key: string, field: string): Promise<string | null> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      return await this.client.hGet(fullKey, field);
    } catch (error) {
      logger.error('Redis HGET error', { key, field, error });
      return null;
    }
  }

  async hset(key: string, field: string, value: string): Promise<boolean> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      const result = await this.client.hSet(fullKey, field, value);
      return result >= 0;
    } catch (error) {
      logger.error('Redis HSET error', { key, field, error });
      return false;
    }
  }

  async hgetall(key: string): Promise<Record<string, string> | null> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      return await this.client.hGetAll(fullKey);
    } catch (error) {
      logger.error('Redis HGETALL error', { key, error });
      return null;
    }
  }

  async hdel(key: string, field: string): Promise<boolean> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      const result = await this.client.hDel(fullKey, field);
      return result > 0;
    } catch (error) {
      logger.error('Redis HDEL error', { key, field, error });
      return false;
    }
  }

  // List operations
  async lpush(key: string, value: string): Promise<number> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      return await this.client.lPush(fullKey, value);
    } catch (error) {
      logger.error('Redis LPUSH error', { key, error });
      return 0;
    }
  }

  async rpush(key: string, value: string): Promise<number> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      return await this.client.rPush(fullKey, value);
    } catch (error) {
      logger.error('Redis RPUSH error', { key, error });
      return 0;
    }
  }

  async lpop(key: string): Promise<string | null> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      return await this.client.lPop(fullKey);
    } catch (error) {
      logger.error('Redis LPOP error', { key, error });
      return null;
    }
  }

  async rpop(key: string): Promise<string | null> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      return await this.client.rPop(fullKey);
    } catch (error) {
      logger.error('Redis RPOP error', { key, error });
      return null;
    }
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      return await this.client.lRange(fullKey, start, stop);
    } catch (error) {
      logger.error('Redis LRANGE error', { key, start, stop, error });
      return [];
    }
  }

  // Set operations
  async sadd(key: string, member: string): Promise<boolean> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      const result = await this.client.sAdd(fullKey, member);
      return result > 0;
    } catch (error) {
      logger.error('Redis SADD error', { key, member, error });
      return false;
    }
  }

  async srem(key: string, member: string): Promise<boolean> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      const result = await this.client.sRem(fullKey, member);
      return result > 0;
    } catch (error) {
      logger.error('Redis SREM error', { key, member, error });
      return false;
    }
  }

  async sismember(key: string, member: string): Promise<boolean> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      return await this.client.sIsMember(fullKey, member);
    } catch (error) {
      logger.error('Redis SISMEMBER error', { key, member, error });
      return false;
    }
  }

  async smembers(key: string): Promise<string[]> {
    try {
      const fullKey = `${config.redis.keyPrefix}${key}`;
      return await this.client.sMembers(fullKey);
    } catch (error) {
      logger.error('Redis SMEMBERS error', { key, error });
      return [];
    }
  }

  // Utility methods
  async flushdb(): Promise<boolean> {
    try {
      await this.client.flushDb();
      return true;
    } catch (error) {
      logger.error('Redis FLUSHDB error', { error });
      return false;
    }
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis PING error', { error });
      return false;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      const fullPattern = `${config.redis.keyPrefix}${pattern}`;
      const keys = await this.client.keys(fullPattern);
      // Remove prefix from returned keys
      return keys.map(key => key.replace(config.redis.keyPrefix, ''));
    } catch (error) {
      logger.error('Redis KEYS error', { pattern, error });
      return [];
    }
  }

  // Cache helper methods
  async cache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = config.redis.defaultTTL
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.get(key);
      if (cached) {
        return JSON.parse(cached);
      }

      // Fetch data
      const data = await fetcher();

      // Store in cache
      await this.setex(key, ttl, JSON.stringify(data));

      return data;
    } catch (error) {
      logger.error('Redis cache error', { key, error });
      // Fallback to fetcher if cache fails
      return await fetcher();
    }
  }

  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.keys(pattern);
      if (keys.length === 0) return 0;

      const fullKeys = keys.map(key => `${config.redis.keyPrefix}${key}`);
      return await this.client.del(fullKeys);
    } catch (error) {
      logger.error('Redis invalidate pattern error', { pattern, error });
      return 0;
    }
  }

  // Health check
  isHealthy(): boolean {
    return this.isConnected;
  }

  // Get raw client for advanced operations
  getClient(): RedisClientType {
    return this.client;
  }
}

// Create singleton instance
export const redisClient = new RedisService();

// Export for use in other modules
export default redisClient;