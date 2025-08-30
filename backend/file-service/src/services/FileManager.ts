import { EventEmitter } from 'events';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../config';
import { logger } from '../utils/logger';
import { CacheService } from './cache';
import { KafkaService } from './kafka';
import { S3StorageProvider } from '../storage/S3StorageProvider';
import { GCSStorageProvider } from '../storage/GCSStorageProvider';
import { AzureStorageProvider } from '../storage/AzureStorageProvider';
import { LocalStorageProvider } from '../storage/LocalStorageProvider';
import { ImageProcessor } from '../processors/ImageProcessor';
import { DocumentProcessor } from '../processors/DocumentProcessor';
import { VideoProcessor } from '../processors/VideoProcessor';
import { generateId } from '@trade-marketing/shared';

export interface FileMetadata {
  id: string;
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  hash: string;
  path: string;
  url: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  status: 'uploading' | 'processing' | 'ready' | 'error' | 'deleted';
  visibility: 'public' | 'private' | 'internal';
  tags: string[];
  metadata: Record<string, any>;
  uploadedBy: string;
  uploadedAt: Date;
  expiresAt?: Date;
  downloadCount: number;
  lastAccessedAt?: Date;
  versions: Array<{
    id: string;
    version: number;
    filename: string;
    size: number;
    uploadedAt: Date;
    uploadedBy: string;
  }>;
  permissions: {
    read: string[];
    write: string[];
    delete: string[];
  };
}

export interface UploadOptions {
  visibility?: 'public' | 'private' | 'internal';
  tags?: string[];
  expiresAt?: Date;
  generateThumbnail?: boolean;
  generatePreview?: boolean;
  processImage?: {
    resize?: { width: number; height: number };
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
  };
  permissions?: {
    read?: string[];
    write?: string[];
    delete?: string[];
  };
  metadata?: Record<string, any>;
}

export interface ProcessingJob {
  id: string;
  fileId: string;
  type: 'thumbnail' | 'preview' | 'conversion' | 'optimization' | 'analysis';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  config: any;
  result?: any;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface FileSearchQuery {
  query?: string;
  mimeTypes?: string[];
  tags?: string[];
  uploadedBy?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  sizeRange?: {
    min: number;
    max: number;
  };
  visibility?: 'public' | 'private' | 'internal';
  status?: FileMetadata['status'];
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'size' | 'uploadedAt' | 'lastAccessedAt';
  sortOrder?: 'asc' | 'desc';
}

export class FileManager extends EventEmitter {
  private cacheService: CacheService;
  private kafkaService: KafkaService;
  private storageProvider: any;
  private imageProcessor: ImageProcessor;
  private documentProcessor: DocumentProcessor;
  private videoProcessor: VideoProcessor;
  private files: Map<string, FileMetadata> = new Map();
  private processingJobs: Map<string, ProcessingJob> = new Map();

  constructor() {
    super();
    this.cacheService = new CacheService();
    this.kafkaService = new KafkaService();
    this.imageProcessor = new ImageProcessor();
    this.documentProcessor = new DocumentProcessor();
    this.videoProcessor = new VideoProcessor();
    
    this.initializeStorageProvider();
  }

  private initializeStorageProvider(): void {
    switch (config.storage.provider) {
      case 's3':
        this.storageProvider = new S3StorageProvider(config.storage.s3);
        break;
      case 'gcs':
        this.storageProvider = new GCSStorageProvider(config.storage.gcs);
        break;
      case 'azure':
        this.storageProvider = new AzureStorageProvider(config.storage.azure);
        break;
      default:
        this.storageProvider = new LocalStorageProvider(config.storage.local);
    }
  }

