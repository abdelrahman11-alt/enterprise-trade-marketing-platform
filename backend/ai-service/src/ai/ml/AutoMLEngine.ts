import * as tf from '@tensorflow/tfjs-node';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { AutoMLExperimentModel } from '../../models/AutoMLExperiment';
import { AIModelModel } from '../../models/AIModel';
import { PredictionModel } from '../../models/Prediction';
import { generateId } from '@trade-marketing/shared';

export interface Dataset {
  features: number[][];
  target: number[];
  featureNames: string[];
  targetName: string;
}

export interface ModelConfig {
  type: 'classification' | 'regression' | 'clustering' | 'time_series';
  hyperparameters?: any;
  validation?: {
    method: 'holdout' | 'cross_validation' | 'time_series_split';
    testSize?: number;
    folds?: number;
  };
}

export interface TrainingResult {
  model: tf.LayersModel;
  metrics: any;
  history: any;
  config: ModelConfig;
}

export interface PredictionResult {
  predictions: number[];
  confidence?: number[];
  probabilities?: number[][];
}

export class AutoMLEngine {
  private models: Map<string, tf.LayersModel> = new Map();
  private modelConfigs: Map<string, ModelConfig> = new Map();

  constructor() {
    // Set TensorFlow backend
    if (config.ml.tensorflow.backend === 'gpu') {
      tf.setBackend('tensorflow');
    } else {
      tf.setBackend('cpu');
    }

    // Enable profiling if configured
    if (config.ml.tensorflow.enableProfiling) {
      tf.enableProdMode();
    }
  }

  async createExperiment(
    name: string,
    description: string,
    companyId: string,
    userId: string,
    problemType: 'classification' | 'regression' | 'clustering' | 'time_series',
    dataset: any,
    targetColumn: string,
    features: string[]
  ): Promise<string> {
    try {
      const experimentId = generateId();

      // Create experiment record
      await AutoMLExperimentModel.create({
        id: experimentId,
        name,
        description,
        companyId,
        userId,
        problemType: problemType.toUpperCase() as any,
        dataset,
        targetColumn,
        features,
        config: {
          autoFeatureSelection: true,
          autoHyperparameterTuning: true,
          maxModels: config.ml.automl.maxExperiments,
          maxTrainingTime: config.ml.automl.maxTrainingTime,
        },
        status: 'PENDING',
      });

      // Start experiment asynchronously
      this.runExperiment(experimentId).catch(error => {
        logger.error('Experiment failed', { experimentId, error });
        AutoMLExperimentModel.update(experimentId, {
          status: 'FAILED',
          error: error.message,
          completedAt: new Date(),
        });
      });

      return experimentId;
    } catch (error) {
      logger.error('Failed to create experiment', { error });
      throw error;
    }
  }

