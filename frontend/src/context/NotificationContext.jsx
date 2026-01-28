import { createContext, useContext } from 'react';

// Tạo context
export const NotificationContext = createContext({
    showNotification: () => console.warn('NotificationProvider is missing')
});

// Tạo một hook tùy chỉnh để sử dụng context dễ dàng hơn
export const useNotification = () => {
    return useContext(NotificationContext);
};