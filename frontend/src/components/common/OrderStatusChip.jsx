import React from 'react';
import { Typography, Chip, useTheme } from '@mui/material';

// Bộ từ khóa chuẩn đồng bộ với Backend/app/kpi_utils.py
const ORDER_STATUS_KEYWORDS = {
    bomb_status: ["fail", "chuyen hoan", "that bai", "khong thanh cong", "khong nhan", "tu choi", "khong lien lac", "thue bao", "tu choi", "khong nghe may", "boom hang", "bom hang", "contact failed"],
    cancel_status: ["huy", "cancel"],
    success_status: ["hoan thanh", "complete", "deliver", "success", "da nhan", "thanh cong", "da giao", "giao thanh cong", "shipped", "finish", "done", "hoan tat", "nguoi mua xac nhan"],
    processing_status: ["dang giao", "dang trung chuyen", "cho giao hang", "cho van chuyen", "dang cho", "chuan bi hang", "pickup", "transitting", "delivery"]
};

const normalizeText = (text) => {
    if (!text) return '';
    return text.toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
};

const OrderStatusChip = ({ status, category, variant = 'text' }) => {
    const theme = useTheme();
    
    let color = theme.palette.text.secondary;
    let label = status || '---';
    let chipColor = 'default';

    // Xác định category nếu chưa có
    let currentCategory = category;
    
    if (!currentCategory && status) {
        const normalizedStatus = normalizeText(status);
        
        if (ORDER_STATUS_KEYWORDS.bomb_status.some(k => normalizedStatus.includes(k))) {
            currentCategory = 'bomb';
        } else if (ORDER_STATUS_KEYWORDS.cancel_status.some(k => normalizedStatus.includes(k))) {
            currentCategory = 'cancelled';
        } else if (ORDER_STATUS_KEYWORDS.success_status.some(k => normalizedStatus.includes(k))) {
            currentCategory = 'completed';
        } else if (ORDER_STATUS_KEYWORDS.processing_status.some(k => normalizedStatus.includes(k))) {
            currentCategory = 'processing';
        } else {
            currentCategory = 'other';
        }
    }

    // Logic hiển thị dựa trên category
    switch (currentCategory) {
        case 'completed':
            color = theme.palette.success.main;
            chipColor = 'success';
            label = 'Hoàn thành';
            break;
        case 'processing':
            color = theme.palette.info.main;
            chipColor = 'info';
            label = 'Đang giao';
            break;
        case 'cancelled':
            color = theme.palette.warning.main;
            chipColor = 'warning';
            label = 'Hủy';
            break;
        case 'bomb':
            color = theme.palette.error.main;
            chipColor = 'error';
            label = 'Bom hàng';
            break;
        case 'refunded':
            color = theme.palette.error.light;
            chipColor = 'error';
            label = 'Đơn hoàn';
            break;
        default:
            // Giữ nguyên text gốc nếu không match
            break;
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