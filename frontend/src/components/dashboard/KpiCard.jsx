import React from 'react';
import { Paper, Typography, Box, Avatar, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { formatCurrency, formatNumber, formatPercentage } from '../../utils/formatters';
import { useAnimatedValue } from '../../hooks/useAnimatedValue';

const KpiComparison = ({ value, previousValue, format, direction = 'up' }) => {
    const theme = useTheme();

    if (typeof previousValue !== 'number' || previousValue === null) {
        return <Box sx={{ height: '20px' }} />; // Giữ chỗ để layout không bị nhảy
    }

    const currentValue = (typeof value === 'number') ? value : 0;
    const previous = previousValue;

    if (currentValue === 0 && previous === 0) return <Box sx={{ height: '20px' }} />;

    const sxProps = { display: 'flex', alignItems: 'center', mt: 0.5 };

    if (previous === 0 && currentValue > 0) {
        const color = direction === 'up' ? theme.palette.success.main : theme.palette.error.main;
        const Icon = direction === 'up' ? ArrowDropUpIcon : ArrowDropDownIcon;
        return (
            <Box sx={{ ...sxProps, color }}>
                <Icon sx={{ fontSize: '1.2rem' }} />
                <Typography variant="caption" sx={{ fontWeight: 600, lineHeight: 1 }}>Mới</Typography>
            </Box>
        );
    }
    
    if (previous === 0) return <Box sx={{ height: '20px' }} />;

    const percentageChange = ((currentValue - previous) / Math.abs(previous));
    if (!isFinite(percentageChange)) return <Box sx={{ height: '20px' }} />;

    let isGoodChange;
    if (direction === 'up') {
        isGoodChange = percentageChange >= 0;
    } else {
        isGoodChange = percentageChange <= 0;
    }
    const color = isGoodChange ? theme.palette.success.main : theme.palette.error.main;
    
    const Icon = percentageChange >= 0 ? ArrowDropUpIcon : ArrowDropDownIcon;
    
    let previousDisplay;
    if (format === 'currency') previousDisplay = formatCurrency(previous);
    else if (format === 'percent') previousDisplay = formatPercentage(previous);
    else previousDisplay = formatNumber(previous);


    return (
        <Tooltip title={`Kỳ trước: ${previousDisplay}`} placement="top">
            <Box sx={{ ...sxProps, color }}>
                <Icon sx={{ fontSize: '1.2rem' }} />
                <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1 }}>
                    {formatPercentage(percentageChange, { includeSign: false })}
                </Typography>
            </Box>
        </Tooltip>
    );
};


function KpiCard({ title, value, icon, color = 'primary.main', previousValue, format, direction }) {
    // The value prop can be a pre-formatted string (like "1.234 đ") or a number
    const numericValue = typeof value === 'string' 
        ? parseFloat(value.replace(/[^0-9.,-]+/g, "").replace(".", "").replace(",", "."))
        : value;

    const animatedDisplayValue = useAnimatedValue(numericValue, 1200);

    let displayValue;
    if (typeof animatedDisplayValue === 'number') {
        if (format === 'currency') displayValue = formatCurrency(animatedDisplayValue);
        else if (format === 'percent') displayValue = formatPercentage(animatedDisplayValue);
        else displayValue = formatNumber(animatedDisplayValue);
    } else {
        displayValue = value; // Fallback to the original value if it's not a number
    }


    return (
        <Paper 
            elevation={0}
            sx={{
                p: 2.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 4,
                height: '100%', // Đảm bảo card có chiều cao bằng nhau
            }}
        >
            <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    {title}
                </Typography>
                <Typography variant="h5" fontWeight="600">
                    {displayValue}
                </Typography>
                <KpiComparison value={numericValue} previousValue={previousValue} format={format} direction={direction} />
            </Box>
            <Avatar 
                sx={{ 
                    bgcolor: color, 
                    color: 'white',
                    width: 56, 
                    height: 56 
                }}
            >
                {icon}
            </Avatar>
        </Paper>
    );
}

export default KpiCard;