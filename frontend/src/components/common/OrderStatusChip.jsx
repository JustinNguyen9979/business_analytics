import React from 'react';
import { Typography, Chip, useTheme } from '@mui/material';

const OrderStatusChip = ({ status, category, variant = 'text' }) => {
    const theme = useTheme();
    
    let color = theme.palette.text.secondary;
    let label = status;
    let chipColor = 'default';

    // Logic mapping màu sắc
    if (category) {
        switch (category) {
            case 'completed':
                color = theme.palette.success.main;
                chipColor = 'success';
                label = 'Thành công';
                break;
            case 'processing':
                color = theme.palette.info.main;
                chipColor = 'info';
                label = 'Đang xử lý';
                break;
            case 'cancelled':
                color = theme.palette.warning.main;
                chipColor = 'warning';
                label = 'Đã hủy';
                break;
            case 'bomb':
                color = theme.palette.error.main;
                chipColor = 'error';
                label = 'Bom hàng';
                break;
            case 'refunded':
                color = theme.palette.error.light; // Dùng màu nhạt hơn hoặc custom
                chipColor = 'error';
                label = 'Đơn hoàn';
                break;
            default:
                break;
        }
    } else {
        // Fallback logic cũ dựa trên text matching
        const s = status?.toLowerCase() || '';
        if (s.includes('completed') || s.includes('delivered') || s.includes('thành công')) {
            color = theme.palette.success.main;
            chipColor = 'success';
            label = 'Thành công';
        } else if (s.includes('processing') || s.includes('đang') || s.includes('chờ')) {
            color = theme.palette.info.main;
            chipColor = 'info';
            label = 'Đang xử lý';
        } else if (s.includes('cancel') || s.includes('hủy')) {
            color = theme.palette.warning.main;
            chipColor = 'warning';
            label = 'Đã hủy';
        } else if (s.includes('bomb') || s.includes('return') || s.includes('hoàn')) {
            color = theme.palette.error.main;
            chipColor = 'error';
            label = 'Bom/Hoàn';
        }
    }

    if (variant === 'chip') {
        return (
            <Chip 
                label={label} 
                color={chipColor} 
                size="small" 
                variant="outlined"
                sx={{ fontWeight: 'bold' }} 
            />
        );
    }

    return (
        <Typography variant="caption" sx={{ color, fontWeight: 'bold', textTransform: 'uppercase' }}>
            {label}
        </Typography>
    );
};

export default OrderStatusChip;