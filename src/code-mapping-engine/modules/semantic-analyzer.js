/**
 * 语义分析器
 * 负责分析代码的语义和功能，建立代码与业务功能的映射关系
 */

const natural = require('natural');
const { TfIdf } = natural;
const { cosineDistance } = require('../utils/vector-utils');

class SemanticAnalyzer {
  constructor(config = {}) {
    this.config = {
      minTokenLength: 3,
      stopWords: ['the', 'and', 'or', 'to', 'a', 'in', 'of', 'for', 'on', 'with'],
      similarityThreshold: 0.7,
      ...config
    };
    
    this.tokenizer = new natural.WordTokenizer();
    this.stemmer = natural.PorterStemmer;
    this.tfidf = new TfIdf();
    
    // 代码语义索引
    this.semanticIndex = {
      files: {},
      functions: {},
      classes: {}
    };
  }
  
  /**
   * 分析代码库的语义
   * @param {Object} codeIndex - 代码索引对象
   * @returns {Promise<Object>} - 语义索引对象
   */
  async analyzeCodebase(codeIndex) {
    console.log('Analyzing code semantics...');
    
    // 重置TF-IDF模型
    this.tfidf = new TfIdf();
    
    // 重置语义索引
    this.semanticIndex = {
      files: {},
      functions: {},
      classes: {}
    };
    
    // 分析文件
    await this.analyzeFiles(codeIndex.files);
    
    // 分析函数
    await this.analyzeFunctions(codeIndex.functions);
    
    // 分析类
    await this.analyzeClasses(codeIndex.classes);
    
    console.log('Semantic analysis complete.');
    
    return this.semanticIndex;
  }
  
  /**
   * 分析文件的语义
   * @param {Array} files - 文件数组
   * @returns {Promise<void>}
   */
  async analyzeFiles(files) {
    for (const file of files) {
      // 提取文件名的关键词
      const fileNameTokens = this.tokenizeAndStem(file.name.replace(/\.[^/.]+$/, ''));
      
      // 为文件创建TF-IDF向量
      this.tfidf.addDocument(fileNameTokens, file.path);
      
      // 存储文件的语义信息
      this.semanticIndex.files[file.path] = {
        path: file.path,
        tokens: fileNameTokens,
        vector: null, // 将在所有文档添加后计算
        keywords: []
      };
    }
    
    // 计算每个文件的TF-IDF向量和关键词
    for (const file of files) {
      const fileSemantics = this.semanticIndex.files[file.path];
      
      // 计算TF-IDF向量
      const vector = this.calculateTfIdfVector(fileSemantics.tokens, file.path);
      fileSemantics.vector = vector;
      
      // 提取关键词
      fileSemantics.keywords = this.extractKeywords(file.path, 5);
    }
  }
  
  /**
   * 分析函数的语义
   * @param {Array} functions - 函数数组
   * @returns {Promise<void>}
   */
  async analyzeFunctions(functions) {
    for (const func of functions) {
      // 提取函数名的关键词
      const funcNameTokens = this.tokenizeAndStem(func.name);
      
      // 提取函数代码的关键词
      const codeTokens = this.tokenizeAndStem(func.code);
      
      // 合并关键词
      const allTokens = [...funcNameTokens, ...codeTokens];
      
      // 为函数创建TF-IDF向量
      const docId = `function:${func.filePath}:${func.name}`;
      this.tfidf.addDocument(allTokens, docId);
      
      // 存储函数的语义信息
      this.semanticIndex.functions[docId] = {
        name: func.name,
        filePath: func.filePath,
        tokens: allTokens,
        vector: null, // 将在所有文档添加后计算
        keywords: [],
        params: func.params
      };
    }
    
    // 计算每个函数的TF-IDF向量和关键词
    for (const func of functions) {
      const docId = `function:${func.filePath}:${func.name}`;
      const funcSemantics = this.semanticIndex.functions[docId];
      
      // 计算TF-IDF向量
      const vector = this.calculateTfIdfVector(funcSemantics.tokens, docId);
      funcSemantics.vector = vector;
      
      // 提取关键词
      funcSemantics.keywords = this.extractKeywords(docId, 5);
    }
  }
  
  /**
   * 分析类的语义
   * @param {Array} classes - 类数组
   * @returns {Promise<void>}
   */
  async analyzeClasses(classes) {
    for (const cls of classes) {
      // 提取类名的关键词
      const classNameTokens = this.tokenizeAndStem(cls.name);
      
      // 提取类代码的关键词
      const codeTokens = this.tokenizeAndStem(cls.code);
      
      // 合并关键词
      const allTokens = [...classNameTokens, ...codeTokens];
      
      // 为类创建TF-IDF向量
      const docId = `class:${cls.filePath}:${cls.name}`;
      this.tfidf.addDocument(allTokens, docId);
      
      // 存储类的语义信息
      this.semanticIndex.classes[docId] = {
        name: cls.name,
        filePath: cls.filePath,
        tokens: allTokens,
        vector: null, // 将在所有文档添加后计算
        keywords: [],
        methods: cls.methods.map(method => method.name)
      };
    }
    
    // 计算每个类的TF-IDF向量和关键词
    for (const cls of classes) {
      const docId = `class:${cls.filePath}:${cls.name}`;
      const classSemantics = this.semanticIndex.classes[docId];
      
      // 计算TF-IDF向量
      const vector = this.calculateTfIdfVector(classSemantics.tokens, docId);
      classSemantics.vector = vector;
      
      // 提取关键词
      classSemantics.keywords = this.extractKeywords(docId, 5);
    }
  }
  
