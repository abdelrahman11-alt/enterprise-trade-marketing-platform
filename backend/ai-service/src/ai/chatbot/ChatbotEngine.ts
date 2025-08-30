import { OpenAI } from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ConversationChain } from 'langchain/chains';
import { BufferMemory } from 'langchain/memory';
import { PromptTemplate } from '@langchain/core/prompts';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { CacheService } from '../../services/cache';
import { ConversationModel } from '../../models/Conversation';
import { MessageModel } from '../../models/Message';
import { KnowledgeBaseService } from '../knowledge/KnowledgeBaseService';
import { NLPService } from '../nlp/NLPService';
import { ContextManager } from './ContextManager';
import { PersonalizationService } from './PersonalizationService';
import { generateId } from '@trade-marketing/shared';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: any;
}

export interface ChatResponse {
  message: string;
  confidence: number;
  intent?: string;
  entities?: any[];
  suggestions?: string[];
  actions?: any[];
  metadata?: any;
}

export interface ChatContext {
  userId: string;
  companyId: string;
  sessionId: string;
  conversationId?: string;
  userProfile?: any;
  businessContext?: any;
  preferences?: any;
}

export class ChatbotEngine {
  private openai: OpenAI;
  private anthropic: Anthropic;
  private langchainOpenAI: ChatOpenAI;
  private langchainAnthropic: ChatAnthropic;
  private knowledgeBase: KnowledgeBaseService;
  private nlpService: NLPService;
  private contextManager: ContextManager;
  private personalizationService: PersonalizationService;

  constructor() {
    // Initialize AI providers
    this.openai = new OpenAI({
      apiKey: config.ai.openai.apiKey,
      timeout: config.ai.openai.timeout,
    });

    this.anthropic = new Anthropic({
      apiKey: config.ai.anthropic.apiKey,
    });

    this.langchainOpenAI = new ChatOpenAI({
      openAIApiKey: config.ai.openai.apiKey,
      modelName: config.ai.openai.model,
      temperature: config.ai.openai.temperature,
      maxTokens: config.ai.openai.maxTokens,
    });

    this.langchainAnthropic = new ChatAnthropic({
      anthropicApiKey: config.ai.anthropic.apiKey,
      modelName: config.ai.anthropic.model,
      temperature: config.ai.anthropic.temperature,
      maxTokens: config.ai.anthropic.maxTokens,
    });

    // Initialize services
    this.knowledgeBase = new KnowledgeBaseService();
    this.nlpService = new NLPService();
    this.contextManager = new ContextManager();
    this.personalizationService = new PersonalizationService();
  }

  async chat(message: string, context: ChatContext): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      // Get or create conversation
      let conversationId = context.conversationId;
      if (!conversationId) {
        const conversation = await ConversationModel.create({
          id: generateId(),
          userId: context.userId,
          companyId: context.companyId,
          sessionId: context.sessionId,
          title: this.generateConversationTitle(message),
          context: context.businessContext || {},
        });
        conversationId = conversation.id;
      }

      // Analyze user message
      const analysis = await this.nlpService.analyze(message);
      
      // Store user message
      await MessageModel.create({
        id: generateId(),
        conversationId,
        role: 'USER',
        content: message,
        intent: analysis.intent,
        entities: analysis.entities,
        sentiment: analysis.sentiment,
        confidence: analysis.confidence,
      });

      // Build conversation context
      const conversationContext = await this.contextManager.buildContext(
        conversationId,
        context
      );

      // Get relevant knowledge
      const relevantKnowledge = await this.knowledgeBase.search(
        message,
        context.companyId,
        5
      );

      // Get personalized preferences
      const personalizedContext = await this.personalizationService.getPersonalizedContext(
        context.userId,
        context.companyId
      );

      // Generate response based on provider
      const response = await this.generateResponse(
        message,
        conversationContext,
        relevantKnowledge,
        personalizedContext,
        analysis
      );

      // Store assistant message
      const processingTime = Date.now() - startTime;
      await MessageModel.create({
        id: generateId(),
        conversationId,
        role: 'ASSISTANT',
        content: response.message,
        confidence: response.confidence,
        processingTime,
        metadata: response.metadata,
      });

      // Update conversation
      await ConversationModel.update(conversationId, {
        lastMessageAt: new Date(),
        messageCount: { increment: 2 }, // user + assistant
      });

