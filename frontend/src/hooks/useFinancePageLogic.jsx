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
    const [selectedSources, setSelectedSources] = useState(['all']);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [filterType, setFilterType] = useState('this_month');
    const [dateRange, setDateRange] = useState(defaultDateRange);
    const [dateLabel, setDateLabel] = useState(defaultDateLabel);
    const [anchorEl, setAnchorEl] = useState(null);
    const [visibleSeriesKeys, setVisibleSeriesKeys] = useState(['netRevenue', 'profit']);

    // --- EFFECTS ---
    useEffect(() => {
        if (brandSlug) {
            getSourcesForBrand(brandSlug)
                .then(sources => {
                    const options = sources.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }));
                    setSourceOptions(options);
                }).catch(err => console.error("Failed to load sources:", err));
        }
    }, [brandSlug]);

    // --- HANDLERS ---
    const handleToggleSource = (sourceValue) => {
        setSelectedSources(prev => {
            if (sourceValue === 'all') {
                if (prev.includes('all')) {
                    return [];
                }
                return ['all'];
            }
            if (prev.includes('all')) {
                const allValues = sourceOptions.map(o => o.value);
                const newSelection = allValues.filter(v => v !== sourceValue);
                return newSelection; 
            }
            if (prev.includes(sourceValue)) {
                const newSelection = prev.filter(v => v !== sourceValue);
                return newSelection; 
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

    const handleToggleSeries = useCallback((key) => {
        setVisibleSeriesKeys(prevKeys => {
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
    const summaryData = currentData?.find(item => item.platform === 'Tổng cộng') || {};
    const prevSummaryData = previousData?.find(item => item.platform === 'Tổng cộng') || {};
    
    const platformData = currentData
        ?.filter(item => item.platform !== 'Tổng cộng')
        .sort((a, b) => (b.gmv || 0) - (a.gmv || 0)) || [];

    // --- CHART CONFIGS ---
    const comparisonChartSeries = useMemo(() => [
        { key: 'netRevenue', name: 'Doanh thu', color: theme.palette.primary.light },
        { key: 'cogs', name: 'Giá vốn', color: theme.palette.warning.light },
        { key: 'profit', name: 'Lợi nhuận', color: theme.palette.success.light },
    ], [theme.palette]);

    const allAvailableSeries = useMemo(() => [
        { key: 'netRevenue', name: 'Doanh thu ròng', color: theme.palette.primary.main },
        { key: 'profit', name: 'Lợi nhuận', color: '#28a545' },
        { key: 'gmv', name: 'GMV', color: theme.palette.warning.main },
        { key: 'totalCost', name: 'Tổng Chi phí', color: theme.palette.error.main },
        { key: 'cogs', name: 'Giá vốn', color: '#e17e1b' },
        { key: 'adSpend', name: 'Chi phí Ads', color: '#1f1fddcc' },
        { key: 'executionCost', name: 'Chi phí thực thi', color: '#9C27B0' },
    ], [theme]);

    const filteredLineChartSeries = useMemo(() => {
        return allAvailableSeries.filter(s => visibleSeriesKeys.includes(s.key));
    }, [allAvailableSeries, visibleSeriesKeys]);

    // KPI Cards Configuration
    const cardConfigs = [
        { key: 'profit', title: 'Tổng Lợi nhuận', icon: <MonetizationOnIcon />, color: 'success.main' },
        { key: 'gmv', title: 'Tổng GMV', icon: <AccountBalanceWalletIcon />, color: 'primary.main' },
        { key: 'netRevenue', title: 'Tổng Doanh thu thuần', icon: <TrendingUpIcon />, color: 'info.main' },
        { key: 'totalCost', title: 'Tổng Chi phí', icon: <AttachMoneyIcon />, color: 'error.main', direction: 'down' },
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
    };
};
