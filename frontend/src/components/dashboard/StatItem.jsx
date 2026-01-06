// FILE: frontend/src/components/dashboard/StatItem.jsx (PHIÊN BẢN CUỐI CÙNG)

import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { formatCurrency, formatNumber } from '../../utils/formatters'; 
import { useAnimatedValue } from '../../hooks/useAnimatedValue';
import StatComparison from '../common/StatComparison'; // Import component đã tách

export function StatItem({ title, value, previousValue, tooltipText, format = 'number', direction = 'up' }) {
    const animatedValue = useAnimatedValue(value, 1200);
    let displayValue;
    if (typeof animatedValue === 'number') {
        if (format === 'currency') {
            displayValue = formatCurrency(animatedValue);
        } 
        // === SỬA LỖI Ở ĐÂY: NHÂN VỚI 100 TRƯỚC KHI HIỂN THỊ ===
        else if (format === 'percent') {
            displayValue = `${(animatedValue * 100).toFixed(2)}%`;
        } 
        else {
            displayValue = formatNumber(animatedValue);
        }
    } else {
        displayValue = (format === 'currency' ? '0 đ' : (format === 'percent' ? '0.00%' : '0'));
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>{title}</Typography>
                {tooltipText && ( <Tooltip title={tooltipText} arrow placement="top"> <InfoOutlinedIcon sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help', ml: 0.5 }} /> </Tooltip> )}
                <StatComparison value={value} previousValue={previousValue} format={format} direction={direction} />
            </Box>
            <Typography variant="h6" fontWeight="600">{displayValue}</Typography>
        </Box>
    );
}
