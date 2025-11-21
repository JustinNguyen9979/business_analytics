// FILE: frontend/src/pages/DashboardPage.jsx (PHIÊN BẢN HOÀN THIỆN)

import { useTheme } from '@mui/material/styles';
import React, { useState, useCallback, useEffect, Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Typography, Box, Paper, Divider, CircularProgress, Alert, Button, Stack, Skeleton } from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import dayjs from 'dayjs';
import { useDashboardData } from '../hooks/dashboard/useDashboardData';
import DateRangeFilterMenu from '../components/common/DateRangeFilterMenu';
import ChartTimeFilter from '../components/common/ChartTimeFilter';
import { StatItem } from '../components/dashboard/StatItem';
import { kpiGroups } from '../config/dashboardConfig';
// import RevenueProfitChart from '../components/charts/RevenueProfitChart';
// import TopProductsChart from '../components/charts/TopProductsChart';
// import CostDonutChart from '../components/charts/CostDonutChart';
// import GeoMapChart from '../components/charts/GeoMapChart';
import ChartPlaceholder from '../components/common/ChartPlaceholder';
import { useLayout } from '../context/LayoutContext';
import { useBrand } from '../context/BrandContext';

const RevenueProfitChart = lazy(() => import('../components/charts/RevenueProfitChart'));
const CostDonutChart = lazy(() => import('../components/charts/CostDonutChart'));
const TopProductsChart = lazy(() => import('../components/charts/TopProductsChart'));
const GeoMapChart = lazy(() => import('../components/charts/GeoMapChart'));

const ChartSkeleton = () => (
    <Skeleton 
        variant="rectangular" 
        width="100%" 
        height="100%" 
        sx={{ borderRadius: 2, bgcolor: 'rgba(255, 255, 255, 0.05)' }} 
    />
);

