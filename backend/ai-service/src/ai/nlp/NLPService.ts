import natural from 'natural';
import compromise from 'compromise';
import sentiment from 'sentiment';
import keyword from 'keyword-extractor';
import { NlpManager } from 'node-nlp';
import { config } from '../../config';
import { logger } from '../../utils/logger';

export interface NLPAnalysisResult {
  intent: string;
  entities: Entity[];
  sentiment: number;
  confidence: number;
  keywords: string[];
  language: string;
  tokens: string[];
  pos: Array<{ word: string; tag: string }>;
}

export interface Entity {
  entity: string;
  value: string;
  start: number;
  end: number;
  confidence: number;
  type: 'person' | 'organization' | 'location' | 'date' | 'money' | 'product' | 'metric' | 'other';
}

export interface IntentClassificationResult {
  intent: string;
  confidence: number;
  alternatives: Array<{ intent: string; confidence: number }>;
}

export interface SentimentAnalysisResult {
  score: number;
  comparative: number;
  calculation: any[];
  tokens: string[];
  words: string[];
  positive: string[];
  negative: string[];
}

export class NLPService {
  private nlpManager: NlpManager;
  private sentimentAnalyzer: any;
  private tokenizer: any;
  private stemmer: any;
  private isInitialized: boolean = false;

  constructor() {
    this.initializeNLP();
  }

  private async initializeNLP(): Promise<void> {
    try {
      // Initialize NLP Manager
      this.nlpManager = new NlpManager({
        languages: config.business.languages,
        forceNER: true,
        nlu: { useNoneFeature: true },
      });

      // Initialize sentiment analyzer
      this.sentimentAnalyzer = new sentiment();

      // Initialize tokenizer and stemmer
      this.tokenizer = new natural.WordTokenizer();
      this.stemmer = natural.PorterStemmer;

      // Train the NLP model with trade marketing intents
      await this.trainTradeMarketingModel();

      this.isInitialized = true;
      logger.info('NLP Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize NLP Service', { error });
    }
  }

  private async trainTradeMarketingModel(): Promise<void> {
    // Add training data for trade marketing intents
    const trainingData = [
      // Promotion Planning
      { text: 'create a new promotion', intent: 'promotion_planning' },
      { text: 'plan a promotion for next quarter', intent: 'promotion_planning' },
      { text: 'set up promotional campaign', intent: 'promotion_planning' },
      { text: 'design promotion strategy', intent: 'promotion_planning' },
      { text: 'budget allocation for promotions', intent: 'promotion_planning' },

      // Analytics and Reporting
      { text: 'show me sales performance', intent: 'analytics' },
      { text: 'generate performance report', intent: 'analytics' },
      { text: 'analyze market trends', intent: 'analytics' },
      { text: 'what are the key metrics', intent: 'analytics' },
      { text: 'dashboard insights', intent: 'analytics' },
      { text: 'ROI analysis', intent: 'analytics' },

      // Field Execution
      { text: 'check store compliance', intent: 'field_execution' },
      { text: 'schedule store visits', intent: 'field_execution' },
      { text: 'field team performance', intent: 'field_execution' },
      { text: 'shelf compliance report', intent: 'field_execution' },
      { text: 'planogram execution', intent: 'field_execution' },

      // Trade Spend Management
      { text: 'optimize trade spend', intent: 'trade_spend' },
      { text: 'budget management', intent: 'trade_spend' },
      { text: 'spend allocation', intent: 'trade_spend' },
      { text: 'cost optimization', intent: 'trade_spend' },
      { text: 'trade investment', intent: 'trade_spend' },

      // Supply Chain
      { text: 'inventory levels', intent: 'supply_chain' },
      { text: 'stock management', intent: 'supply_chain' },
      { text: 'demand forecasting', intent: 'supply_chain' },
      { text: 'supply chain optimization', intent: 'supply_chain' },

      // Customer Insights
      { text: 'customer behavior analysis', intent: 'customer_insights' },
      { text: 'consumer preferences', intent: 'customer_insights' },
      { text: 'market research', intent: 'customer_insights' },
      { text: 'customer segmentation', intent: 'customer_insights' },

      // General Help
      { text: 'help me with', intent: 'general' },
      { text: 'what can you do', intent: 'general' },
      { text: 'how to use', intent: 'general' },
      { text: 'getting started', intent: 'general' },
    ];

    // Add training examples
    for (const example of trainingData) {
      this.nlpManager.addDocument('en', example.text, example.intent);
    }

    // Add entities for trade marketing domain
    this.addTradeMarketingEntities();

    // Train the model
    await this.nlpManager.train();
    logger.info('Trade marketing NLP model trained successfully');
  }

