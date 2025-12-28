// FILE: frontend/src/pages/DashboardPage.jsx (PHIÊN BẢN HOÀN THIỆN)

import { useTheme } from '@mui/material/styles';
import React, { useState, useEffect, Suspense, lazy, useMemo, useCallback } from 'react';
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
import { useChartFilter } from '../hooks/useChartFilter';
import LoadingOverlay from '../components/common/LoadingOverlay';
import DashboardBox from '../components/ui/DashboardBox';

import { useCostBreakdown } from '../hooks/useCostBreakdown';
import HorizontalBarChart from '../components/charts/HorizontalBarChart';

const RevenueProfitChart = lazy(() => import('../components/charts/RevenueProfitChart'));
const DonutChart = lazy(() => import('../components/charts/DonutChart'));
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
        { key: 'net_revenue', name: 'Doanh thu ròng', color: theme.palette.primary.main},
        { key: 'profit', name: 'Lợi nhuận', color: '#28a545'},
        { key: 'total_cost', name: 'Tổng chi phí', color: '#cdb832ff'},
    ], [theme.palette.primary.main]);

    // 1. TẠO BỘ LỌC TỔNG (GLOBAL FILTER) - CHA
    const globalDateFilter = useDateFilter({
        defaultType: 'this_month',
        useUrl: true, 
        urlPrefix: 'dashboard_'
    });

    // Tạo state tổng để truyền xuống con
    const globalFilterState = useMemo(() => ({
        dateRange: globalDateFilter.filter.range,
        dateLabel: globalDateFilter.buttonProps.children
    }), [globalDateFilter.filter.range, globalDateFilter.buttonProps.children]);

    // 2. TẠO CÁC BỘ LỌC CON (LOCAL FILTERS) - KẾ THỪA TỪ CHA
    const kpiFilterControl = useChartFilter(globalFilterState);
    const lineChartFilterControl = useChartFilter(globalFilterState);
    const donutFilterControl = useChartFilter(globalFilterState);
    const topProductsFilterControl = useChartFilter(globalFilterState);
    const mapFilterControl = useChartFilter(globalFilterState);

    // 3. MAPPING DỮ LIỆU CHO HOOK FETCH DATA
    // Lưu ý: useChartFilter trả về trực tiếp dateRange, ta cần map về format { range: ... } để useDashboardData hiểu
    const filtersForHook = useMemo (() => ({
        kpi: { range: kpiFilterControl.dateRange, type: 'custom' },
        lineChart: { range: lineChartFilterControl.dateRange, type: 'custom' },
        donut: { range: donutFilterControl.dateRange, type: 'custom' },
        topProducts: { range: topProductsFilterControl.dateRange, type: 'custom' },
        map: { range: mapFilterControl.dateRange, type: 'custom' },
    }), [
        kpiFilterControl.dateRange,
        lineChartFilterControl.dateRange,
        donutFilterControl.dateRange,
        topProductsFilterControl.dateRange,
        mapFilterControl.dateRange,
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

    // Chuẩn bị dữ liệu cho Donut Chart
    const donutChartData = useCostBreakdown(donut.data);

    // Optimize: Dùng useCallback để hàm không bị tạo mới mỗi lần render, tránh re-render chart con
    const getTopProductColor = useCallback((index) => {
        return index < 3 ? theme.palette.warning.main : theme.palette.primary.main;
    }, [theme.palette.warning.main, theme.palette.primary.main]);

    return (
        <Box sx={{ px: 4, py: 3 }} >
            {/* --- HEADER: TIÊU ĐỀ & BỘ LỌC TỔNG --- */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {brandName ? `Báo cáo Kinh doanh: ${brandName}` : 'Đang tải...'}
                </Typography>
                
                <Box>
                    <Button 
                        variant="outlined" 
                        startIcon={<CalendarMonthIcon />} 
                        {...globalDateFilter.buttonProps}
                        sx={{ borderRadius: 2, height: 40, px: 3 }}
                    >
                         {globalDateFilter.buttonProps.children}
                    </Button>
                    <DateRangeFilterMenu {...globalDateFilter.menuProps} />
                </Box>
            </Box>
            
            <Paper variant="glass" elevation={0} sx={{ p: 3, mb: 4 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }} noWrap>Chỉ số Hiệu suất Tổng thể</Typography>
                    
                    <Box>
                        <Button 
                            variant="outlined" 
                            size="small"
                            startIcon={<CalendarMonthIcon />} 
                            onClick={kpiFilterControl.openDateMenu}
                        >
                            {kpiFilterControl.dateLabel}
                        </Button>
                        <DateRangeFilterMenu {...kpiFilterControl.dateMenuProps} />
                    </Box>
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
                        <Button 
                            variant="outlined" 
                            size="small" 
                            startIcon={<CalendarMonthIcon />} 
                            onClick={lineChartFilterControl.openDateMenu}
                        >
                            {lineChartFilterControl.dateLabel}
                        </Button>
                        <DateRangeFilterMenu {...lineChartFilterControl.dateMenuProps} />
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
                                        selectedDateRange={lineChartFilterControl.dateRange}
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
                                                            <Button 
                                                                variant="outlined" 
                                                                size="small" 
                                                                startIcon={<CalendarMonthIcon />} 
                                                                onClick={donutFilterControl.openDateMenu}
                                                            >
                                                                {donutFilterControl.dateLabel}
                                                            </Button>
                                                            <DateRangeFilterMenu {...donutFilterControl.dateMenuProps} />
                                                        </Box>
                                                    </Box>
                                                    <Box sx={{ flexGrow: 1, height: 400, position: 'relative' }}>
                                                        {donut.loading && !donut.data ? (
                                                            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                                                <CircularProgress />
                                                            </Box>
                                                        ) : (
                                                            donut.data ? (
                                                                <>
                                                                    {donut.loading && <LoadingOverlay borderRadius={4} />}
                                                                    <Suspense fallback={<ChartSkeleton />}>
                                                                        <DonutChart 
                                                                            data={donutChartData} 
                                                                            centerLabel="TỔNG"
                                                                            centerValue={donut.data?.total_cost}
                                                                            unit="đ"
                                                                            formatType="currency"
                                                                            height="100%"
                                                                        />
                                                                    </Suspense>
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
                                                            <Button 
                                                                variant="outlined" 
                                                                size="small" 
                                                                startIcon={<CalendarMonthIcon />} 
                                                                onClick={topProductsFilterControl.openDateMenu}
                                                            >
                                                                {topProductsFilterControl.dateLabel}
                                                            </Button>
                                                            <DateRangeFilterMenu {...topProductsFilterControl.dateMenuProps} />
                                                        </Box>
                                                    </Box>
                                                    <Box sx={{ flexGrow: 1, height: 600, position: 'relative' }}>
                                                        {topProducts.loading ? (
                                                            <ChartSkeleton />
                                                        ) : (
                                                            topProducts.data ? (
                                                                <HorizontalBarChart 
                                                                    data={topProducts.data} 
                                                                    dataKey="total_quantity"
                                                                    labelKey="name"
                                                                    subLabelKey="sku"
                                                                    unit=" sp"
                                                                    height="100%"
                                                                    color={getTopProductColor}
                                                                />
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
                                                        <Button 
                                                            variant="outlined" 
                                                            size="small" 
                                                            startIcon={<CalendarMonthIcon />} 
                                                            onClick={mapFilterControl.openDateMenu}
                                                        >
                                                            {mapFilterControl.dateLabel}
                                                        </Button>
                                                        <DateRangeFilterMenu {...mapFilterControl.dateMenuProps} />
                                                    </Box>
                                                </Box>                        <Box sx={{ flexGrow: 1, minHeight: { xs: 500, lg: 'auto' }, position: 'relative' }}>
                            {map.loading && !map.data ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box>
                            ) : (
                                map.data ? (
                                    <>
                                        {map.loading && <LoadingOverlay borderRadius={4} />}
                                        <Suspense fallback={<ChartSkeleton />}>
                                            <GeoMapChart 
                                                data={map.data} 
                                                valueKey="orders" 
                                                labelKey="city" 
                                                unitLabel="đơn"
                                            />
                                        </Suspense>
                                    </>
                                ) : (
                                    <ChartPlaceholder title="Phân bổ Khách hàng" />
                                )
                            )}
                        </Box>
                    </Paper>
                </Box>
            </Box>
        </Box>
    );
}

export default DashboardPage;