  // Upload file
  async uploadFile(
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    uploadedBy: string,
    options: UploadOptions = {}
  ): Promise<FileMetadata> {
    try {
      // Validate file
      await this.validateFile(fileBuffer, mimeType, originalName);

      // Generate file metadata
      const fileId = generateId();
      const hash = this.calculateHash(fileBuffer);
      const filename = this.generateFilename(originalName, fileId);
      
      // Check for duplicate
      const existingFile = await this.findFileByHash(hash);
      if (existingFile && config.storage.deduplication) {
        logger.info('Duplicate file detected, returning existing', {
          fileId: existingFile.id,
          hash,
        });
        return existingFile;
      }

      // Create file metadata
      const fileMetadata: FileMetadata = {
        id: fileId,
        originalName,
        filename,
        mimeType,
        size: fileBuffer.length,
        hash,
        path: '',
        url: '',
        status: 'uploading',
        visibility: options.visibility || 'private',
        tags: options.tags || [],
        metadata: options.metadata || {},
        uploadedBy,
        uploadedAt: new Date(),
        expiresAt: options.expiresAt,
        downloadCount: 0,
        versions: [],
        permissions: {
          read: options.permissions?.read || [uploadedBy],
          write: options.permissions?.write || [uploadedBy],
          delete: options.permissions?.delete || [uploadedBy],
        },
      };

      // Store file
      const storagePath = await this.storageProvider.store(
        fileBuffer,
        filename,
        {
          mimeType,
          visibility: fileMetadata.visibility,
          metadata: fileMetadata.metadata,
        }
      );

      fileMetadata.path = storagePath;
      fileMetadata.url = await this.storageProvider.getUrl(storagePath, fileMetadata.visibility);

      // Store metadata
      this.files.set(fileId, fileMetadata);
      await this.storeFileMetadata(fileMetadata);

      // Start processing if needed
      if (this.shouldProcess(mimeType, options)) {
        await this.startProcessing(fileMetadata, options);
      } else {
        fileMetadata.status = 'ready';
        await this.updateFileMetadata(fileMetadata);
      }

      // Emit upload event
      this.emit('file.uploaded', {
        fileId,
        originalName,
        size: fileBuffer.length,
        uploadedBy,
      });

      logger.info('File uploaded successfully', {
        fileId,
        originalName,
        size: fileBuffer.length,
        mimeType,
        uploadedBy,
      });

      return fileMetadata;

    } catch (error) {
      logger.error('File upload failed', {
        error,
        originalName,
        uploadedBy,
      });
      throw error;
    }
  }

  // Download file
  async downloadFile(
    fileId: string,
    userId: string,
    options: {
      version?: number;
      range?: { start: number; end: number };
    } = {}
  ): Promise<{
    buffer: Buffer;
    metadata: FileMetadata;
    contentType: string;
    contentLength: number;
  }> {
    try {
      const fileMetadata = await this.getFileMetadata(fileId);
      if (!fileMetadata) {
        throw new Error('File not found');
      }

      // Check permissions
      if (!this.hasReadPermission(fileMetadata, userId)) {
        throw new Error('Access denied');
      }

      // Check if file is ready
      if (fileMetadata.status !== 'ready') {
        throw new Error(`File is not ready (status: ${fileMetadata.status})`);
      }

      // Get file from storage
      const buffer = await this.storageProvider.retrieve(
        fileMetadata.path,
        options.range
      );

      // Update access tracking
      await this.trackFileAccess(fileId, userId);

      // Emit download event
      this.emit('file.downloaded', {
        fileId,
        userId,
        size: buffer.length,
      });

      return {
        buffer,
        metadata: fileMetadata,
        contentType: fileMetadata.mimeType,
        contentLength: buffer.length,
      };

    } catch (error) {
      logger.error('File download failed', { error, fileId, userId });
      throw error;
    }
  }

  // Delete file
  async deleteFile(fileId: string, userId: string, permanent: boolean = false): Promise<void> {
    try {
      const fileMetadata = await this.getFileMetadata(fileId);
      if (!fileMetadata) {
        throw new Error('File not found');
      }

      // Check permissions
      if (!this.hasDeletePermission(fileMetadata, userId)) {
        throw new Error('Access denied');
      }

      if (permanent) {
        // Permanently delete from storage
        await this.storageProvider.delete(fileMetadata.path);
        
        // Delete all versions
        for (const version of fileMetadata.versions) {
          await this.storageProvider.delete(version.filename);
        }

        // Delete thumbnails and previews
        if (fileMetadata.thumbnailUrl) {
          await this.storageProvider.delete(this.extractPathFromUrl(fileMetadata.thumbnailUrl));
        }
        if (fileMetadata.previewUrl) {
          await this.storageProvider.delete(this.extractPathFromUrl(fileMetadata.previewUrl));
        }

        // Remove from database
        await this.removeFileMetadata(fileId);
        this.files.delete(fileId);

      } else {
        // Soft delete
        fileMetadata.status = 'deleted';
        await this.updateFileMetadata(fileMetadata);
      }

      // Emit delete event
      this.emit('file.deleted', {
        fileId,
        userId,
        permanent,
      });

      logger.info('File deleted', {
        fileId,
        userId,
        permanent,
      });

    } catch (error) {
      logger.error('File deletion failed', { error, fileId, userId });
      throw error;
    }
  }

