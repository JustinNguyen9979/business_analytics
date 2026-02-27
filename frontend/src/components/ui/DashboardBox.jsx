import React from 'react';
import { Paper, Typography, Box, Button, Skeleton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DateRangeFilterMenu from '../common/DateRangeFilterMenu';
import LoadingOverlay from '../common/LoadingOverlay';
import ChartPlaceholder from '../common/ChartPlaceholder';
import { T, AccentBar } from '../../theme/designSystem';

const ChartSkeleton = () => (
    <Skeleton 
        variant="rectangular" 
        width="100%" 
        height="100%" 
        sx={{ borderRadius: T.radiusMd, bgcolor: 'rgba(255, 255, 255, 0.03)' }} 
    />
);

/**
 * DashboardBox - Hộp chứa nội dung chuẩn cho Dashboard.
 * Tái sử dụng class glass-card từ global.css.
 */
const DashboardBox = ({ 
    title, 
    action, 
    children, 
    minWidth = 'auto', 
    height = 400, 
    sx = {},
    loading = false,
    hasData = true,
    filterControl = null,
    placeholderTitle = '',
    contentSx = {},
    className = ''
}) => {
    const theme = useTheme();

    return (
        <Box 
            className={`glass-card ${className}`}
            sx={{ 
                position: 'relative',
                overflow: 'hidden',
                flex: minWidth === 'auto' ? '1 1 auto' : `1 1 ${minWidth}`, 
                p: 3, 
                height: height, 
                display: 'flex', 
                flexDirection: 'column',
                transition: 'all 0.4s var(--ease-smooth)',
                borderRadius: T.radiusLg,
                // Hiệu ứng Glassmorphism mạnh hơn
                backdropFilter: 'blur(30px) saturate(150%)',
                WebkitBackdropFilter: 'blur(30px) saturate(150%)',
                boxShadow: `
                    0 20px 50px -12px rgba(0, 0, 0, 0.8), 
                    inset 0 1px 1px rgba(255, 255, 255, 0.03),
                    0 0 0 1px rgba(255, 255, 255, 0.02)
                `,
                border: `1px solid ${T.border}`, 
                '&:hover': {
                    borderColor: `${T.primary}80`, 
                    transform: 'translateY(-6px)',
                    boxShadow: `
                        0 30px 60px -15px rgba(0, 0, 0, 0.9), 
                        0 0 30px ${T.primary}15,
                        inset 0 0 15px ${T.border}
                    `,
                },
                ...sx 
            }}
        >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                {title && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <AccentBar height={20} />
                        <Typography 
                            variant="h6" 
                            sx={{ 
                                fontWeight: 700, 
                                fontFamily: T.fontDisplay,
                                fontSize: '1rem',
                                color: T.textPrimary,
                                letterSpacing: '0.5px'
                            }} 
                            noWrap
                        >
                            {title}
                        </Typography>
                    </Box>
                )}
                
                <Box display="flex" gap={1} alignItems="center">
                    {filterControl && (
                        <>
                            <Button 
                                variant="outlined" 
                                size="small" 
                                startIcon={<CalendarMonthIcon />} 
                                onClick={filterControl.openDateMenu}
                                sx={{ 
                                    borderRadius: T.radiusSm,
                                    borderColor: T.border,
                                    color: T.textSecond,
                                    fontSize: '0.75rem',
                                    height: 32,
                                    px: 1.5,
                                    '&:hover': {
                                        borderColor: T.primary,
                                        color: T.primary,
                                        backgroundColor: T.primaryDim
                                    }
                                }}
                            >
                                {filterControl.dateLabel}
                            </Button>
                            <DateRangeFilterMenu {...filterControl.dateMenuProps} />
                        </>
                    )}
                    {action}
                </Box>
            </Box>

            <Box sx={{ flexGrow: 1, position: 'relative', minWidth: 0, ...contentSx }}>
                {loading && !hasData ? (
                    <ChartSkeleton />
                ) : (
                    hasData ? (
                        <>
                            {loading && <LoadingOverlay borderRadius={T.radiusMd} />}
                            {children}
                        </>
                    ) : (
                        <ChartPlaceholder title={placeholderTitle || title} />
                    )
                )}
            </Box>
        </Box>
    );
};

export default DashboardBox;