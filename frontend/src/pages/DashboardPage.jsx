// FILE: frontend/src/pages/DashboardPage.jsx (PHIÊN BẢN HOÀN THIỆN)

import { useTheme } from '@mui/material/styles';
import React, { useState, useEffect, Suspense, lazy, useMemo, useCallback } from 'react';
import { Typography, Box, Button, Stack, Skeleton } from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { useDashboardData } from '../hooks/useDashboardData';
import DateRangeFilterMenu from '../components/common/DateRangeFilterMenu';
import { StatItem } from '../components/dashboard/StatItem';
import { kpiGroups } from '../config/dashboardConfig';
import { useLayout } from '../context/LayoutContext';
import { useBrand } from '../context/BrandContext';
import { useDateFilter } from '../hooks/useDateFilter';
import { useChartFilter } from '../hooks/useChartFilter';
import DashboardBox from '../components/ui/DashboardBox';

import { useCostBreakdown } from '../hooks/useCostBreakdown';
import LazyLoader from '../components/common/LazyLoader';
import { ShimmerText, EyebrowLabel, T, AccentBar, fadeUp } from '../theme/designSystem';

const RevenueProfitChart = lazy(() => import('../components/charts/RevenueProfitChart'));
const DonutChart = lazy(() => import('../components/charts/DonutChart'));
const GeoMapChart = lazy(() => import('../components/charts/GeoMapChart'));
const HorizontalBarChart = lazy(() => import('../components/charts/HorizontalBarChart'));

