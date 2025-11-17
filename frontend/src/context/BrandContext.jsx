// FILE: frontend/src/context/BrandContext.jsx

import React, { createContext, useContext } from 'react';

// Tạo Context
const BrandContext = createContext(null);

// Tạo Provider (chúng ta sẽ dùng nó trong DashboardLayout)
export const BrandProvider = BrandContext.Provider;

// Tạo hook tùy chỉnh để các component con dễ dàng sử dụng
export const useBrand = () => {
    const context = useContext(BrandContext);
    if (!context) {
        throw new Error('useBrand must be used within a BrandProvider');
    }
    return context;
};