  private addTradeMarketingEntities(): void {
    // Product entities
    const products = ['coca-cola', 'pepsi', 'sprite', 'fanta', 'water', 'juice', 'snacks', 'chips'];
    products.forEach(product => {
      this.nlpManager.addNamedEntityText('product', product, ['en'], [product]);
    });

    // Metric entities
    const metrics = ['sales', 'revenue', 'roi', 'margin', 'volume', 'share', 'growth', 'performance'];
    metrics.forEach(metric => {
      this.nlpManager.addNamedEntityText('metric', metric, ['en'], [metric]);
    });

    // Time entities
    const timeframes = ['today', 'yesterday', 'week', 'month', 'quarter', 'year', 'daily', 'weekly', 'monthly'];
    timeframes.forEach(time => {
      this.nlpManager.addNamedEntityText('timeframe', time, ['en'], [time]);
    });

    // Channel entities
    const channels = ['online', 'offline', 'retail', 'wholesale', 'ecommerce', 'supermarket', 'convenience'];
    channels.forEach(channel => {
      this.nlpManager.addNamedEntityText('channel', channel, ['en'], [channel]);
    });

    // Region entities
    const regions = ['north', 'south', 'east', 'west', 'national', 'regional', 'local', 'global'];
    regions.forEach(region => {
      this.nlpManager.addNamedEntityText('region', region, ['en'], [region]);
    });
  }

  async analyze(text: string, language: string = 'en'): Promise<NLPAnalysisResult> {
    try {
      if (!this.isInitialized) {
        await this.initializeNLP();
      }

      // Intent classification
      const intentResult = await this.classifyIntent(text, language);

      // Entity extraction
      const entities = await this.extractEntities(text, language);

      // Sentiment analysis
      const sentimentResult = this.analyzeSentiment(text);

      // Keyword extraction
      const keywords = this.extractKeywords(text);

      // Tokenization
      const tokens = this.tokenizer.tokenize(text.toLowerCase());

      // Part-of-speech tagging
      const pos = this.performPOSTagging(text);

      return {
        intent: intentResult.intent,
        entities,
        sentiment: sentimentResult.score,
        confidence: intentResult.confidence,
        keywords,
        language,
        tokens,
        pos,
      };

    } catch (error) {
      logger.error('NLP analysis failed', { error, text });
      
      // Return fallback result
      return {
        intent: 'general',
        entities: [],
        sentiment: 0,
        confidence: 0.5,
        keywords: [],
        language,
        tokens: [],
        pos: [],
      };
    }
  }

  async classifyIntent(text: string, language: string = 'en'): Promise<IntentClassificationResult> {
    try {
      const result = await this.nlpManager.process(language, text);
      
      const alternatives = result.classifications
        .slice(1, 4) // Top 3 alternatives
        .map((cls: any) => ({
          intent: cls.intent,
          confidence: cls.score,
        }));

      return {
        intent: result.intent || 'general',
        confidence: result.score || 0.5,
        alternatives,
      };

    } catch (error) {
      logger.error('Intent classification failed', { error, text });
      return {
        intent: 'general',
        confidence: 0.5,
        alternatives: [],
      };
    }
  }

