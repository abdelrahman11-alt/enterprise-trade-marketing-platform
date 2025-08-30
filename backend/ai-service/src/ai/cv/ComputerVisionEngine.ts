import * as tf from '@tensorflow/tfjs-node';
import sharp from 'sharp';
import Jimp from 'jimp';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { ImageAnalysisModel } from '../../models/ImageAnalysis';
import { generateId } from '@trade-marketing/shared';

export interface ImageAnalysisRequest {
  imageUrl: string;
  analysisType: 'shelf_compliance' | 'product_recognition' | 'planogram_analysis' | 'brand_visibility' | 'competitor_analysis' | 'quality_check' | 'inventory_count';
  userId: string;
  companyId: string;
  metadata?: any;
}

export interface ImageAnalysisResult {
  analysisId: string;
  results: any;
  confidence: number;
  processingTime: number;
  metadata?: any;
}

export interface ObjectDetectionResult {
  objects: Array<{
    class: string;
    confidence: number;
    bbox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
  totalObjects: number;
}

export interface ShelfComplianceResult {
  compliance: {
    overall: number;
    planogram: number;
    pricing: number;
    availability: number;
    positioning: number;
  };
  violations: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    location: { x: number; y: number };
  }>;
  recommendations: string[];
}

export interface ProductRecognitionResult {
  products: Array<{
    name: string;
    brand: string;
    category: string;
    confidence: number;
    bbox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    attributes: {
      size?: string;
      flavor?: string;
      price?: number;
    };
  }>;
  totalProducts: number;
  brandDistribution: Record<string, number>;
}