  // Search files
  async searchFiles(query: FileSearchQuery, userId: string): Promise<{
    files: FileMetadata[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      // Build search criteria
      const criteria = this.buildSearchCriteria(query, userId);
      
      // Execute search
      const results = await this.executeSearch(criteria);
      
      // Filter by permissions
      const accessibleFiles = results.files.filter(file => 
        this.hasReadPermission(file, userId)
      );

      return {
        files: accessibleFiles,
        total: results.total,
        hasMore: results.hasMore,
      };

    } catch (error) {
      logger.error('File search failed', { error, query, userId });
      throw error;
    }
  }

  // Process file
  async processFile(
    fileId: string,
    processingType: ProcessingJob['type'],
    config: any = {}
  ): Promise<ProcessingJob> {
    try {
      const fileMetadata = await this.getFileMetadata(fileId);
      if (!fileMetadata) {
        throw new Error('File not found');
      }

      // Create processing job
      const job: ProcessingJob = {
        id: generateId(),
        fileId,
        type: processingType,
        status: 'pending',
        progress: 0,
        config,
        createdAt: new Date(),
      };

      this.processingJobs.set(job.id, job);

      // Start processing
      this.executeProcessingJob(job, fileMetadata);

      return job;

    } catch (error) {
      logger.error('File processing failed', { error, fileId, processingType });
      throw error;
    }
  }

  // Execute processing job
  private async executeProcessingJob(
    job: ProcessingJob,
    fileMetadata: FileMetadata
  ): Promise<void> {
    try {
      job.status = 'processing';
      job.startedAt = new Date();

      // Get file buffer
      const buffer = await this.storageProvider.retrieve(fileMetadata.path);

      let result: any;

      switch (job.type) {
        case 'thumbnail':
          result = await this.generateThumbnail(buffer, fileMetadata, job.config);
          break;
        case 'preview':
          result = await this.generatePreview(buffer, fileMetadata, job.config);
          break;
        case 'conversion':
          result = await this.convertFile(buffer, fileMetadata, job.config);
          break;
        case 'optimization':
          result = await this.optimizeFile(buffer, fileMetadata, job.config);
          break;
        case 'analysis':
          result = await this.analyzeFile(buffer, fileMetadata, job.config);
          break;
        default:
          throw new Error(`Unsupported processing type: ${job.type}`);
      }

      job.status = 'completed';
      job.progress = 100;
      job.result = result;
      job.completedAt = new Date();

      // Update file metadata if needed
      if (job.type === 'thumbnail' && result.url) {
        fileMetadata.thumbnailUrl = result.url;
        await this.updateFileMetadata(fileMetadata);
      }
      if (job.type === 'preview' && result.url) {
        fileMetadata.previewUrl = result.url;
        await this.updateFileMetadata(fileMetadata);
      }

      // Emit completion event
      this.emit('processing.completed', {
        jobId: job.id,
        fileId: job.fileId,
        type: job.type,
        result,
      });

      logger.info('Processing job completed', {
        jobId: job.id,
        fileId: job.fileId,
        type: job.type,
        duration: job.completedAt.getTime() - job.startedAt!.getTime(),
      });

    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.completedAt = new Date();

      this.emit('processing.failed', {
        jobId: job.id,
        fileId: job.fileId,
        type: job.type,
        error: error.message,
      });

      logger.error('Processing job failed', {
        error,
        jobId: job.id,
        fileId: job.fileId,
        type: job.type,
      });
    }
  }

  // Generate thumbnail
  private async generateThumbnail(
    buffer: Buffer,
    fileMetadata: FileMetadata,
    config: any
  ): Promise<{ url: string; path: string }> {
    const thumbnailBuffer = await this.imageProcessor.generateThumbnail(
      buffer,
      fileMetadata.mimeType,
      {
        width: config.width || 200,
        height: config.height || 200,
        quality: config.quality || 80,
      }
    );

    const thumbnailPath = `thumbnails/${fileMetadata.id}_thumb.jpg`;
    await this.storageProvider.store(thumbnailBuffer, thumbnailPath, {
      mimeType: 'image/jpeg',
      visibility: fileMetadata.visibility,
    });

    const url = await this.storageProvider.getUrl(thumbnailPath, fileMetadata.visibility);
    
    return { url, path: thumbnailPath };
  }

