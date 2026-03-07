import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '@mui/material/styles';
import {
    Campaign as CampaignIcon,
    Visibility as VisibilityIcon,
    AdsClick as AdsClickIcon,
    ShoppingCartCheckout as ShoppingCartCheckoutIcon,
    QueryStats as QueryStatsIcon,
    Percent as PercentIcon,
    PriceChange as PriceChangeIcon,
    Paid as PaidIcon,
} from '@mui/icons-material';
import { dateShortcuts } from '../config/dashboardConfig';
import { useDashboardData } from './useDashboardData';
import { fetchAsyncData, getSourcesForBrand } from '../services/api';
import { useBrand } from '../context/BrandContext';
import { toggleSourceSelection } from '../utils/filterLogic';

const defaultDateRange = dateShortcuts.find(s => s.type === 'this_month').getValue();
const defaultDateLabel = dateShortcuts.find(s => s.type === 'this_month').label;

const capitalize = (value = '') => value.charAt(0).toUpperCase() + value.slice(1);

export const useMarketingPageLogic = () => {
    const theme = useTheme();
    const { slug: brandSlug } = useBrand();

    const [sourceOptions, setSourceOptions] = useState([]);
    const [lineSelectedSources, setLineSelectedSources] = useState(['all']);
    const [comparisonSelectedSources, setComparisonSelectedSources] = useState(['all']);

    const [isLineConfigOpen, setIsLineConfigOpen] = useState(false);
    const [isComparisonConfigOpen, setIsComparisonConfigOpen] = useState(false);

    const [lineVisibleKeys, setLineVisibleKeys] = useState(['ad_spend', 'conversions', 'roas', 'ctr']);
    const [comparisonVisibleKeys, setComparisonVisibleKeys] = useState(['ad_spend', 'cpm', 'cpc', 'cpa']);

    const [filterType, setFilterType] = useState('this_month');
    const [dateRange, setDateRange] = useState(defaultDateRange);
    const [dateLabel, setDateLabel] = useState(defaultDateLabel);
    const [anchorEl, setAnchorEl] = useState(null);

    const [comparisonData, setComparisonData] = useState([]);
    const [comparisonLoading, setComparisonLoading] = useState(true);
    const [comparisonError, setComparisonError] = useState(null);

    useEffect(() => {
        const fetchSources = async () => {
            if (!brandSlug) return;
            try {
                const sources = await getSourcesForBrand(brandSlug);
                setSourceOptions(sources.map(s => ({ label: capitalize(s), value: s })));
            } catch (error) {
                console.error('Failed to fetch sources for marketing page:', error);
                setSourceOptions([]);
            }
        };

        fetchSources();
    }, [brandSlug]);

    const handleToggleLineSource = (sourceValue) => {
        setLineSelectedSources(prev => toggleSourceSelection(sourceValue, prev, sourceOptions));
    };

    const handleToggleComparisonSource = (sourceValue) => {
        setComparisonSelectedSources(prev => toggleSourceSelection(sourceValue, prev, sourceOptions));
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

    const handleToggleLineSeries = useCallback((key) => {
        setLineVisibleKeys(prevKeys => (
            prevKeys.includes(key) ? prevKeys.filter(k => k !== key) : [...prevKeys, key]
        ));
    }, []);

    const handleToggleComparisonSeries = useCallback((key) => {
        setComparisonVisibleKeys(prevKeys => (
            prevKeys.includes(key) ? prevKeys.filter(k => k !== key) : [...prevKeys, key]
        ));
    }, []);

    const dashboardFilters = useMemo(() => ({
        marketing: {
            range: dateRange,
            type: filterType,
        },
        lineChart: {
            range: dateRange,
            type: filterType,
            source: lineSelectedSources.includes('all') ? null : lineSelectedSources,
        },
        finance: null,
        operations: null,
        customers: null,
        donut: null,
        topProducts: null,
        map: null,
    }), [dateRange, filterType, lineSelectedSources]);

    const { marketing, lineChart } = useDashboardData(brandSlug, dashboardFilters);

    useEffect(() => {
        const fetchComparison = async () => {
            if (!brandSlug || !dateRange || sourceOptions.length === 0) {
                setComparisonData([]);
                setComparisonLoading(false);
                return;
            }

            const selectedValues = comparisonSelectedSources.includes('all')
                ? sourceOptions.map(s => s.value)
                : comparisonSelectedSources.filter(v => v !== 'all');

            if (selectedValues.length === 0) {
                setComparisonData([]);
                setComparisonLoading(false);
                return;
            }

            setComparisonLoading(true);
            setComparisonError(null);

            try {
                const totalParams = comparisonSelectedSources.includes('all') ? {} : { source: selectedValues };

                const [totalSummary, perSource] = await Promise.all([
                    fetchAsyncData('kpi_summary', brandSlug, dateRange, totalParams),
                    Promise.all(
                        selectedValues.map(async (source) => {
                            const data = await fetchAsyncData('kpi_summary', brandSlug, dateRange, { source: [source] });
                            return {
                                platform: capitalize(source),
                                ...data,
                            };
                        })
                    )
                ]);

                setComparisonData([
                    { platform: 'Tổng cộng', ...totalSummary },
                    ...perSource.sort((a, b) => (b.ad_spend || 0) - (a.ad_spend || 0)),
                ]);
            } catch (error) {
                console.error('Failed to fetch marketing comparison data:', error);
                setComparisonError(error.message || 'Không thể tải dữ liệu so sánh marketing.');
                setComparisonData([]);
            } finally {
                setComparisonLoading(false);
            }
        };

        fetchComparison();
    }, [brandSlug, dateRange, sourceOptions, comparisonSelectedSources]);

    const summaryData = useMemo(() => marketing?.data?.current || {}, [marketing]);
    const prevSummaryData = useMemo(() => marketing?.data?.previous || {}, [marketing]);

    const lineSeries = useMemo(() => [
        { key: 'ad_spend', name: 'Chi phí Ads', color: theme.palette.primary.main, area: true },
        { key: 'conversions', name: 'Chuyển đổi', color: theme.palette.success.main, type: 'bar' },
        { key: 'clicks', name: 'Clicks', color: '#ff9800' },
        { key: 'impressions', name: 'Impressions', color: '#7e57c2' },
        { key: 'ctr', name: 'CTR', color: '#4dd0e1' },
        { key: 'cpc', name: 'CPC', color: '#ef5350' },
        { key: 'cpa', name: 'CPA', color: '#ec407a' },
        { key: 'cpm', name: 'CPM', color: '#ffa726' },
        { key: 'roas', name: 'ROAS', color: '#66bb6a' },
        { key: 'conversion_rate', name: 'CR', color: '#26a69a' },
        { key: 'frequency', name: 'Frequency', color: '#ab47bc' },
    ], [theme]);

    const comparisonSeries = useMemo(() => [
        { key: 'ad_spend', name: 'Chi phí Ads', color: theme.palette.primary.main },
        { key: 'cpm', name: 'CPM', color: '#ffa726' },
        { key: 'cpc', name: 'CPC', color: '#ef5350' },
        { key: 'cpa', name: 'CPA', color: '#ec407a' },
    ], [theme]);

    const filteredLineSeries = useMemo(
        () => lineSeries.filter(s => lineVisibleKeys.includes(s.key)),
        [lineSeries, lineVisibleKeys]
    );

    const filteredComparisonSeries = useMemo(
        () => comparisonSeries.filter(s => comparisonVisibleKeys.includes(s.key)),
        [comparisonSeries, comparisonVisibleKeys]
    );

    const sourceChartData = useMemo(
        () => comparisonData.filter(item => item.platform !== 'Tổng cộng'),
        [comparisonData]
    );

    const cardConfigs = useMemo(() => [
        { key: 'ad_spend', title: 'Chi phí Ads', icon: <CampaignIcon />, color: 'primary.main', format: 'currency', direction: 'down' },
        { key: 'impressions', title: 'Impressions', icon: <VisibilityIcon />, color: 'info.main', format: 'number' },
        { key: 'clicks', title: 'Clicks', icon: <AdsClickIcon />, color: 'warning.main', format: 'number' },
        { key: 'conversions', title: 'Conversions', icon: <ShoppingCartCheckoutIcon />, color: 'success.main', format: 'number' },
        { key: 'ctr', title: 'CTR', icon: <PercentIcon />, color: 'secondary.main', format: 'percent' },
        { key: 'cpc', title: 'CPC', icon: <PaidIcon />, color: 'error.main', format: 'currency', direction: 'down' },
        { key: 'cpa', title: 'CPA', icon: <PriceChangeIcon />, color: 'error.main', format: 'currency', direction: 'down' },
        { key: 'roas', title: 'ROAS', icon: <QueryStatsIcon />, color: 'success.main', format: 'number' },
    ], []);

    const kpiCards = useMemo(() => cardConfigs.map(config => ({
        ...config,
        value: summaryData[config.key],
        previousValue: prevSummaryData[config.key],
    })), [cardConfigs, summaryData, prevSummaryData]);

    return {
        sourceOptions,
        lineSelectedSources,
        comparisonSelectedSources,
        isLineConfigOpen,
        setIsLineConfigOpen,
        isComparisonConfigOpen,
        setIsComparisonConfigOpen,
        dateRange,
        dateLabel,
        anchorEl,
        lineVisibleKeys,
        comparisonVisibleKeys,

        handleToggleLineSource,
        handleToggleComparisonSource,
        handleOpenFilter,
        handleCloseFilter,
        handleApplyDateRange,
        handleToggleLineSeries,
        handleToggleComparisonSeries,

        marketing,
        lineChart,
        comparisonData,
        sourceChartData,
        comparisonLoading,
        comparisonError,
        kpiCards,
        lineSeries,
        filteredLineSeries,
        comparisonSeries,
        filteredComparisonSeries,
    };
};
