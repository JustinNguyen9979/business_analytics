import React, { useState, lazy, Suspense, useMemo } from 'react';
import { Box, Typography, Button, Paper, Skeleton, IconButton, Tooltip, Divider } from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SettingsIcon from '@mui/icons-material/Settings';
import { useTheme } from '@mui/material/styles';

// Hooks & Logic
import { useCustomerPageLogic } from '../hooks/useCustomerPageLogic';

// UI Components
import DashboardBox from '../components/ui/DashboardBox';
import SectionTitle from '../components/ui/SectionTitle';
import DateRangeFilterMenu from '../components/common/DateRangeFilterMenu';
import LazyLoader from '../components/common/LazyLoader';
import CustomerTable from '../components/customer/CustomerTable';
import StatComparison from '../components/common/StatComparison'; // Import StatComparison

// Import Chart Controls (Tái sử dụng logic từ Operation)
import ChartSettingsPanel from '../components/charts/controls/ChartSettingsPanel';
import SourceSelectionSection from '../components/charts/controls/SourceSelectionSection';
import { toggleSourceSelection } from '../utils/filterLogic';

// Charts (Lazy)
const GaugeChart = lazy(() => import('../components/charts/GaugeChart'));
const DonutChart = lazy(() => import('../components/charts/DonutChart'));
const RevenueProfitChart = lazy(() => import('../components/charts/RevenueProfitChart'));

const ChartSkeleton = () => (
    <Skeleton
        variant="rectangular"
        width="100%"
        height="100%"
        sx={{ borderRadius: 2, bgcolor: 'rgba(255, 255, 255, 0.05)' }}
    />
);

// --- 1. KPI CARD COMPONENT (Modern Glassmorphism Style) ---
const CustomerKpiCard = React.memo(({ label, value, previousValue, unit, color }) => (
    <Paper 
        variant="glass" 
        sx={{ 
            flex: '1 1 240px',
            p: 2.5, 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'space-between',
            height: 160,
            position: 'relative',
            overflow: 'hidden',
            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
            '&:hover': {
                transform: 'translateY(-5px)',
                boxShadow: `0 12px 20px -10px ${color}40`,
                borderColor: color,
            }
        }}
    >
        {/* Decorative Circle */}
        <Box sx={{ 
            position: 'absolute', 
            top: -15, 
            right: -15, 
            width: 80, 
            height: 80, 
            bgcolor: color, 
            opacity: 0.1, 
            borderRadius: '50%' 
        }} />
        
        <Typography variant="subtitle2" color="text.secondary" fontWeight="700" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {label}
        </Typography>
        
        <Box>
            <Typography variant="h3" fontWeight="800" sx={{ color: color, lineHeight: 1 }}>
                {typeof value === 'number' 
                    ? (unit === '%' 
                        ? value.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) 
                        : Math.round(value).toLocaleString('vi-VN'))
                    : value
                }
                <Typography component="span" variant="h6" sx={{ color: 'text.secondary', ml: 0.5, fontWeight: '600' }}>
                    {unit}
                </Typography>
            </Typography>
            
            {/* SỬ DỤNG STAT COMPARISON ĐỂ HIỂN THỊ XU HƯỚNG CHUẨN XÁC */}
            <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center' }}>
                <StatComparison 
                    value={value} 
                    previousValue={previousValue} 
                    format="number"
                />
                 {/* Ẩn text "so với kỳ trước" nếu không có so sánh để tránh trống trải */}
                 {previousValue !== undefined && previousValue !== null && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: '500', ml: 1 }}>
                        so với kỳ trước
                    </Typography>
                )}
            </Box>
        </Box>
    </Paper>
));

