// FILE: frontend/src/components/StyledComponents.js

import { styled, alpha } from '@mui/material/styles';
import { Card, Box, TextField, Paper, Typography, Avatar } from '@mui/material';

// Styled Component cho Card "Thêm mới" (đã có)
export const StyledAddCard = styled(Card)(({ theme }) => ({
    width: 200,
    height: 200,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(10px)',
    border: `2px dashed ${theme.palette.divider}`,
    transition: 'all 0.3s ease',
    '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderColor: theme.palette.primary.main,
    },
}));

// Styled Component cho Card hiển thị Brand
export const StyledBrandCard = styled(Card)(({ theme }) => ({
    width: 200,
    height: 200,
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(10px)',
    border: `1px solid ${theme.palette.divider}`, // Tái sử dụng màu từ theme
    transition: 'all 0.3s ease',
    '&:hover': {
        transform: 'translateY(-5px)',
        // Sử dụng màu primary từ theme để tạo bóng
        boxShadow: `0 10px 20px ${theme.palette.primary.main}33`, // 33 là mã hex cho alpha ~0.2
    },
}));

// --- SEARCH PAGE COMPONENTS (REUSABLE) ---

export const MainContainer = styled(Box)(({ theme }) => ({
    width: '100%',
    maxWidth: '100%', // Giới hạn chiều rộng để đẹp trên màn to
    margin: '0 auto',   // Căn giữa container
    minHeight: '100vh',
    padding: theme.spacing(3, 4), // Tăng padding chút cho thoáng
    display: 'flex',
    flexDirection: 'column',
}));

export const SearchHeader = styled(Box, {
    shouldForwardProp: (prop) => prop !== 'hasResult',
})(({ theme, hasResult }) => ({
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: hasResult ? theme.spacing(6) : 0, // Tăng margin khi có kết quả
    marginTop: hasResult ? 0 : '15vh',
    transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)', // Hiệu ứng nảy nhẹ
}));

// Style mới: Thanh "Pill Glass" bo tròn cao cấp
export const GlowingInput = styled(TextField)(({ theme }) => ({
    width: '100%',
    maxWidth: '850px',
    
    // Animation xoay vòng
    '@keyframes spin': {
        '0%': { transform: 'rotate(0deg)' },
        '100%': { transform: 'rotate(360deg)' }
    },

    '& .MuiOutlinedInput-root': {
        fontSize: '1.2rem',
        fontWeight: 500,
        color: theme.palette.text.primary,
        backgroundColor: alpha(theme.palette.background.paper, 0.5),
        backdropFilter: 'blur(30px)',
        borderRadius: '50px',
        padding: '8px 25px',
        border: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
        boxShadow: `0 15px 35px ${alpha('#000', 0.4)}`,
        transition: 'all 0.4s ease',
        overflow: 'hidden', // Quan trọng để cắt phần thừa của hiệu ứng xoay
        position: 'relative',

        '& fieldset': { border: 'none' },

        '&:hover': {
            backgroundColor: alpha(theme.palette.background.paper, 0.7),
            boxShadow: `0 20px 45px ${alpha('#000', 0.5)}`,
            transform: 'translateY(-2px)',
            border: `1px solid ${alpha(theme.palette.primary.main, 1)}`, // Thêm viền sáng nhẹ khi hover
        },

        // --- TRẠNG THÁI ACTIVE: KHI FOCUS HOẶC ĐANG SEARCH ---
        '&.Mui-focused, &.searching .MuiOutlinedInput-root, & .MuiOutlinedInput-root.Mui-focused': {
            border: 'none', 
            boxShadow: `0 15px 35px ${alpha('#000', 0.5)}`,
            backgroundColor: 'transparent',
            position: 'relative',
            overflow: 'hidden',
            transform: 'scale(1.02)', // Phóng to nhẹ khi focus cho nổi bật

            // 1. Lớp Gradient xoay (Hình VUÔNG cực lớn)
            '&::before': {
                content: '""',
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '1000px', 
                height: '1000px', 
                background: `conic-gradient(from 0deg, 
                    transparent 0%, 
                    ${theme.palette.primary.main} 25%, 
                    ${theme.palette.secondary.main} 50%, 
                    #D500F9 75%, 
                    transparent 100%
                )`,
                animation: 'spin 2s linear infinite',
                zIndex: 0,
                margin: '-500px 0 0 -500px', 
            },

            // 2. Lớp Nền che bên trong (Mask)
            '&::after': {
                content: '""',
                position: 'absolute',
                inset: '2px', // Độ dày viền
                background: theme.palette.background.default, 
                borderRadius: '50px',
                zIndex: 1,
            }
        },        
        // Đảm bảo nội dung (Input) nằm trên cùng
        '&.searching input': {
            position: 'relative',
            zIndex: 2, 
        }
    },

    '& input': { 
        padding: '12px 10px',
        position: 'relative', 
        zIndex: 2, // Đảm bảo chữ nằm trên hiệu ứng
        '&::placeholder': {
            color: alpha(theme.palette.text.primary, 0.3),
            letterSpacing: '0.5px',
            textTransform: 'none',
            fontSize: '1.1rem'
        }
    },

    // Đảm bảo icon (InputAdornment) nằm trên cùng
    '& .MuiInputAdornment-root': {
        position: 'relative',
        zIndex: 2,
    }
}));

