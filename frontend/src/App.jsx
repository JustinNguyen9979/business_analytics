// FILE: frontend/src/App.jsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Box } from '@mui/material';

import BrandLobby from './pages/BrandLobby';
import DashboardLayout from './layouts/DashboardLayout'; 
import DashboardPage from './pages/DashboardPage';   

// Tạo một theme tối (dark theme) chi tiết hơn
const futuristicTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#00BFFF', // Deep Sky Blue
        },
        secondary: {
            main: '#9370DB', // Medium Purple
        },
        background: {
            default: '#071225', // slightly adjusted to match CSS vars
            paper: 'rgba(10, 25, 41, 0.6)', // translucent paper for cards
        },
        text: {
            primary: '#E0E0E0',
            secondary: '#B0B0B0',
        }
    },
    typography: {
        fontFamily: "'Inter', 'Roboto', sans-serif",
        h3: {
            fontWeight: 700,
            fontSize: '2.5rem',
        },
        h5: {
            fontWeight: 300,
            fontSize: '1.5rem',
        }
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 10,
                    textTransform: 'none', // keep capitalization natural
                    transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                },
                containedPrimary: {
                    boxShadow: '0 6px 18px rgba(0,179,255,0.08)'
                }
            }
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02))",
                    border: '1px solid rgba(255,255,255,0.06)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)'
                }
            }
        }
    }
});

function App() {
    return (
        <ThemeProvider theme={futuristicTheme}>
            <CssBaseline />
            {/* Bỏ Box bao ngoài đi để layout tự quản lý background */}
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