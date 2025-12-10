import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import Notification, { NotificationProps } from './Notification';

interface NotificationContextValue {
  notifications: NotificationProps[];
  showNotification: (notification: Omit<NotificationProps, 'id' | 'onClose'>) => string;
  hideNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const useNotifications = (): NotificationContextValue => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationProps[]>([]);

  const showNotification = useCallback((
    notification: Omit<NotificationProps, 'id' | 'onClose'>
  ): string => {
    const id = Date.now().toString();
    const newNotification: NotificationProps = {
      ...notification,
      id,
      onClose: hideNotification
    };

    setNotifications(prev => [...prev, newNotification]);
    return id;
  }, []);

  const hideNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const value = {
    notifications,
    showNotification,
    hideNotification,
    clearAllNotifications
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {notifications.map(notification => (
            <Notification
              key={notification.id}
              {...notification}
            />
          ))}
        </div>
      )}
    </NotificationContext.Provider>
  );
};

// 便捷的Hook函数
export const useNotification = () => {
  const { showNotification, hideNotification, clearAllNotifications } = useNotifications();

  const success = useCallback((
    message: string,
    options?: { title?: string; duration?: number; action?: { label: string; onClick: () => void } }
  ) => {
    return showNotification({
      type: 'success',
      message,
      ...options
    });
  }, [showNotification]);

  const error = useCallback((
    message: string,
    options?: { title?: string; duration?: number; action?: { label: string; onClick: () => void } }
  ) => {
    return showNotification({
      type: 'error',
      message,
      duration: options?.duration || 0, // 错误通知默认不自动关闭
      ...options
    });
  }, [showNotification]);

  const warning = useCallback((
    message: string,
    options?: { title?: string; duration?: number; action?: { label: string; onClick: () => void } }
  ) => {
    return showNotification({
      type: 'warning',
      message,
      ...options
    });
  }, [showNotification]);

  const info = useCallback((
    message: string,
    options?: { title?: string; duration?: number; action?: { label: string; onClick: () => void } }
  ) => {
    return showNotification({
      type: 'info',
      message,
      ...options
    });
  }, [showNotification]);

  return {
    showNotification,
    hideNotification,
    clearAllNotifications,
    success,
    error,
    warning,
    info
  };
};

export default NotificationProvider;