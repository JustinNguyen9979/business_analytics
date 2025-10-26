// FILE: frontend/src/components/StyledComponents.js

import { styled } from '@mui/material/styles';
import { Card } from '@mui/material';

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

// THÊM MỚI: Styled Component cho Card hiển thị Brand
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