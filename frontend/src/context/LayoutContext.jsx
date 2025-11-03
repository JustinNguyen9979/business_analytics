// FILE: frontend/src/context/LayoutContext.jsx (TẠO MỚI)

import React, { createContext, useContext, useState } from 'react';

// 1. Tạo Context
const LayoutContext = createContext();

// 2. Tạo Provider (Component cha sẽ bọc các con)
export function LayoutProvider({ children }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const value = { isSidebarOpen, setIsSidebarOpen };

    return (
        <LayoutContext.Provider value={value}>
            {children}
        </LayoutContext.Provider>
    );
}

// 3. Tạo một hook tùy chỉnh để dễ dàng sử dụng
export function useLayout() {
    return useContext(LayoutContext);
}