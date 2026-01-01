import React, { useState } from 'react';
import { Box, Typography, Button, Paper, Skeleton, IconButton, Tooltip, ToggleButton, ToggleButtonGroup, Switch, FormControlLabel, FormGroup, Divider } from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SettingsIcon from '@mui/icons-material/Settings';
import DateRangeFilterMenu from '../components/common/DateRangeFilterMenu';
import GaugeChart from '../components/charts/GaugeChart';
import DonutChart from '../components/charts/DonutChart';
import HorizontalBarChart from '../components/charts/HorizontalBarChart';
import GeoMapChart from '../components/charts/GeoMapChart';
import { useOperationPageLogic } from '../hooks/useOperationPageLogic';
import { useTheme } from '@mui/material/styles';

// UI Components
import DashboardBox from '../components/ui/DashboardBox';
import SectionTitle from '../components/ui/SectionTitle';

// Import Chart Controls
import ChartSettingsPanel from '../components/charts/controls/ChartSettingsPanel';
import SourceSelectionSection from '../components/charts/controls/SourceSelectionSection';
import { toggleSourceSelection } from '../utils/filterLogic';

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
const CancelReasonBox = React.memo(({ chart, sourceOptions }) => (
    <DashboardBox 
        minWidth="350px"
        title="Phân loại Lý do Hủy đơn" 
        loading={chart.loading}
        hasData={chart.data.length > 0}
        action={<OperationBoxControl filter={chart.filter} sourceOptions={sourceOptions} title="Chọn nguồn dữ liệu" />}
    >
        <DonutChart 
            data={chart.data} 
            centerLabel="TỔNG HỦY" 
            unit=" đơn"
            formatType="number"
            height="100%"
        />
    </DashboardBox>
));

const TopRefundBox = React.memo(({ chart, sourceOptions }) => (
    <DashboardBox 
        minWidth="350px"
        title="Top 5 Sản phẩm Hoàn/Bom cao nhất"
        loading={chart.loading}
        hasData={chart.data.length > 0}
        placeholderTitle="Chưa có dữ liệu Top Sản phẩm Hoàn"
        action={<OperationBoxControl filter={chart.filter} sourceOptions={sourceOptions} title="Chọn nguồn dữ liệu" />}
    >
        <HorizontalBarChart 
            data={chart.data}
            dataKey="value"
            labelKey="name"
            subLabelKey="sku"
            unit=" sp"
            color="#ff6384"
            height="100%"
        />
    </DashboardBox>
));

const PaymentBox = React.memo(({ chart, sourceOptions }) => (
    <DashboardBox 
        minWidth="350px"
        title="Phương thức thanh toán"
        loading={chart.loading}
        hasData={chart.data.length > 0}
        action={<OperationBoxControl filter={chart.filter} sourceOptions={sourceOptions} title="Chọn nguồn dữ liệu" />}
    >
        <HorizontalBarChart
            data={chart.data}
            layout="vertical"
            dataKey="value"
            labelKey="name"
            unit=" đơn"
            color= "#e8d458"
            height="100%"
        />
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
            <HorizontalBarChart 
                data={chart.data}
                layout="horizontal" 
                dataKey="count"
                labelKey="hour"
                unit=" đơn"
                color={theme.palette.info.main}
                height="100%"
            />
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
            <GeoMapChart 
                data={chart.data}
                valueKey="orders"
                labelKey="city"
                unitLabel=" đơn"
                statusFilter={chart.statusFilter}
                statusColors={colors}
            />
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
                    <OperationBoxControl filter={chart.filter} sourceOptions={sourceOptions} hideSource={true} />
                </Box>
            }
        >
                {viewMode === 'quality' ? (
                    <HorizontalBarChart
                    data={chart.data.filter(i => i.platform !== 'Tổng cộng')}
                    layout="vertical"
                    showLegend={true}
                    series={[
                        { dataKey: 'completed_orders', label: 'Thành công', color: theme.palette.success.main },
                        { dataKey: 'cancelled_orders', label: 'Hủy', color: theme.palette.error.main },
                        { dataKey: 'refunded_orders', label: 'Hoàn', color: theme.palette.warning.main }
                    ]}
                    labelKey="platform"
                    unit=" đơn"
                    height="100%"
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
                    />
                )}
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
                        </Paper>
                    ))
                )}
            </DashboardRow>

            {/* --- PHÂN TÍCH NGUYÊN NHÂN --- */}
            <SectionTitle>Phân tích Nguyên nhân</SectionTitle>
            <DashboardRow>
                <CancelReasonBox chart={charts.cancelReason} sourceOptions={sourceOptions} />
                <TopRefundBox chart={charts.topRefund} sourceOptions={sourceOptions} />
            </DashboardRow>

            {/* --- PHƯƠNG THỨC THANH TOÁN & XU HƯỚNG --- */}
            <SectionTitle>Phương thức thanh toán & Xu hướng</SectionTitle>
            <DashboardRow>
                <PaymentBox chart={charts.payment} sourceOptions={sourceOptions} />
                <HourlyBox chart={charts.hourly} sourceOptions={sourceOptions} />
            </DashboardRow>

            {/* --- PHÂN BỔ ĐỊA LÝ & NỀN TẢNG --- */}
            <SectionTitle>Phân bổ Địa lý & Nền tảng</SectionTitle>
            <DashboardRow>
                <GeoMapBox chart={charts.geo} sourceOptions={sourceOptions} />
                <PlatformBox chart={charts.platform} sourceOptions={sourceOptions} />
            </DashboardRow>

        </Box>
    );
}

export default OperationPage;