export class ComputerVisionEngine {
  private models: Map<string, tf.GraphModel | tf.LayersModel> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    this.initializeModels();
  }

  private async initializeModels(): Promise<void> {
    try {
      // Load pre-trained models
      await this.loadObjectDetectionModel();
      await this.loadImageClassificationModel();
      await this.loadTextRecognitionModel();
      
      this.isInitialized = true;
      logger.info('Computer Vision models initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize CV models', { error });
    }
  }

  private async loadObjectDetectionModel(): Promise<void> {
    try {
      // In a real implementation, you would load a pre-trained model like YOLO or SSD
      // For now, we'll create a placeholder
      const model = await tf.loadGraphModel('https://tfhub.dev/tensorflow/ssd_mobilenet_v2/2');
      this.models.set('object_detection', model);
    } catch (error) {
      logger.warn('Object detection model not available, using fallback', { error });
      // Create a simple placeholder model
      const model = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [224 * 224 * 3], units: 128, activation: 'relu' }),
          tf.layers.dense({ units: 64, activation: 'relu' }),
          tf.layers.dense({ units: 20, activation: 'softmax' }) // 20 common product classes
        ]
      });
      this.models.set('object_detection', model);
    }
  }

  private async loadImageClassificationModel(): Promise<void> {
    try {
      // Load MobileNet for image classification
      const model = await tf.loadLayersModel('https://tfhub.dev/google/imagenet/mobilenet_v2_100_224/classification/4');
      this.models.set('image_classification', model);
    } catch (error) {
      logger.warn('Image classification model not available, using fallback', { error });
      // Create a simple placeholder model
      const model = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [224 * 224 * 3], units: 256, activation: 'relu' }),
          tf.layers.dense({ units: 128, activation: 'relu' }),
          tf.layers.dense({ units: 1000, activation: 'softmax' }) // ImageNet classes
        ]
      });
      this.models.set('image_classification', model);
    }
  }

  private async loadTextRecognitionModel(): Promise<void> {
    // Text recognition would typically use OCR libraries like Tesseract
    // For now, we'll create a placeholder
    logger.info('Text recognition model loaded (placeholder)');
  }

  async analyzeImage(request: ImageAnalysisRequest): Promise<ImageAnalysisResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isInitialized) {
        await this.initializeModels();
      }

      // Create analysis record
      const analysisId = generateId();
      await ImageAnalysisModel.create({
        id: analysisId,
        userId: request.userId,
        companyId: request.companyId,
        filename: this.extractFilename(request.imageUrl),
        originalUrl: request.imageUrl,
        analysisType: request.analysisType.toUpperCase() as any,
        results: {},
        status: 'PROCESSING',
        metadata: request.metadata || {},
        tags: [],
      });

      // Load and preprocess image
      const imageBuffer = await this.loadImage(request.imageUrl);
      const preprocessedImage = await this.preprocessImage(imageBuffer);

      // Perform analysis based on type
      let results: any;
      switch (request.analysisType) {
        case 'shelf_compliance':
          results = await this.analyzeShelfCompliance(preprocessedImage);
          break;
        case 'product_recognition':
          results = await this.recognizeProducts(preprocessedImage);
          break;
        case 'planogram_analysis':
          results = await this.analyzePlanogram(preprocessedImage);
          break;
        case 'brand_visibility':
          results = await this.analyzeBrandVisibility(preprocessedImage);
          break;
        case 'competitor_analysis':
          results = await this.analyzeCompetitors(preprocessedImage);
          break;
        case 'quality_check':
          results = await this.performQualityCheck(preprocessedImage);
          break;
        case 'inventory_count':
          results = await this.countInventory(preprocessedImage);
          break;
        default:
          throw new Error(`Unsupported analysis type: ${request.analysisType}`);
      }

      const processingTime = Date.now() - startTime;
      const confidence = this.calculateOverallConfidence(results);

      // Update analysis record
      await ImageAnalysisModel.update(analysisId, {
        results,
        confidence,
        processingTime,
        status: 'COMPLETED',
      });

      logger.info('Image analysis completed', {
        analysisId,
        analysisType: request.analysisType,
        processingTime,
        confidence,
      });

      return {
        analysisId,
        results,
        confidence,
        processingTime,
        metadata: request.metadata,
      };

    } catch (error) {
      logger.error('Image analysis failed', { error, request });
      throw error;
    }
  }

  private async loadImage(imageUrl: string): Promise<Buffer> {
    if (imageUrl.startsWith('http')) {
      // Download image from URL
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      return Buffer.from(await response.arrayBuffer());
    } else {
      // Load from local file system
      const fs = await import('fs');
      return fs.readFileSync(imageUrl);
    }
  }

  private async preprocessImage(imageBuffer: Buffer): Promise<tf.Tensor3D> {
    try {
      // Resize and normalize image using Sharp
      const processedBuffer = await sharp(imageBuffer)
        .resize(224, 224)
        .removeAlpha()
        .raw()
        .toBuffer();

      // Convert to tensor
      const tensor = tf.tensor3d(
        new Uint8Array(processedBuffer),
        [224, 224, 3],
        'int32'
      );

      // Normalize to [0, 1]
      return tensor.div(255.0) as tf.Tensor3D;

    } catch (error) {
      logger.error('Image preprocessing failed', { error });
      throw error;
    }
  }

  private async analyzeShelfCompliance(image: tf.Tensor3D): Promise<ShelfComplianceResult> {
    // Simulate shelf compliance analysis
    // In a real implementation, this would use specialized models
    
    const objectDetection = await this.detectObjects(image);
    
    // Analyze compliance based on detected objects
    const compliance = {
      overall: 0.85,
      planogram: 0.82,
      pricing: 0.90,
      availability: 0.88,
      positioning: 0.80,
    };

    const violations = [
      {
        type: 'planogram_violation',
        severity: 'medium' as const,
        description: 'Product placement does not match planogram',
        location: { x: 150, y: 200 },
      },
      {
        type: 'missing_price_tag',
        severity: 'high' as const,
        description: 'Price tag missing for premium product',
        location: { x: 300, y: 150 },
      },
    ];

    const recommendations = [
      'Reposition products according to planogram',
      'Add missing price tags',
      'Improve product facing',
      'Check stock levels for out-of-stock items',
    ];

    return {
      compliance,
      violations,
      recommendations,
    };
  }

  private async recognizeProducts(image: tf.Tensor3D): Promise<ProductRecognitionResult> {
    // Simulate product recognition
    const objectDetection = await this.detectObjects(image);
    
    const products = [
      {
        name: 'Coca-Cola Classic 330ml',
        brand: 'Coca-Cola',
        category: 'Soft Drinks',
        confidence: 0.92,
        bbox: { x: 50, y: 100, width: 80, height: 120 },
        attributes: {
          size: '330ml',
          flavor: 'Classic',
          price: 1.99,
        },
      },
      {
        name: 'Pepsi Cola 330ml',
        brand: 'Pepsi',
        category: 'Soft Drinks',
        confidence: 0.88,
        bbox: { x: 150, y: 100, width: 80, height: 120 },
        attributes: {
          size: '330ml',
          flavor: 'Original',
          price: 1.89,
        },
      },
    ];

    const brandDistribution = products.reduce((acc, product) => {
      acc[product.brand] = (acc[product.brand] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      products,
      totalProducts: products.length,
      brandDistribution,
    };
  }

  private async analyzePlanogram(image: tf.Tensor3D): Promise<any> {
    // Simulate planogram analysis
    const products = await this.recognizeProducts(image);
    
    return {
      planogramCompliance: 0.78,
      expectedProducts: 12,
      actualProducts: products.totalProducts,
      missingProducts: ['Product A', 'Product B'],
      incorrectPlacements: [
        {
          product: 'Coca-Cola Classic 330ml',
          expected: { shelf: 2, position: 3 },
          actual: { shelf: 2, position: 5 },
        },
      ],
      shelfUtilization: 0.85,
      recommendations: [
        'Move Coca-Cola to correct position',
        'Add missing products to shelf',
        'Optimize shelf space utilization',
      ],
    };
  }

  private async analyzeBrandVisibility(image: tf.Tensor3D): Promise<any> {
    const products = await this.recognizeProducts(image);
    
    const brandVisibility = Object.entries(products.brandDistribution).map(([brand, count]) => ({
      brand,
      visibility: count / products.totalProducts,
      shelfShare: count / products.totalProducts,
      facings: count,
    }));

    return {
      brandVisibility,
      dominantBrand: brandVisibility.reduce((prev, current) => 
        prev.visibility > current.visibility ? prev : current
      ),
      competitorPresence: brandVisibility.filter(b => b.brand !== 'Your Brand'),
      recommendations: [
        'Increase facings for underperforming brands',
        'Optimize product placement for better visibility',
        'Consider promotional displays for key brands',
      ],
    };
  }

  private async analyzeCompetitors(image: tf.Tensor3D): Promise<any> {
    const products = await this.recognizeProducts(image);
    
    const competitors = products.products.filter(p => p.brand !== 'Your Brand');
    
    return {
      competitorProducts: competitors,
      competitorBrands: [...new Set(competitors.map(p => p.brand))],
      priceComparison: competitors.map(p => ({
        product: p.name,
        competitorPrice: p.attributes.price,
        yourPrice: (p.attributes.price || 0) * 1.1, // Simulate your price
        priceDifference: (p.attributes.price || 0) * 0.1,
      })),
      marketShare: {
        yours: 0.35,
        competitors: 0.65,
      },
      threats: [
        'Competitor has lower prices',
        'Better shelf positioning for competitor products',
        'New competitor product launched',
      ],
      opportunities: [
        'Gap in premium segment',
        'Opportunity for better positioning',
        'Promotional opportunity identified',
      ],
    };
  }

  private async performQualityCheck(image: tf.Tensor3D): Promise<any> {
    // Simulate quality check analysis
    return {
      overallQuality: 0.88,
      issues: [
        {
          type: 'damaged_packaging',
          severity: 'medium',
          location: { x: 200, y: 150 },
          description: 'Package appears damaged',
        },
        {
          type: 'expired_product',
          severity: 'high',
          location: { x: 100, y: 200 },
          description: 'Product past expiration date',
        },
      ],
      recommendations: [
        'Remove damaged products from shelf',
        'Check expiration dates regularly',
        'Implement quality control procedures',
      ],
    };
  }

  private async countInventory(image: tf.Tensor3D): Promise<any> {
    const objectDetection = await this.detectObjects(image);
    
    return {
      totalItems: objectDetection.totalObjects,
      itemsByCategory: {
        'Soft Drinks': 8,
        'Snacks': 12,
        'Dairy': 6,
        'Bakery': 4,
      },
      stockLevels: {
        'Coca-Cola Classic': { current: 15, minimum: 10, status: 'adequate' },
        'Pepsi Cola': { current: 8, minimum: 10, status: 'low' },
        'Sprite': { current: 5, minimum: 8, status: 'critical' },
      },
      restockNeeded: ['Pepsi Cola', 'Sprite'],
      estimatedValue: 245.50,
    };
  }

  private async detectObjects(image: tf.Tensor3D): Promise<ObjectDetectionResult> {
    try {
      const model = this.models.get('object_detection');
      if (!model) {
        throw new Error('Object detection model not loaded');
      }

      // Expand dimensions for batch processing
      const batchedImage = image.expandDims(0);
      
      // Run inference
      const predictions = model.predict(batchedImage) as tf.Tensor;
      const predictionData = await predictions.data();
      
      // Clean up tensors
      batchedImage.dispose();
      predictions.dispose();

      // Simulate object detection results
      const objects = [
        {
          class: 'bottle',
          confidence: 0.92,
          bbox: { x: 50, y: 100, width: 80, height: 120 },
        },
        {
          class: 'can',
          confidence: 0.88,
          bbox: { x: 150, y: 100, width: 60, height: 100 },
        },
        {
          class: 'package',
          confidence: 0.85,
          bbox: { x: 250, y: 120, width: 100, height: 80 },
        },
      ];

      return {
        objects,
        totalObjects: objects.length,
      };

    } catch (error) {
      logger.error('Object detection failed', { error });
      // Return fallback results
      return {
        objects: [],
        totalObjects: 0,
      };
    }
  }

  private calculateOverallConfidence(results: any): number {
    // Calculate confidence based on analysis results
    if (results.compliance) {
      return results.compliance.overall;
    } else if (results.products) {
      const avgConfidence = results.products.reduce((sum: number, p: any) => sum + p.confidence, 0) / results.products.length;
      return avgConfidence;
    } else if (results.overallQuality) {
      return results.overallQuality;
    }
    
    return 0.8; // Default confidence
  }

  private extractFilename(url: string): string {
    return url.split('/').pop() || 'unknown.jpg';
  }

  // Batch processing
  async processBatch(requests: ImageAnalysisRequest[]): Promise<ImageAnalysisResult[]> {
    const results: ImageAnalysisResult[] = [];
    
    // Process images in parallel (with concurrency limit)
    const concurrency = config.queue.concurrency.imageProcessing;
    const chunks = this.chunkArray(requests, concurrency);
    
    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(request => this.analyzeImage(request))
      );
      results.push(...chunkResults);
    }
    
    return results;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Model management
  async updateModel(modelType: string, modelPath: string): Promise<void> {
    try {
      const model = await tf.loadLayersModel(modelPath);
      this.models.set(modelType, model);
      logger.info('Model updated successfully', { modelType, modelPath });
    } catch (error) {
      logger.error('Failed to update model', { modelType, modelPath, error });
      throw error;
    }
  }

  // Cleanup
  dispose(): void {
    for (const model of this.models.values()) {
      model.dispose();
    }
    this.models.clear();
  }

  // Health check
  isHealthy(): boolean {
    return this.isInitialized && this.models.size > 0;
  }

  // Get analysis history
  async getAnalysisHistory(companyId: string, userId?: string): Promise<any[]> {
    const filters: any = { companyId };
    if (userId) {
      filters.userId = userId;
    }
    
    const result = await ImageAnalysisModel.findMany(
      { page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' },
      filters
    );
    
    return result.data;
  }

  // Get analysis by ID
  async getAnalysis(analysisId: string): Promise<any> {
    return await ImageAnalysisModel.findById(analysisId);
  }
}