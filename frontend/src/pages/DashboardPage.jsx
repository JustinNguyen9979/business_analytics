// FILE: frontend/src/pages/DashboardPage.jsx (PHIÊN BẢN HOÀN THIỆN)

import { useTheme } from '@mui/material/styles';
import React, { useState, useEffect, Suspense, lazy, useMemo } from 'react';
import { Typography, Box, Paper, Divider, CircularProgress, Button, Stack, Skeleton } from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import dayjs from 'dayjs';
import { useDashboardData } from '../hooks/useDashboardData';
import DateRangeFilterMenu from '../components/common/DateRangeFilterMenu';
import { StatItem } from '../components/dashboard/StatItem';
import { kpiGroups } from '../config/dashboardConfig';
import ChartPlaceholder from '../components/common/ChartPlaceholder';
import { useLayout } from '../context/LayoutContext';
import { useBrand } from '../context/BrandContext';
import { useDateFilter } from '../hooks/useDateFilter';
import LoadingOverlay from '../components/common/LoadingOverlay';

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
    const { slug: brandSlug, name: brandName } = useBrand();
    const { isSidebarOpen } = useLayout();

    const lineChartSeries = useMemo(() => [
        { key: 'netRevenue', name: 'Doanh thu ròng', color: theme.palette.primary.main},
        { key: 'profit', name: 'Lợi nhuận', color: '#28a545'},
        { key: 'totalCost', name: 'Tổng chi phí', color: '#cdb832ff'},
    ], [theme.palette.primary.main]);

    // Gọi hook cho từng bộ lọc
    const kpiFilterControl = useDateFilter({
        defaultType: 'this_month',
        useUrl: true,
        urlPrefix: 'kpi_'
    });

    const lineChartFilterControl = useDateFilter({ defaultType: 'this_month' });
    const donutFilterControl = useDateFilter({ defaultType: 'this_month' });
    const topProductsFilterControl = useDateFilter({ defaultType: 'this_month' });
    const mapFilterControl = useDateFilter({ defaultType: 'this_month' });

    const filtersForHook = useMemo (() => ({
        kpi: kpiFilterControl.filter,
        lineChart: lineChartFilterControl.filter,
        donut: donutFilterControl.filter,
        topProducts: topProductsFilterControl.filter,
        map: mapFilterControl.filter,
    }), [
        kpiFilterControl.filter,
        lineChartFilterControl.filter,
        donutFilterControl.filter,
        topProductsFilterControl.filter,
        mapFilterControl.filter,
    ]);

    const dashboardState = useDashboardData(brandSlug, filtersForHook)

    const { kpi, lineChart, donut, topProducts, map } = dashboardState;

    // --- STATE QUẢN LÝ UI ---
    const [chartRevision, setChartRevision] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => setChartRevision(prev => prev + 1), 300);
        return () => clearTimeout(timer);
    }, [isSidebarOpen]);

    const anyError = Object.values(dashboardState).find(s => s.error);


    return (
        <Box sx={{ px: 4 }} >
            <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
                {brandName ? `Báo cáo Kinh doanh: ${brandName}` : 'Đang tải...'}
            </Typography>
            
            <Paper variant="glass" elevation={0} sx={{ p: 3, mb: 4 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }} noWrap>Chỉ số Hiệu suất Tổng thể</Typography>
                    
                    <Button variant="outlined" startIcon={<CalendarMonthIcon />} {...kpiFilterControl.buttonProps} />
                </Box>
                
                <Divider sx={{ mb: 3 }} />
                
                <Box sx={{ minHeight: 360, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {kpi.loading && !kpi.data.current ? (
                        // 1. NẾU ĐANG LOADING: Hiển thị vòng quay
                        <Box variant="loaderContainer" sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : kpi.data.current ? (
                        <>
                            {kpi.loading && <LoadingOverlay borderRadius={2} />}
                        
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
                        </>
                    ) : (
                        <ChartPlaceholder title="Chỉ số Hiệu suất" />
                    )}
                </Box>
            </Paper>

            <Paper variant="glass" elevation={0} sx={{ p: 1, mb: 4 }}>
                <Box variant="loaderContainer" sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, px: 3, pt: 3 }}>
                    <Typography variant="h6" noWrap>Biểu đồ Doanh thu ròng & Lợi nhuận</Typography>
                    <Box>
                        <Button variant="outlined" size="small" {...lineChartFilterControl.buttonProps} />
                        <DateRangeFilterMenu {...lineChartFilterControl.menuProps} />
                    </Box>
                </Box>
                
                <Box sx={{ pb: 3, pt: 1, height: 750, position: 'relative' }}>
                    {lineChart.loading && !lineChart.data.current ? (
                        <ChartSkeleton />
                    ) : (
                        <Suspense fallback={<ChartSkeleton />}>
                            {lineChart.data.current && lineChart.data.current.length > 0 ? (
                                <>
                                    {lineChart.loading && <LoadingOverlay borderRadius={4} />}
                                    <RevenueProfitChart 
                                        data={lineChart.data.current} 
                                        comparisonData={lineChart.data.previous}
                                        series={lineChartSeries}
                                        isLoading={lineChart.loading}
                                        chartRevision={chartRevision}
                                        aggregationType={lineChart.data.aggregationType}
                                        selectedDateRange={lineChartFilterControl.filter.range}
                                    />
                                </>
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
                                <Box>
                                    <Button variant="outlined" size="small" {...donutFilterControl.buttonProps} />
                                    <DateRangeFilterMenu {...donutFilterControl.menuProps} />
                                </Box>
                            </Box>
                            <Box sx={{ flexGrow: 1, minHeight: 400, position: 'relative' }}>
                                {donut.loading && !donut.data ? (
                                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                        <CircularProgress />
                                    </Box>
                                ) : (
                                    donut.data ? (
                                        <>
                                            {donut.loading && <LoadingOverlay borderRadius={4} />}
                                             <CostDonutChart {...donut.data} />
                                        </>
                                    ) : <ChartPlaceholder title="Phân bổ Chi phí"/>
                                )}
                            </Box>
                        </Paper>

                        {/* KHỐI 2: TOP PRODUCTS CHART */}
                        <Paper variant="glass" elevation={0} sx={{ p: 1, display: 'flex', flexDirection: 'column' }}>
                            <Box variant="loaderContainer" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, px: 2, pt: 2 }}>
                                <Typography variant="h6" noWrap>Top SKU bán chạy</Typography>
                                <Box>
                                    <Button variant="outlined" size="small" {...topProductsFilterControl.buttonProps} />
                                    <DateRangeFilterMenu {...topProductsFilterControl.menuProps} />
                                </Box>
                            </Box>
                            <Box sx={{ flexGrow: 1, minHeight: 600, position: 'relative' }}>
                                {topProducts.loading && !topProducts.data ? (
                                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                        <CircularProgress />
                                    </Box>
                                ) : (
                                    topProducts.data ? (
                                        <>
                                            {topProducts.loading && <LoadingOverlay borderRadius={4} />}
                                            <TopProductsChart data={topProducts.data} />
                                        </>
                                    ) : <ChartPlaceholder title="Top SKU bán chạy" />
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
                            <Box>
                                <Button variant="outlined" size="small" {...mapFilterControl.buttonProps} />
                                <DateRangeFilterMenu {...mapFilterControl.menuProps} />
                            </Box>
                        </Box>
                        <Box sx={{ flexGrow: 1, minHeight: { xs: 500, lg: 'auto' }, position: 'relative' }}>
                            {map.loading && !map.data ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box>
                            ) : (
                                map.data ? (
                                    <>
                                        {map.loading && <LoadingOverlay borderRadius={4} />}
                                        <GeoMapChart 
                                            data={map.data} 
                                            valueKey="orders" 
                                            labelKey="city" 
                                            unitLabel="đơn"
                                        />
                                    </>
                                ) : (
                                    <ChartPlaceholder title="Phân bổ Khách hàng" />
                                )
                            )}
                        </Box>
                    </Paper>
                </Box>
            </Box>
            
            
            <DateRangeFilterMenu {...kpiFilterControl.menuProps} />
        </Box>
    );
}

export default DashboardPage;
