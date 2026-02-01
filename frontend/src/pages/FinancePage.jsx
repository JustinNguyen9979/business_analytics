import React, { lazy, Suspense } from 'react';
import { Box, Typography, Paper, Button, Skeleton, IconButton, Tooltip, CircularProgress } from '@mui/material';
import {
    CalendarMonth as CalendarMonthIcon,
    Settings as SettingsIcon
} from '@mui/icons-material';
import DateRangeFilterMenu from '../components/common/DateRangeFilterMenu';
import KpiCard from '../components/dashboard/KpiCard';
import ChartSettingsPanel from '../components/charts/controls/ChartSettingsPanel';
import ChartSettingSection from '../components/charts/controls/ChartSettingSection';
import ChartSettingItem from '../components/charts/controls/ChartSettingItem';
import SourceSelectionSection from '../components/charts/controls/SourceSelectionSection';
import { useFinancePageLogic } from '../hooks/useFinancePageLogic'; 
import { useTheme } from '@mui/material/styles'; 
import LoadingOverlay from '../components/common/LoadingOverlay';
import SectionTitle from '../components/ui/SectionTitle';
import DashboardBox from '../components/ui/DashboardBox';
import LazyLoader from '../components/common/LazyLoader';

const RevenueProfitChart = lazy(() => import('../components/charts/RevenueProfitChart'));
const SourceDistributionChart = lazy(() => import('../components/charts/SourceDistributionChart'));
const FinanceComparisonChart = lazy(() => import('../components/charts/FinanceComparisonChart'));
const FinanceTable = lazy(() => import('../components/finance/FinanceTable'));

