// FILE: frontend/src/App.jsx

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme'; 

// 1. IMPORT NOTIFICATION PROVIDER
import { NotificationProvider } from './context/NotificationProvider';

import BrandLobby from './pages/BrandLobby';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardPage from './pages/DashboardPage';

function App() {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {/* 2. BỌC TOÀN BỘ ROUTES BẰNG PROVIDER MỚI */}
            <NotificationProvider>
                <Routes>
                    <Route path="/" element={<BrandLobby />} />
                    <Route element={<DashboardLayout />}>
                        <Route path="/dashboard/:brandId" element={<DashboardPage />} />
                    </Route>
                </Routes>
            </NotificationProvider>
        </ThemeProvider>
    );
}

export default App;