// FILE: frontend/src/theme/index.js

import { createTheme } from '@mui/material/styles';

// --- ĐỊNH NGHĨA CÁC MÃ MÀU NEON / CYBERPUNK ---
const PALETTE = {
    mode: 'dark', // Đặt chế độ tối mặc định
    primary: {
        main: '#00E5FF', // Neon Cyan (Màu chính phát sáng)
        light: '#5FFFFF',
        dark: '#00B2CC',
        contrastText: '#000000', // Chữ đen trên nền Cyan để dễ đọc
    },
    secondary: {
        main: '#2979FF', // Electric Blue (Màu phụ)
        contrastText: '#FFFFFF',
    },
    background: {
        default: '#02040A', // Đen sâu thẳm (Deep Space Black)
        paper: 'rgba(2, 4, 10, 0.6)', // Kính trong suốt tối màu
        darker: '#000000', // Đen tuyền

        // Màu kính mờ cho các thành phần cụ thể
        glassPrimary: 'rgba(2, 4, 10, 0.8)',  
        glassSecondary: 'rgba(10, 25, 41, 0.9)', 
    },
    text: {
        primary: '#E0F7FA', // Trắng hơi xanh (Ice White)
        secondary: '#80DEEA', // Xanh Cyan nhạt
        disabled: 'rgba(255, 255, 255, 0.5)',
    },
    divider: 'rgba(0, 229, 255, 0.15)', // Đường kẻ mờ màu Cyan
    action: {
        hover: 'rgba(0, 229, 255, 0.08)',
        selected: 'rgba(0, 229, 255, 0.16)',
        disabled: 'rgba(255, 255, 255, 0.3)',
        disabledBackground: 'rgba(255, 255, 255, 0.12)',
    },
    success: { main: '#00E676' }, // Neon Green
    warning: { main: '#FFEA00' }, // Neon Yellow
    error: { main: '#FF1744' },   // Neon Red
};

