// FILE: frontend/src/App.jsx

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme'; 
import { LayoutProvider } from './context/LayoutContext';

// 1. IMPORT NOTIFICATION PROVIDER
import { NotificationProvider } from './context/NotificationProvider';

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
        </ThemeProvider>
    );
}

export default App;