const ChartSkeleton = () => (
    <Skeleton
        variant="rectangular"
        width="100%"
        height="100%"
        sx={{ borderRadius: 2, bgcolor: 'rgba(255, 255, 255, 0.05)' }}
    />
);

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
    const {
        // State
        sourceOptions, selectedSources, barSelectedSources,
        isLineConfigOpen, setIsLineConfigOpen,
        isBarConfigOpen, setIsBarConfigOpen,
        dateRange, dateLabel, anchorEl, 
        lineVisibleKeys, barVisibleKeys,
        
        // Handlers
        handleToggleSource, handleToggleBarSource, 
        handleOpenFilter, handleCloseFilter, 
        handleApplyDateRange, 
        handleToggleLineSeries, handleToggleBarSeries,

        // Data
        lineChart, platformData, barChartData, kpiCards,
        loading, error,

        // Configs
        allAvailableSeries, filteredLineChartSeries, filteredBarChartSeries, cardConfigs
    } = useFinancePageLogic();

    return (
        <Box sx={{ px: 4, py: 3 }}>
            {/* Header: Tiêu đề và Bộ lọc */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    Báo cáo Tài chính
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        startIcon={<CalendarMonthIcon />}
                        onClick={handleOpenFilter}
                        sx={{ 
                            color: theme.palette.primary.main, 
                            borderColor: theme.palette.primary.main, 
                            borderRadius: 2
                         }}
                    >
                        {dateLabel}
                    </Button>
                </Box>
                    
                <DateRangeFilterMenu
                    open={Boolean(anchorEl)}
                    anchorEl={anchorEl}
                    onClose={handleCloseFilter}
                    initialDateRange={dateRange}
                    onApply={handleApplyDateRange}
                />
            </Box>

            {/* Hàng KPI Cards */}
            <LazyLoader height={150} offset="0px">
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
            </LazyLoader>

            {/* --- PHẦN 2: CHART PHÂN BỔ (Đã di chuyển lên trên) --- */}
            <LazyLoader height={350}>
                <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
                    {(() => {
                        const minWidth = '18%'; // Đổi thành 18% để 5 box có thể nằm trên 1 hàng (5 * 18% = 90% + gap)

                        if (loading) {
                            return Array.from(new Array(5)).map((_, index) => (
                                <DashboardBox key={index} minWidth={minWidth} height={350} sx={{ flex: `1 1 ${minWidth}` }}>
                                    <Skeleton variant="rectangular" width="100%" height="100%" sx={{ borderRadius: 2 }} />
                                </DashboardBox>
                            ));
                        }

                        return cardConfigs.map(config => (
                            <DashboardBox 
                                key={config.key} 
                                title={config.title}
                                minWidth={minWidth}
                                height={350}
                                sx={{ flex: `1 1 ${minWidth}` }}
                            >
                                <Suspense fallback={<Skeleton variant="rectangular" width="100%" height="100%" />}>
                                    <SourceDistributionChart
                                        data={platformData}
                                        dataKey={config.key}
                                        format={config.format || 'currency'}
                                    />
                                </Suspense>
                            </DashboardBox>
                        ));
                    })()}
                </Box>
            </LazyLoader>

            {/* --- 1. BIỂU ĐỒ BAR CHART (SO SÁNH NỀN TẢNG) --- */}
            <LazyLoader height={600}>
                <Paper variant="glass" elevation={0} sx={{ p: 1, mb: 4, position: 'relative', overflow: 'hidden' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 2, pt: 2 }}>
                        <Typography sx={{ fontWeight: 600 }} variant="h6" noWrap>So sánh Tài chính giữa các Nền tảng</Typography>
                        
                        {/* Nút Cấu hình riêng cho Bar Chart */}
                        <Tooltip title="Cấu hình hiển thị">
                            <IconButton 
                                onClick={() => setIsBarConfigOpen(true)}
                                sx={{ 
                                    border: `1px solid ${theme.palette.divider}`,
                                    borderRadius: 2,
                                    color: isBarConfigOpen ? theme.palette.primary.main : theme.palette.text.secondary,
                                    bgcolor: isBarConfigOpen ? theme.palette.primary.main + '20' : 'transparent',
                                    '&:hover': {
                                        color: theme.palette.primary.main,
                                        borderColor: theme.palette.primary.main,
                                    }
                                }}
                            >
                                <SettingsIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>

                    <Box sx={{ height: 600, mb: 4 }}>
                        {loading && barChartData.length === 0 ? (
                            <Skeleton variant="rectangular" width="100%" height="100%" sx={{ borderRadius: 4 }} />
                        ) : (
                            <Suspense fallback={<ChartSkeleton />}>
                                {loading && barChartData.length > 0 && <LoadingOverlay borderRadius={4} />}
                                <FinanceComparisonChart
                                    data={barChartData}
                                    series={filteredBarChartSeries}
                                />
                            </Suspense>
                        )}
                    </Box>

                    {/* Panel Cấu hình riêng cho Bar Chart */}
                    <ChartSettingsPanel
                        open={isBarConfigOpen}
                        onClose={() => setIsBarConfigOpen(false)}
                        title="Cấu hình Biểu đồ Cột"
                    >
                        <ChartSettingSection title="Chỉ số hiển thị">
                            {allAvailableSeries.map(series => (
                                <ChartSettingItem
                                    key={series.key}
                                    label={series.name}
                                    color={series.color}
                                    checked={barVisibleKeys.includes(series.key)}
                                    onChange={() => handleToggleBarSeries(series.key)}
                                    isSwitch={true}
                                />
                            ))}
                        </ChartSettingSection>

                        <SourceSelectionSection
                            selectedSources={barSelectedSources}
                            sourceOptions={sourceOptions}
                            onToggle={handleToggleBarSource}
                        />
                    </ChartSettingsPanel>
                </Paper>
            </LazyLoader>

            {/* --- 2. BIỂU ĐỒ LINE CHART (XU HƯỚNG) --- */}
            <LazyLoader height={750}>
                <Paper variant="glass" elevation={0} sx={{ p: 1, mb: 4, position: 'relative', overflow: 'hidden' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 2, pt: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>Biểu đồ xu hướng</Typography>
                        
                        {/* Nút Cấu hình riêng cho Line Chart */}
                        <Tooltip title="Cấu hình hiển thị">
                            <IconButton 
                                onClick={() => setIsLineConfigOpen(true)}
                                sx={{ 
                                    border: `1px solid ${theme.palette.divider}`,
                                    borderRadius: 2,
                                    color: isLineConfigOpen ? theme.palette.primary.main : theme.palette.text.secondary,
                                    bgcolor: isLineConfigOpen ? theme.palette.primary.main + '20' : 'transparent',
                                    '&:hover': {
                                        color: theme.palette.primary.main,
                                        borderColor: theme.palette.primary.main,
                                    }
                                }}
                                >
                                    <SettingsIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>

                    <Box sx={{ pb: 3, pt: 1, height: 750, position: 'relative' }}>
                        {lineChart.loading && !lineChart.data.current ? (
                            <ChartSkeleton />
                        ) : (
                            <Suspense fallback={<ChartSkeleton />}>
                                {lineChart.loading && lineChart.data.current && <LoadingOverlay borderRadius={4} />}
                                <RevenueProfitChart
                                    data={lineChart.data.current}
                                    comparisonData={lineChart.data.previous}
                                    series={filteredLineChartSeries}
                                    isLoading={lineChart.loading}
                                    chartRevision={0}
                                    aggregationType={lineChart.data.aggregationType}
                                    selectedDateRange={dateRange}
                                />
                            </Suspense>
                        )}
                    </Box>

                    {/* Panel Cấu hình riêng cho Line Chart */}
                    <ChartSettingsPanel
                        open={isLineConfigOpen}
                        onClose={() => setIsLineConfigOpen(false)}
                        title="Cấu hình Biểu đồ Đường"
                    >
                        <ChartSettingSection title="Chỉ số hiển thị">
                            {allAvailableSeries.map(series => (
                                <ChartSettingItem
                                    key={series.key}
                                    label={series.name}
                                    color={series.color}
                                    checked={lineVisibleKeys.includes(series.key)}
                                    onChange={() => handleToggleLineSeries(series.key)}
                                    isSwitch={true}
                                />
                            ))}
                        </ChartSettingSection>

                        <SourceSelectionSection
                            selectedSources={selectedSources}
                            sourceOptions={sourceOptions}
                            onToggle={handleToggleSource}
                        />
                    </ChartSettingsPanel>
                </Paper>
            </LazyLoader>

            {/* Bảng chi tiết */}
            <LazyLoader height={400}>
                <SectionTitle>Chi tiết theo nền tảng</SectionTitle>
                <Suspense fallback={<Skeleton variant="rectangular" width="100%" height={400} />}>
                    <FinanceTable data={platformData} loading={loading} error={error} />
                </Suspense>
            </LazyLoader>
        </Box>
    );
}

export default FinancePage;