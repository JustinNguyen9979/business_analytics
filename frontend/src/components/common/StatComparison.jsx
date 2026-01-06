import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { useTheme } from '@mui/material/styles';
import { formatCurrency, formatNumber } from '../../utils/formatters';

const StatComparison = ({ value, previousValue, format, direction = 'up' }) => {
    const theme = useTheme();

    if (typeof previousValue !== 'number') {
        return null;
    }

    const currentValue = (typeof value === 'number') ? value : 0;
    const previous = previousValue;

    if (currentValue === 0 && previous === 0) return null;

    const sxProps = { display: 'flex', alignItems: 'center', ml: 0.5 };

    if (previous === 0 && currentValue > 0) {
        let color = direction === 'up' ? theme.palette.success.main : theme.palette.error.main;
        let Icon = direction === 'up' ? ArrowDropUpIcon : ArrowDropDownIcon;
        return ( <Box sx={{ ...sxProps, color }}> <Icon sx={{ fontSize: '1rem' }} /> <Typography variant="caption" sx={{ fontWeight: 600, lineHeight: 1 }}>Mới</Typography> </Box> );
    }

    if (previous === 0) return null;
    
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
                <Typography variant="caption" sx={{ fontWeight: 600, lineHeight: 1 }}>{Math.abs(percentageChange).toFixed(2)}%</Typography>
            </Box>
        </Tooltip>
    );
};

export default StatComparison;