// --- 2. HELPER COMPONENTS (BOX CONTROLS & BOXES) ---
const CustomerBoxControl = React.memo(({ filter, sourceOptions, title, hideSource = false }) => {
    const theme = useTheme();
    const [isConfigOpen, setIsConfigOpen] = useState(false);

    const handleToggleSource = (sourceValue) => {
        const newSources = toggleSourceSelection(sourceValue, filter.selectedSources, sourceOptions);
        filter.applySourceFilter(newSources);
    };

    return (
        <Box sx={{ display: 'flex', gap: 1 }}>
            <Box>
                <Button 
                    variant="outlined" size="small" startIcon={<CalendarMonthIcon />} 
                    onClick={filter.openDateMenu}
                    sx={{ borderRadius: 2, height: 36.5, minWidth: 110, whiteSpace: 'nowrap' }}
                >
                    {filter.dateLabel}
                </Button>
                <DateRangeFilterMenu {...filter.dateMenuProps} />
            </Box>

            <Tooltip title="Cấu hình hiển thị">
                <IconButton 
                    onClick={() => setIsConfigOpen(true)}
                    sx={{ 
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 2,
                        color: isConfigOpen ? theme.palette.primary.main : theme.palette.text.secondary,
                        bgcolor: isConfigOpen ? theme.palette.primary.main + '20' : 'transparent',
                    }}
                >
                    <SettingsIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <ChartSettingsPanel
                open={isConfigOpen}
                onClose={() => setIsConfigOpen(false)}
                title={title || "Cấu hình"}
            >
                {!hideSource && (
                    <SourceSelectionSection
                        selectedSources={filter.selectedSources}
                        sourceOptions={sourceOptions}
                        onToggle={handleToggleSource}
                    />
                )}
            </ChartSettingsPanel>
        </Box>
    );
});

const CustomerTrendBox = React.memo(({ chart, sourceOptions }) => (
    <DashboardBox 
        minWidth="350px"
        flex={2.5}
        title="Xu hướng Khách Mới vs Quay lại"
        loading={chart.loading}
        hasData={chart.data.length > 0}
        action={<CustomerBoxControl filter={chart.filter} sourceOptions={sourceOptions} title="Chọn nguồn dữ liệu" />}
    >
        <Suspense fallback={<ChartSkeleton />}>
            <RevenueProfitChart 
                data={chart.data}
                series={[
                    { dataKey: 'new_customers', label: 'Khách mới', color: '#00E676', type: 'bar' },
                    { dataKey: 'returning_customers', label: 'Khách quay lại', color: '#2196F3', type: 'bar' }
                ]}
                unit=" khách"
                xKey="date"
                height="100%"
            />
        </Suspense>
    </DashboardBox>
));

const CustomerSegmentBox = React.memo(({ chart, sourceOptions }) => (
    <DashboardBox 
        minWidth="80px"
        flex={1}
        title="Phân nhóm theo Chi tiêu"
        loading={chart.loading}
        hasData={chart.data.length > 0}
        action={<CustomerBoxControl filter={chart.filter} sourceOptions={sourceOptions} title="Chọn nguồn dữ liệu" />}
    >
        <Suspense fallback={<ChartSkeleton />}>
            <DonutChart 
                data={chart.data} 
                centerLabel="TỔNG" 
                unit=" khách"
                height="100%"
                hideTooltip={true}
            />
        </Suspense>
    </DashboardBox>
));

const CustomerFrequencyBox = React.memo(({ chart, sourceOptions }) => {
    // Memoize chart content để tránh re-render khi filter (menu open state) thay đổi
    const chartContent = useMemo(() => (
        <RevenueProfitChart 
            data={chart.data}
            series={[
                { dataKey: 'value', label: 'Số lượng Khách', color: '#FF9800', type: 'bar' }
            ]}
            unit=" khách"
            xKey="range"
            height="100%"
            hideTooltip={true}
            showBarLabel={true}
        />
    ), [chart.data]);

    return (
        <DashboardBox 
            minWidth="120px"
            flex={2}
            title="Tần suất Mua hàng"
            loading={chart.loading}
            hasData={chart.data.length > 0}
            action={<CustomerBoxControl filter={chart.filter} sourceOptions={sourceOptions} title="Chọn nguồn dữ liệu" />}
        >
            <Suspense fallback={<ChartSkeleton />}>
                {chartContent}
            </Suspense>
        </DashboardBox>
    );
});

const CustomerCycleBox = React.memo(({ chart, sourceOptions }) => {
    const theme = useTheme();
    return (
        <DashboardBox 
            minWidth="300px"
            flex={1}
            title="Chu kỳ Mua lại Trung bình"
            loading={chart.loading}
            hasData={chart.data.length > 0}
            action={<CustomerBoxControl filter={chart.filter} sourceOptions={sourceOptions} title="Chọn nguồn dữ liệu" />}
        >
            <Suspense fallback={<ChartSkeleton />}>
                <RevenueProfitChart 
                    data={chart.data}
                    series={[
                        { dataKey: 'value', label: 'Số ngày TB', color: '#9C27B0', area: true }
                    ]}
                    unit=" ngày"
                    xKey="date"
                    height="100%"
                />
            </Suspense>
        </DashboardBox>
    );
});