// --- LUXURY CARD COMPONENTS ---

export const LuxuryCard = styled(Paper)(({ theme }) => ({
    height: '100%',
    backgroundColor: alpha(theme.palette.background.paper, 0.6), // Tăng độ mờ nền
    backdropFilter: 'blur(20px)',
    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)', // Bóng đổ sâu hơn
    position: 'relative',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
        borderColor: alpha(theme.palette.primary.main, 0.6),
        boxShadow: `0 0 25px ${alpha(theme.palette.primary.main, 0.2)}, inset 0 0 10px ${alpha(theme.palette.primary.main, 0.05)}`,
        transform: 'translateY(-4px)',
        '&::before': {
            opacity: 1,
            height: '3px',
        }
    },
    '&::before': { // Viền sáng gradient trên đầu (Nằm trong Box)
        content: '""',
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: '3px', // Tăng độ dày một chút
        background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
        opacity: 0.6, // Giảm độ gắt
        transition: 'all 0.3s ease',
        zIndex: 1, // Đảm bảo nằm dưới các control nổi
    }
}));

export const CardHeader = styled(Box)(({ theme }) => ({
    padding: theme.spacing(2, 3),
    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: alpha(theme.palette.background.default, 0.3),
}));

export const CardContent = styled(Box)(({ theme }) => ({
    padding: theme.spacing(3),
}));

export const NoteTypography = styled(Typography)(({ theme }) => ({
    fontStyle: 'italic',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 5,
    WebkitBoxOrient: 'vertical',
    wordBreak: 'break-word',
    cursor: 'default',
    userSelect: 'none',
    color: theme.palette.text.secondary
}));

export const RankAvatar = styled(Avatar, {
    shouldForwardProp: (prop) => prop !== 'glowColor',
})(({ theme, glowColor }) => ({
    width: 100,
    height: 100,
    margin: '0 auto',
    border: `4px solid ${theme.palette.background.paper}`,
    backgroundColor: theme.palette.background.default,
    color: glowColor,
    boxShadow: `0 0 30px ${glowColor}`,
    fontWeight: 900,
    fontSize: '2.5rem',
    transition: 'all 0.5s ease'
}));

export const StyledOptionItem = styled(Box, {
    shouldForwardProp: (prop) => prop !== 'itemType'
})(({ theme, itemType }) => {
    const isCustomer = itemType === 'customer';
    const mainColor = isCustomer ? theme.palette.primary.main : theme.palette.error.main;

    return {
        padding: '14px 24px !important',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        position: 'relative',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        
        '&:hover': {
            backgroundColor: 'rgba(0, 229, 255, 0.03) !important',
            paddingLeft: '30px !important',
            
            '& .highlight-text': {
                color: theme.palette.primary.main,
                textShadow: `0 0 12px ${alpha(theme.palette.primary.main, 0.6)}`,
            },
            
            '& .icon-box': {
                backgroundColor: alpha(mainColor, 0.2),
                transform: 'scale(1.1) rotate(5deg)',
                boxShadow: `0 0 15px ${alpha(mainColor, 0.4)}`,
                color: mainColor
            },
            
            '&::before': {
                content: '""',
                position: 'absolute',
                left: 0, top: '20%', bottom: '20%',
                width: '3px',
                borderRadius: '0 4px 4px 0',
                backgroundColor: mainColor,
                boxShadow: `0 0 8px ${mainColor}`
            }
        },
        '&:last-child': {
            borderBottom: 'none'
        }
    };
});

export const StyledIconBox = styled(Box, {
    shouldForwardProp: (prop) => prop !== 'itemType'
})(({ theme, itemType }) => {
    const isCustomer = itemType === 'customer';
    const mainColor = isCustomer ? theme.palette.primary.main : theme.palette.error.main;
    
    return {
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        width: 42, 
        height: 42,
        borderRadius: '12px',
        backgroundColor: alpha(mainColor, 0.05),
        color: mainColor,
        transition: 'all 0.3s ease'
    };
});