function DashboardPage() {
    const theme = useTheme();
    const { id: brandId, name: brandName } = useBrand();
    const [searchParams, setSearchParams] = useSearchParams();
    const { isSidebarOpen } = useLayout();

    const [kpiFilter, setKpiFilter] = useState(() => {
        const start = searchParams.get('start_kpi');
        const end = searchParams.get('end_kpi');
        const initialRange = [start ? dayjs(start) : dayjs().subtract(27, 'days').startOf('day'), end ? dayjs(end) : dayjs().endOf('day')];
        // Mặc định ban đầu, ta coi nó là loại 'custom' hoặc 'day'
        return { range: initialRange, type: 'custom' }; 
    });

    const [lineChartFilter, setLineChartFilter] = useState({ range: [dayjs().startOf('month'), dayjs().endOf('day')], type: 'month' });
    const [donutFilter, setDonutFilter] = useState({ range: [dayjs().startOf('month'), dayjs().endOf('day')], type: 'month' });
    const [topProductsFilter, setTopProductsFilter] = useState({ range: [dayjs().startOf('month'), dayjs().endOf('day')], type: 'month' });
    const [mapFilter, setMapFilter] = useState({ range: [dayjs().startOf('month'), dayjs().endOf('day')], type: 'month' });

    const dashboardState = useDashboardData(brandId, {
        kpi: kpiFilter,
        lineChart: lineChartFilter,
        donut: donutFilter,
        topProducts: topProductsFilter,
        map: mapFilter,
    });
    const { kpi, lineChart, donut, topProducts, map } = dashboardState;

    // --- STATE QUẢN LÝ UI ---
    const [kpiAnchorEl, setKpiAnchorEl] = useState(null);
    const [chartRevision, setChartRevision] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => setChartRevision(prev => prev + 1), 300);
        return () => clearTimeout(timer);
    }, [isSidebarOpen]);

    // --- CÁC HÀM HANDLER CHO BỘ LỌC KPI ---
    const handleOpenKpiFilter = (event) => setKpiAnchorEl(event.currentTarget);
    const handleCloseKpiFilter = () => setKpiAnchorEl(null);
    const handleApplyKpiFilter = useCallback((newRange, filterType = 'custom') => {
        setKpiFilter({ range: newRange, type: filterType });
        setSearchParams({ start_kpi: newRange[0].format('YYYY-MM-DD'), end_kpi: newRange[1].format('YYYY-MM-DD') });
        handleCloseKpiFilter();
    }, [setSearchParams]);

    const handleLineChartFilterChange = useCallback((range, type) => setLineChartFilter({ range, type }), []);
    const handleDonutFilterChange = useCallback((range, type) => setDonutFilter({ range, type }), []);
    const handleTopProductsFilterChange = useCallback((range, type) => setTopProductsFilter({ range, type }), []);
    const handleMapFilterChange = useCallback((range, type) => setMapFilter({ range, type }), []);

    const anyError = Object.values(dashboardState).find(s => s.error);
    if (anyError) return <Alert severity="error" sx={{ m: 4 }}>{anyError.error}</Alert>;

    return (
        <Box sx={{ px: 4 }} >
            <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
                {brandName ? `Báo cáo Kinh doanh: ${brandName}` : 'Đang tải...'}
            </Typography>
            
            <Paper variant="glass" elevation={0} sx={{ p: 3, mb: 4 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }} noWrap>Chỉ số Hiệu suất Tổng thể</Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body1" color="text.secondary">
                           {`${kpiFilter.range[0].format('DD/MM/YYYY')} - ${kpiFilter.range[1].format('DD/MM/YYYY')}`}
                        </Typography>
                        <Button variant="outlined" onClick={handleOpenKpiFilter} startIcon={<CalendarMonthIcon />}>
                            Bộ lọc
                        </Button>
                    </Box>
                </Box>
                
                <Divider sx={{ mb: 3 }} />
                
                <Box sx={{ minHeight: 360, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {kpi.loading ? (
                        // 1. NẾU ĐANG LOADING: Hiển thị vòng quay
                        <Box variant="loaderContainer" sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : kpi.data.current ? (
                        // 2. NẾU KHÔNG LOADING VÀ CÓ DỮ LIỆU: Hiển thị bảng
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
                                        {group.items.map((kpiItem) => {
                                            // console.log(`Đang render chỉ số: ${kpiItem.key}`, ' | Giá trị hiện tại:', kpi.data.current[kpiItem.key], ' | Giá trị kỳ trước:', kpi.data.previous?.[kpiItem.key]);
                                            return (
                                                <StatItem 
                                                    key={kpiItem.key} 
                                                    value={kpi.data.current[kpiItem.key]} 
                                                    previousValue={kpi.data.previous?.[kpiItem.key]}
                                                    {...(() => {
                                                        const { key, ...rest } = kpiItem;
                                                        return rest;
                                                    })()}
                                                />
                                            );
                                        })} 
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    ) : (
                        <ChartPlaceholder title="Chỉ số Hiệu suất" />
                    )}
                </Box>
            </Paper>

            <Paper variant="glass" elevation={0} sx={{ p: 1, mb: 4 }}>
                <Box variant="loaderContainer" sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, px: 3, pt: 3 }}>
                    <Typography variant="h6" noWrap>Biểu đồ Doanh thu ròng & Lợi nhuận</Typography>
                    <ChartTimeFilter value={lineChartFilter} onChange={handleLineChartFilterChange} />
                </Box>
                
                <Box sx={{ pb: 3, pt: 1, height: 450, position: 'relative' }}>
                    {lineChart.loading ? <ChartSkeleton /> : (
                        <Suspense fallback={<ChartSkeleton />}>
                            {lineChart.data.current && lineChart.data.current.length > 0 ? (
                                <RevenueProfitChart 
                                    data={lineChart.data.current} 
                                    comparisonData={lineChart.data.previous}
                                    chartRevision={chartRevision}
                                    aggregationType={lineChart.data.aggregationType}
                                />
                            ) : <ChartPlaceholder title="Doanh thu & Lợi nhuận" />}
                        </Suspense>
                    )}
                </Box>
            </Paper>

            <Box
                sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 4,
                    mb: 4,
                }}
            >
                {/* --- BOX CON BÊN TRÁI --- */}
                <Box
                    sx={{
                        width: { xs: '100%', md: 'calc(50% - 16px)' }, 
                    }}
                >
                    {/* Dùng Stack để tạo khoảng cách giữa 2 biểu đồ bên trong */}
                    <Stack spacing={4}>
                        {/* KHỐI 1: DONUT CHART */}
                        <Paper variant="glass" elevation={0} sx={{ p: 1, display: 'flex', flexDirection: 'column' }}>
                            <Box variant="loaderContainer" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, px: 2, pt: 2 }}>
                                <Typography variant="h6" noWrap>Phân bổ Chi phí</Typography>
                                <ChartTimeFilter value={donutFilter} onChange={handleDonutFilterChange} />
                            </Box>
                            <Box sx={{ flexGrow: 1, minHeight: 400, position: 'relative' }}>
                                {donut.loading ? (
                                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                        <CircularProgress />
                                    </Box>
                                ) : (
                                    donut.data ? <CostDonutChart {...donut.data} /> : <ChartPlaceholder title="Phân bổ Chi phí"/>
                                )}
                            </Box>
                        </Paper>

                        {/* KHỐI 2: TOP PRODUCTS CHART */}
                        <Paper variant="glass" elevation={0} sx={{ p: 1, display: 'flex', flexDirection: 'column' }}>
                            <Box variant="loaderContainer" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, px: 2, pt: 2 }}>
                                <Typography variant="h6" noWrap>Top SKU bán chạy</Typography>
                                <ChartTimeFilter value={topProductsFilter} onChange={handleTopProductsFilterChange} />
                            </Box>
                            <Box sx={{ flexGrow: 1, minHeight: 600, position: 'relative' }}>
                                {topProducts.loading ? (
                                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                        <CircularProgress />
                                    </Box>
                                ) : (
                                    topProducts.data ? <TopProductsChart data={topProducts.data} /> : <ChartPlaceholder title="Top SKU bán chạy" />
                                )}
                            </Box>
                        </Paper>
                    </Stack>
                </Box>

                {/* --- BOX CON BÊN PHẢI --- */}
                <Box
                    sx={{
                        width: { xs: '100%', md: 'calc(50% - 16px)' },
                        display: 'flex',
                    }}
                >
                    {/* THAY THẾ NỘI DUNG CŨ BẰNG KHỐI NÀY */}
                    <Paper
                        variant="glass"
                        elevation={0}
                        sx={{
                            p: 1,
                            width: '100%',
                            flexGrow: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            minHeight: { xs: 900, md: '100%' }
                        }}
                    >
                        <Box variant="loaderContainer" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, px: 2, pt: 2 }}>
                            <Typography variant="h6" noWrap>Phân bổ Khách hàng</Typography>
                            <ChartTimeFilter value={mapFilter} onChange={handleMapFilterChange} />
                        </Box>
                        <Box sx={{ flexGrow: 1, minHeight: { xs: 500, lg: 'auto' }, position: 'relative' }}>
                            {map.loading ? <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box> : (
                                map.data ? <GeoMapChart data={map.data}/> : <ChartPlaceholder title="Phân bổ Khách hàng" />
                            )}
                        </Box>
                    </Paper>
                </Box>
            </Box>
            
            
            <DateRangeFilterMenu
                open={Boolean(kpiAnchorEl)}
                anchorEl={kpiAnchorEl}
                onClose={handleCloseKpiFilter}
                initialDateRange={kpiFilter.range} 
                onApply={handleApplyKpiFilter}
            />
        </Box>
    );
}

export default DashboardPage;
