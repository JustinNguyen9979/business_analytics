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
import HorizontalBarChart from '../components/charts/HorizontalBarChart';

const RevenueProfitChart = lazy(() => import('../components/charts/RevenueProfitChart'));
const DonutChart = lazy(() => import('../components/charts/DonutChart'));
const GeoMapChart = lazy(() => import('../components/charts/GeoMapChart'));

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
            
            <DashboardBox
                title="Chỉ số Hiệu suất Tổng thể"
                filterControl={kpiFilterControl}
                loading={kpi.loading}
                hasData={!!kpi.data.current}
                height="auto"
                sx={{ mb: 4, p: 3 }}
            >
                {kpi.data.current && (
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
                            </Box>
                        ))}
                    </Box>
                )}
            </DashboardBox>

            <DashboardBox
                title="Biểu đồ Doanh thu ròng & Lợi nhuận"
                filterControl={lineChartFilterControl}
                loading={lineChart.loading}
                hasData={!!(lineChart.data.current && lineChart.data.current.length > 0)}
                height={750}
                sx={{ mb: 4 }}
                contentSx={{ pt: 1, pb: 3 }}
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

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4, mb: 4 }}>
                <Box sx={{ width: { xs: '100%', md: 'calc(50% - 16px)' } }}>
                    <Stack spacing={4}>
                        <DashboardBox
                            title="Phân bổ Chi phí"
                            filterControl={donutFilterControl}
                            loading={donut.loading}
                            hasData={!!donut.data}
                            height={400}
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

                        <DashboardBox
                            title="Top SKU bán chạy"
                            filterControl={topProductsFilterControl}
                            loading={topProducts.loading}
                            hasData={!!topProducts.data}
                            height={600}
                        >
                            <HorizontalBarChart 
                                data={topProducts.data} 
                                dataKey="total_quantity"
                                labelKey="name"
                                subLabelKey="sku"
                                unit=" sp"
                                height="100%"
                                color={getTopProductColor}
                            />
                        </DashboardBox>
                    </Stack>
                </Box>

                <Box sx={{ width: { xs: '100%', md: 'calc(50% - 16px)' }, display: 'flex' }}>
                    <DashboardBox
                        title="Phân bổ Khách hàng"
                        filterControl={mapFilterControl}
                        loading={map.loading}
                        hasData={!!map.data}
                        height="100%"
                        sx={{ flexGrow: 1, minHeight: { xs: 500, md: 'auto' } }}
                    >
                        <Suspense fallback={<Skeleton variant="rectangular" width="100%" height="100%" />}>
                            <GeoMapChart 
                                data={map.data} 
                                valueKey="orders" 
                                labelKey="city" 
                                unitLabel="đơn"
                            />
                        </Suspense>
                    </DashboardBox>
                </Box>
            </Box>
        </Box>
    );
}

export default DashboardPage;