function DashboardPage() {
    const theme = useTheme();
    const { slug: brandSlug, name: brandName } = useBrand();
    const { isSidebarOpen } = useLayout();

    const lineChartSeries = useMemo(() => [
        { key: 'net_revenue', name: 'Doanh thu ròng', color: T.primary },
        { key: 'profit', name: 'Lợi nhuận', color: T.success },
        { key: 'total_cost', name: 'Tổng chi phí', color: T.gold },
    ], []);

    // 1. TẠO BỘ LỌC TỔNG (GLOBAL FILTER) - CHA
    const globalDateFilter = useDateFilter({
        defaultType: 'this_month',
        useUrl: true, 
        urlPrefix: 'dashboard_'
    });

    // Tạo state tổng để truyền xuống con
    const globalFilterState = useMemo(() => ({
        dateRange: globalDateFilter.filter.range,
        dateLabel: globalDateFilter.buttonProps.children,
        dateType: globalDateFilter.filter.type
    }), [globalDateFilter.filter.range, globalDateFilter.buttonProps.children, globalDateFilter.filter.type]);

    // 2. TẠO CÁC BỘ LỌC CON (LOCAL FILTERS) - KẾ THỪA TỪ CHA
    const kpiFilterControl = useChartFilter(globalFilterState);
    const lineChartFilterControl = useChartFilter(globalFilterState);
    const donutFilterControl = useChartFilter(globalFilterState);
    const topProductsFilterControl = useChartFilter(globalFilterState);
    const mapFilterControl = useChartFilter(globalFilterState);

    // 3. MAPPING DỮ LIỆU CHO HOOK FETCH DATA
    const filtersForHook = useMemo (() => ({
        kpi: { range: kpiFilterControl.dateRange, type: kpiFilterControl.dateType },
        lineChart: { range: lineChartFilterControl.dateRange, type: lineChartFilterControl.dateType },
        donut: { range: donutFilterControl.dateRange, type: donutFilterControl.dateType },
        topProducts: { range: topProductsFilterControl.dateRange, type: topProductsFilterControl.dateType },
        map: { range: mapFilterControl.dateRange, type: mapFilterControl.dateType },
    }), [
        kpiFilterControl.dateRange, kpiFilterControl.dateType,
        lineChartFilterControl.dateRange, lineChartFilterControl.dateType,
        donutFilterControl.dateRange, donutFilterControl.dateType,
        topProductsFilterControl.dateRange, topProductsFilterControl.dateType,
        mapFilterControl.dateRange, mapFilterControl.dateType,
    ]);

    const dashboardState = useDashboardData(brandSlug, filtersForHook)

    const { kpi, lineChart, donut, topProducts, map } = dashboardState;

    // --- STATE QUẢN LÝ UI ---
    const [chartRevision, setChartRevision] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => setChartRevision(prev => prev + 1), 300);
        return () => clearTimeout(timer);
    }, [isSidebarOpen]);

    // Chuẩn bị dữ liệu cho Donut Chart
    const donutChartData = useCostBreakdown(donut.data);

    // Optimize: Dùng useCallback để hàm không bị tạo mới mỗi lần render, tránh re-render chart con
    const getTopProductColor = useCallback((index) => {
        return index < 3 ? T.warning : T.primary;
    }, []);

    // Bảng màu cho Map Status (Đồng bộ với OperationPage)
    const statusColors = useMemo(() => ({
        all: T.error,
        completed: T.success,
        cancelled: '#C62828',
        bomb: T.warning,
        refunded: '#9c27b0'
    }), []);

    return (
        <Box 
            sx={{ 
                px: 4, 
                py: 3, 
                position: 'relative', 
                zIndex: 1, 
                animation: `${fadeUp} 0.6s ease-out forwards` 
            }}
        >
            {/* --- HEADER: TIÊU ĐỀ & BỘ LỌC TỔNG --- */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
                    <Box>
                        <Typography variant="h3" sx={{ fontWeight: 800, fontFamily: T.fontDisplay, mt: 1 }}>
                            <ShimmerText>
                                {brandName ? `Báo cáo: ${brandName}` : 'Đang tải...'}
                            </ShimmerText>
                        </Typography>
                    </Box>
                    
                    <Box sx={{ mt: 5 }}>
                        <Button 
                            variant="outlined" 
                            startIcon={<CalendarMonthIcon />} 
                            {...globalDateFilter.buttonProps}
                            sx={{ 
                                borderRadius: T.radiusMd, 
                                height: 44, 
                                px: 3,
                                backgroundColor: 'rgba(255,255,255,0.03)',
                                borderColor: T.border,
                                color: T.textPrimary,
                                '&:hover': {
                                    borderColor: T.primary,
                                    backgroundColor: 'rgba(45, 212, 191, 0.05)',
                                }
                            }}
                        >
                             {globalDateFilter.buttonProps.children}
                        </Button>
                        <DateRangeFilterMenu {...globalDateFilter.menuProps} />
                    </Box>
                </Box>
                
                <Box sx={{ 
                    display: 'grid', 
                    gap: 3, 
                    gridTemplateColumns: {
                        xs: '1fr',
                        sm: 'repeat(2, 1fr)',
                    },
                    mb: 4
                }}>
                    {kpiGroups.map((group, groupIndex) => (
                        <LazyLoader key={group.groupTitle} height={200} offset="0px">
                            <DashboardBox
                                title={group.groupTitle}
                                filterControl={kpiFilterControl}
                                loading={kpi.loading}
                                hasData={!!kpi.data.current}
                                height="auto"
                                sx={{ height: '100%' }}
                                className={`anim-stagger-in delay-${groupIndex + 1}`}
                            >
                                {kpi.data.current && (
                                    <Box sx={{ 
                                        display: 'grid', 
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
                                        gap: 3, 
                                        textAlign: 'left' 
                                    }}>
                                        {group.items.map((kpiItem) => (
                                            <StatItem 
                                                key={kpiItem.key} 
                                                value={kpi.data.current[kpiItem.key]} 
                                                previousValue={kpi.data.previous?.[kpiItem.key]}
                                                {...(() => {
                                                    const { key, ...rest } = kpiItem;
                                                    return rest;
                                                })()}
                                            />
                                        ))} 
                                    </Box>
                                )}
                            </DashboardBox>
                        </LazyLoader>
                    ))}
                </Box>

                <LazyLoader height={750}>
                    <DashboardBox
                        title="Biểu đồ Doanh thu ròng & Lợi nhuận"
                        filterControl={lineChartFilterControl}
                        loading={lineChart.loading}
                        hasData={!!(lineChart.data.current && lineChart.data.current.length > 0)}
                        height={750}
                        sx={{ mb: 5 }}
                        contentSx={{ pt: 1, pb: 3 }}
                        className="anim-stagger-in delay-2"
                    >
                        <Suspense fallback={<Skeleton variant="rectangular" width="100%" height="100%" />}>
                            <RevenueProfitChart 
                                data={lineChart.data.current} 
                                comparisonData={lineChart.data.previous}
                                series={lineChartSeries}
                                isLoading={lineChart.loading}
                                chartRevision={chartRevision}
                                aggregationType={lineChart.data.aggregationType}
                                selectedDateRange={lineChartFilterControl.dateRange}
                            />
                        </Suspense>
                    </DashboardBox>
                </LazyLoader>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 5, mb: 5 }}>
                    <Box sx={{ width: { xs: '100%', md: 'calc(50% - 25px)' } }}>
                        <Stack spacing={5}>
                            <LazyLoader height={400}>
                                <DashboardBox
                                    title="Phân bổ Chi phí"
                                    filterControl={donutFilterControl}
                                    loading={donut.loading}
                                    hasData={!!donut.data}
                                    height={400}
                                    className="anim-stagger-in delay-3"
                                >
                                    <Suspense fallback={<Skeleton variant="circular" width={300} height={300} sx={{ m: 'auto' }} />}>
                                        <DonutChart 
                                            data={donutChartData} 
                                            centerLabel="TỔNG"
                                            centerValue={donut.data?.total_cost}
                                            unit="đ"
                                            formatType="currency"
                                            height="100%"
                                        />
                                    </Suspense>
                                </DashboardBox>
                            </LazyLoader>

                            <LazyLoader height={600}>
                                <DashboardBox
                                    title="Top SKU bán chạy"
                                    filterControl={topProductsFilterControl}
                                    loading={topProducts.loading}
                                    hasData={!!topProducts.data}
                                    height={600}
                                    className="anim-stagger-in delay-4"
                                >
                                    <Suspense fallback={<Skeleton variant="rectangular" width="100%" height="100%" />}>
                                        <HorizontalBarChart 
                                            data={topProducts.data} 
                                            dataKey="total_quantity"
                                            labelKey="name"
                                            subLabelKey="sku"
                                            unit=" sp"
                                            height="100%"
                                            color={getTopProductColor}
                                        />
                                    </Suspense>
                                </DashboardBox>
                            </LazyLoader>
                        </Stack>
                    </Box>

                    <Box sx={{ width: { xs: '100%', md: 'calc(50% - 25px)' }, display: 'flex', flexDirection: 'column' }}>
                        <LazyLoader height={600} sx={{ flex: 1, height: '100%', mb: 0 }}>
                            <DashboardBox
                                title="Phân bổ Khách hàng"
                                filterControl={mapFilterControl}
                                loading={map.loading}
                                hasData={map.data && map.data.length > 0}
                                height="100%"
                                sx={{ minHeight: { xs: 500, md: 'auto' }, height: '100%' }}
                                className="anim-stagger-in delay-5"
                            >
                                <Suspense fallback={<Skeleton variant="rectangular" width="100%" height="100%" />}>
                                    <GeoMapChart 
                                        data={map.data} 
                                        valueKey="orders" 
                                        labelKey="province" 
                                        unitLabel="đơn"
                                        statusColors={statusColors}
                                        statusFilter={['all']}
                                    />
                                </Suspense>
                            </DashboardBox>
                        </LazyLoader>
                    </Box>
                </Box>
            </Box>
    );
}

export default DashboardPage;
