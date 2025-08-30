import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3008', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database Configuration
  database: {
    url: process.env.DATABASE_URL || 'postgresql://admin:admin123@localhost:5432/trade_marketing_ai',
  },
  
  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    keyPrefix: 'tm:ai:',
    defaultTTL: 3600, // 1 hour
  },
  
  // Kafka Configuration
  kafka: {
    brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
    clientId: 'ai-service',
    groupId: 'ai-service-group',
    topics: {
      aiEvents: 'ai.events',
      chatEvents: 'chat.events',
      predictionEvents: 'prediction.events',
      trainingEvents: 'training.events',
    },
  },
  
  // AI Provider Configuration
  ai: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4000', 10),
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
      timeout: parseInt(process.env.OPENAI_TIMEOUT || '30000', 10),
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229',
      maxTokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || '4000', 10),
      temperature: parseFloat(process.env.ANTHROPIC_TEMPERATURE || '0.7'),
    },
    google: {
      apiKey: process.env.GOOGLE_AI_API_KEY || '',
      model: process.env.GOOGLE_AI_MODEL || 'gemini-pro',
    },
    huggingface: {
      apiKey: process.env.HUGGINGFACE_API_KEY || '',
      endpoint: process.env.HUGGINGFACE_ENDPOINT || 'https://api-inference.huggingface.co',
    },
  },
  
  // Chatbot Configuration
  chatbot: {
    defaultProvider: process.env.CHATBOT_PROVIDER || 'openai',
    maxConversationLength: parseInt(process.env.MAX_CONVERSATION_LENGTH || '50', 10),
    contextWindow: parseInt(process.env.CONTEXT_WINDOW || '10', 10),
    responseTimeout: parseInt(process.env.RESPONSE_TIMEOUT || '30000', 10),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    enableMemory: process.env.ENABLE_MEMORY === 'true',
    enablePersonalization: process.env.ENABLE_PERSONALIZATION === 'true',
    enableAnalytics: process.env.ENABLE_ANALYTICS === 'true',
  },
  
  // Machine Learning Configuration
  ml: {
    tensorflow: {
      backend: process.env.TF_BACKEND || 'cpu', // cpu, gpu, webgl
      enableProfiling: process.env.TF_PROFILING === 'true',
    },
    automl: {
      maxExperiments: parseInt(process.env.AUTOML_MAX_EXPERIMENTS || '10', 10),
      maxTrainingTime: parseInt(process.env.AUTOML_MAX_TRAINING_TIME || '3600', 10), // seconds
      defaultMetric: process.env.AUTOML_DEFAULT_METRIC || 'accuracy',
    },
    models: {
      cacheDir: process.env.MODEL_CACHE_DIR || './models',
      maxCacheSize: parseInt(process.env.MODEL_MAX_CACHE_SIZE || '1000', 10), // MB
    },
  },
  
  // Natural Language Processing
  nlp: {
    defaultLanguage: process.env.NLP_DEFAULT_LANGUAGE || 'en',
    enableSentimentAnalysis: process.env.NLP_SENTIMENT === 'true',
    enableEntityExtraction: process.env.NLP_ENTITIES === 'true',
    enableIntentClassification: process.env.NLP_INTENT === 'true',
    enableKeywordExtraction: process.env.NLP_KEYWORDS === 'true',
  },
  
  // Computer Vision Configuration
  cv: {
    maxImageSize: parseInt(process.env.CV_MAX_IMAGE_SIZE || '10485760', 10), // 10MB
    supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'bmp'],
    defaultQuality: parseInt(process.env.CV_DEFAULT_QUALITY || '85', 10),
    enableGPU: process.env.CV_ENABLE_GPU === 'true',
    models: {
      objectDetection: process.env.CV_OBJECT_DETECTION_MODEL || 'yolov5',
      imageClassification: process.env.CV_IMAGE_CLASSIFICATION_MODEL || 'mobilenet',
      textRecognition: process.env.CV_TEXT_RECOGNITION_MODEL || 'tesseract',
    },
  },
  
  // Vector Database Configuration
  vectorDb: {
    provider: process.env.VECTOR_DB_PROVIDER || 'redis', // redis, pinecone, weaviate
    dimensions: parseInt(process.env.VECTOR_DIMENSIONS || '1536', 10),
    similarity: process.env.VECTOR_SIMILARITY || 'cosine', // cosine, euclidean, dot
    indexName: process.env.VECTOR_INDEX_NAME || 'trade-marketing-embeddings',
  },
  
  // File Storage Configuration
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local', // local, s3, gcs
    local: {
      uploadDir: process.env.LOCAL_UPLOAD_DIR || './uploads',
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '52428800', 10), // 50MB
    },
    s3: {
      bucket: process.env.S3_BUCKET || '',
      region: process.env.S3_REGION || 'us-east-1',
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
  },
  
  // Queue Configuration
  queue: {
    redis: {
      host: process.env.QUEUE_REDIS_HOST || 'localhost',
      port: parseInt(process.env.QUEUE_REDIS_PORT || '6379', 10),
      password: process.env.QUEUE_REDIS_PASSWORD || '',
    },
    concurrency: {
      training: parseInt(process.env.QUEUE_TRAINING_CONCURRENCY || '2', 10),
      prediction: parseInt(process.env.QUEUE_PREDICTION_CONCURRENCY || '10', 10),
      imageProcessing: parseInt(process.env.QUEUE_IMAGE_CONCURRENCY || '5', 10),
    },
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each user to 1000 requests per windowMs
    chat: {
      windowMs: 60 * 1000, // 1 minute
      max: 20, // 20 messages per minute
    },
    prediction: {
      windowMs: 60 * 1000, // 1 minute
      max: 100, // 100 predictions per minute
    },
    training: {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5, // 5 training jobs per hour
    },
  },
  
  // WebSocket Configuration
  websocket: {
    cors: {
      origin: process.env.WS_CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      credentials: true,
    },
    pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '60000', 10),
    pingInterval: parseInt(process.env.WS_PING_INTERVAL || '25000', 10),
  },
  
  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  },
  
  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
  },
  
  // Monitoring Configuration
  monitoring: {
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    metricsPort: parseInt(process.env.METRICS_PORT || '9090', 10),
    enableTracing: process.env.ENABLE_TRACING === 'true',
  },
  
  // Feature Flags
  features: {
    chatbot: process.env.FEATURE_CHATBOT !== 'false',
    automl: process.env.FEATURE_AUTOML === 'true',
    computerVision: process.env.FEATURE_COMPUTER_VISION === 'true',
    voiceInterface: process.env.FEATURE_VOICE_INTERFACE === 'true',
    multiLanguage: process.env.FEATURE_MULTI_LANGUAGE === 'true',
    realTimeAnalytics: process.env.FEATURE_REAL_TIME_ANALYTICS === 'true',
    predictiveAnalytics: process.env.FEATURE_PREDICTIVE_ANALYTICS === 'true',
    recommendationEngine: process.env.FEATURE_RECOMMENDATION_ENGINE === 'true',
  },
  
  // Business Context
  business: {
    domains: [
      'trade_marketing',
      'promotion_planning',
      'field_execution',
      'supply_chain',
      'financial_management',
      'analytics',
      'customer_insights',
    ],
    languages: ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko'],
    currencies: ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'BRL'],
    regions: ['NORTH_AMERICA', 'EUROPE', 'ASIA_PACIFIC', 'LATIN_AMERICA', 'MIDDLE_EAST_AFRICA'],
  },
};

export default config;