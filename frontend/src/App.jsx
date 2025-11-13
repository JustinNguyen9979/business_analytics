// FILE: frontend/src/App.jsx

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme'; 
import { LayoutProvider } from './context/LayoutContext';

import { NotificationProvider } from './context/NotificationProvider';
import { Tooltip } from 'react-tooltip';

import BrandLobby from './pages/BrandLobby';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardPage from './pages/DashboardPage';

function App() {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <NotificationProvider>
                {/* <<< BỌC CÁC ROUTE CẦN DÙNG LAYOUT BẰNG PROVIDER MỚI >>> */}
                <LayoutProvider>
                    <Routes>
                        <Route path="/" element={<BrandLobby />} />
                        <Route element={<DashboardLayout />}>
                            <Route path="/dashboard/:brandId" element={<DashboardPage />} />
                        </Route>
                    </Routes>
                </LayoutProvider>
            </NotificationProvider>
            <Tooltip 
                id="map-tooltip" // ID này phải khớp với `data-tooltip-id` trong ComposableMap
                style={{ 
                    backgroundColor: 'rgba(30, 41, 59, 0.8)',
                    backdropFilter: 'blur(10px)',
                    // border: `1px solid ${theme.palette.divider}`,
                    borderRadius: '8px',
                    zIndex: 9999 // Đảm bảo nó nổi lên trên tất cả
                }}
            />
        </ThemeProvider>
    );
}

export default App;