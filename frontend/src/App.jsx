// FILE: frontend/src/App.jsx (PHIÊN BẢN SỬ DỤNG THEME TẬP TRUNG)

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';

// 1. IMPORT THEME TỪ FILE RIÊNG
import theme from './theme'; 

import BrandLobby from './pages/BrandLobby';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardPage from './pages/DashboardPage';

function App() {
    return (
        // 2. SỬ DỤNG THEME ĐÃ IMPORT
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Routes>
                {/* Route cho trang sảnh chính */}
                <Route path="/" element={<BrandLobby />} />
                
                {/* Route cho trang dashboard, sử dụng layout mới */}
                <Route element={<DashboardLayout />}>
                    <Route path="/dashboard/:brandId" element={<DashboardPage />} />
                </Route>
            </Routes>
        </ThemeProvider>
    );
}

export default App;