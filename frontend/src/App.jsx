// FILE: frontend/src/App.jsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Box } from '@mui/material';
import BrandLobby from './pages/BrandLobby';

// Tạo một theme tối (dark theme) chi tiết hơn
const futuristicTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#00BFFF', // Deep Sky Blue - một màu xanh công nghệ
        },
        secondary: {
            main: '#9370DB', // Medium Purple - một màu tím nhẹ nhàng
        },
        background: {
            default: '#0A1929', // Màu nền xanh đen đậm
            paper: 'rgba(10, 25, 41, 0.7)', // Màu nền cho các Card, có độ trong suốt
        },
        text: {
            primary: '#E0E0E0',
            secondary: '#B0B0B0',
        }
    },
    typography: {
        fontFamily: 'Roboto, sans-serif',
        h3: {
            fontWeight: 700,
        },
        h5: {
            fontWeight: 300,
        }
    },
    components: {
        // Tùy chỉnh mặc định cho một số component
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    textTransform: 'none', // Bỏ viết hoa mặc định
                },
            },
        },
    },
});

function App() {
    return (
        <ThemeProvider theme={futuristicTheme}>
            <CssBaseline />
            <Box sx={{
                minHeight: '100vh',
                background: `linear-gradient(135deg, ${futuristicTheme.palette.background.default} 0%, #000000 100%)`,
            }}>
                <Routes>
                    <Route path="/" element={<BrandLobby />} />
                    {/* <Route path="/dashboard/:brandId" element={<Dashboard />} /> */}
                </Routes>
            </Box>
        </ThemeProvider>
    );
}

export default App;