import React, { useMemo, useState, lazy, Suspense, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Paper, Button, Skeleton } from '@mui/material';
import {
    CalendarToday as CalendarTodayIcon,
    MonetizationOn as MonetizationOnIcon,
    TrendingUp as TrendingUpIcon,
    AccountBalanceWallet as AccountBalanceWalletIcon,
    StackedLineChart as StackedLineChartIcon,
    AttachMoney as AttachMoneyIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { useDashboardData } from '../hooks/useDashboardData';
import { useDateFilter } from '../hooks/useDateFilter';
import { useTheme } from '@mui/material/styles';
import DateRangeFilterMenu from '../components/common/DateRangeFilterMenu';
import FinanceTable from '../components/finance/FinanceTable';
import KpiCard from '../components/dashboard/KpiCard';
import { useFinanceData } from '../hooks/useFinanceData';
import { dateShortcuts } from '../config/dashboardConfig';
import { formatCurrency, formatPercentage } from '../utils/formatters';
import { useBrand } from '../context/BrandContext';
import SourceDistributionChart from '../components/charts/SourceDistributionChart';
import FinanceComparisonChart from '../components/charts/FinanceComparisonChart';

// Lấy giá trị mặc định là "Tháng này"
const defaultDateRange = dateShortcuts.find(s => s.type === 'this_month').getValue();
const defaultDateLabel = dateShortcuts.find(s => s.type === 'this_month').label;
const RevenueProfitChart = lazy(() => import('../components/charts/RevenueProfitChart'));

const ChartSkeleton = () => (
    <Skeleton
        variant="rectangular"
        width="100%"
        height="100%"
        sx={{ borderRadius: 2, bgcolor: 'rgba(255, 255, 255, 0.05)' }}
    />
);
// Component cho KpiCard khi đang tải
const KpiCardSkeleton = () => (
    <Paper variant="glass" sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
            <Skeleton variant="text" width={100} sx={{ mb: 1 }} />
            <Skeleton variant="text" width={150} height={40} />
        </Box>
        <Skeleton variant="circular" width={56} height={56} />
    </Paper>
);

function FinancePage() {
    const theme = useTheme();
    const { id: brandId } = useBrand();
    const lineChartFilterControl = useDateFilter({ defaultType: 'this_month' });

    const dashboardFilters = useMemo(() => ({
        lineChart: lineChartFilterControl.filter,
        kpi: null, donut: null, topProducts: null, map: null,
    }), [lineChartFilterControl.filter]);

    const { lineChart } = useDashboardData(brandId, dashboardFilters);

    const comparisonChartSeries = useMemo(() => [
        { key: 'netRevenue', name: 'Doanh thu', color: theme.palette.primary.light },
        { key: 'cogs', name: 'Giá vốn', color: theme.palette.warning.light },
        { key: 'profit', name: 'Lợi nhuận', color: theme.palette.success.light },
    ], [theme.palette]);

    const allAvailableSeries = useMemo(() => [
        { key: 'netRevenue', name: 'Doanh thu ròng', color: theme.palette.primary.main },
        { key: 'profit', name: 'Lợi nhuận', color: '#28a545' },
        { key: 'gmv', name: 'GMV', color: theme.palette.warning.main },
        { key: 'totalCost', name: 'Tổng Chi phí', color: theme.palette.error.main },
        { key: 'cogs', name: 'Giá vốn', color: theme.palette.secondary.main },
        { key: 'adSpend', name: 'Chi phí Ads', color: theme.palette.info.main },
        { key: 'executionCost', name: 'Chi phí thực thi', color: theme.palette.text.secondary },
    ], [theme]);

    const [visibleSeriesKeys, setVisibleSeriesKeys] = useState(['netRevenue', 'profit']);

    const handleToggleSeries = useCallback((key) => {
        setVisibleSeriesKeys(prevKeys => {
            if (prevKeys.includes(key)) {
                return prevKeys.filter(k => k !== key);
            } else {
                return [...prevKeys, key];
            }
        });
    }, []);

    const filteredLineChartSeries = useMemo(() => {
        return allAvailableSeries.filter(s => visibleSeriesKeys.includes(s.key));
    }, [allAvailableSeries, visibleSeriesKeys]);

    const [dateRange, setDateRange] = useState(defaultDateRange);
    const [dateLabel, setDateLabel] = useState(defaultDateLabel);
    const [anchorEl, setAnchorEl] = useState(null);
    
    const { currentData, previousData, loading, error } = useFinanceData(brandId, dateRange);

    const handleOpenFilter = (event) => setAnchorEl(event.currentTarget);
    const handleCloseFilter = () => setAnchorEl(null);

    const handleApplyDateRange = (newRange, newLabelType) => {
        const newLabel = dateShortcuts.find(s => s.type === newLabelType)?.label || 
                         `${newRange[0].format('DD/MM')} - ${newRange[1].format('DD/MM/YYYY')}`;
        setDateRange(newRange);
        setDateLabel(newLabel);
        handleCloseFilter();
    };

    // Tách dữ liệu tổng và chi tiết
    const summaryData = currentData?.find(item => item.platform === 'Tổng cộng') || {};
    const prevSummaryData = previousData?.find(item => item.platform === 'Tổng cộng') || {};
    
    // Sắp xếp dữ liệu theo GMV giảm dần. Đây sẽ là thứ tự chuẩn cho tất cả các chart.
    const platformData = currentData
        ?.filter(item => item.platform !== 'Tổng cộng')
        .sort((a, b) => (b.gmv || 0) - (a.gmv || 0)) || [];

    const cardConfigs = [
        { key: 'profit', title: 'Tổng Lợi nhuận', icon: <MonetizationOnIcon />, color: 'success.main' },
        { key: 'gmv', title: 'Tổng GMV', icon: <AccountBalanceWalletIcon />, color: 'primary.main' },
        { key: 'netRevenue', title: 'Tổng Doanh thu thuần', icon: <TrendingUpIcon />, color: 'info.main' },
        { key: 'totalCost', title: 'Tổng Chi phí', icon: <AttachMoneyIcon />, color: 'error.main', direction: 'down' }, // Chi phí giảm là tốt
        { key: 'roi', title: 'ROI Tổng', icon: <StackedLineChartIcon />, color: 'secondary.main', format: 'percent' },
    ];

    // 2. Tạo danh sách kpiCards bằng cách map qua cấu hình và gán dữ liệu động
    const kpiCards = cardConfigs.map(config => ({
        ...config, // Kế thừa toàn bộ thuộc tính static (title, icon, color...)
        value: summaryData[config.key],
        previousValue: prevSummaryData[config.key],
        format: config.format || 'currency', // Mặc định là 'currency' nếu không khai báo
        direction: config.direction || 'up',   // Mặc định là 'up' nếu không khai báo
    }));

    return (
        <Box sx={{ px: 4, py: 3 }}>
            {/* Header: Tiêu đề và Bộ lọc */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    Báo cáo Tài chính
                </Typography>
                <Button
                    variant="outlined"
                    startIcon={<CalendarTodayIcon />}
                    onClick={handleOpenFilter}
                    sx={{ 
                        color: (theme) => theme.palette.primary.main, 
                        borderColor: (theme) => theme.palette.primary.main, 
                        borderRadius: 2 
                    }}
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

            {/* Hàng KPI Cards */}
            <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
                {loading 
                    ? Array.from(new Array(5)).map((_, index) => (
                        <Box key={index} sx={{ flex: 1, minWidth: '200px' }}>
                            <KpiCardSkeleton />
                        </Box>
                      ))
                    : kpiCards.map(card => (
                        <Box key={card.title} sx={{ flex: 1, minWidth: '200px' }}>
                            <KpiCard 
                                title={card.title} 
                                value={card.value} 
                                icon={card.icon} 
                                color={card.color}
                                previousValue={card.previousValue}
                                format={card.format}
                                direction={card.direction}
                            />
                        </Box>
                ))}
            </Box>

            {/* --- BIỂU ĐỒ ĐƯỜNG --- */}
            <Paper variant="glass" elevation={0} sx={{ p: 1, mb: 4 }}>
                <Typography sx={{ fontWeight: 600, mb: 2 }} variant="h6" noWrap>So sánh Tài chính giữa các Nền tảng</Typography>
                <Box sx={{ height: 600, mb: 4 }}>
                    {loading ? (
                        <Skeleton variant="rectangular" width="100%" height="100%" sx={{ borderRadius: 4 }} />
                    ) : (
                        <FinanceComparisonChart
                            data={platformData}
                            series={comparisonChartSeries}
                        />
                    )}
                </Box>
            </Paper>

            <Paper variant="glass" elevation={0} sx={{ p: 1, mb: 4 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" noWrap>Xu hướng theo thời gian (Toàn bộ thương hiệu)</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 3, pt: 3}}>
                        {/* Các nút bật/tắt series */}
                        {allAvailableSeries.map(s => (
                                <Button
                                    key={s.key}
                                    variant={visibleSeriesKeys.includes(s.key) ? 'contained' : 'outlined'}
                                    onClick={() => handleToggleSeries(s.key)}
                                    size="small"
                                    sx={{
                                        borderColor: s.color,
                                        color: visibleSeriesKeys.includes(s.key) ? theme.palette.common.white : s.color,
                                        bgcolor: visibleSeriesKeys.includes(s.key) ? s.color : 'transparent',
                                        '&:hover': {
                                            bgcolor: visibleSeriesKeys.includes(s.key) ? s.color : 'transparent',
                                            borderColor: s.color,
                                            opacity: 0.8,
                                        }
                                    }}
                                >
                                {s.name}
                            </Button>
                        ))}        
                    </Box>   
                </Box>

                <Box sx={{ pb: 3, pt: 1, height: 750, position: 'relative' }}>
                    {lineChart.loading ? <ChartSkeleton /> : (
                        <Suspense fallback={<ChartSkeleton />}>
                            {lineChart.data.current && lineChart.data.current.length > 0 ? (
                                <RevenueProfitChart
                                    data={lineChart.data.current}
                                    comparisonData={lineChart.data.previous}
                                    series={filteredLineChartSeries}
                                    isLoading={lineChart.loading}
                                    chartRevision={0}
                                    aggregationType={lineChart.data.aggregationType}
                                />
                            ): <ChartPlaceholder title="Biểu đồ xu hướng" />}
                        </Suspense>
                    )}
                </Box>
            </Paper>

            {/* --- PHẦN 2: CHART PHÂN BỔ --- */}
            <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
                {(() => {
                    const isExpanded = platformData.length > 5;
                    const chartBoxSx = isExpanded
                        ? { width: 'calc(33.333% - 16px)' } // ~3 cột mỗi hàng
                        : { flex: '1 1 300px' };             // Co giãn linh hoạt

                    if (loading) {
                        return Array.from(new Array(5)).map((_, index) => (
                            <Box key={index} sx={chartBoxSx}>
                                 <Skeleton variant="rectangular" width="100%" height="250px" sx={{ borderRadius: 4, bgcolor: 'rgba(255,255,255,0.05)' }} />
                            </Box>
                        ));
                    }

                    return cardConfigs.map(config => (
                        <Box key={config.key} sx={chartBoxSx}>
                            <SourceDistributionChart
                                data={platformData}
                                dataKey={config.key}
                                title={config.title}
                                format={config.format || 'currency'}
                            />
                        </Box>
                    ));
                })()}
            </Box>

            {/* Bảng chi tiết */}
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Chi tiết theo nền tảng
            </Typography>
            <FinanceTable data={platformData} loading={loading} error={error} />
        </Box>
    );
}

export default FinancePage;