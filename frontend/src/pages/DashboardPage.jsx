// FILE: frontend/src/pages/DashboardPage.jsx (PHIÊN BẢN HOÀN THIỆN)

import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Typography, Box, Paper, Divider, CircularProgress, Alert, Button, Grid, Stack } from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import dayjs from 'dayjs';
import CostDonutChart from '../components/charts/CostDonutChart';
import { useDashboardData } from '../components/dashboard/useDashboardData';
import { useTheme } from '@mui/material/styles';
import { useLayout } from '../context/LayoutContext';
import { StatItem } from '../components/dashboard/StatItem';
import { kpiGroups } from '../config/dashboardConfig';

import RevenueProfitChart from '../components/charts/RevenueProfitChart';
import TopProductsChart from '../components/charts/TopProductsChart';
import ChartPlaceholder from '../components/common/ChartPlaceholder';
import DateRangeFilterMenu from '../components/common/DateRangeFilterMenu';
import ChartTimeFilter from '../components/common/ChartTimeFilter';
import { getBrandDetails, getBrandDailyKpis, getTopProducts } from '../services/api';
import GeoMapChart from '../components/charts/GeoMapChart';
import { getCustomerDistribution } from '../services/api';

function DashboardPage() {
    const theme = useTheme();
    const { brandId } = useParams();
    const { isSidebarOpen } = useLayout();
    const [searchParams, setSearchParams] = useSearchParams();
    
    // --- STATE QUẢN LÝ LỰA CHỌN CỦA NGƯỜI DÙNG ---
    const [kpiDateRange, setKpiDateRange] = useState(() => {
        const start = searchParams.get('start');
        const end = searchParams.get('end');
        return (start && end) ? [dayjs(start), dayjs(end)] : [dayjs().subtract(27, 'days').startOf('day'), dayjs().endOf('day')];
    });
    const [chartDateRange, setChartDateRange] = useState({
        range: [dayjs().startOf('year'), dayjs().endOf('year')],
        type: 'year'
    });

    // === THÊM MỚI: State và Handler riêng cho Donut Chart ===
    const [donutChartDateRange, setDonutChartDateRange] = useState({
        range: [dayjs().startOf('year'), dayjs().endOf('year')],
        type: 'year'
    });
    const [donutChartKpiData, setDonutChartKpiData] = useState(null);
    const [isDonutChartLoading, setIsDonutChartLoading] = useState(true);

    const handleDonutChartFilterChange = useCallback((newRange, type) => {
        setDonutChartDateRange({ range: newRange, type: type });
    }, []);
    
    // State cho UI Popover/Menu
    const [kpiAnchorEl, setKpiAnchorEl] = useState(null);
    const [chartRevision, setChartRevision] = useState(0);

    // 2. GỌI CUSTOM HOOK ĐỂ LẤY TOÀN BỘ DỮ LIỆU VÀ TRẠNG THÁI
    const { loading, error, brandInfo, kpiData, chartData } = useDashboardData(
        brandId,
        kpiDateRange,
        chartDateRange
    );

    // 2. Thêm các state mới để quản lý dữ liệu và bộ lọc cho bản đồ
    const [mapDateRange, setMapDateRange] = useState({
        range: [dayjs().startOf('year'), dayjs().endOf('year')],
        type: 'year'
    });
    const [mapData, setMapData] = useState([]);
    const [isMapLoading, setIsMapLoading] = useState(true);

    const handleMapFilterChange = useCallback((newRange, type) => {
        setMapDateRange({ range: newRange, type: type });
    }, []);

    // 3. Thêm useEffect để tải dữ liệu cho bản đồ
    useEffect(() => {
        const fetchMapData = async () => {
            if (!brandId) return;
            setIsMapLoading(true);
            try {
                const [start, end] = mapDateRange.range;
                const data = await getCustomerDistribution(brandId, start, end);
                setMapData(data);
            } catch (err) {
                console.error("Lỗi khi tải dữ liệu bản đồ:", err);
                setMapData([]);
            } finally {
                setIsMapLoading(false);
            }
        };

        fetchMapData();
    }, [brandId, mapDateRange]);

    // --- CÁC HÀM XỬ LÝ SỰ KIỆN CỦA UI (KHÔNG THAY ĐỔI) ---
    const handleOpenKpiFilter = (event) => setKpiAnchorEl(event.currentTarget);
    const handleCloseKpiFilter = () => setKpiAnchorEl(null);
    const handleApplyKpiFilter = (newRange) => {
        setKpiDateRange(newRange);
        setSearchParams({ start: newRange[0].format('YYYY-MM-DD'), end: newRange[1].format('YYYY-MM-DD') });
        handleCloseKpiFilter();
    };
    const handleChartFilterChange = useCallback((newRange, type) => {
        setChartDateRange({ range: newRange, type: type });
    }, []);

    const [topProductsDateRange, setTopProductsDateRange] = useState({
        range: [dayjs().startOf('year'), dayjs().endOf('year')],
        type: 'year'
    });
    const [topProductsData, setTopProductsData] = useState([]);
    const [isTopProductsLoading, setIsTopProductsLoading] = useState(true);

    const handleTopProductsFilterChange = useCallback((newRange, type) => {
        setTopProductsDateRange({ range: newRange, type: type });
    }, []);

    useEffect(() => {
        const fetchTopProducts = async () => {
            if (!brandId) return;
            setIsTopProductsLoading(true);
            try {
                const [start, end] = topProductsDateRange.range;
                const data = await getTopProducts(brandId, start, end, 10);
                setTopProductsData(data);
            } catch (err) {
                console.error("Lỗi khi tải Top Products:", err);
                setTopProductsData([]);
            } finally {
                setIsTopProductsLoading(false);
            }
        };

        fetchTopProducts();
    }, [brandId, topProductsDateRange]);



    // Effect để vẽ lại biểu đồ khi sidebar thay đổi (không thay đổi)
    useEffect(() => {
        const timer = setTimeout(() => setChartRevision(prev => prev + 1), 300);
        return () => clearTimeout(timer);
    }, [isSidebarOpen]);

    useEffect(() => {
        const fetchDonutData = async () => {
            if (!brandId) return;
            setIsDonutChartLoading(true);
            try {
                const [start, end] = donutChartDateRange.range;
                const data = await getBrandDetails(brandId, start, end);
                setDonutChartKpiData(data ? data.kpis : null);
            } catch (err) {
                console.error("Lỗi khi tải dữ liệu Donut Chart:", err);
                setDonutChartKpiData(null); // Reset khi có lỗi
            } finally {
                setIsDonutChartLoading(false);
            }
        };

        fetchDonutData();
    }, [brandId, donutChartDateRange]);

    // --- PHẦN RENDER GIAO DIỆN ---
    if (error) return <Alert severity="error">{error}</Alert>;
    // 3. SỬ DỤNG KẾT QUẢ TRẢ VỀ TỪ HOOK
    if (loading && !kpiData.current) { 
        return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>; 
    }

    return (
        <Box sx={{ px: 4 }} >
            <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>{brandInfo.name ? `Báo cáo Kinh doanh: ${brandInfo.name}` : ''}</Typography>
            
            <Paper variant="glass" elevation={0} sx={{ p: 3, mb: 4 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }} noWrap>Chỉ số Hiệu suất Tổng thể</Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body1" color="text.secondary">
                           {`${kpiDateRange[0].format('DD/MM/YYYY')} - ${kpiDateRange[1].format('DD/MM/YYYY')}`}
                        </Typography>
                        <Button variant="outlined" onClick={handleOpenKpiFilter} startIcon={<CalendarMonthIcon />}>
                            Bộ lọc
                        </Button>
                    </Box>
                </Box>
                
                <Divider sx={{ mb: 3 }} />
                
                {kpiData.current ? (
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
                                    {group.items.map((kpi) => (
                                        <StatItem 
                                            key={kpi.key} 
                                            title={kpi.title} 
                                            value={kpiData.current[kpi.key]} 
                                            previousValue={kpiData.previous ? kpiData.previous[kpi.key] : 0}
                                            format={kpi.format}
                                            tooltipText={kpi.tooltipText}
                                            direction={kpi.direction}
                                        />
                                    ))}
                                </Box>
                            </Box>
                        ))}
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
                )}
            </Paper>

            <Paper variant="glass" elevation={0} sx={{ p: 1, mb: 4 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, px: 3, pt: 3 }}>
                    <Typography variant="h6" noWrap>Biểu đồ Doanh thu ròng & Lợi nhuận</Typography>
                    <ChartTimeFilter onFilterChange={handleChartFilterChange} />
                </Box>
                
                <Box sx={{ pb: 3, pt: 1 }}>
                    {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', height: 450 }}><CircularProgress /></Box> : (
                        chartData.current.length > 0 ? (
                            <RevenueProfitChart 
                                data={chartData.current} 
                                comparisonData={chartData.previous}
                                chartRevision={chartRevision}
                                filterType={chartDateRange.type}
                                dateRange={chartDateRange.range}
                                aggregationType={chartData.aggregationType}
                            />
                        ) : <ChartPlaceholder />
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
                        {/* KHỐI 1: DONUT CHART - Tái sử dụng variant="glass" */}
                        <Paper variant="glass" elevation={0} sx={{ p: 1, display: 'flex', flexDirection: 'column' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, px: 2, pt: 2 }}>
                                <Typography variant="h6" noWrap>Phân bổ Chi phí</Typography>
                                <ChartTimeFilter onFilterChange={handleDonutChartFilterChange} />
                            </Box>
                            <Box sx={{ flexGrow: 1, minHeight: 400, position: 'relative' }}>
                                {isDonutChartLoading ? ( <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><CircularProgress /></Box> ) : donutChartKpiData ? ( <CostDonutChart cogs={donutChartKpiData.cogs} executionCost={donutChartKpiData.executionCost} adSpend={donutChartKpiData.adSpend} /> ) : ( <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Typography color="text.secondary">Không có dữ liệu.</Typography></Box> )}
                            </Box>
                        </Paper>

                        {/* KHỐI 2: TOP PRODUCTS CHART - Tái sử dụng variant="glass" */}
                        <Paper variant="glass" elevation={0} sx={{ p: 1, display: 'flex', flexDirection: 'column' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, px: 2, pt: 2 }}>
                                <Typography variant="h6" noWrap>Top SKU bán chạy</Typography>
                                <ChartTimeFilter onFilterChange={handleTopProductsFilterChange} />
                            </Box>
                            <Box sx={{ flexGrow: 1, minHeight: 600, position: 'relative' }}>
                                {isTopProductsLoading ? ( <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><CircularProgress /></Box> ) : ( <TopProductsChart data={topProductsData} /> )}
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
                            flexDirection: 'column'
                        }}
                    >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, px: 2, pt: 2 }}>
                            <Typography variant="h6" noWrap>Phân bổ Khách hàng</Typography>
                            <ChartTimeFilter onFilterChange={handleMapFilterChange} />
                        </Box>
                        <Box sx={{ flexGrow: 1, minHeight: { xs: 500, lg: 'auto' }, position: 'relative' }}>
                            {isMapLoading ? 
                                (<Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><CircularProgress /></Box>) 
                                : 
                                (<GeoMapChart data={mapData} />)
                            }
                        </Box>
                    </Paper>
                </Box>
            </Box>
            
            
            <DateRangeFilterMenu
                open={Boolean(kpiAnchorEl)}
                anchorEl={kpiAnchorEl}
                onClose={handleCloseKpiFilter}
                initialDateRange={kpiDateRange}
                onApply={handleApplyKpiFilter}
            />
        </Box>
    );
}

export default DashboardPage;


