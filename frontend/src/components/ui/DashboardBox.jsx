import React from 'react';
import { Paper, Typography, Box, Button, Skeleton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DateRangeFilterMenu from '../common/DateRangeFilterMenu';
import LoadingOverlay from '../common/LoadingOverlay';
import ChartPlaceholder from '../common/ChartPlaceholder';

const ChartSkeleton = () => (
    <Skeleton 
        variant="rectangular" 
        width="100%" 
        height="100%" 
        sx={{ borderRadius: 2, bgcolor: 'rgba(255, 255, 255, 0.05)' }} 
    />
);

/**
 * DashboardBox - Hộp chứa nội dung chuẩn cho Dashboard.
 * Tái sử dụng Paper variant="glass" từ theme.
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
    contentSx = {}
}) => {
    const theme = useTheme();

    return (
        <Paper 
            variant="glass" 
            sx={{ 
                position: 'relative',
                overflow: 'hidden',
                flex: minWidth === 'auto' ? '1 1 auto' : `1 1 ${minWidth}`, 
                p: 2, 
                height: height, 
                display: 'flex', 
                flexDirection: 'column',
                transition: 'all 0.3s ease',
                '&:hover': {
                    borderColor: theme.palette.primary.main,
                    boxShadow: `0 0 20px ${theme.palette.primary.main}30`,
                },
                ...sx 
            }}
        >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 1 }}>
                {title && (
                    <Typography variant="h6" sx={{ fontWeight: 600 }} noWrap>
                        {title}
                    </Typography>
                )}
                
                <Box display="flex" gap={1} alignItems="center">
                    {filterControl && (
                        <>
                            <Button 
                                variant="outlined" 
                                size="small" 
                                startIcon={<CalendarMonthIcon />} 
                                onClick={filterControl.openDateMenu}
                                sx={{ borderRadius: 1.5 }}
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
                            {loading && <LoadingOverlay borderRadius={2} />}
                            {children}
                        </>
                    ) : (
                        <ChartPlaceholder title={placeholderTitle || title} />
                    )
                )}
            </Box>
        </Paper>
    );
};

export default DashboardBox;