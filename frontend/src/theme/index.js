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
        default: '#0d1e3dff', // Nền tối để làm nổi bật hiệu ứng Aurora
        paper: 'rgba(10, 25, 41, 0.6)',
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
                    backgroundColor: 'rgba(15, 23, 42, 0.7)', // Màu nền kính mờ đậm hơn
                    backdropFilter: 'blur(12px)', // Tăng độ mờ
                    WebkitBackdropFilter: 'blur(12px)',
                    boxShadow: 'none',
                    borderBottom: `1px solid ${PALETTE.divider}`,
                }
            }
        },

        // Drawer (Thanh sidebar trong Dashboard)
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    backgroundColor: 'rgba(15, 23, 42, 0.7)', // Đồng bộ màu với AppBar
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
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
        },

        MuiDialog: {
            styleOverrides: {
                paper: ({ theme }) => ({ // Sử dụng arrow function để truy cập theme
                    borderRadius: theme.shape.borderRadius * 2, // Bo tròn góc nhiều hơn một chút
                    backgroundColor: 'rgba(30, 41, 59, 0.7)',
                    backdropFilter: 'blur(15px)',
                    WebkitBackdropFilter: 'blur(15px)',
                    border: `1px solid ${theme.palette.divider}`,
                }),
            },
        },

        // Tùy chỉnh CSS toàn cục, bao gồm cả thanh cuộn
        MuiCssBaseline: {
            styleOverrides: (theme) => ({
                body: {
                    // Style cho thanh cuộn trên Firefox
                    scrollbarWidth: 'thin',
                    scrollbarColor: `${theme.palette.text.secondary} ${theme.palette.background.default}`,

                    // Style cho thanh cuộn trên các trình duyệt Webkit (Chrome, Safari, Edge)
                    '&::-webkit-scrollbar': {
                        width: '4px',
                    },
                    '&::-webkit-scrollbar-track': {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    },
                    '&::-webkit-scrollbar-thumb': {
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: theme.shape.borderRadius,
                        border: '2px solid transparent',
                        backgroundClip: 'content-box',
                        '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.4)',
                        },
                    },
                },
            }),
        },

        MuiPaper: {
            variants: [
                {
                    props: { variant: 'glass' },
                    style: ({ theme }) => ({
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: theme.shape.borderRadius * 4, // Bo tròn nhiều hơn
                    }),
                },
                {
                    props: { variant: 'placeholder' },
                    style: ({ theme }) => ({
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: theme.shape.borderRadius * 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: 400,
                    }),
                },
            ]
        },

        MuiMenu: {
            styleOverrides: {
                paper: ({ theme }) => ({
                    minWidth: 180, // Đặt chiều rộng tối thiểu cho menu
                    backgroundColor: '#1e293b',
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: theme.shape.borderRadius,
                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                }),
                list: {
                    padding: '4px 0',
                }
            }
        }
    }
});




export default theme;