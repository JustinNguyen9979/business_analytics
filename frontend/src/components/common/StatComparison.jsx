import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { T } from '../../theme/designSystem';

const StatComparison = ({ value, previousValue, format, direction = 'up' }) => {
    if (typeof previousValue !== 'number') {
        return null;
    }

    const currentValue = (typeof value === 'number') ? value : 0;
    const previous = previousValue;

    if (currentValue === 0 && previous === 0) return null;

    const sxProps = { display: 'flex', alignItems: 'center', ml: 0.5 };

    if (previous === 0 && currentValue > 0) {
        let color = direction === 'up' ? T.success : T.error;
        let Icon = direction === 'up' ? ArrowDropUpIcon : ArrowDropDownIcon;
        return ( <Box sx={{ ...sxProps, color }}> <Icon sx={{ fontSize: '1.2rem' }} /> <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1, fontFamily: T.fontMono }}>NEW</Typography> </Box> );
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
    const color = isGoodChange ? T.success : T.error;
    // ===================================
    
    const Icon = percentageChange >= 0 ? ArrowDropUpIcon : ArrowDropDownIcon;
    const previousDisplay = format === 'currency' ? formatCurrency(previous) : format === 'percent' ? `${(previous * 100).toFixed(2)}%` : formatNumber(previous);

    return (
        <Tooltip title={`Kỳ trước: ${previousDisplay}`} placement="top">
            <Box sx={{ ...sxProps, color, filter: `drop-shadow(0 0 4px ${color}40)` }}>
                <Icon sx={{ fontSize: '1.2rem' }} />
                <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1, fontFamily: T.fontMono }}>{Math.abs(percentageChange).toFixed(1)}%</Typography>
            </Box>
        </Tooltip>
    );
};

export default StatComparison;

