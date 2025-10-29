// FILE: frontend/src/components/dashboard/StatItem.jsx (PHIÊN BẢN CUỐI CÙNG)

import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { useTheme } from '@mui/material/styles';
import { formatCurrency, formatNumber } from '../../utils/kpiCalculations'; // Sửa lại đường dẫn nếu cần

// Component con để hiển thị so sánh (LOGIC ĐƯỢC TỐI ƯU)
const StatComparison = ({ value, previousValue, format }) => {
    const theme = useTheme();

    // Chuẩn hóa giá trị: coi null, undefined là 0
    const currentValue = typeof value === 'number' ? value : 0;
    const previous = typeof previousValue === 'number' ? previousValue : 0;

    // Cả hai đều là 0, không cần so sánh
    if (currentValue === 0 && previous === 0) {
        return null;
    }

    // Trường hợp kỳ trước bằng 0
    if (previous === 0) {
        if (currentValue > 0) { // Từ 0 lên số dương -> Mới
            return (
                <Box sx={{ display: 'flex', alignItems: 'center', color: theme.palette.success.main, ml: 0.5 }}>
                    <ArrowDropUpIcon sx={{ fontSize: '1rem' }} />
                    <Typography variant="caption" sx={{ fontWeight: 600, lineHeight: 1 }}>Mới</Typography>
                </Box>
            );
        }
        if (currentValue < 0) { // Từ 0 xuống số âm -> Mới (nhưng là tiêu cực)
            return (
                <Box sx={{ display: 'flex', alignItems: 'center', color: theme.palette.error.main, ml: 0.5 }}>
                    <ArrowDropDownIcon sx={{ fontSize: '1rem' }} />
                    <Typography variant="caption" sx={{ fontWeight: 600, lineHeight: 1 }}>Mới</Typography>
                </Box>
            );
        }
    }
    
    // Trường hợp kỳ trước khác 0
    const percentageChange = ((currentValue - previous) / Math.abs(previous)) * 100;

    // Nếu thay đổi quá lớn (Infinity), không hiển thị
    if (!isFinite(percentageChange)) {
        return null;
    }

    const isPositive = percentageChange >= 0;
    const color = isPositive ? theme.palette.success.main : theme.palette.error.main;
    const Icon = isPositive ? ArrowDropUpIcon : ArrowDropDownIcon;
    
    const previousDisplay = format === 'currency' ? formatCurrency(previous) : 
                            format === 'percent' ? `${previous.toFixed(2)}%` : formatNumber(previous);

    return (
        <Tooltip title={`Kỳ trước: ${previousDisplay}`} placement="top">
            <Box sx={{ display: 'flex', alignItems: 'center', color, ml: 1 }}>
                <Icon sx={{ fontSize: '1rem' }} />
                <Typography variant="caption" sx={{ fontWeight: 600, lineHeight: 1 }}>
                    {Math.abs(percentageChange).toFixed(0)}%
                </Typography>
            </Box>
        </Tooltip>
    );
};

// Component chính (không thay đổi)
export function StatItem({ title, value, previousValue, tooltipText, format = 'number' }) {
    let displayValue;
    if (typeof value === 'number') {
        if (format === 'currency') displayValue = formatCurrency(value);
        else if (format === 'percent') displayValue = `${value.toFixed(2)}%`;
        else displayValue = formatNumber(value);
    } else {
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
                <StatComparison value={value} previousValue={previousValue} format={format} />
            </Box>
            <Typography variant="h6" fontWeight="600">
                {displayValue}
            </Typography>
        </Box>
    );
}