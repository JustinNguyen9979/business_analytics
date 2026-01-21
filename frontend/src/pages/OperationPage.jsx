import React, { useState, lazy, Suspense } from 'react';
import { Box, Typography, Button, Paper, Skeleton, IconButton, Tooltip, ToggleButton, ToggleButtonGroup, Switch, FormControlLabel, FormGroup, Divider } from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SettingsIcon from '@mui/icons-material/Settings';
import DateRangeFilterMenu from '../components/common/DateRangeFilterMenu';
import LazyLoader from '../components/common/LazyLoader'; 
import { useOperationPageLogic } from '../hooks/useOperationPageLogic';
import { useTheme } from '@mui/material/styles';

// UI Components
import DashboardBox from '../components/ui/DashboardBox';
import SectionTitle from '../components/ui/SectionTitle';

// Import Chart Controls
import ChartSettingsPanel from '../components/charts/controls/ChartSettingsPanel';
import SourceSelectionSection from '../components/charts/controls/SourceSelectionSection';
import { toggleSourceSelection } from '../utils/filterLogic';

const GaugeChart = lazy(() => import('../components/charts/GaugeChart'));
const DonutChart = lazy(() => import('../components/charts/DonutChart'));
const HorizontalBarChart = lazy(() => import('../components/charts/HorizontalBarChart'));
const GeoMapChart = lazy(() => import('../components/charts/GeoMapChart'));
const RevenueProfitChart = lazy(() => import('../components/charts/RevenueProfitChart'));

const ChartSkeleton = () => (
    <Skeleton
        variant="rectangular"
        width="100%"
        height="100%"
        sx={{ borderRadius: 2, bgcolor: 'rgba(255, 255, 255, 0.05)' }}
    />
);

// Helper lấy màu theo status (Định nghĩa tập trung)
const getStatusColors = (theme) => ({
    all: '#FF5252', // Mặc định: Đỏ tươi
    completed: theme.palette.success.main,
    cancelled: '#C62828', // Đỏ sẫm (Khác biệt với #FF5252)
    bomb: theme.palette.warning.main,
    refunded: '#9c27b0'
});

// Component chọn trạng thái cho Map (Redesigned with "Excel-like" All Logic)
const MapStatusFilter = ({ selectedStatuses, onToggle }) => {
    const theme = useTheme();
    const colors = getStatusColors(theme);
    
    // Định nghĩa danh sách status, thêm 'all' vào đầu
    const statusOptions = [
        { key: 'completed', label: 'Đơn thành công', color: colors.completed },
        { key: 'cancelled', label: 'Đơn đã hủy', color: colors.cancelled },
        { key: 'bomb', label: 'Đơn bom (thất bại)', color: colors.bomb },
        { key: 'refunded', label: 'Đơn hoàn tiền', color: colors.refunded }
    ];

    // Tạo danh sách option dạng {value, label} để dùng cho hàm toggleSourceSelection
    const toggleOptions = statusOptions.map(s => ({ value: s.key, label: s.label }));

    const handleSwitchChange = (key) => {
        // Sử dụng logic toggle thông minh "kiểu Excel" từ utils/filterLogic
        const newSelection = toggleSourceSelection(key === 'all' ? 'all' : key, selectedStatuses, toggleOptions);
        onToggle(newSelection);
    };

    const isAllChecked = selectedStatuses.includes('all');

    return (
        <Box sx={{ mt: 2 }}>
            <Divider sx={{ my: 2, borderStyle: 'dashed' }} />
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Hiển thị theo trạng thái:
            </Typography>
            <FormGroup>
                {/* Nút TẤT CẢ riêng biệt */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5, mb: 0.5, borderBottom: '1px dashed rgba(255,255,255,0.1)' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        Tất cả
                    </Typography>
                    <Switch 
                        size="small"
                        checked={isAllChecked}
                        onChange={() => handleSwitchChange('all')}
                        color="primary"
                    />
                </Box>

                {statusOptions.map((status) => {
                    const isChecked = selectedStatuses.includes(status.key); // Không cần check 'all' ở đây vì logic mảng đã chứa đủ
                    
                    return (
                        <Box key={status.key} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                            <Typography variant="body2" sx={{ color: status.color, fontWeight: 500 }}>
                                {status.label}
                            </Typography>
                            <Switch 
                                size="small"
                                checked={isChecked}
                                onChange={() => handleSwitchChange(status.key)}
                                sx={{
                                    '& .MuiSwitch-switchBase.Mui-checked': {
                                        color: status.color,
                                        '&:hover': { backgroundColor: status.color + '15' },
                                    },
                                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                        backgroundColor: status.color,
                                    },
                                }}
                            />
                        </Box>
                    );
                })}
            </FormGroup>
        </Box>
    );
};

