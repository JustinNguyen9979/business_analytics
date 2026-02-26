// FILE: frontend/src/App.jsx

import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box, CircularProgress } from '@mui/material';
import theme from './theme'; 
import { LayoutProvider } from './context/LayoutContext';

import { NotificationProvider } from './context/NotificationProvider';
import { Tooltip } from 'react-tooltip';
import DashboardLayout from './layouts/DashboardLayout';

const BrandLobby = lazy(() => import('./pages/BrandLobby'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const FinancePage = lazy(() => import('./pages/FinancePage'));
const MarketingPage = lazy(() => import('./pages/MarketingPage'));
const OperationPage = lazy(() => import('./pages/OperationPage'));
const CustomerPage = lazy(() => import('./pages/CustomerPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));

const PageLoader = () => (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100%' }}>
        <CircularProgress />
    </Box>
);

function App() {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <NotificationProvider>
                <LayoutProvider>
                    {/* 3. Bọc Routes bằng Suspense */}
                    <Suspense fallback={<PageLoader />}>
                        <Routes>
                            <Route path="/login" element={<AuthPage />} />
                            <Route path="/" element={<BrandLobby />} />
                            <Route element={<DashboardLayout />}>
                                <Route path="/dashboard/:brandIdentifier" element={<DashboardPage />} />
                                <Route path="/dashboard/:brandIdentifier/finance" element={<FinancePage />} />
                                <Route path="/dashboard/:brandIdentifier/marketing" element={<MarketingPage />} />
                                <Route path="/dashboard/:brandIdentifier/operation" element={<OperationPage />} />
                                <Route path="/dashboard/:brandIdentifier/customer" element={<CustomerPage />} />
                                <Route path="/dashboard/:brandIdentifier/search" element={<SearchPage />} />
                            </Route>
                        </Routes>
                    </Suspense>
                </LayoutProvider>
            </NotificationProvider>
            <Tooltip 
                id="map-tooltip" 
                style={{ 
                    backgroundColor: 'rgba(30, 41, 59, 0.8)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '8px',
                    zIndex: 9999
                }}
            />
        </ThemeProvider>
    );
}

export default App;