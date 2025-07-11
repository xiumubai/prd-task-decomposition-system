/**
 * 向量工具
 * 提供向量计算相关的工具函数
 */

/**
 * 计算两个向量的余弦距离
 * 余弦距离 = 1 - 余弦相似度
 * @param {Object} vector1 - 向量1，格式为 {term1: weight1, term2: weight2, ...}
 * @param {Object} vector2 - 向量2，格式为 {term1: weight1, term2: weight2, ...}
 * @returns {number} - 余弦距离，范围为 0-1，值越小表示越相似
 */
function cosineDistance(vector1, vector2) {
  // 如果任一向量为空，则距离为1（完全不相似）
  if (!vector1 || !vector2 || Object.keys(vector1).length === 0 || Object.keys(vector2).length === 0) {
    return 1;
  }
  
  // 计算向量点积
  let dotProduct = 0;
  for (const term in vector1) {
    if (vector2[term]) {
      dotProduct += vector1[term] * vector2[term];
    }
  }
  
  // 计算向量模长
  const magnitude1 = Math.sqrt(Object.values(vector1).reduce((sum, val) => sum + val * val, 0));
  const magnitude2 = Math.sqrt(Object.values(vector2).reduce((sum, val) => sum + val * val, 0));
  
  // 避免除以零
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 1;
  }
  
  // 计算余弦相似度
  const cosineSimilarity = dotProduct / (magnitude1 * magnitude2);
  
  // 计算余弦距离
  return 1 - cosineSimilarity;
}

/**
 * 计算两个向量的欧几里得距离
 * @param {Object} vector1 - 向量1
 * @param {Object} vector2 - 向量2
 * @returns {number} - 欧几里得距离
 */
function euclideanDistance(vector1, vector2) {
  // 获取所有唯一的维度
  const dimensions = new Set([...Object.keys(vector1), ...Object.keys(vector2)]);
  
  // 计算欧几里得距离
  let sumSquaredDiff = 0;
  for (const dim of dimensions) {
    const val1 = vector1[dim] || 0;
    const val2 = vector2[dim] || 0;
    const diff = val1 - val2;
    sumSquaredDiff += diff * diff;
  }
  
  return Math.sqrt(sumSquaredDiff);
}

/**
 * 计算两个向量的曼哈顿距离
 * @param {Object} vector1 - 向量1
 * @param {Object} vector2 - 向量2
 * @returns {number} - 曼哈顿距离
 */
function manhattanDistance(vector1, vector2) {
  // 获取所有唯一的维度
  const dimensions = new Set([...Object.keys(vector1), ...Object.keys(vector2)]);
  
  // 计算曼哈顿距离
  let sumAbsDiff = 0;
  for (const dim of dimensions) {
    const val1 = vector1[dim] || 0;
    const val2 = vector2[dim] || 0;
    sumAbsDiff += Math.abs(val1 - val2);
  }
  
  return sumAbsDiff;
}

/**
 * 归一化向量
 * @param {Object} vector - 输入向量
 * @returns {Object} - 归一化后的向量
 */
function normalizeVector(vector) {
  const magnitude = Math.sqrt(Object.values(vector).reduce((sum, val) => sum + val * val, 0));
  
  // 避免除以零
  if (magnitude === 0) {
    return { ...vector };
  }
  
  const normalizedVector = {};
  for (const term in vector) {
    normalizedVector[term] = vector[term] / magnitude;
  }
  
  return normalizedVector;
}

/**
 * 合并多个向量
 * @param {Array} vectors - 向量数组
 * @param {Array} weights - 权重数组，默认为均等权重
 * @returns {Object} - 合并后的向量
 */
function mergeVectors(vectors, weights = null) {
  if (!vectors || vectors.length === 0) {
    return {};
  }
  
  // 如果未提供权重，则使用均等权重
  if (!weights) {
    weights = vectors.map(() => 1 / vectors.length);
  }
  
  // 确保权重数组长度与向量数组长度相同
  if (weights.length !== vectors.length) {
    throw new Error('Weights array length must match vectors array length');
  }
  
  const mergedVector = {};
  
  // 合并向量
  for (let i = 0; i < vectors.length; i++) {
    const vector = vectors[i];
    const weight = weights[i];
    
    for (const term in vector) {
      if (!mergedVector[term]) {
        mergedVector[term] = 0;
      }
      mergedVector[term] += vector[term] * weight;
    }
  }
  
  return mergedVector;
}

module.exports = {
  cosineDistance,
  euclideanDistance,
  manhattanDistance,
  normalizeVector,
  mergeVectors
};
