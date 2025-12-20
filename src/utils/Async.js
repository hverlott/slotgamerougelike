/**
 * 🛡️ Async 辅助工具 - 防止游戏冻结
 * 为所有 awaited promises 添加超时保护
 */

/**
 * 为 promise 添加超时保护
 * @param {Promise} promise - 要包装的 promise
 * @param {number} ms - 超时毫秒数
 * @param {string} label - 用于日志的标签
 * @param {*} fallbackValue - 超时时返回的值
 * @returns {Promise} 包装后的 promise
 */
export function withTimeout(promise, ms, label = 'operation', fallbackValue = null) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => {
        console.warn(`⏱️ [Timeout] ${label} exceeded ${ms}ms, using fallback`);
        resolve(fallbackValue);
      }, ms);
    })
  ]);
}

/**
 * 创建一个带超时的延迟 promise
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise}
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 安全执行 async 函数，捕获所有错误
 * @param {Function} fn - async 函数
 * @param {*} fallbackValue - 发生错误时返回的值
 * @returns {Promise}
 */
export async function tryCatch(fn, fallbackValue = null) {
  try {
    return await fn();
  } catch (error) {
    console.error('[tryCatch] Error:', error);
    return fallbackValue;
  }
}

/**
 * 批量执行 promises 并全部添加超时保护
 * @param {Promise[]} promises - promise 数组
 * @param {number} ms - 每个 promise 的超时时间
 * @param {string} label - 标签前缀
 * @returns {Promise<Array>}
 */
export function allWithTimeout(promises, ms, label = 'batch') {
  return Promise.all(
    promises.map((p, i) => 
      withTimeout(p, ms, `${label}[${i}]`, null)
    )
  );
}


