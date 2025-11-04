// FILE: frontend/src/pages/DashboardPage.jsx (PHIÊN BẢN HOÀN THIỆN)

import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Typography, Box, Paper, Divider, CircularProgress, Alert, Button } from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import dayjs from 'dayjs';

// 1. IMPORT CUSTOM HOOK MỚI
import { useDashboardData } from '../components/dashboard/useDashboardData';
import { useTheme } from '@mui/material/styles';

import { useLayout } from '../context/LayoutContext';
import { StatItem } from '../components/dashboard/StatItem';
import { kpiGroups } from '../config/dashboardConfig';
import RevenueProfitChart from '../components/charts/RevenueProfitChart';
import ChartPlaceholder from '../components/common/ChartPlaceholder';
import DateRangeFilterMenu from '../components/common/DateRangeFilterMenu';
import ChartTimeFilter from '../components/common/ChartTimeFilter';

function DashboardPage() {
    const theme = useTheme();
    const { brandId } = useParams();
    const { isSidebarOpen } = useLayout();
    const [searchParams, setSearchParams] = useSearchParams();
    
    // --- STATE QUẢN LÝ LỰA CHỌN CỦA NGƯỜI DÙNG (VẪN GIỮ LẠI Ở ĐÂY) ---
    const [kpiDateRange, setKpiDateRange] = useState(() => {
        const start = searchParams.get('start');
        const end = searchParams.get('end');
        return (start && end) ? [dayjs(start), dayjs(end)] : [dayjs().subtract(27, 'days').startOf('day'), dayjs().endOf('day')];
    });
    const [chartDateRange, setChartDateRange] = useState({
        range: [dayjs().startOf('year'), dayjs().endOf('year')],
        type: 'year'
    });
    
    // State cho UI Popover/Menu
    const [kpiAnchorEl, setKpiAnchorEl] = useState(null);
    const [chartRevision, setChartRevision] = useState(0);

    // 2. GỌI CUSTOM HOOK ĐỂ LẤY TOÀN BỘ DỮ LIỆU VÀ TRẠNG THÁI
    const { loading, error, brandInfo, kpiData, chartData } = useDashboardData(
        brandId,
        kpiDateRange,
        chartDateRange
    );

    // --- CÁC HÀM XỬ LÝ SỰ KIỆN CỦA UI (KHÔNG THAY ĐỔI) ---
    const handleOpenKpiFilter = (event) => setKpiAnchorEl(event.currentTarget);
    const handleCloseKpiFilter = () => setKpiAnchorEl(null);
    const handleApplyKpiFilter = (newRange) => {
        setKpiDateRange(newRange);
        setSearchParams({ start: newRange[0].format('YYYY-MM-DD'), end: newRange[1].format('YYYY-MM-DD') });
        handleCloseKpiFilter();
    };
    const handleChartFilterChange = useCallback((newRange, type) => {
        setChartDateRange({ range: newRange, type: type });
    }, []);

    // Effect để vẽ lại biểu đồ khi sidebar thay đổi (không thay đổi)
    useEffect(() => {
        const timer = setTimeout(() => setChartRevision(prev => prev + 1), 300);
        return () => clearTimeout(timer);
    }, [isSidebarOpen]);

    // --- PHẦN RENDER GIAO DIỆN ---
    if (error) return <Alert severity="error">{error}</Alert>;
    // 3. SỬ DỤNG KẾT QUẢ TRẢ VỀ TỪ HOOK
    if (loading && !kpiData.current) { 
        return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>; 
    }

    return (
        <Box sx={{ px: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Typography variant="h4" gutterBottom>{brandInfo.name ? `Báo cáo Kinh doanh: ${brandInfo.name}` : ''}</Typography>
            
            <Paper variant="glass" elevation={0} sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }} noWrap>Chỉ số Hiệu suất Tổng thể</Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body1" color="text.secondary">
                           {`${kpiDateRange[0].format('DD/MM/YYYY')} - ${kpiDateRange[1].format('DD/MM/YYYY')}`}
                        </Typography>
                        <Button variant="outlined" onClick={handleOpenKpiFilter} startIcon={<CalendarMonthIcon />}>
                            Bộ lọc
                        </Button>
                    </Box>
                </Box>
                
                <Divider sx={{ mb: 3 }} />
                
                {kpiData.current ? (
                    <Box sx={{ 
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: '1fr',
                            md: 'repeat(2, 1fr)',
                            lg: 'repeat(4, 1fr)',
                        }
                    }}>
                        {kpiGroups.map((group, groupIndex) => (
                            <Box 
                                key={group.groupTitle} 
                                sx={{ 
                                    p: 2, 
                                    borderRight: { 
                                        lg: groupIndex < 3 ? `1px solid ${theme.palette.divider}` : 'none',
                                        md: groupIndex % 2 === 0 ? `1px solid ${theme.palette.divider}` : 'none',
                                    }, 
                                    borderBottom: { 
                                        xs: groupIndex < kpiGroups.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                                        md: groupIndex < 2 ? `1px solid ${theme.palette.divider}` : 'none',
                                        lg: 'none'
                                    } 
                                }}
                            >
                                <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 2, fontWeight: 600, fontSize: '0.875rem', textAlign: 'center' }}>
                                    {group.groupTitle}
                                </Typography>
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 3, textAlign: 'left' }}>
                                    {group.items.map((kpi) => (
                                        <StatItem 
                                            key={kpi.key} 
                                            title={kpi.title} 
                                            value={kpiData.current[kpi.key]} 
                                            previousValue={kpiData.previous ? kpiData.previous[kpi.key] : 0}
                                            format={kpi.format}
                                            tooltipText={kpi.tooltipText}
                                            direction={kpi.direction}
                                        />
                                    ))}
                                </Box>
                            </Box>
                        ))}
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
                )}
            </Paper>

            <Paper variant="glass" elevation={0} sx={{ p: 1 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, px: 3, pt: 3 }}>
                    {/* 1. Đưa tiêu đề ra ngoài */}
                    <Typography variant="h6" noWrap>Biểu đồ Doanh thu ròng & Lợi nhuận</Typography>
                    {/* 2. Đặt bộ lọc trực tiếp ở đây */}
                    <ChartTimeFilter onFilterChange={handleChartFilterChange} />
                </Box>
                
                <Box sx={{ px: 3, pb: 3, pt: 1 }}>
                    {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', height: 450 }}><CircularProgress /></Box> : (
                        chartData.current.length > 0 ? (
                            <RevenueProfitChart 
                                data={chartData.current} 
                                comparisonData={chartData.previous}
                                chartRevision={chartRevision}
                                filterType={chartDateRange.type}
                                dateRange={chartDateRange.range}
                                aggregationType={chartData.aggregationType}
                            />
                        ) : <ChartPlaceholder />
                    )}
                </Box>
            </Paper>
            
            <DateRangeFilterMenu
                open={Boolean(kpiAnchorEl)}
                anchorEl={kpiAnchorEl}
                onClose={handleCloseKpiFilter}
                initialDateRange={kpiDateRange}
                onApply={handleApplyKpiFilter}
            />
        </Box>
    );
}

export default DashboardPage;