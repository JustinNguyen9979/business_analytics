// FILE: frontend/src/components/dashboard/StatItem.jsx (PHIÊN BẢN CUỐI CÙNG)

import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { useTheme } from '@mui/material/styles';
import { formatCurrency, formatNumber } from '../../utils/kpiCalculations'; // Sửa lại đường dẫn nếu cần

export function StatItem({ title, value, previousValue, tooltipText, format = 'number' }) {
    let displayValue;

    // === SỬA LỖI Ở ĐÂY: XỬ LÝ CẢ TRƯỜNG HỢP NULL VÀ UNDEFINED ===
    if (value !== null && value !== undefined && typeof value === 'number') {
        if (format === 'currency') displayValue = formatCurrency(value);
        else if (format === 'percent') displayValue = `${value.toFixed(2)}%`;
        else displayValue = formatNumber(value);
    } else {
        // Nếu giá trị là null, undefined, hoặc không phải số, hiển thị giá trị mặc định
        displayValue = (format === 'currency' ? '0 đ' : (format === 'percent' ? '0.00%' : '0'));
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    {title}
                </Typography>
                {tooltipText && (
                    <Tooltip title={tooltipText} arrow placement="top">
                        <InfoOutlinedIcon sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help', ml: 0.5 }} />
                    </Tooltip>
                )}
                {/* Truyền cả giá trị đã được chuẩn hóa xuống StatComparison để nó an toàn hơn */}
                <StatComparison value={value} previousValue={previousValue} format={format} />
            </Box>
            <Typography variant="h6" fontWeight="600">
                {displayValue}
            </Typography>
        </Box>
    );
}

// Em copy lại luôn phần StatComparison để anh tiện copy cả file
const StatComparison = ({ value, previousValue, format }) => {
    const theme = useTheme();
    const currentValue = (value !== null && value !== undefined && typeof value === 'number') ? value : 0;
    const previous = (previousValue !== null && previousValue !== undefined && typeof previousValue === 'number') ? previousValue : 0;
    
    if (currentValue === 0 && previous === 0) return null;
    
    const sxProps = { display: 'flex', alignItems: 'center', ml: 0.5 };
    if (previous === 0) {
        if (currentValue > 0) return ( <Box sx={{ ...sxProps, color: theme.palette.success.main }}> <ArrowDropUpIcon sx={{ fontSize: '1rem' }} /> <Typography variant="caption" sx={{ fontWeight: 600, lineHeight: 1 }}>Mới</Typography> </Box> );
        if (currentValue < 0) return ( <Box sx={{ ...sxProps, color: theme.palette.error.main }}> <ArrowDropDownIcon sx={{ fontSize: '1rem' }} /> <Typography variant="caption" sx={{ fontWeight: 600, lineHeight: 1 }}>Mới</Typography> </Box> );
        return null;
    }
    
    const percentageChange = ((currentValue - previous) / Math.abs(previous)) * 100;
    if (!isFinite(percentageChange)) return null;

    const isPositive = percentageChange >= 0;
    const color = isPositive ? theme.palette.success.main : theme.palette.error.main;
    const Icon = isPositive ? ArrowDropUpIcon : ArrowDropDownIcon;
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