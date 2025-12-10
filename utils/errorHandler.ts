/**
 * 错误处理工具函数
 * 提供统一的错误处理机制
 */

export enum ErrorType {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  AUTH = 'AUTH',
  DATABASE = 'DATABASE',
  UNKNOWN = 'UNKNOWN'
}

export interface AppError {
  type: ErrorType;
  message: string;
  originalError?: Error;
  context?: Record<string, any>;
}

/**
 * 创建标准化错误对象
 */
export const createError = (
  type: ErrorType,
  message: string,
  originalError?: Error,
  context?: Record<string, any>
): AppError => {
  const error: AppError = {
    type,
    message,
    originalError,
    context
  };

  // 在开发环境中记录详细错误
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${type}] ${message}`, { originalError, context });
  }

  // 在生产环境中可以发送到错误监控服务
  if (process.env.NODE_ENV === 'production') {
    sendToErrorService(error);
  }

  return error;
};

/**
 * 处理API错误
 */
export const handleApiError = (error: any): AppError => {
  if (!error) {
    return createError(ErrorType.UNKNOWN, '未知错误');
  }

  // 网络错误
  if (!navigator.onLine) {
    return createError(
      ErrorType.NETWORK,
      '网络连接已断开，请检查您的网络设置',
      error
    );
  }

  // 服务器响应错误
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;

    switch (status) {
      case 401:
        return createError(
          ErrorType.AUTH,
          '认证失败，请重新登录',
          error,
          { status }
        );
      case 403:
        return createError(
          ErrorType.AUTH,
          '权限不足，无法访问此资源',
          error,
          { status }
        );
      case 404:
        return createError(
          ErrorType.NETWORK,
          '请求的资源不存在',
          error,
          { status }
        );
      case 422:
        return createError(
          ErrorType.VALIDATION,
          data?.message || '提交的数据有误',
          error,
          { status, validationErrors: data?.errors }
        );
      case 500:
        return createError(
          ErrorType.DATABASE,
          '服务器内部错误，请稍后再试',
          error,
          { status }
        );
      default:
        return createError(
          ErrorType.NETWORK,
          data?.message || `请求失败 (${status})`,
          error,
          { status }
        );
    }
  }

  // 请求超时
  if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
    return createError(
      ErrorType.NETWORK,
      '请求超时，请检查网络连接后重试',
      error
    );
  }

  // 其他错误
  return createError(
    ErrorType.UNKNOWN,
    error.message || '操作失败，请重试',
    error
  );
};

/**
 * 处理Supabase错误
 */
export const handleSupabaseError = (error: any): AppError => {
  if (!error) {
    return createError(ErrorType.DATABASE, '数据库操作失败');
  }

  const message = error.message || '数据库操作失败';

  // 根据错误类型分类
  if (message.includes('duplicate key')) {
    return createError(
      ErrorType.VALIDATION,
      '数据已存在，不能重复创建',
      error
    );
  }

  if (message.includes('foreign key constraint')) {
    return createError(
      ErrorType.VALIDATION,
      '数据关联错误，请检查相关数据',
      error
    );
  }

  if (message.includes('permission denied')) {
    return createError(
      ErrorType.AUTH,
      '没有权限执行此操作',
      error
    );
  }

  return createError(ErrorType.DATABASE, message, error);
};

/**
 * 发送错误到监控服务
 */
const sendToErrorService = (error: AppError) => {
  // 这里可以集成Sentry、LogRocket等错误监控服务
  // 示例：
  // Sentry.captureException(error.originalError, {
  //   tags: { errorType: error.type },
  //   extra: error.context
  // });

  // 开发环境打印错误
  if (process.env.NODE_ENV === 'development') {
    console.error('Error sent to service:', error);
  }
};

/**
 * 安全地执行异步操作
 */
export const safeAsync = async <T>(
  asyncFn: () => Promise<T>,
  errorHandler?: (error: AppError) => void
): Promise<[T | null, AppError | null]> => {
  try {
    const result = await asyncFn();
    return [result, null];
  } catch (error) {
    const appError = handleApiError(error);
    if (errorHandler) {
      errorHandler(appError);
    }
    return [null, appError];
  }
};

/**
 * 重试机制
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * 2);
  }
};

/**
 * 用户友好的错误消息
 */
export const getErrorMessage = (error: AppError): string => {
  switch (error.type) {
    case ErrorType.NETWORK:
      return '网络连接出现问题，请检查您的网络设置并重试。';
    case ErrorType.VALIDATION:
      return '输入的信息有误，请检查后重新提交。';
    case ErrorType.AUTH:
      return '登录已过期，请重新登录。';
    case ErrorType.DATABASE:
      return '数据处理失败，请稍后再试。';
    default:
      return error.message || '操作失败，请重试。';
  }
};

/**
 * 创建错误报告
 */
export const createErrorReport = (error: AppError): string => {
  const timestamp = new Date().toISOString();
  const userAgent = navigator.userAgent;
  const url = window.location.href;
  
  return `
错误报告 - ${timestamp}

错误类型: ${error.type}
错误消息: ${error.message}

用户代理: ${userAgent}
页面地址: ${url}

错误上下文: ${JSON.stringify(error.context, null, 2)}

原始错误: ${error.originalError?.stack || '无'}
  `.trim();
};