  // Generate preview
  private async generatePreview(
    buffer: Buffer,
    fileMetadata: FileMetadata,
    config: any
  ): Promise<{ url: string; path: string }> {
    let previewBuffer: Buffer;

    if (fileMetadata.mimeType.startsWith('image/')) {
      previewBuffer = await this.imageProcessor.generatePreview(buffer, fileMetadata.mimeType, config);
    } else if (fileMetadata.mimeType === 'application/pdf') {
      previewBuffer = await this.documentProcessor.generatePDFPreview(buffer, config);
    } else if (fileMetadata.mimeType.startsWith('video/')) {
      previewBuffer = await this.videoProcessor.generateVideoPreview(buffer, config);
    } else {
      throw new Error(`Preview generation not supported for ${fileMetadata.mimeType}`);
    }

    const previewPath = `previews/${fileMetadata.id}_preview.jpg`;
    await this.storageProvider.store(previewBuffer, previewPath, {
      mimeType: 'image/jpeg',
      visibility: fileMetadata.visibility,
    });

    const url = await this.storageProvider.getUrl(previewPath, fileMetadata.visibility);
    
    return { url, path: previewPath };
  }

  // Convert file
  private async convertFile(
    buffer: Buffer,
    fileMetadata: FileMetadata,
    config: any
  ): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    // Implementation would handle various file conversions
    throw new Error('File conversion not implemented');
  }

  // Optimize file
  private async optimizeFile(
    buffer: Buffer,
    fileMetadata: FileMetadata,
    config: any
  ): Promise<{ buffer: Buffer; originalSize: number; optimizedSize: number; savings: number }> {
    let optimizedBuffer: Buffer;

    if (fileMetadata.mimeType.startsWith('image/')) {
      optimizedBuffer = await this.imageProcessor.optimize(buffer, fileMetadata.mimeType, config);
    } else {
      throw new Error(`Optimization not supported for ${fileMetadata.mimeType}`);
    }

    const originalSize = buffer.length;
    const optimizedSize = optimizedBuffer.length;
    const savings = ((originalSize - optimizedSize) / originalSize) * 100;

    return {
      buffer: optimizedBuffer,
      originalSize,
      optimizedSize,
      savings,
    };
  }

  // Analyze file
  private async analyzeFile(
    buffer: Buffer,
    fileMetadata: FileMetadata,
    config: any
  ): Promise<any> {
    if (fileMetadata.mimeType.startsWith('image/')) {
      return await this.imageProcessor.analyze(buffer, fileMetadata.mimeType);
    } else if (fileMetadata.mimeType === 'application/pdf') {
      return await this.documentProcessor.analyzePDF(buffer);
    } else if (fileMetadata.mimeType.startsWith('video/')) {
      return await this.videoProcessor.analyze(buffer);
    } else {
      throw new Error(`Analysis not supported for ${fileMetadata.mimeType}`);
    }
  }

