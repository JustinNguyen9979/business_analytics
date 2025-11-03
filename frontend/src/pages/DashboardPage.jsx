// FILE: frontend/src/pages/DashboardPage.jsx 

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
    Typography, Box, Grid, Paper, Divider, CircularProgress, 
    Alert, Button, Popover, List, ListItemButton, ListItemText, useTheme 
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { StaticDatePicker } from '@mui/x-date-pickers/StaticDatePicker';
import { getBrandDetails, getBrandDailyKpis } from '../services/api';
import { StatItem } from '../components/dashboard/StatItem';
import { kpiGroups, dateShortcuts } from '../config/dashboardConfig';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import RevenueProfitChart from '../components/charts/RevenueProfitChart';
import ChartPlaceholder from '../components/common/ChartPlaceholder';


// Hàm getPreviousPeriod đã được đơn giản hóa
const getPreviousPeriod = (startDate, endDate) => {
    if (!startDate || !endDate) return [null, null];
    const diff = endDate.diff(startDate, 'day');
    const prevEndDate = startDate.subtract(1, 'day').endOf('day');
    const prevStartDate = prevEndDate.subtract(diff, 'day').startOf('day');
    return [prevStartDate, prevEndDate];
};

function DashboardPage() {
    const { brandId } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const theme = useTheme(); 

    const [dailyChartData, setDailyChartData] = useState([]);

    const initializeDateRange = () => {
        const start = searchParams.get('start');
        const end = searchParams.get('end');
        if (start && end && dayjs(start).isValid() && dayjs(end).isValid()) {
            return [dayjs(start), dayjs(end)];
        }
        return [dayjs().startOf('year'), dayjs()];
    };

    // === CÁC STATE CẦN THIẾT ===
    const [brandInfo, setBrandInfo] = useState({ name: '' });
    const [currentKpis, setCurrentKpis] = useState(null);
    const [previousKpis, setPreviousKpis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [customDateRange, setCustomDateRange] = useState(initializeDateRange);
    const [tempDateRange, setTempDateRange] = useState(customDateRange);
    const [anchorEl, setAnchorEl] = useState(null);

    // === CÁC HÀM XỬ LÝ SỰ KIỆN ===
    const handleOpenPicker = (event) => {
        setTempDateRange(customDateRange);
        setAnchorEl(event.currentTarget);
    };
    const handleClosePicker = () => setAnchorEl(null);
    const openPicker = Boolean(anchorEl);

    const updateUrl = (newDateRange) => {
        setSearchParams({
            start: dayjs(newDateRange[0]).format('YYYY-MM-DD'),
            end: dayjs(newDateRange[1]).format('YYYY-MM-DD'),
        });
    };

    const handleShortcutClick = (getValue) => {
        const newRange = getValue();
        setCustomDateRange(newRange);
        updateUrl(newRange);
        handleClosePicker();
    };

    const handleApplyCustomDate = () => {
        setCustomDateRange(tempDateRange);
        updateUrl(tempDateRange);
        handleClosePicker();
    };

    // === HÀM LẤY DỮ LIỆU TỪ API ===
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
                    dailyDataResponse
                ] = await Promise.all([
                    getBrandDetails(brandId, currentStart, currentEnd),
                    (prevStart && prevEnd) ? getBrandDetails(brandId, prevStart, prevEnd) : Promise.resolve(null),
                    getBrandDailyKpis(brandId, currentStart, currentEnd)
                ]);

                if (currentDataResponse) {
                    setBrandInfo({ id: currentDataResponse.id, name: currentDataResponse.name });
                    setCurrentKpis(currentDataResponse.kpis);
                }

                setPreviousKpis(previousDataResponse ? previousDataResponse.kpis : null);
                setDailyChartData(dailyDataResponse || []);

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
        <Box sx={{ px: 1 }}>
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
                        <Button variant="outlined" onClick={handleOpenPicker} startIcon={<CalendarMonthIcon />}>
                            Bộ lọc
                        </Button>
                        <Popover
                            open={openPicker}
                            anchorEl={anchorEl}
                            onClose={handleClosePicker}
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                            PaperProps={{ sx: { mt: 1, borderRadius: 3, backdropFilter: 'blur(15px)', backgroundColor: 'rgba(30, 41, 59, 0.8)' } }}
                        >
                            <Box sx={{ display: 'flex' }}>
                                {/* Cột trái: Chỉ chứa các lựa chọn nhanh */}
                                <Box sx={{ borderRight: 1, borderColor: 'divider', width: 160 }}>
                                    <List>
                                        {dateShortcuts.map(({ label, getValue }) => (
                                            <ListItemButton key={label} onClick={() => handleShortcutClick(getValue)}>
                                                <ListItemText primary={label} />
                                            </ListItemButton>
                                        ))}
                                    </List>
                                </Box>
                                
                                {/* <<< BƯỚC 2: TÁI CẤU TRÚC CỘT PHẢI ĐỂ CHỨA CẢ LỊCH VÀ NÚT ÁP DỤNG >>> */}
                                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                    {/* Phần lịch */}
                                    <Box sx={{ display: 'flex' }}>
                                        <StaticDatePicker
                                            displayStaticWrapperAs="desktop"
                                            value={tempDateRange[0]}
                                            onChange={(newValue) => {
                                                const newRange = [newValue, tempDateRange[1]];
                                                if (newValue.isAfter(tempDateRange[1])) {
                                                    newRange[1] = newValue;
                                                }
                                                setTempDateRange(newRange);
                                            }}
                                            maxDate={tempDateRange[1]}
                                            views={['year', 'month', 'day']}
                                            slotProps={{ 
                                                actionBar: { actions: [] },
                                                calendarHeader: {
                                                    sx: {
                                                        '& .MuiPickersArrowSwitcher-button': { color: 'text.secondary' },
                                                        '& .MuiPickersCalendarHeader-label': { color: 'text.primary' },
                                                        '& .MuiPickersCalendarHeader-switchViewIcon': { color: 'text.secondary' },
                                                    }
                                                }
                                            }}
                                        />
                                        <StaticDatePicker
                                            displayStaticWrapperAs="desktop"
                                            value={tempDateRange[1]}
                                            onChange={(newValue) => setTempDateRange([tempDateRange[0], newValue])}
                                            minDate={tempDateRange[0]}
                                            views={['year', 'month', 'day']}
                                            slotProps={{ 
                                                actionBar: { actions: [] },
                                                calendarHeader: {
                                                    sx: {
                                                        '& .MuiPickersArrowSwitcher-button': { color: 'text.secondary' },
                                                        '& .MuiPickersCalendarHeader-label': { color: 'text.primary' },
                                                        '& .MuiPickersCalendarHeader-switchViewIcon': { color: 'text.secondary' },
                                                    }
                                                }
                                            }}
                                        />
                                    </Box>
                                    
                                    {/* Phần nút Áp dụng được đặt ở dưới */}
                                    <Box sx={{ p: 2, pt: 1, display: 'flex', justifyContent: 'flex-end', borderTop: 1, borderColor: 'divider' }}>
                                        <Button variant="contained" onClick={handleApplyCustomDate}>Áp dụng</Button>
                                    </Box>
                                </Box>
                            </Box>
                        </Popover>
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

            <Grid container spacing={3} >
                    <Grid item xs={12}>
                        {/* <<< BƯỚC 3: KIỂM TRA DỮ LIỆU BIỂU ĐỒ TRƯỚC KHI RENDER >>> */}
                        {dailyChartData && dailyChartData.length > 0 ? (
                            <RevenueProfitChart data={dailyChartData} />
                        ) : (
                            // Nếu không có dữ liệu, hiển thị placeholder
                            <ChartPlaceholder title="Biểu đồ Doanh thu & Lợi nhuận" />
                        )}
                    </Grid>
                </Grid>
        </Box>
    );
}

export default DashboardPage;