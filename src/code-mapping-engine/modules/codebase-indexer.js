/**
 * 代码库索引器
 * 负责扫描代码库并建立索引，包括文件结构、函数、类等信息
 */

const fs = require('fs').promises;
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

class CodebaseIndexer {
  constructor(config = {}) {
    this.config = {
      excludeDirs: ['node_modules', '.git', 'dist', 'build'],
      fileExtensions: ['.js', '.jsx', '.ts', '.tsx'],
      indexDepth: 3,
      ...config
    };
    
    this.codeIndex = {
      files: [],
      functions: [],
      classes: [],
      metadata: {
        indexedAt: null,
        totalFiles: 0,
        totalFunctions: 0,
        totalClasses: 0
      }
    };
  }
  
  /**
   * 索引代码库
   * @param {string} codebasePath - 代码库路径
   * @returns {Promise<Object>} - 代码索引对象
   */
  async indexCodebase(codebasePath) {
    console.log(`Indexing codebase at ${codebasePath}...`);
    
    // 重置索引
    this.resetIndex();
    
    // 扫描文件
    await this.scanDirectory(codebasePath);
    
    // 更新元数据
    this.updateMetadata();
    
    console.log(`Indexing complete. Found ${this.codeIndex.metadata.totalFiles} files, ${this.codeIndex.metadata.totalFunctions} functions, ${this.codeIndex.metadata.totalClasses} classes.`);
    
    return this.codeIndex;
  }
  
  /**
   * 重置索引
   */
  resetIndex() {
    this.codeIndex = {
      files: [],
      functions: [],
      classes: [],
      metadata: {
        indexedAt: null,
        totalFiles: 0,
        totalFunctions: 0,
        totalClasses: 0
      }
    };
  }
  
  /**
   * 更新索引元数据
   */
  updateMetadata() {
    this.codeIndex.metadata = {
      indexedAt: new Date().toISOString(),
      totalFiles: this.codeIndex.files.length,
      totalFunctions: this.codeIndex.functions.length,
      totalClasses: this.codeIndex.classes.length
    };
  }
  
  /**
   * 递归扫描目录
   * @param {string} dirPath - 目录路径
   * @param {number} depth - 当前深度
   * @returns {Promise<void>}
   */
  async scanDirectory(dirPath, depth = 0) {
    // 检查深度限制
    if (depth > this.config.indexDepth) {
      return;
    }
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          // 跳过排除的目录
          if (this.config.excludeDirs.includes(entry.name)) {
            continue;
          }
          
          // 递归扫描子目录
          await this.scanDirectory(entryPath, depth + 1);
        } else if (entry.isFile()) {
          // 检查文件扩展名
          const ext = path.extname(entry.name);
          if (this.config.fileExtensions.includes(ext)) {
            await this.indexFile(entryPath);
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error);
    }
  }
  
  /**
   * 索引单个文件
   * @param {string} filePath - 文件路径
   * @returns {Promise<void>}
   */
  async indexFile(filePath) {
    try {
      // 读取文件内容
      const content = await fs.readFile(filePath, 'utf-8');
      
      // 创建文件索引
      const fileIndex = {
        path: filePath,
        name: path.basename(filePath),
        extension: path.extname(filePath),
        size: content.length,
        lastModified: null,
        functions: [],
        classes: []
      };
      
      // 获取文件状态
      const stats = await fs.stat(filePath);
      fileIndex.lastModified = stats.mtime.toISOString();
      
      // 解析代码
      await this.parseCode(content, fileIndex);
      
      // 添加到索引
      this.codeIndex.files.push(fileIndex);
      
      // 将函数和类添加到全局索引
      fileIndex.functions.forEach(func => {
        this.codeIndex.functions.push({
          ...func,
          filePath
        });
      });
      
      fileIndex.classes.forEach(cls => {
        this.codeIndex.classes.push({
          ...cls,
          filePath
        });
      });
    } catch (error) {
      console.error(`Error indexing file ${filePath}:`, error);
    }
  }
  
  /**
   * 解析代码并提取函数和类信息
   * @param {string} code - 代码内容
   * @param {Object} fileIndex - 文件索引对象
   * @returns {Promise<void>}
   */
  async parseCode(code, fileIndex) {
    try {
      // 解析代码为AST
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'classProperties']
      });
      
      // 遍历AST
      traverse(ast, {
        // 索引函数声明
        FunctionDeclaration: (path) => {
          const node = path.node;
          const functionName = node.id ? node.id.name : 'anonymous';
          
          fileIndex.functions.push({
            name: functionName,
            params: node.params.map(param => param.name || 'unnamed'),
            loc: {
              start: node.loc.start.line,
              end: node.loc.end.line
            },
            code: code.substring(node.start, node.end)
          });
        },
        
        // 索引类声明
        ClassDeclaration: (path) => {
          const node = path.node;
          const className = node.id ? node.id.name : 'anonymous';
          
          const methods = [];
          node.body.body.forEach(member => {
            if (member.type === 'ClassMethod') {
              methods.push({
                name: member.key.name,
                params: member.params.map(param => param.name || 'unnamed'),
                loc: {
                  start: member.loc.start.line,
                  end: member.loc.end.line
                }
              });
            }
          });
          
          fileIndex.classes.push({
            name: className,
            methods,
            loc: {
              start: node.loc.start.line,
              end: node.loc.end.line
            },
            code: code.substring(node.start, node.end)
          });
        }
      });
    } catch (error) {
      console.error('Error parsing code:', error);
    }
  }
  
  /**
   * 搜索代码索引
   * @param {Object} query - 搜索查询
   * @returns {Object} - 搜索结果
   */
  searchIndex(query) {
    const results = {
      files: [],
      functions: [],
      classes: []
    };
    
    // 搜索文件
    if (query.fileName) {
      results.files = this.codeIndex.files.filter(file => 
        file.name.toLowerCase().includes(query.fileName.toLowerCase())
      );
    }
    
    // 搜索函数
    if (query.functionName) {
      results.functions = this.codeIndex.functions.filter(func => 
        func.name.toLowerCase().includes(query.functionName.toLowerCase())
      );
    }
    
    // 搜索类
    if (query.className) {
      results.classes = this.codeIndex.classes.filter(cls => 
        cls.name.toLowerCase().includes(query.className.toLowerCase())
      );
    }
    
    return results;
  }
}

module.exports = CodebaseIndexer;
