// FILE: frontend/src/components/dashboard/StatItem.jsx (PHIÊN BẢN CUỐI CÙNG)

import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { useTheme } from '@mui/material/styles';
import { formatCurrency, formatNumber } from '../../utils/formatters'; 
import { useCountUp } from '../../hooks/useCountUp';

// Em copy lại luôn phần StatComparison để anh tiện copy cả file
const StatComparison = ({ value, previousValue, format, direction = 'up' }) => {
    const theme = useTheme();
    const currentValue = (typeof value === 'number') ? value : 0;
    const previous = (typeof previousValue === 'number') ? previousValue : 0;

    if (currentValue === 0 && previous === 0) return null;

    const sxProps = { display: 'flex', alignItems: 'center', ml: 0.5 };
    if (previous === 0) {
        let color = theme.palette.success.main;
        let Icon = ArrowDropUpIcon;
        if (direction === 'down') {
             color = theme.palette.error.main;
             Icon = ArrowDropDownIcon;
        }
        return ( <Box sx={{ ...sxProps, color }}> <Icon sx={{ fontSize: '1rem' }} /> <Typography variant="caption" sx={{ fontWeight: 600, lineHeight: 1 }}>Mới</Typography> </Box> );
    }
    
    const percentageChange = ((currentValue - previous) / Math.abs(previous)) * 100;
    if (!isFinite(percentageChange)) return null;

    // === LOGIC MỚI QUYẾT ĐỊNH MÀU SẮC ===
    let isGoodChange;
    if (direction === 'up') {
        isGoodChange = percentageChange >= 0; // Tăng là tốt
    } else { // direction === 'down'
        isGoodChange = percentageChange <= 0; // Giảm là tốt
    }
    const color = isGoodChange ? theme.palette.success.main : theme.palette.error.main;
    // ===================================
    
    const Icon = percentageChange >= 0 ? ArrowDropUpIcon : ArrowDropDownIcon;
    const previousDisplay = format === 'currency' ? formatCurrency(previous) : format === 'percent' ? `${previous.toFixed(2)}%` : formatNumber(previous);

    return (
        <Tooltip title={`Kỳ trước: ${previousDisplay}`} placement="top">
            <Box sx={{ ...sxProps, color }}>
                <Icon sx={{ fontSize: '1rem' }} />
                <Typography variant="caption" sx={{ fontWeight: 600, lineHeight: 1 }}>{Math.abs(percentageChange).toFixed(0)}%</Typography>
            </Box>
        </Tooltip>
    );
};

export function StatItem({ title, value, previousValue, tooltipText, format = 'number', direction = 'up' }) {
    const animatedValue = useCountUp(value, 1200);
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