// --- 1. COMPONENT CON QUẢN LÝ SETTINGS PANEL (Memoized) ---
const OperationBoxControl = React.memo(({ filter, sourceOptions, title, hideSource = false, extraContent }) => {
    const theme = useTheme();
    const [isConfigOpen, setIsConfigOpen] = useState(false);

    // Xử lý logic chọn source
    const handleToggleSource = (sourceValue) => {
        const newSources = toggleSourceSelection(sourceValue, filter.selectedSources, sourceOptions);
        filter.applySourceFilter(newSources);
    };

    return (
        <Box sx={{ display: 'flex', gap: 1 }}>
            {/* Nút Lịch */}
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

            {/* Nút Cấu hình (Bánh răng) */}
            <Tooltip title="Cấu hình hiển thị">
                <IconButton 
                    onClick={() => setIsConfigOpen(true)}
                    sx={{ 
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 2,
                        color: isConfigOpen ? theme.palette.primary.main : theme.palette.text.secondary,
                        bgcolor: isConfigOpen ? theme.palette.primary.main + '20' : 'transparent',
                        '&:hover': {
                            color: theme.palette.primary.main,
                            borderColor: theme.palette.primary.main,
                        }
                    }}
                >
                    <SettingsIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            {/* Panel Cấu hình */}
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
                {/* Render nội dung phụ (ví dụ: Map Status Filter) */}
                {extraContent}
            </ChartSettingsPanel>
        </Box>
    );
});

// --- 2. CÁC BOX BIỂU ĐỒ RIÊNG BIỆT (Memoized) ---

// === 4 BOX MỚI (TÍCH CỰC) ===
const TopSellingBox = React.memo(({ chart, sourceOptions }) => {
    const theme = useTheme();
    return (
        <DashboardBox 
            minWidth="350px"
            title="Top Sản phẩm Bán chạy"
            loading={chart.loading}
            hasData={chart.data.length > 0}
            action={<OperationBoxControl filter={chart.filter} sourceOptions={sourceOptions} title="Chọn nguồn dữ liệu" />} 
        >
            <Suspense fallback={<ChartSkeleton />}>
                <HorizontalBarChart 
                    data={chart.data}
                    dataKey="value"
                    labelKey="name"
                    subLabelKey="sku"
                    unit=" sp"
                    color={theme.palette.success.main}
                    height="100%"
                    hideTooltip={true}
                />
            </Suspense>
        </DashboardBox>
    );
});

const OrderTrendBox = React.memo(({ chart, sourceOptions }) => (
    <DashboardBox 
        minWidth="350px"
        title="Nhịp độ Đơn hàng (Vào vs Ra)"
        loading={chart.loading}
        hasData={chart.data.length > 0}
        action={<OperationBoxControl filter={chart.filter} sourceOptions={sourceOptions} title="Chọn nguồn dữ liệu" />}
    >
        <Suspense fallback={<ChartSkeleton />}>
            <RevenueProfitChart 
                data={chart.data}
                series={[
                    { dataKey: 'total', label: 'Đơn đặt mới', color: '#2196F3', area: true },
                    { dataKey: 'completed', label: 'Đơn đi (Thành công)', color: '#4CAF50', area: true }
                ]}
                unit=" đơn"
                xKey="date"
                height="100%"
            />
        </Suspense>
    </DashboardBox>
));

const SpeedTrendBox = React.memo(({ chart, sourceOptions }) => {
    const theme = useTheme();
    return (
        <DashboardBox 
            minWidth="350px"
            title="Tốc độ Xử lý"
            loading={chart.loading}
            hasData={chart.data.length > 0}
            action={<OperationBoxControl filter={chart.filter} sourceOptions={sourceOptions} title="Chọn nguồn dữ liệu" />}
        >
            <Suspense fallback={<ChartSkeleton />}>
                <RevenueProfitChart 
                    data={chart.data}
                    series={[
                        { dataKey: 'value', label: 'Thời gian TB (Giờ)', color: theme.palette.warning.main, area: true }
                    ]}
                    unit=" giờ"
                    xKey="date"
                    height="100%"
                />            
            </Suspense>
        </DashboardBox>
    );
});