  async extractEntities(text: string, language: string = 'en'): Promise<Entity[]> {
    try {
      const result = await this.nlpManager.process(language, text);
      const entities: Entity[] = [];

      // Extract named entities from NLP manager
      if (result.entities) {
        for (const entity of result.entities) {
          entities.push({
            entity: entity.entity,
            value: entity.sourceText,
            start: entity.start,
            end: entity.end,
            confidence: entity.accuracy || 0.8,
            type: this.mapEntityType(entity.entity),
          });
        }
      }

      // Extract additional entities using compromise
      const doc = compromise(text);
      
      // People
      const people = doc.people().out('array');
      people.forEach((person: string) => {
        const start = text.toLowerCase().indexOf(person.toLowerCase());
        if (start !== -1) {
          entities.push({
            entity: 'person',
            value: person,
            start,
            end: start + person.length,
            confidence: 0.7,
            type: 'person',
          });
        }
      });

      // Organizations
      const orgs = doc.organizations().out('array');
      orgs.forEach((org: string) => {
        const start = text.toLowerCase().indexOf(org.toLowerCase());
        if (start !== -1) {
          entities.push({
            entity: 'organization',
            value: org,
            start,
            end: start + org.length,
            confidence: 0.7,
            type: 'organization',
          });
        }
      });

      // Dates
      const dates = doc.dates().out('array');
      dates.forEach((date: string) => {
        const start = text.toLowerCase().indexOf(date.toLowerCase());
        if (start !== -1) {
          entities.push({
            entity: 'date',
            value: date,
            start,
            end: start + date.length,
            confidence: 0.8,
            type: 'date',
          });
        }
      });

      // Money
      const money = doc.money().out('array');
      money.forEach((amount: string) => {
        const start = text.toLowerCase().indexOf(amount.toLowerCase());
        if (start !== -1) {
          entities.push({
            entity: 'money',
            value: amount,
            start,
            end: start + amount.length,
            confidence: 0.8,
            type: 'money',
          });
        }
      });

      return entities;

    } catch (error) {
      logger.error('Entity extraction failed', { error, text });
      return [];
    }
  }

  analyzeSentiment(text: string): SentimentAnalysisResult {
    try {
      const result = this.sentimentAnalyzer.analyze(text);
      
      return {
        score: result.score,
        comparative: result.comparative,
        calculation: result.calculation,
        tokens: result.tokens,
        words: result.words,
        positive: result.positive,
        negative: result.negative,
      };

    } catch (error) {
      logger.error('Sentiment analysis failed', { error, text });
      return {
        score: 0,
        comparative: 0,
        calculation: [],
        tokens: [],
        words: [],
        positive: [],
        negative: [],
      };
    }
  }

  extractKeywords(text: string): string[] {
    try {
      const keywords = keyword.extract(text, {
        language: 'english',
        remove_digits: false,
        return_changed_case: true,
        remove_duplicates: true,
      });

      // Filter and rank keywords for trade marketing context
      const tradeMarketingKeywords = keywords.filter(kw => 
        kw.length > 2 && 
        !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'].includes(kw.toLowerCase())
      );

      return tradeMarketingKeywords.slice(0, 10); // Top 10 keywords

    } catch (error) {
      logger.error('Keyword extraction failed', { error, text });
      return [];
    }
  }

  private performPOSTagging(text: string): Array<{ word: string; tag: string }> {
    try {
      const tokens = this.tokenizer.tokenize(text);
      const tagged: Array<{ word: string; tag: string }> = [];

      // Simple POS tagging using compromise
      const doc = compromise(text);
      const terms = doc.terms().out('array');
      
      terms.forEach((term: string) => {
        const termDoc = compromise(term);
        let tag = 'NN'; // Default to noun
        
        if (termDoc.verbs().length > 0) tag = 'VB';
        else if (termDoc.adjectives().length > 0) tag = 'JJ';
        else if (termDoc.adverbs().length > 0) tag = 'RB';
        else if (termDoc.nouns().length > 0) tag = 'NN';
        
        tagged.push({ word: term, tag });
      });

      return tagged;

    } catch (error) {
      logger.error('POS tagging failed', { error, text });
      return [];
    }
  }