  /**
   * 分词并词干提取
   * @param {string} text - 输入文本
   * @returns {Array} - 处理后的词元数组
   */
  tokenizeAndStem(text) {
    // 将驼峰命名转换为空格分隔
    const spacedText = text.replace(/([a-z])([A-Z])/g, '$1 $2');
    
    // 分词
    const tokens = this.tokenizer.tokenize(spacedText.toLowerCase());
    
    // 过滤停用词和短词
    const filteredTokens = tokens.filter(token => 
      token.length >= this.config.minTokenLength && 
      !this.config.stopWords.includes(token)
    );
    
    // 词干提取
    return filteredTokens.map(token => this.stemmer.stem(token));
  }
  
  /**
   * 计算TF-IDF向量
   * @param {Array} tokens - 词元数组
   * @param {string} docId - 文档ID
   * @returns {Object} - TF-IDF向量
   */
  calculateTfIdfVector(tokens, docId) {
    const vector = {};
    
    // 获取唯一词元
    const uniqueTokens = [...new Set(tokens)];
    
    // 计算每个词元的TF-IDF值
    for (const token of uniqueTokens) {
      const tfidf = this.tfidf.tfidf(token, docId);
      vector[token] = tfidf;
    }
    
    return vector;
  }
  
  /**
   * 提取文档的关键词
   * @param {string} docId - 文档ID
   * @param {number} count - 关键词数量
   * @returns {Array} - 关键词数组
   */
  extractKeywords(docId, count = 5) {
    const keywords = [];
    
    this.tfidf.listTerms(this.tfidf.documents.indexOf(docId))
      .slice(0, count)
      .forEach(item => {
        keywords.push({
          term: item.term,
          tfidf: item.tfidf
        });
      });
    
    return keywords;
  }
  
  /**
   * 计算两个向量的相似度
   * @param {Object} vector1 - 向量1
   * @param {Object} vector2 - 向量2
   * @returns {number} - 相似度分数 (0-1)
   */
  calculateSimilarity(vector1, vector2) {
    // 使用余弦距离计算相似度
    const distance = cosineDistance(vector1, vector2);
    
    // 将距离转换为相似度 (1 - 距离)
    return 1 - distance;
  }
  
  /**
   * 查找与查询最相似的代码元素
   * @param {string} query - 查询文本
   * @param {Object} options - 查询选项
   * @returns {Array} - 相似度排序的结果数组
   */
  findSimilarElements(query, options = {}) {
    const defaults = {
      limit: 10,
      types: ['files', 'functions', 'classes'],
      threshold: this.config.similarityThreshold
    };
    
    const config = { ...defaults, ...options };
    
    // 对查询进行分词和词干提取
    const queryTokens = this.tokenizeAndStem(query);
    
    // 为查询创建TF-IDF向量
    const queryVector = {};
    for (const token of queryTokens) {
      // 使用平均IDF值计算查询向量
      let totalIdf = 0;
      let count = 0;
      
      for (let i = 0; i < this.tfidf.documents.length; i++) {
        if (this.tfidf.documents[i][token]) {
          totalIdf += this.tfidf.idf(token);
          count++;
        }
      }
      
      const avgIdf = count > 0 ? totalIdf / count : 0;
      queryVector[token] = avgIdf;
    }
    
    const results = [];
    
    // 搜索文件
    if (config.types.includes('files')) {
      for (const filePath in this.semanticIndex.files) {
        const file = this.semanticIndex.files[filePath];
        const similarity = this.calculateSimilarity(queryVector, file.vector);
        
        if (similarity >= config.threshold) {
          results.push({
            type: 'file',
            item: file,
            similarity
          });
        }
      }
    }
    
    // 搜索函数
    if (config.types.includes('functions')) {
      for (const funcId in this.semanticIndex.functions) {
        const func = this.semanticIndex.functions[funcId];
        const similarity = this.calculateSimilarity(queryVector, func.vector);
        
        if (similarity >= config.threshold) {
          results.push({
            type: 'function',
            item: func,
            similarity
          });
        }
      }
    }
    
    // 搜索类
    if (config.types.includes('classes')) {
      for (const classId in this.semanticIndex.classes) {
        const cls = this.semanticIndex.classes[classId];
        const similarity = this.calculateSimilarity(queryVector, cls.vector);
        
        if (similarity >= config.threshold) {
          results.push({
            type: 'class',
            item: cls,
            similarity
          });
        }
      }
    }
    
    // 按相似度排序
    results.sort((a, b) => b.similarity - a.similarity);
    
    // 限制结果数量
    return results.slice(0, config.limit);
  }
}

module.exports = SemanticAnalyzer;