const UptTrendBox = React.memo(({ chart, sourceOptions }) => {
    const theme = useTheme();
    return (
        <DashboardBox 
            minWidth="350px"
            title="Hiệu suất Đóng gói (UPT)"
            loading={chart.loading}
            hasData={chart.data.length > 0}
            action={<OperationBoxControl filter={chart.filter} sourceOptions={sourceOptions} title="Chọn nguồn dữ liệu" />}
        >
            <Suspense fallback={<ChartSkeleton />}>
                <RevenueProfitChart 
                    data={chart.data}
                    series={[
                        { dataKey: 'value', label: 'Sản phẩm / Đơn', color: '#9c27b0', type: 'bar' }
                    ]}
                    unit=" sp/đơn"
                    xKey="date"
                    height="100%"
                />
            </Suspense>
        </DashboardBox>
    );
});

// === CÁC BOX CŨ (TIÊU CỰC / PHÂN TÍCH) ===
const CancelReasonBox = React.memo(({ chart, sourceOptions }) => (
    <DashboardBox 
        minWidth="350px"
        title="Phân loại Lý do Hủy đơn" 
        loading={chart.loading}
        hasData={chart.data.length > 0}
        action={<OperationBoxControl filter={chart.filter} sourceOptions={sourceOptions} title="Chọn nguồn dữ liệu" />}
    >
        <Suspense fallback={<ChartSkeleton />}>
            <DonutChart 
                data={chart.data} 
                centerLabel="TỔNG HỦY" 
                unit=" đơn"
                formatType="number"
                height="100%"
                hideTooltip={true}
            />
        </Suspense>
    </DashboardBox>
));

const TopRefundBox = React.memo(({ chart, sourceOptions }) => {
    const theme = useTheme();
    const [viewMode, setViewMode] = useState('refunded');

    const handleViewChange = (event, newMode) => {
        if (newMode !== null) setViewMode(newMode);
    };

    // Lấy data theo viewMode, xử lý an toàn nếu data chưa load hoặc format sai
    const currentData = (chart.data && !Array.isArray(chart.data)) ? (chart.data[viewMode] || []) : [];
    
    // Config màu sắc và label cho từng mode
    const config = {
        refunded: { color: '#9c27b0', label: 'Top Hoàn tiền', unit: ' sp' },
        bomb: { color: theme.palette.warning.main, label: 'Top Bom hàng', unit: ' sp' },
        cancelled: { color: '#C62828', label: 'Top Hủy đơn', unit: ' sp' }
    };

    return (
        <DashboardBox 
            minWidth="350px"
            title="Sản phẩm có vấn đề (Top 10)"
            loading={chart.loading}
            // Check data exist: Nếu object có ít nhất 1 key có data thì coi là hasData
            hasData={chart.data && !Array.isArray(chart.data) && Object.values(chart.data).some(arr => arr && arr.length > 0)}
            placeholderTitle={`Chưa có dữ liệu ${config[viewMode].label}`}
            action={
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                     <ToggleButtonGroup
                        value={viewMode}
                        exclusive
                        onChange={handleViewChange}
                        size="small"
                        sx={{ height: 32 }}
                    >
                        <ToggleButton value="refunded" sx={{ textTransform: 'none', px: 1.5, fontSize: '0.75rem' }}>Hoàn</ToggleButton>
                        <ToggleButton value="bomb" sx={{ textTransform: 'none', px: 1.5, fontSize: '0.75rem' }}>Bom</ToggleButton>
                        <ToggleButton value="cancelled" sx={{ textTransform: 'none', px: 1.5, fontSize: '0.75rem' }}>Hủy</ToggleButton>
                    </ToggleButtonGroup>
                    <OperationBoxControl filter={chart.filter} sourceOptions={sourceOptions} title="Chọn nguồn dữ liệu" />
                </Box>
            }
        >
            <Suspense fallback={<ChartSkeleton />}>
                <HorizontalBarChart 
                    data={currentData}
                    dataKey="value"
                    labelKey="name"
                    subLabelKey="sku"
                    unit={config[viewMode].unit}
                    color={config[viewMode].color}
                    height="100%"
                    hideTooltip={true}
                />
            </Suspense>
        </DashboardBox>
    );
});

const PaymentBox = React.memo(({ chart, sourceOptions }) => (
    <DashboardBox 
        minWidth="350px"
        title="Phương thức thanh toán"
        loading={chart.loading}
        hasData={chart.data.length > 0}
        action={<OperationBoxControl filter={chart.filter} sourceOptions={sourceOptions} title="Chọn nguồn dữ liệu" />}
    >
        <Suspense fallback={<ChartSkeleton />}>
            <HorizontalBarChart
                data={chart.data}
                layout="vertical"
                dataKey="value"
                labelKey="name"
                unit=" đơn"
                color= "#e8d458"
                height="100%"
                hideTooltip={true}
            />
        </Suspense>
    </DashboardBox>
));

