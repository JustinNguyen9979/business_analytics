// FILE: frontend/src/context/LayoutContext.jsx (PHIÊN BẢN ĐÃ NÂNG CẤP)

import React, { createContext, useContext, useState, useEffect } from 'react';

const LayoutContext = createContext();

export function LayoutProvider({ children }) {
    
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        try {
            const savedState = localStorage.getItem('sidebarOpenState');
            // Nếu có trạng thái đã lưu, dùng nó. Nếu không, mặc định là 'true' (mở).
            // JSON.parse(null) sẽ trả về null, nên toán tử '??' sẽ hoạt động đúng.
            return JSON.parse(savedState) ?? true;
        } catch (error) {
            console.error("Lỗi khi đọc trạng thái sidebar từ localStorage:", error);
            // Nếu có lỗi, quay về trạng thái mặc định
            return true;
        }
    });
    
    useEffect(() => {
        try {
            // Chuyển boolean thành chuỗi và lưu vào localStorage
            localStorage.setItem('sidebarOpenState', JSON.stringify(isSidebarOpen));
        } catch (error) {
            console.error("Lỗi khi lưu trạng thái sidebar vào localStorage:", error);
        }
    }, [isSidebarOpen]); // Hook này sẽ chạy lại mỗi khi `isSidebarOpen` thay đổi

    const value = { isSidebarOpen, setIsSidebarOpen };

    return (
        <LayoutContext.Provider value={value}>
            {children}
        </LayoutContext.Provider>
    );
}

export function useLayout() {
    return useContext(LayoutContext);
}