  private async runExperiment(experimentId: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Update status to running
      await AutoMLExperimentModel.update(experimentId, {
        status: 'RUNNING',
        startedAt: new Date(),
        progress: 0,
      });

      // Get experiment details
      const experiment = await AutoMLExperimentModel.findById(experimentId);
      if (!experiment) {
        throw new Error('Experiment not found');
      }

      // Prepare dataset
      const dataset = await this.prepareDataset(experiment.dataset, experiment.features, experiment.targetColumn);
      
      // Update progress
      await AutoMLExperimentModel.update(experimentId, { progress: 10 });

      // Feature engineering
      const engineeredDataset = await this.performFeatureEngineering(dataset);
      
      // Update progress
      await AutoMLExperimentModel.update(experimentId, { progress: 20 });

      // Split data
      const { trainData, testData } = this.splitData(engineeredDataset);
      
      // Update progress
      await AutoMLExperimentModel.update(experimentId, { progress: 30 });

      // Generate model configurations
      const modelConfigs = this.generateModelConfigurations(experiment.problemType as any);
      
      // Train multiple models
      const results: TrainingResult[] = [];
      const totalModels = modelConfigs.length;

      for (let i = 0; i < modelConfigs.length; i++) {
        const config = modelConfigs[i];
        
        try {
          const result = await this.trainModel(trainData, testData, config);
          results.push(result);
          
          // Update progress
          const progress = 30 + ((i + 1) / totalModels) * 60;
          await AutoMLExperimentModel.update(experimentId, { progress });
          
        } catch (error) {
          logger.warn('Model training failed', { experimentId, config, error });
        }
      }

      // Select best model
      const bestResult = this.selectBestModel(results, experiment.problemType as any);
      
      // Update progress
      await AutoMLExperimentModel.update(experimentId, { progress: 95 });

      // Save best model
      const modelId = await this.saveModel(bestResult, experiment);
      
      // Complete experiment
      const duration = Math.floor((Date.now() - startTime) / 1000);
      await AutoMLExperimentModel.update(experimentId, {
        status: 'COMPLETED',
        progress: 100,
        bestModel: {
          id: modelId,
          config: bestResult.config,
          metrics: bestResult.metrics,
        },
        bestScore: this.extractBestScore(bestResult.metrics, experiment.problemType as any),
        models: results.map(r => ({
          config: r.config,
          metrics: r.metrics,
        })),
        completedAt: new Date(),
        duration,
      });

      logger.info('AutoML experiment completed', {
        experimentId,
        duration,
        bestScore: this.extractBestScore(bestResult.metrics, experiment.problemType as any),
        modelsCount: results.length,
      });

    } catch (error) {
      const duration = Math.floor((Date.now() - startTime) / 1000);
      await AutoMLExperimentModel.update(experimentId, {
        status: 'FAILED',
        error: error.message,
        completedAt: new Date(),
        duration,
      });
      throw error;
    }
  }

  private async prepareDataset(rawData: any, features: string[], targetColumn: string): Promise<Dataset> {
    // Convert raw data to tensors
    const data = Array.isArray(rawData) ? rawData : rawData.data;
    
    const featureData: number[][] = [];
    const targetData: number[] = [];

    for (const row of data) {
      const featureRow: number[] = [];
      
      for (const feature of features) {
        let value = row[feature];
        
        // Handle missing values
        if (value === null || value === undefined || value === '') {
          value = 0; // Simple imputation
        }
        
        // Convert to number
        if (typeof value === 'string') {
          value = parseFloat(value) || 0;
        }
        
        featureRow.push(value);
      }
      
      featureData.push(featureRow);
      
      // Handle target
      let targetValue = row[targetColumn];
      if (typeof targetValue === 'string') {
        targetValue = parseFloat(targetValue) || 0;
      }
      targetData.push(targetValue);
    }

    return {
      features: featureData,
      target: targetData,
      featureNames: features,
      targetName: targetColumn,
    };
  }

  private async performFeatureEngineering(dataset: Dataset): Promise<Dataset> {
    // Normalize features
    const normalizedFeatures = this.normalizeFeatures(dataset.features);
    
    // Feature selection (simplified)
    const selectedFeatures = this.selectFeatures(normalizedFeatures, dataset.target);
    
    return {
      ...dataset,
      features: selectedFeatures,
    };
  }

  private normalizeFeatures(features: number[][]): number[][] {
    if (features.length === 0) return features;
    
    const numFeatures = features[0].length;
    const means: number[] = [];
    const stds: number[] = [];
    
    // Calculate means and standard deviations
    for (let i = 0; i < numFeatures; i++) {
      const column = features.map(row => row[i]);
      const mean = column.reduce((sum, val) => sum + val, 0) / column.length;
      const variance = column.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / column.length;
      const std = Math.sqrt(variance);
      
      means.push(mean);
      stds.push(std || 1); // Avoid division by zero
    }
    
    // Normalize
    return features.map(row =>
      row.map((val, i) => (val - means[i]) / stds[i])
    );
  }

  private selectFeatures(features: number[][], target: number[]): number[][] {
    // Simple correlation-based feature selection
    if (features.length === 0) return features;
    
    const numFeatures = features[0].length;
    const correlations: number[] = [];
    
    for (let i = 0; i < numFeatures; i++) {
      const column = features.map(row => row[i]);
      const correlation = this.calculateCorrelation(column, target);
      correlations.push(Math.abs(correlation));
    }
    
    // Select top features (simplified - select all for now)
    return features;
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    const sumY2 = y.reduce((sum, val) => sum + val * val, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private splitData(dataset: Dataset): { trainData: Dataset; testData: Dataset } {
    const testSize = 0.2;
    const splitIndex = Math.floor(dataset.features.length * (1 - testSize));
    
    return {
      trainData: {
        features: dataset.features.slice(0, splitIndex),
        target: dataset.target.slice(0, splitIndex),
        featureNames: dataset.featureNames,
        targetName: dataset.targetName,
      },
      testData: {
        features: dataset.features.slice(splitIndex),
        target: dataset.target.slice(splitIndex),
        featureNames: dataset.featureNames,
        targetName: dataset.targetName,
      },
    };
  }

  private generateModelConfigurations(problemType: string): ModelConfig[] {
    const configs: ModelConfig[] = [];
    
    if (problemType === 'CLASSIFICATION') {
      // Simple neural network configurations
      configs.push(
        {
          type: 'classification',
          hyperparameters: {
            layers: [64, 32],
            activation: 'relu',
            dropout: 0.2,
            learningRate: 0.001,
            epochs: 50,
          },
        },
        {
          type: 'classification',
          hyperparameters: {
            layers: [128, 64, 32],
            activation: 'relu',
            dropout: 0.3,
            learningRate: 0.0005,
            epochs: 100,
          },
        }
      );
    } else if (problemType === 'REGRESSION') {
      configs.push(
        {
          type: 'regression',
          hyperparameters: {
            layers: [64, 32],
            activation: 'relu',
            dropout: 0.2,
            learningRate: 0.001,
            epochs: 50,
          },
        },
        {
          type: 'regression',
          hyperparameters: {
            layers: [128, 64],
            activation: 'relu',
            dropout: 0.1,
            learningRate: 0.0005,
            epochs: 100,
          },
        }
      );
    }
    
    return configs;
  }

  private async trainModel(
    trainData: Dataset,
    testData: Dataset,
    config: ModelConfig
  ): Promise<TrainingResult> {
    const { hyperparameters } = config;
    
    // Create model architecture
    const model = tf.sequential();
    
    // Input layer
    model.add(tf.layers.dense({
      inputShape: [trainData.features[0].length],
      units: hyperparameters.layers[0],
      activation: hyperparameters.activation,
    }));
    
    // Hidden layers
    for (let i = 1; i < hyperparameters.layers.length; i++) {
      model.add(tf.layers.dropout({ rate: hyperparameters.dropout }));
      model.add(tf.layers.dense({
        units: hyperparameters.layers[i],
        activation: hyperparameters.activation,
      }));
    }
    
    // Output layer
    if (config.type === 'classification') {
      const numClasses = Math.max(...trainData.target) + 1;
      model.add(tf.layers.dense({
        units: numClasses,
        activation: 'softmax',
      }));
    } else {
      model.add(tf.layers.dense({
        units: 1,
        activation: 'linear',
      }));
    }
    
    // Compile model
    model.compile({
      optimizer: tf.train.adam(hyperparameters.learningRate),
      loss: config.type === 'classification' ? 'sparseCategoricalCrossentropy' : 'meanSquaredError',
      metrics: config.type === 'classification' ? ['accuracy'] : ['mae'],
    });
    
    // Prepare tensors
    const xTrain = tf.tensor2d(trainData.features);
    const yTrain = tf.tensor1d(trainData.target);
    const xTest = tf.tensor2d(testData.features);
    const yTest = tf.tensor1d(testData.target);
    
    try {
      // Train model
      const history = await model.fit(xTrain, yTrain, {
        epochs: hyperparameters.epochs,
        validationData: [xTest, yTest],
        verbose: 0,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 10 === 0) {
              logger.debug('Training progress', { epoch, logs });
            }
          },
        },
      });
      
      // Evaluate model
      const evaluation = model.evaluate(xTest, yTest, { verbose: 0 }) as tf.Scalar[];
      const metrics = {
        loss: await evaluation[0].data(),
        [config.type === 'classification' ? 'accuracy' : 'mae']: await evaluation[1].data(),
      };
      
      return {
        model,
        metrics,
        history: history.history,
        config,
      };
      
    } finally {
      // Clean up tensors
      xTrain.dispose();
      yTrain.dispose();
      xTest.dispose();
      yTest.dispose();
    }
  }

  private selectBestModel(results: TrainingResult[], problemType: string): TrainingResult {
    if (results.length === 0) {
      throw new Error('No models trained successfully');
    }
    
    // Select based on primary metric
    const metric = problemType === 'CLASSIFICATION' ? 'accuracy' : 'mae';
    const isHigherBetter = metric === 'accuracy';
    
    return results.reduce((best, current) => {
      const bestScore = best.metrics[metric][0];
      const currentScore = current.metrics[metric][0];
      
      if (isHigherBetter) {
        return currentScore > bestScore ? current : best;
      } else {
        return currentScore < bestScore ? current : best;
      }
    });
  }

  private async saveModel(result: TrainingResult, experiment: any): Promise<string> {
    const modelId = generateId();
    
    // Save model to filesystem
    const modelPath = `${config.ml.models.cacheDir}/${modelId}`;
    await result.model.save(`file://${modelPath}`);
    
    // Create model record
    await AIModelModel.create({
      id: modelId,
      name: `AutoML-${experiment.name}`,
      displayName: `AutoML Model for ${experiment.name}`,
      description: `Automatically generated model for ${experiment.problemType.toLowerCase()} problem`,
      type: this.mapProblemTypeToModelType(experiment.problemType),
      version: '1.0.0',
      provider: 'CUSTOM',
      config: {
        architecture: result.config.hyperparameters,
        features: experiment.features,
        targetColumn: experiment.targetColumn,
        modelPath,
      },
      capabilities: [experiment.problemType.toLowerCase()],
      status: 'ACTIVE',
      accuracy: this.extractBestScore(result.metrics, experiment.problemType),
      lastTrainedAt: new Date(),
      trainingData: {
        experimentId: experiment.id,
        datasetSize: experiment.dataset.length,
        features: experiment.features.length,
      },
      metrics: result.metrics,
      createdBy: experiment.userId,
      updatedBy: experiment.userId,
    });
    
    // Cache model in memory
    this.models.set(modelId, result.model);
    this.modelConfigs.set(modelId, result.config);
    
    return modelId;
  }

  private mapProblemTypeToModelType(problemType: string): any {
    const mapping: Record<string, any> = {
      'CLASSIFICATION': 'CLASSIFICATION',
      'REGRESSION': 'REGRESSION',
      'CLUSTERING': 'CLUSTERING',
      'TIME_SERIES': 'TIME_SERIES',
    };
    
    return mapping[problemType] || 'CLASSIFICATION';
  }

  private extractBestScore(metrics: any, problemType: string): number {
    const metric = problemType === 'CLASSIFICATION' ? 'accuracy' : 'mae';
    return metrics[metric] ? metrics[metric][0] : 0;
  }

  async predict(modelId: string, input: number[][]): Promise<PredictionResult> {
    try {
      let model = this.models.get(modelId);
      
      if (!model) {
        // Load model from database
        const modelRecord = await AIModelModel.findById(modelId);
        if (!modelRecord) {
          throw new Error('Model not found');
        }
        
        // Load model from filesystem
        const modelPath = modelRecord.config.modelPath;
        model = await tf.loadLayersModel(`file://${modelPath}`);
        
        // Cache model
        this.models.set(modelId, model);
      }
      
      // Make predictions
      const inputTensor = tf.tensor2d(input);
      const predictions = model.predict(inputTensor) as tf.Tensor;
      const predictionData = await predictions.data();
      
      // Clean up
      inputTensor.dispose();
      predictions.dispose();
      
      // Format results
      const results: number[] = Array.from(predictionData);
      
      return {
        predictions: results,
        confidence: results.map(() => 0.8), // Simplified confidence
      };
      
    } catch (error) {
      logger.error('Prediction failed', { modelId, error });
      throw error;
    }
  }

  async getExperimentStatus(experimentId: string): Promise<any> {
    return await AutoMLExperimentModel.findById(experimentId);
  }

  async listExperiments(companyId: string, userId?: string): Promise<any[]> {
    const filters: any = { companyId };
    if (userId) {
      filters.userId = userId;
    }
    
    const result = await AutoMLExperimentModel.findMany(
      { page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' },
      filters
    );
    
    return result.data;
  }

  async deleteExperiment(experimentId: string): Promise<void> {
    await AutoMLExperimentModel.update(experimentId, {
      status: 'CANCELLED',
    });
  }

  // Model management
  async listModels(companyId?: string): Promise<any[]> {
    const filters: any = {};
    if (companyId) {
      // This would need to be implemented in the model
      // filters.companyId = companyId;
    }
    
    const result = await AIModelModel.findMany(
      { page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' },
      filters
    );
    
    return result.data;
  }

  async deleteModel(modelId: string): Promise<void> {
    // Remove from cache
    this.models.delete(modelId);
    this.modelConfigs.delete(modelId);
    
    // Update database
    await AIModelModel.update(modelId, {
      status: 'DEPRECATED',
    });
  }

  // Cleanup methods
  dispose(): void {
    // Dispose all cached models
    for (const model of this.models.values()) {
      model.dispose();
    }
    this.models.clear();
    this.modelConfigs.clear();
  }
}