const HourlyBox = React.memo(({ chart, sourceOptions }) => {
    const theme = useTheme();
    return (
        <DashboardBox 
            minWidth="350px"
            title="Phân bổ Đơn hàng theo Khung giờ"
            loading={chart.loading}
            hasData={chart.data.length > 0}
            placeholderTitle="Chưa có dữ liệu Khung giờ"
            action={<OperationBoxControl filter={chart.filter} sourceOptions={sourceOptions} title="Chọn nguồn dữ liệu" />}
        >
            <Suspense fallback={<ChartSkeleton />}>
                <HorizontalBarChart 
                    data={chart.data}
                    layout="horizontal" 
                    dataKey="count"
                    labelKey="hour"
                    unit=" đơn"
                    color={theme.palette.info.main}
                    height="100%"
                    hideTooltip={true}
                />
            </Suspense>
        </DashboardBox>
    );
});

const GeoMapBox = React.memo(({ chart, sourceOptions }) => {
    const theme = useTheme();
    const colors = React.useMemo(() => getStatusColors(theme), [theme]);

    return (
        <DashboardBox 
            minWidth="350px"
            title="Bản đồ 'Điểm nóng' Đơn hàng" 
            height={600}
            loading={chart.loading}
            hasData={chart.data.length > 0}
            action={
                <OperationBoxControl 
                    filter={chart.filter} 
                    sourceOptions={sourceOptions} 
                    title="Cấu hình Bản đồ"
                    extraContent={
                        <MapStatusFilter 
                            selectedStatuses={chart.statusFilter} 
                            onToggle={chart.applyStatusFilter} 
                        />
                    }
                />
            }
        >
            <Suspense fallback={<ChartSkeleton />}>
                <GeoMapChart 
                    data={chart.data}
                    valueKey="orders"
                    labelKey="province"
                    unitLabel=" đơn"
                    statusFilter={chart.statusFilter}
                    statusColors={colors}
                />
            </Suspense>
        </DashboardBox>
    );
});

const PlatformBox = React.memo(({ chart, sourceOptions }) => {
    const theme = useTheme();
    const [viewMode, setViewMode] = useState('quality'); // Local state cho view mode

    const handleViewChange = (event, newAlignment) => {
        if (newAlignment !== null) setViewMode(newAlignment);
    };

    return (
        <DashboardBox 
            minWidth="350px"
            title="Hiệu quả Vận hành theo Sàn" 
            height={600}
            loading={chart.loading}
            hasData={chart.data.length > 0}
            placeholderTitle="Chưa có dữ liệu Vận hành theo Sàn"
            action={
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <ToggleButtonGroup
                        value={viewMode}
                        exclusive
                        onChange={handleViewChange}
                        size="small"
                        sx={{ height: 36 }}
                    >
                        <ToggleButton value="quality" sx={{ textTransform: 'none', px: 2 }}>
                            Chất lượng
                        </ToggleButton>
                        <ToggleButton value="speed" sx={{ textTransform: 'none', px: 2 }}>
                            Tốc độ xử lý
                        </ToggleButton>
                    </ToggleButtonGroup>
                    <OperationBoxControl filter={chart.filter} sourceOptions={sourceOptions} />
                </Box>
            }
        >
            <Suspense fallback={<ChartSkeleton />}>
                {viewMode === 'quality' ? (
                    <HorizontalBarChart
                    data={chart.data.filter(i => i.platform !== 'Tổng cộng')}
                    layout="vertical"
                    showLegend={true}
                    series={[
                        { dataKey: 'completed_orders', label: 'Thành công', color: theme.palette.success.main },
                        { dataKey: 'cancelled_orders', label: 'Hủy', color: theme.palette.error.main },
                        { dataKey: 'bomb_orders', label: 'Bom', color: theme.palette.warning.main },
                        { dataKey: 'refunded_orders', label: 'Hoàn', color: '#9c27b0' }
                    ]}
                    labelKey="platform"
                    unit=" đơn"
                    height="100%"
                    hideTooltip={true}
                    />
                ) : (
                    <HorizontalBarChart
                    data={chart.data.filter(i => i.platform !== 'Tổng cộng')}
                    layout="vertical"
                    showLegend={true}
                    series={[
                        { dataKey: 'avg_processing_time', label: 'Thời gian xử lý TB', color: theme.palette.info.main },
                    ]}
                    labelKey="platform"
                    unit=" giờ"
                    height="100%"
                    hideTooltip={true}
                    />
                )}
            </Suspense>
        </DashboardBox>
    );
});

// --- LAYOUT BLOCKS ---
const DashboardRow = ({ children }) => (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
        {children}
    </Box>
);