      // Generate insights if enabled
      if (config.chatbot.enableAnalytics) {
        await this.generateInsights(conversationId, message, response, analysis);
      }

      return {
        ...response,
        metadata: {
          ...response.metadata,
          conversationId,
          processingTime,
          provider: config.chatbot.defaultProvider,
        },
      };

    } catch (error) {
      logger.error('Chatbot error', { error, message, context });
      
      return {
        message: "I apologize, but I'm experiencing some technical difficulties. Please try again in a moment.",
        confidence: 0,
        metadata: {
          error: true,
          processingTime: Date.now() - startTime,
        },
      };
    }
  }

  private async generateResponse(
    message: string,
    context: any,
    knowledge: any[],
    personalizedContext: any,
    analysis: any
  ): Promise<ChatResponse> {
    const provider = config.chatbot.defaultProvider;

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(context, knowledge, personalizedContext);
    
    // Build conversation history
    const conversationHistory = this.buildConversationHistory(context.messages || []);

    switch (provider) {
      case 'openai':
        return await this.generateOpenAIResponse(
          message,
          systemPrompt,
          conversationHistory,
          analysis
        );
      
      case 'anthropic':
        return await this.generateAnthropicResponse(
          message,
          systemPrompt,
          conversationHistory,
          analysis
        );
      
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  private async generateOpenAIResponse(
    message: string,
    systemPrompt: string,
    conversationHistory: ChatMessage[],
    analysis: any
  ): Promise<ChatResponse> {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory.slice(-config.chatbot.contextWindow),
      { role: 'user' as const, content: message },
    ];

    const completion = await this.openai.chat.completions.create({
      model: config.ai.openai.model,
      messages,
      temperature: config.ai.openai.temperature,
      max_tokens: config.ai.openai.maxTokens,
      functions: this.getFunctionDefinitions(),
      function_call: 'auto',
    });

    const response = completion.choices[0];
    const functionCall = response.message.function_call;

    let actions: any[] = [];
    let suggestions: string[] = [];

    if (functionCall) {
      // Handle function calls (actions)
      actions = await this.handleFunctionCall(functionCall);
    }

    // Generate suggestions based on intent
    if (analysis.intent) {
      suggestions = await this.generateSuggestions(analysis.intent, message);
    }

    return {
      message: response.message.content || '',
      confidence: this.calculateConfidence(response),
      intent: analysis.intent,
      entities: analysis.entities,
      suggestions,
      actions,
      metadata: {
        model: config.ai.openai.model,
        tokens: completion.usage?.total_tokens,
        cost: this.calculateCost(completion.usage?.total_tokens || 0, 'openai'),
        functionCall: functionCall?.name,
      },
    };
  }

  private async generateAnthropicResponse(
    message: string,
    systemPrompt: string,
    conversationHistory: ChatMessage[],
    analysis: any
  ): Promise<ChatResponse> {
    const messages = [
      ...conversationHistory.slice(-config.chatbot.contextWindow),
      { role: 'user' as const, content: message },
    ];

    const response = await this.anthropic.messages.create({
      model: config.ai.anthropic.model,
      max_tokens: config.ai.anthropic.maxTokens,
      temperature: config.ai.anthropic.temperature,
      system: systemPrompt,
      messages,
    });

    const content = response.content[0];
    const text = content.type === 'text' ? content.text : '';

    // Generate suggestions based on intent
    const suggestions = analysis.intent 
      ? await this.generateSuggestions(analysis.intent, message)
      : [];

    return {
      message: text,
      confidence: this.calculateConfidence(response),
      intent: analysis.intent,
      entities: analysis.entities,
      suggestions,
      actions: [],
      metadata: {
        model: config.ai.anthropic.model,
        tokens: response.usage.input_tokens + response.usage.output_tokens,
        cost: this.calculateCost(
          response.usage.input_tokens + response.usage.output_tokens,
          'anthropic'
        ),
      },
    };
  }

  private buildSystemPrompt(context: any, knowledge: any[], personalizedContext: any): string {
    return `You are an intelligent AI assistant for a trade marketing platform. You help users with:

CORE CAPABILITIES:
- Trade spend management and optimization
- Promotion planning and execution
- Field execution and compliance
- Supply chain insights
- Financial analysis and reporting
- Customer and market analytics
- Strategic recommendations

CONTEXT:
- User: ${context.userProfile?.name || 'User'}
- Company: ${context.companyProfile?.name || 'Company'}
- Role: ${context.userProfile?.role || 'User'}
- Industry: ${context.companyProfile?.industry || 'FMCG'}
- Region: ${context.companyProfile?.region || 'Global'}

PERSONALIZATION:
${personalizedContext.preferences ? `- Preferences: ${JSON.stringify(personalizedContext.preferences)}` : ''}
${personalizedContext.workingStyle ? `- Working Style: ${personalizedContext.workingStyle}` : ''}
${personalizedContext.expertise ? `- Expertise Level: ${personalizedContext.expertise}` : ''}

KNOWLEDGE BASE:
${knowledge.map(k => `- ${k.title}: ${k.content.substring(0, 200)}...`).join('\n')}

GUIDELINES:
1. Be professional, helpful, and concise
2. Provide actionable insights and recommendations
3. Use data-driven approaches when possible
4. Ask clarifying questions when needed
5. Suggest relevant actions or next steps
6. Maintain context throughout the conversation
7. Adapt your communication style to the user's expertise level
8. Focus on trade marketing and business outcomes

RESPONSE FORMAT:
- Provide clear, structured responses
- Include relevant metrics or KPIs when applicable
- Suggest follow-up actions or questions
- Use business terminology appropriate for the industry

Remember: You're helping optimize trade marketing performance and drive business results.`;
  }

  private buildConversationHistory(messages: any[]): ChatMessage[] {
    return messages.map(msg => ({
      role: msg.role.toLowerCase(),
      content: msg.content,
      metadata: msg.metadata,
    }));
  }

  private getFunctionDefinitions(): any[] {
    return [
      {
        name: 'get_promotion_performance',
        description: 'Get performance metrics for a specific promotion',
        parameters: {
          type: 'object',
          properties: {
            promotionId: { type: 'string', description: 'The promotion ID' },
            metrics: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Metrics to retrieve (sales, roi, reach, etc.)'
            },
          },
          required: ['promotionId'],
        },
      },
      {
        name: 'create_promotion_plan',
        description: 'Create a new promotion plan',
        parameters: {
          type: 'object',
          properties: {
            productId: { type: 'string', description: 'Product ID' },
            budget: { type: 'number', description: 'Promotion budget' },
            duration: { type: 'number', description: 'Duration in days' },
            channels: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Marketing channels'
            },
          },
          required: ['productId', 'budget'],
        },
      },
      {
        name: 'analyze_market_trends',
        description: 'Analyze market trends for specific products or categories',
        parameters: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Product category' },
            region: { type: 'string', description: 'Geographic region' },
            timeframe: { type: 'string', description: 'Analysis timeframe' },
          },
          required: ['category'],
        },
      },
      {
        name: 'generate_insights',
        description: 'Generate business insights from data',
        parameters: {
          type: 'object',
          properties: {
            dataType: { type: 'string', description: 'Type of data to analyze' },
            filters: { type: 'object', description: 'Analysis filters' },
          },
          required: ['dataType'],
        },
      },
    ];
  }

  private async handleFunctionCall(functionCall: any): Promise<any[]> {
    const { name, arguments: args } = functionCall;
    const parsedArgs = JSON.parse(args);

    switch (name) {
      case 'get_promotion_performance':
        return await this.getPromotionPerformance(parsedArgs);
      
      case 'create_promotion_plan':
        return await this.createPromotionPlan(parsedArgs);
      
      case 'analyze_market_trends':
        return await this.analyzeMarketTrends(parsedArgs);
      
      case 'generate_insights':
        return await this.generateBusinessInsights(parsedArgs);
      
      default:
        logger.warn('Unknown function call', { name, args: parsedArgs });
        return [];
    }
  }

  private async getPromotionPerformance(args: any): Promise<any[]> {
    // This would integrate with the trade marketing service
    return [{
      type: 'promotion_performance',
      data: {
        promotionId: args.promotionId,
        metrics: {
          sales: 125000,
          roi: 2.3,
          reach: 85000,
          conversion: 0.12,
        },
      },
    }];
  }

  private async createPromotionPlan(args: any): Promise<any[]> {
    // This would integrate with the promotion planning service
    return [{
      type: 'promotion_plan',
      data: {
        planId: generateId(),
        productId: args.productId,
        budget: args.budget,
        estimatedROI: 2.1,
        recommendedChannels: ['digital', 'in-store', 'social'],
      },
    }];
  }

  private async analyzeMarketTrends(args: any): Promise<any[]> {
    // This would integrate with the analytics service
    return [{
      type: 'market_trends',
      data: {
        category: args.category,
        trends: [
          { trend: 'Growing demand', confidence: 0.85 },
          { trend: 'Price sensitivity increasing', confidence: 0.72 },
          { trend: 'Digital channel preference', confidence: 0.91 },
        ],
      },
    }];
  }

  private async generateBusinessInsights(args: any): Promise<any[]> {
    // This would integrate with the AI analytics engine
    return [{
      type: 'business_insights',
      data: {
        insights: [
          {
            title: 'Optimization Opportunity',
            description: 'Reallocate 15% of budget from traditional to digital channels',
            impact: 'Potential 12% increase in ROI',
            confidence: 0.78,
          },
        ],
      },
    }];
  }

  private async generateSuggestions(intent: string, message: string): Promise<string[]> {
    const suggestions: Record<string, string[]> = {
      promotion_planning: [
        'Show me promotion performance metrics',
        'Create a new promotion plan',
        'Analyze competitor promotions',
        'Optimize promotion budget allocation',
      ],
      analytics: [
        'Generate sales performance report',
        'Show market trend analysis',
        'Compare regional performance',
        'Identify growth opportunities',
      ],
      field_execution: [
        'Check store compliance status',
        'View field execution metrics',
        'Schedule store visits',
        'Analyze shelf share data',
      ],
      general: [
        'What can you help me with?',
        'Show me my dashboard',
        'Generate executive summary',
        'Set up alerts and notifications',
      ],
    };

    return suggestions[intent] || suggestions.general;
  }

  private calculateConfidence(response: any): number {
    // Simple confidence calculation based on response characteristics
    // In a real implementation, this would be more sophisticated
    if (response.message?.function_call) {
      return 0.9; // High confidence for function calls
    }
    
    const contentLength = response.message?.content?.length || 0;
    if (contentLength > 100) {
      return 0.8; // Good confidence for detailed responses
    } else if (contentLength > 50) {
      return 0.7; // Medium confidence
    } else {
      return 0.6; // Lower confidence for short responses
    }
  }

  private calculateCost(tokens: number, provider: string): number {
    const pricing: Record<string, { input: number; output: number }> = {
      openai: { input: 0.01 / 1000, output: 0.03 / 1000 }, // GPT-4 pricing per token
      anthropic: { input: 0.015 / 1000, output: 0.075 / 1000 }, // Claude pricing per token
    };

    const rates = pricing[provider] || pricing.openai;
    // Simplified cost calculation (assuming 50/50 input/output split)
    return (tokens * (rates.input + rates.output)) / 2;
  }

  private generateConversationTitle(message: string): string {
    // Extract key topics from the first message
    const words = message.toLowerCase().split(' ');
    const keywords = words.filter(word => 
      word.length > 3 && 
      !['what', 'how', 'when', 'where', 'why', 'can', 'could', 'would', 'should'].includes(word)
    );
    
    if (keywords.length > 0) {
      return keywords.slice(0, 3).join(' ').replace(/^\w/, c => c.toUpperCase());
    }
    
    return 'New Conversation';
  }

  private async generateInsights(
    conversationId: string,
    userMessage: string,
    response: ChatResponse,
    analysis: any
  ): Promise<void> {
    // Generate conversation insights for analytics
    // This would be implemented to create insights based on conversation patterns
    logger.info('Generating conversation insights', {
      conversationId,
      intent: analysis.intent,
      confidence: response.confidence,
    });
  }

  // Public methods for conversation management
  async getConversationHistory(conversationId: string): Promise<any[]> {
    return await MessageModel.findByConversation(conversationId);
  }

  async endConversation(conversationId: string): Promise<void> {
    await ConversationModel.update(conversationId, {
      status: 'ENDED',
      endedAt: new Date(),
    });
  }

  async getConversationInsights(conversationId: string): Promise<any[]> {
    // Return insights generated from the conversation
    return [];
  }
}