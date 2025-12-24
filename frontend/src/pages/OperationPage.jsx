import React, { useState } from 'react';
import { Box, Typography, Button, Paper, useTheme, Skeleton } from '@mui/material';
import { CalendarToday as CalendarTodayIcon } from '@mui/icons-material';
import DateRangeFilterMenu from '../components/common/DateRangeFilterMenu';
import GaugeChart from '../components/charts/GaugeChart';
import { useOperationPageLogic } from '../hooks/useOperationPageLogic';

function OperationPage() {
    const theme = useTheme();

    const {
        dateRange,
        dateLabel,
        anchorEl,
        handleOpenFilter,
        handleCloseFilter,
        handleApplyDateRange,
        loading,
        kpiData
    } = useOperationPageLogic();

    return (
        <Box sx={{ px: 4, py: 3 }}>
            {/* --- HEADER: TIÊU ĐỀ & BỘ LỌC --- */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography variant="h4">
                    Báo cáo Vận hành
                </Typography>
                
                <Box>
                    <Button
                        variant="outlined"
                        startIcon={<CalendarTodayIcon />}
                        onClick={handleOpenFilter}
                        sx={{ borderRadius: 2 }}
                    >
                        {dateLabel}
                    </Button>
                    <DateRangeFilterMenu
                        open={Boolean(anchorEl)}
                        anchorEl={anchorEl}
                        onClose={handleCloseFilter}
                        initialDateRange={dateRange}
                        onApply={handleApplyDateRange}
                    />
                </Box>
            </Box>

            {/* --- HÀNG 1: 4 BIỂU ĐỒ GAUGE (FLEXBOX RESPONSIVE) --- */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
                {loading ? (
                    Array.from(new Array(4)).map((_, index) => (
                        <Paper key={index} variant="glass" sx={{ flex: '1 1 250px', minWidth: '250px', p: 2, height: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <Skeleton variant="text" width="60%" height={30} sx={{ mb: 2 }} />
                            <Skeleton variant="circular" width={140} height={140} />
                        </Paper>
                    ))
                ) : (
                    kpiData.map((kpi, index) => (
                        <Paper
                            key={index}
                            variant="glass"
                            sx = {{ 
                                flex: '1 1 250px',
                                minWidth: '250px',
                                p: 2,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    transform: 'translateY(-5px)',
                                    boxShadow: `0 10px 30px -10px ${kpi.color}40`,
                                    borderColor: kpi.color,
                                }
                            }}
                        >
                            <GaugeChart
                                value={kpi.value}
                                max={kpi.max}
                                segments={kpi.segments}
                                title={kpi.title}
                                unit={kpi.unit}
                                previousValue={kpi.previousValue}
                                height={220}
                                color={kpi.color}
                            />
                        </Paper>
                    ))
                )}
            </Box>

            {/* --- Placeholder cho nội dung tiếp theo --- */}
            <Paper variant="placeholder">
                <Typography variant="body1" color="text.secondary">
                    Khu vực phát triển các tính năng tiếp theo (Backend Integration Pending...)
                </Typography>
            </Paper>
        </Box>
    );
}

export default OperationPage;