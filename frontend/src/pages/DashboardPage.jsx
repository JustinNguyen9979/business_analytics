// FILE: frontend/src/pages/DashboardPage.jsx (PHIÊN BẢN SỬA LỖI anchorEl)

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, useOutletContext } from 'react-router-dom';
import { 
    Typography, Box, Grid, Paper, Divider, CircularProgress, 
    Alert, Button, useTheme
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { useLayout } from '../context/LayoutContext';
import { getBrandDetails, getBrandDailyKpis } from '../services/api';
import { StatItem } from '../components/dashboard/StatItem';
import { kpiGroups } from '../config/dashboardConfig';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import RevenueProfitChart from '../components/charts/RevenueProfitChart';
import ChartPlaceholder from '../components/common/ChartPlaceholder';
import DateRangeFilterMenu from '../components/common/DateRangeFilterMenu';

const getPreviousPeriod = (startDate, endDate) => {
    if (!startDate || !endDate) return [null, null];

    const duration = endDate.diff(startDate, 'day') + 1;

    // Logic mới: Trừ đi đúng khoảng thời gian (số ngày, tháng, năm) thay vì chỉ số ngày
    const prevEndDate = startDate.clone().subtract(1, 'day');
    const prevStartDate = prevEndDate.clone().subtract(duration - 1, 'day');
    
    return [prevStartDate.startOf('day'), prevEndDate.endOf('day')];
};

function DashboardPage() {
    const { brandId } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const theme = useTheme(); 

    const initializeDateRange = () => {
        const start = searchParams.get('start');
        const end = searchParams.get('end');
        if (start && end && dayjs(start).isValid() && dayjs(end).isValid()) {
            return [dayjs(start), dayjs(end)];
        }
        return [dayjs().startOf('year'), dayjs()];
    };

    const [brandInfo, setBrandInfo] = useState({ name: '' });
    const [currentKpis, setCurrentKpis] = useState(null);
    const [previousKpis, setPreviousKpis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dailyChartData, setDailyChartData] = useState([]);
    const [customDateRange, setCustomDateRange] = useState(initializeDateRange);
    const [previousDailyChartData, setPreviousDailyChartData] = useState([]);
    const [chartRevision, setChartRevision] = useState(0);
    const { isSidebarOpen } = useLayout();
    
    // Chỉ sử dụng anchorEl để điều khiển Menu
    const [anchorEl, setAnchorEl] = useState(null);
    const openFilter = Boolean(anchorEl);
    
    // === CÁC HÀM XỬ LÝ SỰ KIỆN ===
    const handleOpenFilterMenu = (event) => {
        setAnchorEl(event.currentTarget);
    };
    const handleCloseFilterMenu = () => {
        setAnchorEl(null);
    };

    const updateUrl = (newDateRange) => {
        setSearchParams({
            start: dayjs(newDateRange[0]).format('YYYY-MM-DD'),
            end: dayjs(newDateRange[1]).format('YYYY-MM-DD'),
        });
    };

    const handleApplyFilter = (newRange) => {
        setCustomDateRange(newRange);
        updateUrl(newRange);
        handleCloseFilterMenu(); // Đóng menu sau khi áp dụng
    };

    useEffect(() => {
        // Đặt một khoảng trễ nhỏ để chờ animation của sidebar hoàn tất
        const timer = setTimeout(() => {
            // Tăng giá trị revision để buộc biểu đồ phải vẽ lại
            setChartRevision(prev => prev + 1);
        }, 300); // 300ms là đủ cho hầu hết các animation

        return () => clearTimeout(timer);
    }, [isSidebarOpen]);

    // === HÀM LẤY DỮ LIỆU TỪ API (giữ nguyên) ===
    useEffect(() => {
        const fetchAllData = async () => {
            if (!brandId || !customDateRange[0] || !customDateRange[1]) return;
            setLoading(true);
            setError(null);
            const [currentStart, currentEnd] = customDateRange;
            const [prevStart, prevEnd] = getPreviousPeriod(currentStart, currentEnd);

            try {
                const [ 
                    currentDataResponse, 
                    previousDataResponse, 
                    dailyDataResponse, 
                    previousDailyDataResponse 
                ] = await Promise.all([
                    // 1. Lấy KPI kỳ hiện tại
                    getBrandDetails(brandId, currentStart, currentEnd),
                    // 2. Lấy KPI kỳ trước
                    (prevStart && prevEnd) ? getBrandDetails(brandId, prevStart, prevEnd) : Promise.resolve(null),
                    // 3. Lấy dữ liệu biểu đồ kỳ hiện tại
                    getBrandDailyKpis(brandId, currentStart, currentEnd),
                    // 4. Lấy dữ liệu biểu đồ kỳ trước
                    (prevStart && prevEnd) ? getBrandDailyKpis(brandId, prevStart, prevEnd) : Promise.resolve(null)
                ]);

                if (currentDataResponse) {
                    setBrandInfo({ id: currentDataResponse.id, name: currentDataResponse.name });
                    setCurrentKpis(currentDataResponse.kpis);
                }

                setPreviousKpis(previousDataResponse ? previousDataResponse.kpis : null);
                setDailyChartData(dailyDataResponse || []);
                setPreviousDailyChartData(previousDailyDataResponse || []);

            } catch (err) {
                console.error("Lỗi khi fetch chi tiết brand:", err);
                if (err.response && err.response.status === 404) { navigate('/'); } 
                else { setError(`Không thể tải dữ liệu cho brand ID: ${brandId}. Vui lòng thử lại.`); }
            } finally {
                setLoading(false);
            }
        };
        fetchAllData();
    }, [brandId, customDateRange, navigate]);

    // === CÁC TRẠNG THÁI RENDER ===
    if (loading) { return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><CircularProgress /></Box>; }
    if (error) { return <Alert severity="error">{error}</Alert>; }
    if (!currentKpis || !brandInfo.name) { return null; }

    // === PHẦN GIAO DIỆN (JSX) ===
    return (
        <Box sx={{ px: 1, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: 700 }}>
                Báo cáo Kinh doanh: {brandInfo.name}
            </Typography>
            
            <Paper variant="glass" elevation={0} sx={{ p: 3, mb: 4 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2 }}>
                    <Typography variant="h6" noWrap>Chỉ số Hiệu suất Tổng thể</Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body1" color="text.secondary">
                           {`${dayjs(customDateRange[0]).format('DD/MM/YYYY')} - ${dayjs(customDateRange[1]).format('DD/MM/YYYY')}`}
                        </Typography>
                        <Button variant="outlined" onClick={handleOpenFilterMenu} startIcon={<CalendarMonthIcon />}>
                            Bộ lọc
                        </Button>
                    </Box>
                </Box>
                
                <Divider sx={{ mb: 3 }} />
                
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
                    {kpiGroups.map((group, groupIndex) => (
                        <Box key={group.groupTitle} sx={{ 
                            p: 2, 
                            borderRight: { md: (groupIndex + 1) % 4 !== 0 && groupIndex < kpiGroups.length - 1 ? `1px solid ${theme.palette.divider}` : 'none' }, 
                            borderBottom: { xs: groupIndex < kpiGroups.length - 1 ? `1px solid ${theme.palette.divider}` : 'none', md: 'none' } 
                        }}>
                            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 2, fontWeight: 600, fontSize: '0.875rem', textAlign: 'center' }}>
                                {group.groupTitle}
                            </Typography>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 3, textAlign: 'left' }}>
                                {group.items.map((kpi) => (
                                    <StatItem 
                                        key={kpi.key} 
                                        title={kpi.title} 
                                        value={currentKpis ? currentKpis[kpi.key] : 0} 
                                        previousValue={previousKpis ? previousKpis[kpi.key] : 0}
                                        format={kpi.format}
                                        tooltipText={kpi.tooltipText}
                                        direction={kpi.direction}
                                    />
                                ))}
                            </Box>
                        </Box>
                    ))}
                </Box>
            </Paper>

            <Box sx={{ width: '100%', mt: 1 }}>
                {dailyChartData && dailyChartData.length > 0 ? (
                    <RevenueProfitChart 
                        data={dailyChartData} 
                        comparisonData={previousDailyChartData} 
                        // <<< THAY ĐỔI 5: Truyền "lệnh làm mới" xuống biểu đồ >>>
                        chartRevision={chartRevision}
                    />
                ) : (
                    <ChartPlaceholder title="Biểu đồ Doanh thu ròng & Lợi nhuận" />
                )}
            </Box>
            
            <DateRangeFilterMenu
                open={openFilter}
                anchorEl={anchorEl}
                onClose={handleCloseFilterMenu}
                initialDateRange={customDateRange}
                onApply={handleApplyFilter}
            />
        </Box>
    );
}

export default DashboardPage;