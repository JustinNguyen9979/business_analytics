import React, { lazy, Suspense } from 'react';
import { Box, Typography, Paper, Button, Skeleton, IconButton, Tooltip } from '@mui/material';
import {
    CalendarToday as CalendarTodayIcon,
    Settings as SettingsIcon
} from '@mui/icons-material';
import DateRangeFilterMenu from '../components/common/DateRangeFilterMenu';
import FinanceTable from '../components/finance/FinanceTable';
import KpiCard from '../components/dashboard/KpiCard';
import SourceDistributionChart from '../components/charts/SourceDistributionChart';
import FinanceComparisonChart from '../components/charts/FinanceComparisonChart';
import ChartSettingsPanel from '../components/charts/controls/ChartSettingsPanel';
import ChartSettingSection from '../components/charts/controls/ChartSettingSection';
import ChartSettingItem from '../components/charts/controls/ChartSettingItem';
import { useFinancePageLogic } from '../hooks/useFinancePageLogic'; // Import Hook (JSX)
import { useTheme } from '@mui/material/styles'; // Need to import useTheme for styling

const RevenueProfitChart = lazy(() => import('../components/charts/RevenueProfitChart'));

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
    const theme = useTheme(); // Use theme here for consistency
    const {
        // State
        sourceOptions, selectedSources, isConfigOpen, setIsConfigOpen,
        dateRange, dateLabel, anchorEl, visibleSeriesKeys,
        
        // Handlers
        handleToggleSource, handleOpenFilter, handleCloseFilter, 
        handleApplyDateRange, handleToggleSeries,

        // Data
        lineChart, platformData, kpiCards,
        loading, error,

        // Configs
        comparisonChartSeries, allAvailableSeries, filteredLineChartSeries, cardConfigs
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
                        startIcon={<CalendarTodayIcon />}
                        onClick={handleOpenFilter}
                        sx={{ 
                            color: theme.palette.primary.main, // Sử dụng theme
                            borderColor: theme.palette.primary.main, // Sử dụng theme
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

            <Paper variant="glass" elevation={0} sx={{ p: 1, mb: 4, position: 'relative', overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 2, pt: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>Biểu đồ xu hướng</Typography>
                    <Tooltip title="Cấu hình hiển thị">
                        <IconButton 
                            onClick={() => setIsConfigOpen(true)}
                            sx={{ 
                                border: `1px solid ${theme.palette.divider}`, // Sử dụng theme
                                borderRadius: 2,
                                color: isConfigOpen ? theme.palette.primary.main : theme.palette.text.secondary, // Sử dụng theme
                                bgcolor: isConfigOpen ? theme.palette.primary.main + '20' : 'transparent', // Sử dụng theme (thêm 20 cho độ mờ)
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
                    {lineChart.loading ? <ChartSkeleton /> : (
                        <Suspense fallback={<ChartSkeleton />}>
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

                <ChartSettingsPanel
                    open={isConfigOpen}
                    onClose={() => setIsConfigOpen(false)}
                    title="Cấu hình biểu đồ"
                >
                    <ChartSettingSection title="Chỉ số hiển thị">
                        {allAvailableSeries.map(series => (
                            <ChartSettingItem
                                key={series.key}
                                label={series.name}
                                color={series.color}
                                checked={visibleSeriesKeys.includes(series.key)}
                                onChange={() => handleToggleSeries(series.key)}
                                isSwitch={true}
                            />
                        ))}
                    </ChartSettingSection>

                    <ChartSettingSection title="Nguồn dữ liệu">
                        <ChartSettingItem
                            label="Tất cả nguồn"
                            checked={selectedSources.includes('all')}
                            onChange={() => handleToggleSource('all')}
                        />
                        {sourceOptions.map(option => (
                            <ChartSettingItem
                                key={option.value}
                                label={option.label}
                                checked={selectedSources.includes('all') || selectedSources.includes(option.value)}
                                onChange={() => handleToggleSource(option.value)}
                            />
                        ))}
                    </ChartSettingSection>
                </ChartSettingsPanel>
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