const CustomerChurnBox = React.memo(({ chart, sourceOptions }) => (
    <DashboardBox 
        minWidth="300px"
        flex={1}
        title="Tỷ lệ Rời bỏ"
        loading={chart.loading}
        hasData={chart.data.length > 0}
        action={<CustomerBoxControl filter={chart.filter} sourceOptions={sourceOptions} title="Chọn nguồn dữ liệu" />}
    >
        <Suspense fallback={<ChartSkeleton />}>
            <RevenueProfitChart 
                data={chart.data}
                series={[
                    { dataKey: 'value', label: 'Tỷ lệ rời bỏ', color: '#FF5252', area: true }
                ]}
                unit="%"
                xKey="date"
                height="100%"
            />
        </Suspense>
    </DashboardBox>
));

const CustomerTableBox = React.memo(({ tableData, sourceOptions }) => (
    <DashboardBox 
        title="Danh sách Khách hàng Tiêu biểu"
        loading={tableData.loading}
        hasData={tableData.data && tableData.data.length > 0}
        height={850}
        action={<CustomerBoxControl filter={tableData.filter} sourceOptions={sourceOptions} title="Chọn nguồn dữ liệu" />}
    >
        <CustomerTable data={tableData} /> 
    </DashboardBox>
));

const DashboardRow = ({ children }) => (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
        {children}
    </Box>
);

// --- 3. MAIN PAGE ---
function CustomerPage() {
    const {
        dateRange,
        dateLabel,
        anchorEl,
        handleOpenFilter,
        handleCloseFilter,
        handleApplyDateRange,
        globalLoading,
        kpiData,
        sourceOptions,
        charts,
        customerList,
        tableData
    } = useCustomerPageLogic();

    return (
        <Box sx={{ px: 4, py: 3 }}>
            {/* --- HEADER --- */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography variant="h4" fontWeight="bold">Báo cáo Khách hàng</Typography>
                <Box>
                    <Button variant="outlined" startIcon={<CalendarMonthIcon />} onClick={handleOpenFilter} sx={{ borderRadius: 2 }}>
                        {dateLabel}
                    </Button>
                    <DateRangeFilterMenu
                        open={Boolean(anchorEl)}
                        anchorEl={anchorEl}
                        onClose={handleCloseFilter}
                        onApply={handleApplyDateRange}
                        initialDateRange={dateRange}
                    />
                </Box>
            </Box>

            {/* --- SECTION 1: KPI OVERVIEW --- */}
            <SectionTitle>Sức khỏe Tập khách hàng</SectionTitle>
            <DashboardRow>
                {globalLoading ? (
                    Array.from(new Array(4)).map((_, index) => (
                        <Skeleton key={index} variant="rectangular" height={160} sx={{ flex: '1 1 240px', borderRadius: 2 }} />
                    ))
                ) : (
                    kpiData.map((kpi, index) => (
                        <CustomerKpiCard 
                            key={index} 
                            label={kpi.label}
                            value={kpi.value}
                            // Thêm previousValue vào Mock KPI Logic trong hook
                            previousValue={kpi.previousValue || (kpi.value * 0.9)} 
                            unit={kpi.unit}
                            color={kpi.color}
                        />
                    ))
                )}
            </DashboardRow>

            {/* --- SECTION 2: TREND & SEGMENTATION --- */}
            <SectionTitle>Phân tích Xu hướng & Cơ cấu</SectionTitle>
            <LazyLoader height={400}>
                <DashboardRow>
                    <CustomerTrendBox chart={charts.trend} sourceOptions={sourceOptions} />
                    <CustomerSegmentBox chart={charts.segment} sourceOptions={sourceOptions} />
                </DashboardRow>
            </LazyLoader>

            {/* --- SECTION 3: BEHAVIOR ANALYSIS (NEW) --- */}
            <SectionTitle>Hành vi Tiêu dùng</SectionTitle>
            <LazyLoader height={400}>
                <DashboardRow>
                    <CustomerFrequencyBox chart={charts.frequency} sourceOptions={sourceOptions} />
                    <CustomerCycleBox chart={charts.cycle} sourceOptions={sourceOptions} />
                    <CustomerChurnBox chart={charts.churn} sourceOptions={sourceOptions} />
                </DashboardRow>
            </LazyLoader>

            {/* --- SECTION 4: TABLE --- */}
            <SectionTitle>Chi tiết Khách hàng</SectionTitle>
            <Box sx={{ mb: 4 }}>
                <CustomerTableBox tableData={tableData} sourceOptions={sourceOptions} />
            </Box>
        </Box>
    );
}

export default CustomerPage;