// --- TẠO THEME ---
const theme = createTheme({
    palette: PALETTE,
    shape: {
        borderRadius: 8, // Bo góc nhẹ
    },
    typography: {
        fontFamily: "'Inter', 'Roboto', sans-serif",
        h1: { fontWeight: 700, color: PALETTE.primary.main, textShadow: '0 0 10px rgba(0, 229, 255, 0.5)' },
        h2: { fontWeight: 700, color: PALETTE.primary.main, textShadow: '0 0 10px rgba(0, 229, 255, 0.5)' },
        h3: { fontWeight: 700, fontSize: '2.5rem', color: PALETTE.primary.main, textShadow: '0 0 10px rgba(0, 229, 255, 0.5)' },
        h4: { fontWeight: 600, color: PALETTE.primary.main },
        h5: { fontWeight: 500, fontSize: '1.5rem' },
        h6: { fontWeight: 500, color: PALETTE.secondary.light },
        // Thêm style chuyên biệt cho tiêu đề các phần (Section)
        sectionTitle: {
            fontSize: '0.85rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: '#80DEEA', // PALETTE.text.secondary
            marginBottom: '16px',
            marginTop: '32px',
            display: 'block'
        }
    },
    
    // --- TÙY CHỈNH STYLE CHO COMPONENT ---
    components: {
        // 1. Button Base (Hiệu ứng gợn sóng)
        MuiButtonBase: {
            styleOverrides: {
                root: {
                    '& .MuiTouchRipple-rippleVisible': {
                        color: PALETTE.primary.main,
                        opacity: 0.3,
                    },
                },
            },
        },

        // 2. Nút bấm (Button) - Thêm hiệu ứng Glow
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 20, // Bo tròn nhiều hơn cho phong cách Tech
                    textTransform: 'none',
                    fontWeight: 600,
                    transition: 'all 0.2s ease-in-out',
                    '&.Mui-disabled': {
                        color: 'rgba(255, 255, 255, 0.3)',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                    }
                },
                contained: {
                    backgroundColor: 'rgba(0, 229, 255, 0.1)', // Nền trong suốt nhẹ
                    color: PALETTE.primary.main,
                    border: `1px solid ${PALETTE.primary.main}`,
                    boxShadow: '0 0 10px rgba(0, 229, 255, 0.2)', // Glow nhẹ mặc định
                    '&:hover': {
                        backgroundColor: PALETTE.primary.main,
                        color: '#000', // Chữ đen khi hover
                        boxShadow: '0 0 20px rgba(0, 229, 255, 0.6)', // Glow mạnh khi hover
                        transform: 'translateY(-2px)',
                    },
                    '&.Mui-disabled': {
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                    }
                },
                outlined: {
                    borderColor: PALETTE.primary.main,
                    color: PALETTE.primary.main,
                    '&:hover': {
                        backgroundColor: 'rgba(0, 229, 255, 0.1)',
                        borderColor: PALETTE.primary.main,
                        boxShadow: '0 0 15px rgba(0, 229, 255, 0.3)',
                    }
                }
            }
        },

        // 3. Ô nhập liệu (TextField / Input)
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(0, 229, 255, 0.3)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: PALETTE.primary.main,
                        boxShadow: '0 0 5px rgba(0, 229, 255, 0.2)',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: PALETTE.primary.main,
                        boxShadow: '0 0 10px rgba(0, 229, 255, 0.4)', // Glow khi focus
                    },
                    input: {
                        color: PALETTE.primary.main, // Chữ nhập vào màu Cyan
                    }
                }
            }
        },
        MuiInputLabel: {
            styleOverrides: {
                root: {
                    color: 'rgba(0, 229, 255, 0.7)',
                    '&.Mui-focused': { color: PALETTE.primary.main }
                }
            }
        },

        // 4. Card & Paper (Hiệu ứng kính mờ + Viền phát sáng)
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundColor: 'rgba(2, 4, 10, 0.6)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: `1px solid ${PALETTE.divider}`,
                    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.5)',
                    transition: 'transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
                    '&:hover': {
                        borderColor: PALETTE.primary.main,
                        boxShadow: '0 0 20px rgba(0, 229, 255, 0.2)', // Glow khung khi hover
                    }
                }
            }
        },

        MuiPaper: {
            variants: [
                {
                    props: { variant: 'glass' },
                    style: {
                        backgroundColor: 'rgba(255, 255, 255, 0.02)', // Rất trong
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        border: `1px solid rgba(0, 229, 255, 0.1)`,
                        borderRadius: 16,
                        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                    },
                },
                {
                    props: { variant: 'placeholder' },
                    style: {
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        backdropFilter: 'blur(10px)',
                        border: `1px dashed rgba(0, 229, 255, 0.3)`, // Viền nét đứt màu Cyan
                        borderRadius: 16,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: 400,
                    },
                },
                // Mới: Biến thể Liquid Glass cao cấp (Dùng cho Dropdown/Menu/Search)
                {
                    props: { variant: 'liquidGlass' },
                    style: {
                        marginTop: 8,
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.03))',
                        backdropFilter: 'blur(30px) saturate(150%)',
                        WebkitBackdropFilter: 'blur(30px) saturate(150%)',
                        border: 'none', // Loại bỏ viền trắng để hòa quyện hơn
                        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
                        borderRadius: 16,
                        overflow: 'hidden',
                        '& .MuiList-root': { padding: 0 }, // Xóa padding mặc định của List
                        '& .MuiMenuItem-root': {
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            margin: 0, // Reset margin để full width
                            padding: '12px 20px', // Padding chuẩn
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            '&:hover': {
                                backgroundColor: 'rgba(0, 229, 255, 0.1) !important',
                                color: '#00E5FF',
                                textShadow: '0 0 8px rgba(0, 229, 255, 0.5)',
                                paddingLeft: '28px' // Hiệu ứng trượt nhẹ
                            },
                            '&.Mui-selected': {
                                backgroundColor: 'rgba(0, 229, 255, 0.2) !important',
                                color: '#00E5FF',
                                fontWeight: 'bold'
                            },
                            '&:last-child': { borderBottom: 'none' }
                        }
                    },
                },
            ]
        },

        // 5. AppBar & Drawer (Glassmorphism tối)
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundColor: PALETTE.background.glassPrimary,
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    boxShadow: 'none',
                    borderBottom: `1px solid ${PALETTE.divider}`,
                }
            }
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    backgroundColor: PALETTE.background.glassPrimary,
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderRight: `1px solid ${PALETTE.divider}`,
                }
            }
        },

        // 6. Menu & Dialog (Popups)
        MuiMenu: {
            styleOverrides: {
                paper: {
                    backgroundColor: '#050A14', // Nền tối gần như đen tuyệt đối
                    border: `1px solid ${PALETTE.primary.main}`, // Viền sáng
                    boxShadow: '0 0 20px rgba(0, 229, 255, 0.2)', // Glow toàn bộ menu
                }
            }
        },

        MuiDialog: {
            styleOverrides: {
                paper: ({ theme }) => ({
                    backgroundColor: 'rgba(5, 10, 20, 0.85)', // Nền tối hơn, đậm hơn
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: `1px solid ${theme.palette.primary.main}`, // Viền sáng màu Cyan
                    borderRadius: 20,
                    // Hiệu ứng đổ bóng phát sáng mạnh (Glow)
                    boxShadow: `0 0 40px rgba(0, 229, 255, 0.15), inset 0 0 20px rgba(0, 229, 255, 0.05)`,
                    backgroundImage: 'none',
                }),
            },
        },

        MuiDialogContent: {
            styleOverrides: {
                root: {
                    padding: '24px',
                }
            }
        },

        MuiDialogActions: {
            styleOverrides: {
                root: {
                    padding: '16px 24px 24px',
                    borderTop: `1px solid ${PALETTE.divider}`,
                    justifyContent: 'space-between', // Dàn đều nút 2 bên
                }
            }
        },

        MuiDialogTitle: {
            styleOverrides: {
                root: {
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    borderBottom: `1px solid ${PALETTE.divider}`,
                    marginBottom: '16px',
                    padding: '20px 24px',
                    // Hiệu ứng chữ phát sáng
                    textShadow: `0 0 10px ${PALETTE.primary.main}`, 
                }
            }
        },

        // 7. List Item (Menu Sidebar)
        MuiListItemButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    margin: '4px 8px',
                    '&.Mui-selected': {
                        backgroundColor: 'rgba(0, 229, 255, 0.15)',
                        color: PALETTE.primary.main,
                        borderLeft: `3px solid ${PALETTE.primary.main}`, // Chỉ báo active bên trái
                        '&:hover': {
                            backgroundColor: 'rgba(0, 229, 255, 0.25)',
                        },
                        '& .MuiListItemIcon-root': {
                            color: PALETTE.primary.main,
                        }
                    },
                    '&:hover': {
                        backgroundColor: PALETTE.action.hover,
                    }
                },
            },
        },
        MuiListItemIcon: {
            styleOverrides: {
                root: { color: PALETTE.text.secondary }
            }
        },

        // 8. CSS Global & Animations
        MuiCssBaseline: {
            styleOverrides: {
                // Global Scrollbar Styling
                scrollbarWidth: 'thin',
                '&::-webkit-scrollbar': { width: '6px', height: '6px' },
                '&::-webkit-scrollbar-track': { background: 'transparent' },
                '&::-webkit-scrollbar-thumb': {
                    backgroundColor: 'rgba(0, 229, 255, 0.6)', // Neon Cyan với độ trong suốt nhẹ
                    borderRadius: 3,
                    transition: 'background-color 0.3s ease, box-shadow 0.3s ease', // Thêm transition
                    '&:hover': {
                        backgroundColor: PALETTE.primary.main, // Sáng rực hơn khi hover
                        boxShadow: '0 0 8px rgba(0, 229, 255, 0.8)', // Hiệu ứng glow mạnh khi hover
                    }
                },
                body: {
                    backgroundColor: PALETTE.background.default,
                    backgroundAttachment: 'fixed',
                },
                // Animation sóng (Ripple) cho bản đồ
                '@keyframes ripple-effect': {
                    '0%': { transform: 'scale(0.1)', opacity: 0.8 },
                    '100%': { transform: 'scale(4)', opacity: 0 }
                },
                '.ripple': {
                    animation: 'ripple-effect 2s infinite linear',
                    stroke: PALETTE.error.main, // Màu đỏ Neon cho điểm nóng
                },
                '.ripple-2': { animationDelay: '1s' },
                
                // Utility class cho chữ Neon
                '.neon-text': {
                    color: PALETTE.primary.main,
                    textShadow: '0 0 5px rgba(0, 229, 255, 0.7), 0 0 10px rgba(0, 229, 255, 0.5)',
                },
                
                // Animation Marquee (Chữ chạy)
                '@keyframes marquee': {
                    '0%': { transform: 'translateX(50%)' }, 
                    '100%': { transform: 'translateX(-100%)' }
                },
                '.marquee-box': {
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    maskImage: 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
                    '&:hover .marquee-text': {
                        animationPlayState: 'paused' // Dừng khi hover
                    }
                },
                '.marquee-text': {
                    display: 'inline-block',
                    paddingLeft: '16px',
                    paddingRight: '16px',
                    minWidth: '100%',
                }
            }
        },

        // 9. Tooltip & DatePicker
        MuiTooltip: {
            styleOverrides: {
                tooltip: {
                    backgroundColor: 'rgba(5, 10, 20, 0.9)',
                    border: `1px solid ${PALETTE.divider}`,
                    backdropFilter: 'blur(4px)',
                    fontSize: '0.8rem',
                }
            }
        },

        MuiBox: {
            variants: [
                {
                    props: { variant: 'dropzone' },
                    style: ({ theme }) => ({
                        position: 'relative',
                        width: '100%',
                        height: 250,
                        border: `2px dashed ${theme.palette.text.secondary}`,
                        borderRadius: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        cursor: 'pointer',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        transition: 'all 0.3s ease',
                        
                        // Hiệu ứng khi Hover
                        '&:hover': {
                            borderColor: theme.palette.primary.main,
                            backgroundColor: 'rgba(0, 229, 255, 0.08)',
                            boxShadow: `inset 0 0 20px rgba(0, 229, 255, 0.1)`,
                            transform: 'scale(1.01)',
                        }
                    }),
                },
            ],
        },

        MuiDatePicker: {
            defaultProps: {
                slotProps: {
                    popper: { sx: { '& .MuiPaper-root': { border: `1px solid ${PALETTE.primary.main}`, boxShadow: '0 0 15px rgba(0, 229, 255, 0.2)' } } },
                    day: { sx: { '&.Mui-selected': { backgroundColor: PALETTE.primary.main, color: '#000' } } }
                }
            }
        }
    }
});

export default theme;