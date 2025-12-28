import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Typography, Button, Paper, Skeleton, IconButton, Tooltip, ToggleButton, ToggleButtonGroup } from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SettingsIcon from '@mui/icons-material/Settings';
import DateRangeFilterMenu from '../components/common/DateRangeFilterMenu';
import GaugeChart from '../components/charts/GaugeChart';
import DonutChart from '../components/charts/DonutChart';
import HorizontalBarChart from '../components/charts/HorizontalBarChart';
import GeoMapChart from '../components/charts/GeoMapChart';
import { useOperationPageLogic } from '../hooks/useOperationPageLogic';
import { useTheme } from '@mui/material/styles';
import { fetchOperationKpisAPI } from '../services/api';
import { useBrand } from '../context/BrandContext';

// UI Components chuẩn hóa
import DashboardBox from '../components/ui/DashboardBox';
import SectionTitle from '../components/ui/SectionTitle';
import PlaceholderBox from '../components/ui/PlaceholderBox';
import { useChartFilter } from '../hooks/useChartFilter';

// Import Chart Controls
import ChartSettingsPanel from '../components/charts/controls/ChartSettingsPanel';
import SourceSelectionSection from '../components/charts/controls/SourceSelectionSection';
import { toggleSourceSelection } from '../utils/filterLogic';

// --- COMPONENT CON QUẢN LÝ SETTINGS PANEL ---
const OperationBoxControl = ({ filter, sourceOptions, title, hideSource = false }) => {
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

            {/* Nút Cấu hình (Bánh răng) - Ẩn nếu hideSource = true */}
            {!hideSource && (
                <>
                    <Tooltip title="Cấu hình nguồn dữ liệu">
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
                        <SourceSelectionSection
                            selectedSources={filter.selectedSources}
                            sourceOptions={sourceOptions}
                            onToggle={handleToggleSource}
                        />
                    </ChartSettingsPanel>
                </>
            )}
        </Box>
    );
};

// --- THIẾT KẾ NỀN MÓNG (LAYOUT BLOCKS) ---
const DashboardRow = ({ children }) => (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
        {children}
    </Box>
);