  // Helper methods
  private async validateFile(buffer: Buffer, mimeType: string, filename: string): Promise<void> {
    // Check file size
    if (buffer.length > config.storage.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed size of ${config.storage.maxFileSize} bytes`);
    }

    // Check file type
    if (!config.storage.allowedMimeTypes.includes(mimeType)) {
      throw new Error(`File type ${mimeType} is not allowed`);
    }

    // Check for malicious content
    await this.scanForMalware(buffer);
  }

  private async scanForMalware(buffer: Buffer): Promise<void> {
    // Implementation would integrate with antivirus scanning
    // For now, just check for suspicious patterns
    const suspiciousPatterns = [
      Buffer.from('eval('),
      Buffer.from('<script'),
      Buffer.from('javascript:'),
    ];

    for (const pattern of suspiciousPatterns) {
      if (buffer.includes(pattern)) {
        throw new Error('Potentially malicious content detected');
      }
    }
  }

  private calculateHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private generateFilename(originalName: string, fileId: string): string {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    return `${fileId}_${timestamp}${ext}`;
  }

  private shouldProcess(mimeType: string, options: UploadOptions): boolean {
    return options.generateThumbnail || 
           options.generatePreview || 
           options.processImage ||
           mimeType.startsWith('image/') ||
           mimeType === 'application/pdf';
  }

  private async startProcessing(fileMetadata: FileMetadata, options: UploadOptions): Promise<void> {
    fileMetadata.status = 'processing';
    await this.updateFileMetadata(fileMetadata);

    const processingJobs = [];

    if (options.generateThumbnail || fileMetadata.mimeType.startsWith('image/')) {
      processingJobs.push(this.processFile(fileMetadata.id, 'thumbnail'));
    }

    if (options.generatePreview) {
      processingJobs.push(this.processFile(fileMetadata.id, 'preview'));
    }

    if (options.processImage && fileMetadata.mimeType.startsWith('image/')) {
      processingJobs.push(this.processFile(fileMetadata.id, 'optimization', options.processImage));
    }

    // Wait for all processing to complete
    await Promise.all(processingJobs);

    fileMetadata.status = 'ready';
    await this.updateFileMetadata(fileMetadata);
  }

  private hasReadPermission(fileMetadata: FileMetadata, userId: string): boolean {
    return fileMetadata.permissions.read.includes(userId) ||
           fileMetadata.permissions.read.includes('*') ||
           fileMetadata.uploadedBy === userId;
  }

  private hasDeletePermission(fileMetadata: FileMetadata, userId: string): boolean {
    return fileMetadata.permissions.delete.includes(userId) ||
           fileMetadata.uploadedBy === userId;
  }

  private async trackFileAccess(fileId: string, userId: string): Promise<void> {
    const fileMetadata = this.files.get(fileId);
    if (fileMetadata) {
      fileMetadata.downloadCount++;
      fileMetadata.lastAccessedAt = new Date();
      await this.updateFileMetadata(fileMetadata);
    }
  }

  private buildSearchCriteria(query: FileSearchQuery, userId: string): any {
    // Implementation would build database query criteria
    return query;
  }

  private async executeSearch(criteria: any): Promise<{
    files: FileMetadata[];
    total: number;
    hasMore: boolean;
  }> {
    // Implementation would execute database search
    return {
      files: Array.from(this.files.values()),
      total: this.files.size,
      hasMore: false,
    };
  }

  private extractPathFromUrl(url: string): string {
    // Extract storage path from URL
    return url.split('/').pop() || '';
  }

  // Data persistence methods (would be implemented with actual database)
  private async storeFileMetadata(metadata: FileMetadata): Promise<void> {
    // Implementation would store in database
  }

  private async updateFileMetadata(metadata: FileMetadata): Promise<void> {
    // Implementation would update in database
  }

  private async removeFileMetadata(fileId: string): Promise<void> {
    // Implementation would remove from database
  }

  private async getFileMetadata(fileId: string): Promise<FileMetadata | null> {
    return this.files.get(fileId) || null;
  }

  private async findFileByHash(hash: string): Promise<FileMetadata | null> {
    for (const file of this.files.values()) {
      if (file.hash === hash) {
        return file;
      }
    }
    return null;
  }

  // Public API methods
  async getFile(fileId: string, userId: string): Promise<FileMetadata | null> {
    const fileMetadata = await this.getFileMetadata(fileId);
    if (!fileMetadata || !this.hasReadPermission(fileMetadata, userId)) {
      return null;
    }
    return fileMetadata;
  }

  async updateFilePermissions(
    fileId: string,
    userId: string,
    permissions: Partial<FileMetadata['permissions']>
  ): Promise<void> {
    const fileMetadata = await this.getFileMetadata(fileId);
    if (!fileMetadata) {
      throw new Error('File not found');
    }

    if (fileMetadata.uploadedBy !== userId) {
      throw new Error('Access denied');
    }

    fileMetadata.permissions = { ...fileMetadata.permissions, ...permissions };
    await this.updateFileMetadata(fileMetadata);
  }

  async getProcessingJob(jobId: string): Promise<ProcessingJob | null> {
    return this.processingJobs.get(jobId) || null;
  }

  async listUserFiles(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: FileMetadata['status'];
    } = {}
  ): Promise<FileMetadata[]> {
    const userFiles = Array.from(this.files.values()).filter(file =>
      file.uploadedBy === userId &&
      (!options.status || file.status === options.status)
    );

    const start = options.offset || 0;
    const end = start + (options.limit || 50);
    
    return userFiles.slice(start, end);
  }

  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    byMimeType: Record<string, { count: number; size: number }>;
    byStatus: Record<string, number>;
  }> {
    const stats = {
      totalFiles: this.files.size,
      totalSize: 0,
      byMimeType: {} as Record<string, { count: number; size: number }>,
      byStatus: {} as Record<string, number>,
    };

    for (const file of this.files.values()) {
      stats.totalSize += file.size;

      // By MIME type
      if (!stats.byMimeType[file.mimeType]) {
        stats.byMimeType[file.mimeType] = { count: 0, size: 0 };
      }
      stats.byMimeType[file.mimeType].count++;
      stats.byMimeType[file.mimeType].size += file.size;

      // By status
      stats.byStatus[file.status] = (stats.byStatus[file.status] || 0) + 1;
    }

    return stats;
  }
}