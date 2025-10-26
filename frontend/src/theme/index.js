// FILE: frontend/src/theme/index.js

import { createTheme } from '@mui/material/styles';

// --- ĐỊNH NGHĨA CÁC MÃ MÀU CƠ BẢN ---
const PALETTE = {
    primary: {
        main: '#00BFFF', // Deep Sky Blue
        contrastText: '#FFFFFF',
    },
    secondary: {
        main: '#9370DB', // Medium Purple
        contrastText: '#FFFFFF',
    },
    background: {
        default: '#071225', // Màu nền chính
        paper: 'rgba(10, 25, 41, 0.6)', // Màu nền cho các Card
    },
    text: {
        primary: '#E0E0E0',
        secondary: '#B0B0B0',
    },
    divider: 'rgba(255, 255, 255, 0.12)',
};

// --- TẠO THEME ---
const theme = createTheme({
    palette: PALETTE,
    typography: {
        fontFamily: "'Inter', 'Roboto', sans-serif",
        h3: {
            fontWeight: 700,
            fontSize: '2.5rem',
        },
        h5: {
            fontWeight: 300,
            fontSize: '1.5rem',
        },
    },
    // --- TÙY CHỈNH STYLE CHO CÁC COMPONENT CỤ THỂ ---
    components: {
        // Nút bấm
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 10,
                    textTransform: 'none',
                    transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                },
                containedPrimary: {
                    boxShadow: '0 6px 18px rgba(0,179,255,0.08)'
                }
            }
        },
        // Card (Dùng cho BrandLobby)
        MuiCard: {
            styleOverrides: {
                root: {
                    background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02))",
                    border: '1px solid rgba(255,255,255,0.06)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)'
                }
            }
        },
        // AppBar (Thanh header trong Dashboard)
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundColor: 'rgba(10, 25, 41, 0.7)', // Màu nền kính mờ
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    boxShadow: 'none', // Bỏ shadow mặc định
                    borderBottom: `1px solid ${PALETTE.divider}`,
                }
            }
        },
        // Drawer (Thanh sidebar trong Dashboard)
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    // Hiệu ứng Kính mờ
                    backgroundColor: 'rgba(10, 25, 41, 0.7)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    borderRight: `1px solid ${PALETTE.divider}`,
                }
            }
        },
        // Icon trong ListItem (Menu sidebar)
        MuiListItemIcon: {
            styleOverrides: {
                root: {
                    color: PALETTE.text.secondary, // Màu mặc định cho icon
                }
            }
        }
    }
});

export default theme;