function OperationPage() {
    const theme = useTheme();
    const { slug: brandSlug } = useBrand();
    const {
        dateRange: globalDateRange,
        dateLabel: globalDateLabel,
        anchorEl,
        handleOpenFilter,
        handleCloseFilter,
        handleApplyDateRange,
        loading: globalLoading,
        kpiData,
        sourceOptions
    } = useOperationPageLogic();

    // Object chứa state tổng để truyền xuống con
    const globalFilterState = useMemo(() => ({
        dateRange: globalDateRange,
        dateLabel: globalDateLabel,
        // selectedSources: ['all'] // Chưa có filter source tổng, mặc định là all
    }), [globalDateRange, globalDateLabel]);

    // ==========================================
    // 1. LOGIC LỌC RIÊNG CHO TỪNG BOX (Hybrid)
    // ==========================================
    
    // --- Box: Lý do hủy ---
    const cancelReasonFilter = useChartFilter(globalFilterState);
    const [cancelData, setCancelData] = useState([]);
    const [cancelLoading, setCancelLoading] = useState(false);

    // --- Box: Top Sản phẩm Hoàn ---
    const topRefundFilter = useChartFilter(globalFilterState);
    const [refundedProds, setRefundedProds] = useState([]);
    const [refundLoading, setRefundLoading] = useState(false);

    // --- Box: Khung giờ ---
    const hourlyFilter = useChartFilter(globalFilterState);
    const [hourlyData, setHourlyData] = useState([]);
    const [hourlyLoading, setHourlyLoading] = useState(false);

    // --- Box: COD vs Prepayment ---
    const paymentRiskFilter = useChartFilter(globalFilterState);
    const [paymentData, setPaymentData] = useState([]);
    const [paymentLoading, setPaymentLoading] = useState(false);

    // --- Box: GeoMap ---
    const geoFilter = useChartFilter(globalFilterState);
    const [geoData, setGeoData] = useState([]);
    const [geoLoading, setGeoLoading] = useState(false);

    // --- Box: Platform Performance ---
    const platformFilter = useChartFilter(globalFilterState);
    const [platformData, setPlatformData] = useState([]);
    const [platformLoading, setPlatformLoading] = useState(false);
    const [platformViewMode, setPlatformViewMode] = useState('quality'); // 'quality' | 'speed'

    const handlePlatformViewChange = (event, newAlignment) => {
        if (newAlignment !== null) {
            setPlatformViewMode(newAlignment);
        }
    };

    // ==========================================
    // 2. FETCH DATA ĐỘC LẬP
    // ==========================================

    const fetchLocalData = useCallback(async (filter, setData, setLoading, key) => {
        if (!brandSlug) return;
        setLoading(true);
        try {
            const start = filter.dateRange[0].format('YYYY-MM-DD');
            const end = filter.dateRange[1].format('YYYY-MM-DD');
            const sources = filter.selectedSources;

            // Nếu người dùng bỏ chọn hết source -> Set data rỗng ngay, khỏi gọi API
            if (sources && sources.length === 0) {
                setData([]);
                setLoading(false);
                return;
            }

            const response = await fetchOperationKpisAPI(brandSlug, start, end, sources);
            
            // Map dữ liệu dựa theo key
            if (key === 'cancelReasons') {
                setData(Object.entries(response.cancel_reason_breakdown || {}).map(([name, value]) => ({ name, value })));
            } else if (key === 'topRefunded') {
                setData(response.top_refunded_products || []);
            } else if (key === 'hourly') {
                setData(Object.entries(response.hourly_breakdown || {}).map(([hour, count]) => ({ hour: `${hour}h`, count })));
            } else if (key === 'payment') {
                // Biểu đồ stacked cần format [{ name: 'Payment', cod: 100, prepayment: 50 }]
                const breakdown = response.payment_method_breakdown || {};
                const formattedData = Object.entries(breakdown).map(([name, value]) => ({name, value}));
                setData(formattedData);

            } else if (key === 'geo') {
                setData(response.location_distribution || []);
            } else if (key === 'platform') {
                setData(response.platform_comparison || []);
            }
        } catch (err) {
            console.error(`Error fetching ${key}:`, err);
        } finally {
            setLoading(false);
        }
    }, [brandSlug]);

    // Effects gọi lại khi filter của từng box thay đổi
    useEffect(() => { fetchLocalData(cancelReasonFilter, setCancelData, setCancelLoading, 'cancelReasons'); }, [cancelReasonFilter.dateRange, cancelReasonFilter.selectedSources, fetchLocalData]);
    useEffect(() => { fetchLocalData(topRefundFilter, setRefundedProds, setRefundLoading, 'topRefunded'); }, [topRefundFilter.dateRange, topRefundFilter.selectedSources, fetchLocalData]);
    useEffect(() => { fetchLocalData(hourlyFilter, setHourlyData, setHourlyLoading, 'hourly'); }, [hourlyFilter.dateRange, hourlyFilter.selectedSources, fetchLocalData]);
    useEffect(() => { fetchLocalData(paymentRiskFilter, setPaymentData, setPaymentLoading, 'payment'); }, [paymentRiskFilter.dateRange, paymentRiskFilter.selectedSources, fetchLocalData]);
    useEffect(() => { fetchLocalData(geoFilter, setGeoData, setGeoLoading, 'geo'); }, [geoFilter.dateRange, geoFilter.selectedSources, fetchLocalData]);
    useEffect(() => { fetchLocalData(platformFilter, setPlatformData, setPlatformLoading, 'platform'); }, [platformFilter.dateRange, platformFilter.selectedSources, fetchLocalData]);

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
                        initialDateRange={globalDateRange}
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
                <DashboardBox 
                    title="Phân loại Lý do Hủy đơn" 
                    action={<OperationBoxControl filter={cancelReasonFilter} sourceOptions={sourceOptions} title="Chọn nguồn dữ liệu" />}
                >
                    {cancelLoading ? <Skeleton variant="rectangular" width="100%" height="100%" /> : (
                        <DonutChart 
                            data={cancelData} 
                            centerLabel="TỔNG HỦY" 
                            unit=" đơn"
                            formatType="number"
                            height="100%"
                        />
                    )}
                </DashboardBox>
                
                <DashboardBox 
                    title="Top 5 Sản phẩm Hoàn/Bom cao nhất"
                    action={<OperationBoxControl filter={topRefundFilter} sourceOptions={sourceOptions} title="Chọn nguồn dữ liệu" />}
                >
                    {refundLoading ? <Skeleton variant="rectangular" width="100%" height="100%" /> : (
                         refundedProds.length > 0 ? (
                            <HorizontalBarChart 
                                data={refundedProds}
                                dataKey="value"
                                labelKey="name"
                                subLabelKey="sku"
                                unit=" sp"
                                color="#ff6384"
                                height="100%"
                            />
                        ) : <PlaceholderBox label="Chưa có dữ liệu Top Sản phẩm Hoàn" />
                    )}
                </DashboardBox>
            </DashboardRow>

            {/* --- PHƯƠNG THỨC THANH TOÁN & XU HƯỚNG --- */}
            <SectionTitle>Phương thức thanh toán & Xu hướng</SectionTitle>
            <DashboardRow>
                <DashboardBox 
                    title="Phương thức thanh toán"
                    action={<OperationBoxControl filter={paymentRiskFilter} sourceOptions={sourceOptions} title="Chọn nguồn dữ liệu" />}
                >
                    {paymentLoading ? <Skeleton variant="rectangular" width="100%" height="100%" /> : (
                        <HorizontalBarChart
                            data={paymentData}
                            layout="vertical"
                            dataKey="value"
                            labelKey="name"
                            unit=" đơn"
                            color= "#e8d458"
                            height="100%"
                        />
                    )}
                </DashboardBox>
                
                <DashboardBox 
                    title="Phân bổ Đơn hàng theo Khung giờ"
                    action={<OperationBoxControl filter={hourlyFilter} sourceOptions={sourceOptions} title="Chọn nguồn dữ liệu" />}
                >
                    {hourlyLoading ? <Skeleton variant="rectangular" width="100%" height="100%" /> : (
                         hourlyData.length > 0 ? (
                            <HorizontalBarChart 
                                data={hourlyData}
                                layout="horizontal" 
                                dataKey="count"
                                labelKey="hour"
                                unit=" đơn"
                                color={theme.palette.info.main}
                                height="100%"
                            />
                        ) : <PlaceholderBox label="Chưa có dữ liệu Khung giờ" />
                    )}
                </DashboardBox>
            </DashboardRow>

            {/* --- PHÂN BỔ ĐỊA LÝ & NỀN TẢNG --- */}
            <SectionTitle>Phân bổ Địa lý & Nền tảng</SectionTitle>
            <DashboardRow>
                <DashboardBox 
                    title="Bản đồ 'Điểm nóng' Đơn hàng" 
                    height={600}
                    action={<OperationBoxControl filter={geoFilter} sourceOptions={sourceOptions} title="Chọn nguồn dữ liệu" />}
                >
                    {geoLoading ? <Skeleton variant="rectangular" width="100%" height="100%" /> : (
                        <GeoMapChart 
                            data={geoData}
                            valueKey="orders"
                            labelKey="city"
                            unitLabel=" đơn"
                        />
                    )}
                </DashboardBox>
                <DashboardBox 
                    title="Hiệu quả Vận hành theo Sàn" 
                    height={600}
                    loading={platformLoading}
                    hasData={platformData.length > 0}
                    placeholderTitle="Chưa có dữ liệu Vận hành theo Sàn"
                    action={
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            <ToggleButtonGroup
                                value={platformViewMode}
                                exclusive
                                onChange={handlePlatformViewChange}
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
                            <OperationBoxControl filter={platformFilter} sourceOptions={sourceOptions} hideSource={true} />
                        </Box>
                    }
                >
                     {platformViewMode === 'quality' ? (
                         <HorizontalBarChart
                            data={platformData.filter(i => i.platform !== 'Tổng cộng')}
                            layout="vertical"
                            // stacked={true}
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
                            data={platformData.filter(i => i.platform !== 'Tổng cộng')}
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
            </DashboardRow>

        </Box>
    );
}

export default OperationPage;