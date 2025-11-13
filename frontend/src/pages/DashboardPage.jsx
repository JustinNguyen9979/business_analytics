// FILE: frontend/src/pages/DashboardPage.jsx (PHIÊN BẢN HOÀN THIỆN)

import { useTheme } from '@mui/material/styles';
import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Typography, Box, Paper, Divider, CircularProgress, Alert, Button, Stack } from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import dayjs from 'dayjs';
import { getAllBrands } from '../services/api';
import { useAsyncData } from '../hooks/useAsyncData'; 
import DateRangeFilterMenu from '../components/common/DateRangeFilterMenu';
import ChartTimeFilter from '../components/common/ChartTimeFilter';
import { StatItem } from '../components/dashboard/StatItem';
import { kpiGroups } from '../config/dashboardConfig';
import RevenueProfitChart from '../components/charts/RevenueProfitChart';
import TopProductsChart from '../components/charts/TopProductsChart';
import CostDonutChart from '../components/charts/CostDonutChart';
import GeoMapChart from '../components/charts/GeoMapChart';
import ChartPlaceholder from '../components/common/ChartPlaceholder';
import { useLayout } from '../context/LayoutContext';

function DashboardPage() {
    const theme = useTheme();
    const { brandId } = useParams();
    const [brandName, setBrandName] = useState('');
    const [searchParams, setSearchParams] = useSearchParams();
    const { isSidebarOpen } = useLayout();
    
    // --- STATE QUẢN LÝ THỜI GIAN ---
    const [kpiDateRange, setKpiDateRange] = useState(() => {
        const start = searchParams.get('start');
        const end = searchParams.get('end');
        return [
            start ? dayjs(start) : dayjs().subtract(27, 'days').startOf('day'),
            end ? dayjs(end) : dayjs().endOf('day')
        ];
    });
    const [chartDateRange, setChartDateRange] = useState({ range: [dayjs().startOf('year'), dayjs().endOf('year')], type: 'year' });
    const [topProductsDateRange, setTopProductsDateRange] = useState({ range: [dayjs().startOf('year'), dayjs().endOf('year')], type: 'year' });
    const [donutDateRange, setDonutDateRange] = useState({ range: [dayjs().startOf('year'), dayjs().endOf('year')], type: 'year' });
    const [mapDateRange, setMapDateRange] = useState({ range: [dayjs().startOf('year'), dayjs().endOf('year')], type: 'year' });
    const handleChartFilterChange = useCallback((range, type) => {
        setChartDateRange({ range, type });
    }, []); // Không có phụ thuộc, chỉ cần tạo 1 lần

    const handleTopProductsFilterChange = useCallback((range, type) => {
        setTopProductsDateRange({ range, type });
    }, []); // Không có phụ thuộc

    const handleDonutFilterChange = useCallback((range, type) => {
        setDonutDateRange({ range, type });
    }, []); // Không có phụ thuộc

    const handleMapFilterChange = useCallback((range, type) => {
        setMapDateRange({ range, type });
    }, []); // Không có phụ thuộc

    // --- STATE QUẢN LÝ UI ---
    const [kpiAnchorEl, setKpiAnchorEl] = useState(null);
    const [chartRevision, setChartRevision] = useState(0);
    useEffect(() => {
        const fetchBrandName = async () => {
            try {
                const allBrands = await getAllBrands();
                const currentBrand = allBrands.find(b => b.id === parseInt(brandId));
                if (currentBrand) {
                    setBrandName(currentBrand.name);
                }
            } catch (error) {
                console.error("Lỗi khi lấy tên brand:", error);
            }
        };
        fetchBrandName();
    }, [brandId]);

    useEffect(() => {
        const timer = setTimeout(() => setChartRevision(prev => prev + 1), 300);
        return () => clearTimeout(timer);
    }, [isSidebarOpen]);

    // --- GỌI DỮ LIỆU BẰNG HOOK BẤT ĐỒNG BỘ DUY NHẤT ---
    const { data: kpiData, isLoading: isKpiLoading, error: kpiError } = useAsyncData('kpi_summary', brandId, kpiDateRange);
    const { data: chartApiResponse, isLoading: isChartLoading, error: chartError } = useAsyncData('daily_kpis_chart', brandId, chartDateRange.range);
    const { data: topProductsData, isLoading: isTopProductsLoading, error: topProductsError } = useAsyncData('top_products', brandId, topProductsDateRange.range);
    const { data: donutData, isLoading: isDonutLoading, error: donutError } = useAsyncData('kpi_summary', brandId, donutDateRange.range);
    const { data: mapData, isLoading: isMapLoading, error: mapError } = useAsyncData('customer_map', brandId, mapDateRange.range);
    
    // Xử lý dữ liệu biểu đồ sau khi nhận được từ API
    const chartData = chartApiResponse ? chartApiResponse.data : [];

    // --- CÁC HÀM HANDLER (Không thay đổi) ---
    const handleOpenKpiFilter = (event) => setKpiAnchorEl(event.currentTarget);
    const handleCloseKpiFilter = () => setKpiAnchorEl(null);
    const handleApplyKpiFilter = useCallback((newRange) => {
        setKpiDateRange(newRange);
        setSearchParams({ start: newRange[0].format('YYYY-MM-DD'), end: newRange[1].format('YYYY-MM-DD') });
        handleCloseKpiFilter();
    }, [setSearchParams]);

    // --- PHẦN RENDER GIAO DIỆN ---
    const anyError = kpiError || chartError || topProductsError || donutError || mapError;
    if (anyError) return <Alert severity="error" sx={{ m: 4 }}>{anyError}</Alert>;

    return (
        <Box sx={{ px: 4 }} >
            <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
                {brandName ? `Báo cáo Kinh doanh: ${brandName}` : 'Đang tải...'}
            </Typography>
            
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
                
                <Box sx={{ minHeight: 360, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {isKpiLoading ? (
                        // 1. NẾU ĐANG LOADING: Hiển thị vòng quay
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : kpiData ? (
                        // 2. NẾU KHÔNG LOADING VÀ CÓ DỮ LIỆU: Hiển thị bảng
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
                                                value={kpiData[kpi.key]}
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
                        <ChartPlaceholder title="Chỉ số Hiệu suất" />
                    )}
                </Box>
            </Paper>

            <Paper variant="glass" elevation={0} sx={{ p: 1, mb: 4 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, px: 3, pt: 3 }}>
                    <Typography variant="h6" noWrap>Biểu đồ Doanh thu ròng & Lợi nhuận</Typography>
                    <ChartTimeFilter onFilterChange={handleChartFilterChange} />
                </Box>
                
                <Box sx={{ pb: 3, pt: 1, height: 450, position: 'relative' }}>
                    {isChartLoading ? <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box> : (
                        
                        // BẮT ĐẦU SỬA
                        chartData && chartData.length > 0 ? (
                        // KẾT THÚC SỬA

                            <RevenueProfitChart 
                                data={chartData} 
                                chartRevision={chartRevision}
                                aggregationType={chartDateRange.type}
                            />
                        ) : <ChartPlaceholder title="Doanh thu & Lợi nhuận" />
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
                                <ChartTimeFilter onFilterChange={handleDonutFilterChange} />
                            </Box>
                            <Box sx={{ flexGrow: 1, minHeight: 400, position: 'relative' }}>
                                {isDonutLoading ? ( <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><CircularProgress /></Box> ) 
                                
                                // BẮT ĐẦU SỬA
                                : donutData ? ( 
                                // KẾT THÚC SỬA

                                    <CostDonutChart cogs={donutData.cogs} executionCost={donutData.executionCost} adSpend={donutData.adSpend} /> 
                                ) : ( 
                                    <ChartPlaceholder title="Phân bổ Chi phí"/> 
                                )}
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
                            flexDirection: 'column',
                            minHeight: { xs: 900, md: '100%' }
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


