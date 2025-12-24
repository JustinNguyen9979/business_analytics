import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '@mui/material/styles';
import { 
    MonetizationOn as MonetizationOnIcon,
    TrendingUp as TrendingUpIcon,
    AccountBalanceWallet as AccountBalanceWalletIcon,
    StackedLineChart as StackedLineChartIcon,
    AttachMoney as AttachMoneyIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { dateShortcuts } from '../config/dashboardConfig';
import { useDashboardData } from './useDashboardData';
import { useFinanceData } from './useFinanceData';
import { getSourcesForBrand } from '../services/api';
import { useBrand } from '../context/BrandContext';

// Giá trị mặc định
const defaultDateRange = dateShortcuts.find(s => s.type === 'this_month').getValue();
const defaultDateLabel = dateShortcuts.find(s => s.type === 'this_month').label;

export const useFinancePageLogic = () => {
    const theme = useTheme();
    const { slug: brandSlug } = useBrand();

    // --- STATE ---
    const [sourceOptions, setSourceOptions] = useState([]);
    const [selectedSources, setSelectedSources] = useState(['all']); // Dùng cho Line Chart
    const [barSelectedSources, setBarSelectedSources] = useState(['all']); // Dùng riêng cho Bar Chart
    
    // State riêng cho Line Chart
    const [isLineConfigOpen, setIsLineConfigOpen] = useState(false);
    const [lineVisibleKeys, setLineVisibleKeys] = useState(['net_revenue', 'profit']);

    // State riêng cho Bar Chart
    const [isBarConfigOpen, setIsBarConfigOpen] = useState(false);
    const [barVisibleKeys, setBarVisibleKeys] = useState([]); // Sẽ set default trong useEffect

    const [filterType, setFilterType] = useState('this_month');
    const [dateRange, setDateRange] = useState(defaultDateRange);
    const [dateLabel, setDateLabel] = useState(defaultDateLabel);
    const [anchorEl, setAnchorEl] = useState(null);

    // --- CHART CONFIGS ---
    const allAvailableSeries = useMemo(() => [
        { key: 'gmv', name: 'GMV', color: theme.palette.warning.main },
        { key: 'net_revenue', name: 'Doanh thu ròng', color: theme.palette.primary.main },
        { key: 'profit', name: 'Lợi nhuận', color: '#28a545' },
        { key: 'total_cost', name: 'Tổng Chi phí', color: theme.palette.error.main },
        { key: 'cogs', name: 'Giá vốn', color: '#e17e1b' },
        { key: 'ad_spend', name: 'Chi phí Ads', color: '#1f1fddcc' },
        { key: 'execution_cost', name: 'Chi phí thực thi', color: '#9C27B0' },
    ], [theme]);

    // Set default cho Bar Chart (Hiện tất cả)
    useEffect(() => {
        if (allAvailableSeries.length > 0 && barVisibleKeys.length === 0) {
            setBarVisibleKeys(allAvailableSeries.map(s => s.key));
        }
    }, [allAvailableSeries]);

    // Fetch Source Options
    useEffect(() => {
        const fetchSources = async () => {
            if (brandSlug) {
                try {
                    const sources = await getSourcesForBrand(brandSlug);
                    const formattedSources = sources.map(s => ({ 
                        label: s.charAt(0).toUpperCase() + s.slice(1), 
                        value: s 
                    }));
                    setSourceOptions(formattedSources);
                } catch (error) {
                    console.error("Failed to fetch sources:", error);
                }
            }
        };
        fetchSources();
    }, [brandSlug]);

    // --- HANDLERS ---
    // Toggle Source cho Line Chart (Logic Select All chuẩn Excel)
    const handleToggleSource = (sourceValue) => {
        setSelectedSources(prev => {
            const allValues = sourceOptions.map(o => o.value);
            
            // 1. Nếu click vào nút "Tất cả"
            if (sourceValue === 'all') {
                // Nếu đang có 'all' (đang chọn hết) -> Click thì Bỏ hết
                if (prev.includes('all')) {
                    return []; 
                }
                // Ngược lại -> Chọn hết
                return ['all', ...allValues];
            }

            // 2. Nếu click vào một source cụ thể
            // Trước tiên, mở rộng 'all' thành list đầy đủ nếu cần để dễ xử lý
            let currentSelection = prev.includes('all') 
                ? ['all', ...allValues] 
                : [...prev];

            if (currentSelection.includes(sourceValue)) {
                // Đang chọn -> Bỏ chọn source đó
                currentSelection = currentSelection.filter(v => v !== sourceValue);
                // Bắt buộc bỏ cờ 'all' vì không còn đủ bộ
                currentSelection = currentSelection.filter(v => v !== 'all');
            } else {
                // Chưa chọn -> Chọn thêm
                currentSelection.push(sourceValue);
            }

            // 3. Kiểm tra xem đã đủ bộ chưa để tự động bật lại 'all'
            const rawSources = currentSelection.filter(v => v !== 'all');
            // Nếu số lượng source chọn == tổng số source option
            if (rawSources.length === allValues.length && allValues.length > 0) {
                return ['all', ...rawSources];
            }

            // Trả về danh sách unique (đề phòng trùng lặp)
            return [...new Set(rawSources)];
        });
    };

    // Toggle Source cho Bar Chart (MỚI)
    const handleToggleBarSource = (sourceValue) => {
        setBarSelectedSources(prev => {
            if (sourceValue === 'all') {
                return ['all'];
            }
            if (prev.includes('all')) {
                return [sourceValue];
            }
            if (prev.includes(sourceValue)) {
                const newSelection = prev.filter(v => v !== sourceValue);
                return newSelection.length === 0 ? ['all'] : newSelection;
            } else {
                return [...prev, sourceValue];
            }
        });
    };

    const handleOpenFilter = (event) => setAnchorEl(event.currentTarget);
    const handleCloseFilter = () => setAnchorEl(null);

    const handleApplyDateRange = (newRange, newLabelType) => {
        const newLabel = dateShortcuts.find(s => s.type === newLabelType)?.label || 
                         `${newRange[0].format('DD/MM')} - ${newRange[1].format('DD/MM/YYYY')}`;
        setDateRange(newRange);
        setDateLabel(newLabel);
        setFilterType(newLabelType || 'custom');
        handleCloseFilter();
    };

    // Toggle cho Line Chart
    const handleToggleLineSeries = useCallback((key) => {
        setLineVisibleKeys(prevKeys => {
            if (prevKeys.includes(key)) {
                return prevKeys.filter(k => k !== key);
            } else {
                return [...prevKeys, key];
            }
        });
    }, []);

    // Toggle cho Bar Chart
    const handleToggleBarSeries = useCallback((key) => {
        setBarVisibleKeys(prevKeys => {
            if (prevKeys.includes(key)) {
                return prevKeys.filter(k => k !== key);
            } else {
                return [...prevKeys, key];
            }
        });
    }, []);

    // --- DATA FETCHING & PROCESSING ---
    const dashboardFilters = useMemo(() => {
        return {
            lineChart: {
                range: dateRange,
                type: filterType,
                source: selectedSources.includes('all') ? null : selectedSources,
            },
            kpi: null, donut: null, topProducts: null, map: null,
        };
    }, [dateRange, selectedSources, filterType]);

    const { lineChart } = useDashboardData(brandSlug, dashboardFilters);
    const { currentData, previousData, loading, error } = useFinanceData(brandSlug, dateRange);

    // Xử lý dữ liệu bảng và biểu đồ so sánh
    const summaryData = useMemo(() => {
        return currentData?.find(item => item.platform === 'Tổng cộng') || {};
    }, [currentData]);

    const prevSummaryData = useMemo(() => {
        return previousData?.find(item => item.platform === 'Tổng cộng') || {};
    }, [previousData]);
    
    // platformData GỐC (Chứa tất cả, dùng cho Donut/Table)
    const platformData = useMemo(() => {
        return currentData
            ?.filter(item => item.platform !== 'Tổng cộng')
            .sort((a, b) => (b.gmv || 0) - (a.gmv || 0)) || [];
    }, [currentData]);

    // Dữ liệu riêng cho Bar Chart (Đã lọc theo barSelectedSources)
    const barChartData = useMemo(() => {
        return platformData.filter(item => {
            if (barSelectedSources.includes('all')) return true;
            return barSelectedSources.some(s => s.toLowerCase() === item.platform.toLowerCase());
        });
    }, [platformData, barSelectedSources]);

    // Bar Chart Series (Đã đồng bộ với Settings Bar Chart)
    const filteredBarChartSeries = useMemo(() => {
        return allAvailableSeries.filter(s => barVisibleKeys.includes(s.key));
    }, [allAvailableSeries, barVisibleKeys]);

    // Line Chart Series (Đã đồng bộ với Settings Line Chart)
    const filteredLineChartSeries = useMemo(() => {
        return allAvailableSeries.filter(s => lineVisibleKeys.includes(s.key));
    }, [allAvailableSeries, lineVisibleKeys]);

    // KPI Cards Configuration
    const cardConfigs = [
        { key: 'profit', title: 'Tổng Lợi nhuận', icon: <MonetizationOnIcon />, color: 'success.main' },
        { key: 'gmv', title: 'Tổng GMV', icon: <AccountBalanceWalletIcon />, color: 'primary.main' },
        { key: 'net_revenue', title: 'Tổng Doanh thu thuần', icon: <TrendingUpIcon />, color: 'info.main' },
        { key: 'total_cost', title: 'Tổng Chi phí', icon: <AttachMoneyIcon />, color: 'error.main', direction: 'down' },
        { key: 'roi', title: 'ROI Tổng', icon: <StackedLineChartIcon />, color: 'secondary.main', format: 'percent' },
    ];

    const kpiCards = cardConfigs.map(config => ({
        ...config,
        value: summaryData[config.key],
        previousValue: prevSummaryData[config.key],
        format: config.format || 'currency',
        direction: config.direction || 'up',
    }));

    return {
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
    };
};