function OperationPage() {
    // const theme = useTheme(); // Không dùng theme ở đây nữa
    const {
        dateRange, // Lấy thêm dateRange
        dateLabel: globalDateLabel,
        anchorEl,
        handleOpenFilter,
        handleCloseFilter,
        handleApplyDateRange,
        globalLoading,
        kpiData,
        sourceOptions,
        charts // Object chứa logic của 6 biểu đồ con
    } = useOperationPageLogic();

    return (
        <Box sx={{ px: 4, py: 3 }}>
            {/* --- HEADER --- */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography variant="h4" fontWeight="bold">Báo cáo Vận hành</Typography>
                <Box>
                    <Button variant="outlined" startIcon={<CalendarMonthIcon />} onClick={handleOpenFilter} sx={{ borderRadius: 2 }}>
                        {globalDateLabel}
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

            {/* --- SỨC KHỎE TỔNG QUAN --- */}
            <SectionTitle>Sức khỏe Vận hành Tổng quan</SectionTitle>
            <DashboardRow>
                {globalLoading ? (
                    Array.from(new Array(5)).map((_, index) => (
                        <Paper key={index} variant="glass" sx={{ flex: '1 1 200px', p: 2, height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Skeleton variant="circular" width={140} height={140} />
                        </Paper>
                    ))
                ) : (
                    kpiData.map((kpi, index) => (
                        <Paper
                            key={index}
                            variant="glass"
                            sx = {{ 
                                flex: '1 1 200px',
                                minWidth: '220px',
                                p: 2,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    transform: 'translateY(-5px)',
                                    boxShadow: `0 10px 30px -10px ${kpi.color || kpi.colorBom}40`,
                                    borderColor: kpi.color || kpi.colorBom,
                                }
                            }}
                        >
                            <Suspense fallback={<Skeleton variant="circular" width={140} height={140} />}>
                                <GaugeChart
                                    value={kpi.value}
                                    max={kpi.max}
                                    segments={kpi.segments}
                                    title={kpi.title}
                                    unit={kpi.unit}
                                    previousValue={kpi.previousValue}
                                    height={220}
                                    color={kpi.color}
                                />
                            </Suspense>
                        </Paper>
                    ))
                )}
            </DashboardRow>

            {/* --- HIỆU SUẤT & SẢN LƯỢNG (MỚI) - LAZY LOAD --- */}
            <SectionTitle>Hiệu suất & Sản lượng</SectionTitle>
            <LazyLoader height={400}>
                <DashboardRow>
                    <TopSellingBox chart={charts.topSelling} sourceOptions={sourceOptions} />
                    <OrderTrendBox chart={charts.orderTrend} sourceOptions={sourceOptions} />
                </DashboardRow>
            </LazyLoader>
            <LazyLoader height={400}>
                <DashboardRow>
                    <SpeedTrendBox chart={charts.speedTrend} sourceOptions={sourceOptions} />
                    <UptTrendBox chart={charts.uptTrend} sourceOptions={sourceOptions} />
                </DashboardRow>
            </LazyLoader>

            {/* --- PHÂN TÍCH NGUYÊN NHÂN - LAZY LOAD --- */}
            <SectionTitle>Phân tích Nguyên nhân</SectionTitle>
            <LazyLoader height={400}>
                <DashboardRow>
                    <CancelReasonBox chart={charts.cancelReason} sourceOptions={sourceOptions} />
                    <TopRefundBox chart={charts.topRefund} sourceOptions={sourceOptions} />
                </DashboardRow>
            </LazyLoader>

            {/* --- PHƯƠNG THỨC THANH TOÁN & XU HƯỚNG - LAZY LOAD --- */}
            <SectionTitle>Phương thức thanh toán & Xu hướng</SectionTitle>
            <LazyLoader height={400}>
                <DashboardRow>
                    <PaymentBox chart={charts.payment} sourceOptions={sourceOptions} />
                    <HourlyBox chart={charts.hourly} sourceOptions={sourceOptions} />
                </DashboardRow>
            </LazyLoader>

            {/* --- PHÂN BỔ ĐỊA LÝ & NỀN TẢNG - LAZY LOAD --- */}
            <SectionTitle>Phân bổ Địa lý & Nền tảng</SectionTitle>
            <LazyLoader height={600}>
                <DashboardRow>
                    <GeoMapBox chart={charts.geo} sourceOptions={sourceOptions} />
                    <PlatformBox chart={charts.platform} sourceOptions={sourceOptions} />
                </DashboardRow>
            </LazyLoader>

        </Box>
    );
}

export default OperationPage;
