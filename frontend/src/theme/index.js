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
                    
                    // === PHẦN CODE MỚI THÊM VÀO ===
                    // Ghi đè style cho nút khi ở trạng thái disabled
                    "&.Mui-disabled": {
                        // Nút Hủy (variant="text" hoặc "outlined")
                        color: 'rgba(255, 255, 255, 0.5)',
                        cursor: 'not-allowed',
                        pointerEvents: 'auto'
                    }
                    // ==============================
                },
                containedPrimary: {
                    boxShadow: '0 6px 18px rgba(0,179,255,0.08)',
                    
                    // === PHẦN CODE MỚI THÊM VÀO ===
                    // Ghi đè style cho nút "Đang xử lý..." (variant="contained")
                    "&.Mui-disabled": {
                        backgroundColor: 'rgba(255, 255, 255, 0.12)',
                        color: 'rgba(255, 255, 255, 0.7)',
                    }
                    // ==============================
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
                '@keyframes ripple-effect': {
                  'from': {
                    transform: 'scale(0.1)',
                    opacity: 0.8,
                  },
                  'to': {
                    transform: 'scale(5)',
                    opacity: 0,
                  }
                },
                
                // 2. Định nghĩa các class sử dụng animation
                '.ripple': {
                animationName: 'ripple-effect',
                animationDuration: '2.2s',
                animationIterationCount: 'infinite',
                
                // Quan trọng: Đảm bảo vòng tròn phóng to từ tâm
                transformOrigin: 'center',

                // <<< THÊM DÒNG NÀY ĐỂ SỬA LỖI TRÊN SVG >>>
                transformBox: 'fill-box',
                },

                '.ripple-2': {
                  animationDelay: '1.1s',
                },

                body: {
                    // Style cho thanh cuộn trên Firefox
                    scrollbarWidth: 'thin',
                    scrollbarColor: `${theme.palette.text.secondary} ${theme.palette.background.default}`,

                    // Style cho thanh cuộn trên các trình duyệt Webkit (Chrome, Safari, Edge)
                    '&::-webkit-scrollbar': {
                        width: '4px',
                    },
                    '*::selection': {
                        backgroundColor: theme.palette.primary.main + '2D', // Màu primary với 30% opacity
                        color: theme.palette.text.primary,
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

        // Tùy chỉnh DatePicker để phù hợp với theme kính mờ
        MuiDatePicker: {
            defaultProps: {
                slotProps: {
                    // Tự động áp dụng style cho ô input
                    textField: {
                        variant: 'standard',
                        size: 'small',
                        sx: {
                            '& .MuiInput-underline:before': { borderBottom: 'none' },
                            '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottom: 'none' },
                        },
                    },
                    // Tự động áp dụng style cho pop-up lịch
                    popper: {
                        placement: 'bottom', 
                        sx: {
                            '& .MuiPaper-root': {
                                backdropFilter: 'blur(15px)',
                                backgroundColor: 'rgba(30, 41, 59, 0.7)',
                                border: (theme) => `1px solid ${theme.palette.divider}`,
                            },
                        },
                    },
                     dialog: { // Dành cho mobile
                        PaperProps: {
                            sx: {
                                backdropFilter: 'blur(15px)',
                                backgroundColor: 'rgba(30, 41, 59, 0.7)',
                                border: (theme) => `1px solid ${theme.palette.divider}`,
                            },
                        },
                    },
                    // Tự động áp dụng style cho các icon và nút bấm
                    openPickerButton: {
                        sx: { color: (theme) => theme.palette.text.secondary },
                    },
                    calendarHeader: {
                        sx: {
                            '& .MuiPickersArrowSwitcher-button': { color: (theme) => theme.palette.text.secondary },
                            '& .MuiPickersCalendarHeader-label': { color: (theme) => theme.palette.text.primary },
                            '& .MuiPickersCalendarHeader-switchViewIcon': { color: (theme) => theme.palette.text.secondary },
                        },
                    },
                    day: {
                        sx: {
                            '&.Mui-selected': {
                                backgroundColor: (theme) => theme.palette.primary.main,
                                color: (theme) => theme.palette.primary.contrastText,
                            },
                            '&:hover': {
                                backgroundColor: (theme) => theme.palette.action.hover,
                            },
                        },
                    },
                },
            },
        },

        // Tùy chỉnh Paper để tạo hiệu ứng kính mờ và placeholder
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

        // Tùy chỉnh Tooltip để phù hợp với theme kính mờ
        MuiTooltip: {
            styleOverrides: {
                tooltip: ({ theme }) => ({
                    backgroundColor: 'rgba(30, 41, 59, 0.7)', // Màu nền kính mờ
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    border: `1px solid ${theme.palette.divider}`,
                    fontSize: '0.875rem', // Tăng cỡ chữ một chút cho dễ đọc
                    padding: theme.spacing(1.5),
                }),
                arrow: ({ theme }) => ({
                    color: 'rgba(30, 41, 59, 0.7)', // Đồng bộ màu mũi tên
                }),
            },
        },

        // Tùy chỉnh Menu để phù hợp với theme kính mờ
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