  private mapEntityType(entityName: string): Entity['type'] {
    const mapping: Record<string, Entity['type']> = {
      'person': 'person',
      'organization': 'organization',
      'location': 'location',
      'date': 'date',
      'time': 'date',
      'money': 'money',
      'product': 'product',
      'metric': 'metric',
    };

    return mapping[entityName] || 'other';
  }

  // Text preprocessing utilities
  preprocessText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  stemText(text: string): string[] {
    const tokens = this.tokenizer.tokenize(text.toLowerCase());
    return tokens.map(token => this.stemmer.stem(token));
  }

  // Language detection
  detectLanguage(text: string): string {
    // Simple language detection based on common words
    const englishWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can'];
    const spanishWords = ['el', 'la', 'de', 'que', 'y', 'en', 'un', 'es', 'se', 'no'];
    const frenchWords = ['le', 'de', 'et', 'à', 'un', 'il', 'être', 'et', 'en', 'avoir'];

    const words = text.toLowerCase().split(/\s+/);
    
    let englishCount = 0;
    let spanishCount = 0;
    let frenchCount = 0;

    words.forEach(word => {
      if (englishWords.includes(word)) englishCount++;
      if (spanishWords.includes(word)) spanishCount++;
      if (frenchWords.includes(word)) frenchCount++;
    });

    if (spanishCount > englishCount && spanishCount > frenchCount) return 'es';
    if (frenchCount > englishCount && frenchCount > spanishCount) return 'fr';
    
    return 'en'; // Default to English
  }

  // Text similarity
  calculateSimilarity(text1: string, text2: string): number {
    const tokens1 = new Set(this.tokenizer.tokenize(text1.toLowerCase()));
    const tokens2 = new Set(this.tokenizer.tokenize(text2.toLowerCase()));
    
    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);
    
    return intersection.size / union.size; // Jaccard similarity
  }

  // Text summarization (simple extractive)
  summarizeText(text: string, maxSentences: number = 3): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length <= maxSentences) {
      return text;
    }

    // Score sentences based on keyword frequency
    const keywords = this.extractKeywords(text);
    const keywordSet = new Set(keywords.map(k => k.toLowerCase()));
    
    const scoredSentences = sentences.map(sentence => {
      const words = this.tokenizer.tokenize(sentence.toLowerCase());
      const score = words.filter(word => keywordSet.has(word)).length;
      return { sentence: sentence.trim(), score };
    });

    // Select top sentences
    const topSentences = scoredSentences
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSentences)
      .map(s => s.sentence);

    return topSentences.join('. ') + '.';
  }

  // Batch processing
  async analyzeBatch(texts: string[], language: string = 'en'): Promise<NLPAnalysisResult[]> {
    const results: NLPAnalysisResult[] = [];
    
    for (const text of texts) {
      try {
        const result = await this.analyze(text, language);
        results.push(result);
      } catch (error) {
        logger.error('Batch analysis failed for text', { error, text });
        results.push({
          intent: 'general',
          entities: [],
          sentiment: 0,
          confidence: 0,
          keywords: [],
          language,
          tokens: [],
          pos: [],
        });
      }
    }
    
    return results;
  }

  // Model training with custom data
  async trainCustomModel(trainingData: Array<{ text: string; intent: string }>): Promise<void> {
    try {
      // Add new training examples
      for (const example of trainingData) {
        this.nlpManager.addDocument('en', example.text, example.intent);
      }

      // Retrain the model
      await this.nlpManager.train();
      
      logger.info('Custom NLP model trained successfully', {
        examplesCount: trainingData.length,
      });

    } catch (error) {
      logger.error('Custom model training failed', { error });
      throw error;
    }
  }

  // Health check
  isHealthy(): boolean {
    return this.isInitialized;
  }

  // Get model statistics
  getModelStats(): any {
    return {
      initialized: this.isInitialized,
      languages: config.business.languages,
      intents: this.nlpManager.nluManager?.intentDomains || {},
      entities: this.nlpManager.nerManager?.namedEntities || {},
    };
  }
}