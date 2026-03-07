import React, { lazy, Suspense, useMemo, useEffect, useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    Skeleton,
    IconButton,
    Tooltip,
    Chip,
    Divider,
    Stack,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
    CalendarMonth as CalendarMonthIcon,
    Settings as SettingsIcon,
    Insights as InsightsIcon,
    TrackChanges as TrackChangesIcon,
    Bolt as BoltIcon,
    SmartToy as SmartToyIcon,
    Radar as RadarIcon,
} from '@mui/icons-material';

import DateRangeFilterMenu from '../components/common/DateRangeFilterMenu';
import ChartSettingsPanel from '../components/charts/controls/ChartSettingsPanel';
import ChartSettingSection from '../components/charts/controls/ChartSettingSection';
import ChartSettingItem from '../components/charts/controls/ChartSettingItem';
import SourceSelectionSection from '../components/charts/controls/SourceSelectionSection';
import LazyLoader from '../components/common/LazyLoader';
import SectionTitle from '../components/ui/SectionTitle';
import LoadingOverlay from '../components/common/LoadingOverlay';
import StatComparison from '../components/common/StatComparison';

import MarketingTable from '../components/marketing/MarketingTable';
import { useMarketingPageLogic } from '../hooks/useMarketingPageLogic';
import { fadeUp } from '../theme/designSystem';
import { formatCurrency, formatNumber, formatPercentage } from '../utils/formatters';

const RevenueProfitChart = lazy(() => import('../components/charts/RevenueProfitChart'));
const SourceDistributionChart = lazy(() => import('../components/charts/SourceDistributionChart'));
const FinanceComparisonChart = lazy(() => import('../components/charts/FinanceComparisonChart'));

const ChartSkeleton = () => (
    <Skeleton
        variant="rectangular"
        width="100%"
        height="100%"
        sx={{ borderRadius: 2, bgcolor: 'rgba(255, 255, 255, 0.05)' }}
    />
);

const formatByType = (value, type) => {
    if (type === 'currency') return formatCurrency(value || 0);
    if (type === 'percent') return formatPercentage(value || 0);
    if (type === 'ratio') {
        if (typeof value !== 'number' || !isFinite(value)) return '0.00';
        return value.toFixed(2);
    }
    return formatNumber(value || 0);
};

const percentChange = (current, prev) => {
    const c = Number(current) || 0;
    const p = Number(prev) || 0;
    if (p === 0) return c > 0 ? 100 : 0;
    return ((c - p) / Math.abs(p)) * 100;
};

function MarketingPage() {
    const theme = useTheme();
    const [typedBrief, setTypedBrief] = useState('');
    const [lastUpdated, setLastUpdated] = useState(() => new Date());
    const [activeLens, setActiveLens] = useState('executive');

    const {
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
        lineSeries,
        filteredLineSeries,
        comparisonSeries,
        filteredComparisonSeries,
    } = useMarketingPageLogic();

    const summary = marketing?.data?.current || {};
    const previous = marketing?.data?.previous || {};

    const funnel = useMemo(() => {
        const impressions = summary.impressions || 0;
        const clicks = summary.clicks || 0;
        const conversions = summary.conversions || 0;

        const clickPct = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const conversionPct = clicks > 0 ? (conversions / clicks) * 100 : 0;

        return { impressions, clicks, conversions, clickPct, conversionPct };
    }, [summary]);

    const channelLeaderboard = useMemo(() => {
        return [...sourceChartData]
            .sort((a, b) => (b.roas || 0) - (a.roas || 0))
            .slice(0, 5);
    }, [sourceChartData]);

    const tacticalInsights = useMemo(() => {
        if (!sourceChartData.length) return [];

        const byRoas = [...sourceChartData].sort((a, b) => (b.roas || 0) - (a.roas || 0));
        const byCtr = [...sourceChartData].sort((a, b) => (b.ctr || 0) - (a.ctr || 0));
        const byCpa = [...sourceChartData]
            .filter(item => (item.cpa || 0) > 0)
            .sort((a, b) => (a.cpa || 0) - (b.cpa || 0));

        return [
            {
                title: 'Top ROAS',
                platform: byRoas[0]?.platform || '---',
                value: formatByType(byRoas[0]?.roas || 0, 'ratio'),
                suffix: 'x',
                color: '#9ccc65',
            },
            {
                title: 'Top CTR',
                platform: byCtr[0]?.platform || '---',
                value: formatByType(byCtr[0]?.ctr || 0, 'percent'),
                suffix: '',
                color: '#26c6da',
            },
            {
                title: 'Best CPA',
                platform: byCpa[0]?.platform || '---',
                value: formatByType(byCpa[0]?.cpa || 0, 'currency'),
                suffix: '',
                color: '#ef5350',
            },
            {
                title: 'Avg Frequency',
                platform: 'All Channels',
                value: formatByType(summary.frequency || 0, 'ratio'),
                suffix: '',
                color: '#ab47bc',
            },
        ];
    }, [sourceChartData, summary.frequency]);

    const executiveTiles = [
        { key: 'ad_spend', label: 'Ad Spend', type: 'currency', direction: 'down', color: '#42a5f5' },
        { key: 'impressions', label: 'Impressions', type: 'number', direction: 'up', color: '#7e57c2' },
        { key: 'clicks', label: 'Clicks', type: 'number', direction: 'up', color: '#29b6f6' },
        { key: 'conversions', label: 'Conversions', type: 'number', direction: 'up', color: '#66bb6a' },
        { key: 'ctr', label: 'CTR', type: 'percent', direction: 'up', color: '#26c6da' },
        { key: 'roas', label: 'ROAS', type: 'ratio', direction: 'up', color: '#9ccc65' },
    ];

    const lensConfig = {
        executive: {
            label: 'Tổng quan',
            tileKeys: ['ad_spend', 'impressions', 'clicks', 'conversions', 'ctr', 'roas'],
            lineKeys: ['ad_spend', 'conversions', 'roas', 'ctr', 'clicks'],
            comparisonKeys: ['ad_spend', 'cpm', 'cpc', 'cpa'],
            mixCards: [
                { title: 'Ad Spend Share', dataKey: 'ad_spend', format: 'currency' },
                { title: 'Conversions Share', dataKey: 'conversions', format: 'number' },
            ],
            monitorCards: [
                { title: 'CTR by Channel', dataKey: 'ctr', format: 'percent' },
                { title: 'ROAS by Channel', dataKey: 'roas', format: 'ratio' },
                { title: 'CPC by Channel', dataKey: 'cpc', format: 'currency' },
                { title: 'CPA by Channel', dataKey: 'cpa', format: 'currency' },
            ],
        },
        acquisition: {
            label: 'Thu hút',
            tileKeys: ['ad_spend', 'impressions', 'clicks', 'ctr'],
            lineKeys: ['ad_spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm'],
            comparisonKeys: ['ad_spend', 'cpm', 'cpc'],
            mixCards: [
                { title: 'Impressions Share', dataKey: 'impressions', format: 'number' },
                { title: 'Clicks Share', dataKey: 'clicks', format: 'number' },
            ],
            monitorCards: [
                { title: 'CTR by Channel', dataKey: 'ctr', format: 'percent' },
                { title: 'CPC by Channel', dataKey: 'cpc', format: 'currency' },
                { title: 'CPM by Channel', dataKey: 'cpm', format: 'currency' },
                { title: 'Ad Spend by Channel', dataKey: 'ad_spend', format: 'currency' },
            ],
        },
        performance: {
            label: 'Hiệu quả',
            tileKeys: ['conversions', 'ctr', 'roas', 'clicks'],
            lineKeys: ['conversions', 'conversion_rate', 'roas', 'cpa', 'frequency'],
            comparisonKeys: ['ad_spend', 'cpa', 'cpc'],
            mixCards: [
                { title: 'ROAS Share', dataKey: 'roas', format: 'ratio' },
                { title: 'CPA Share', dataKey: 'cpa', format: 'currency' },
            ],
            monitorCards: [
                { title: 'ROAS by Channel', dataKey: 'roas', format: 'ratio' },
                { title: 'CPA by Channel', dataKey: 'cpa', format: 'currency' },
                { title: 'CTR by Channel', dataKey: 'ctr', format: 'percent' },
                { title: 'Conversions by Channel', dataKey: 'conversions', format: 'number' },
            ],
        },
    };

    const activeConfig = lensConfig[activeLens] || lensConfig.executive;
    const activeExecutiveTiles = executiveTiles.filter(tile => activeConfig.tileKeys.includes(tile.key));

    const activeLineSeries = useMemo(() => {
        const filtered = filteredLineSeries.filter(series => activeConfig.lineKeys.includes(series.key));
        return filtered.length > 0 ? filtered : filteredLineSeries;
    }, [activeConfig.lineKeys, filteredLineSeries]);

    const activeComparisonSeries = useMemo(() => {
        const filtered = filteredComparisonSeries.filter(series => activeConfig.comparisonKeys.includes(series.key));
        return filtered.length > 0 ? filtered : filteredComparisonSeries;
    }, [activeConfig.comparisonKeys, filteredComparisonSeries]);

    const anomalyAlerts = useMemo(() => {
        const alerts = [];

        const roasDrop = percentChange(summary.roas, previous.roas);
        if (roasDrop <= -15) {
            alerts.push({
                severity: 'high',
                title: 'ROAS giảm mạnh',
                detail: `${Math.abs(roasDrop).toFixed(1)}% | Hiện tại ${formatByType(summary.roas, 'ratio')}x`,
            });
        }

        const cpaRise = percentChange(summary.cpa, previous.cpa);
        if (cpaRise >= 20) {
            alerts.push({
                severity: 'high',
                title: 'CPA tăng bất thường',
                detail: `+${cpaRise.toFixed(1)}% | Hiện tại ${formatByType(summary.cpa, 'currency')}`,
            });
        }

        const ctrDrop = percentChange(summary.ctr, previous.ctr);
        if (ctrDrop <= -12) {
            alerts.push({
                severity: 'medium',
                title: 'CTR suy giảm',
                detail: `${Math.abs(ctrDrop).toFixed(1)}% | Hiện tại ${formatByType(summary.ctr, 'percent')}`,
            });
        }

        const currentTrend = lineChart?.data?.current || [];
        if (currentTrend.length >= 7) {
            const last7 = currentTrend.slice(-7);
            const first3 = last7.slice(0, 3);
            const last3 = last7.slice(-3);

            const avg = (arr, key) => {
                if (!arr.length) return 0;
                return arr.reduce((sum, item) => sum + (Number(item[key]) || 0), 0) / arr.length;
            };

            const cpaEarly = avg(first3, 'cpa');
            const cpaRecent = avg(last3, 'cpa');
            if (cpaEarly > 0 && cpaRecent / cpaEarly >= 1.25) {
                alerts.push({
                    severity: 'medium',
                    title: 'CPA 3 ngày gần nhất tăng nhanh',
                    detail: `${formatByType(cpaEarly, 'currency')} -> ${formatByType(cpaRecent, 'currency')}`,
                });
            }

            const roasEarly = avg(first3, 'roas');
            const roasRecent = avg(last3, 'roas');
            if (roasEarly > 0 && roasRecent / roasEarly <= 0.8) {
                alerts.push({
                    severity: 'medium',
                    title: 'ROAS ngắn hạn đang giảm',
                    detail: `${formatByType(roasEarly, 'ratio')}x -> ${formatByType(roasRecent, 'ratio')}x`,
                });
            }
        }

        if (sourceChartData.length > 0) {
            const weakChannels = sourceChartData
                .filter(item => (item.ad_spend || 0) > 0 && ((item.roas || 0) < 1 || (item.cpa || 0) > (summary.cpa || 0) * 1.2))
                .sort((a, b) => (b.ad_spend || 0) - (a.ad_spend || 0))
                .slice(0, 2);

            weakChannels.forEach((channel) => {
                alerts.push({
                    severity: 'low',
                    title: `Kênh cần tối ưu: ${channel.platform}`,
                    detail: `ROAS ${formatByType(channel.roas, 'ratio')}x | CPA ${formatByType(channel.cpa, 'currency')}`,
                });
            });
        }

        if (alerts.length === 0) {
            alerts.push({
                severity: 'ok',
                title: 'Không có biến động bất thường lớn',
                detail: 'Các chỉ số đang vận hành trong ngưỡng an toàn.',
            });
        }

        return alerts.slice(0, 6);
    }, [lineChart?.data?.current, previous.cpa, previous.ctr, previous.roas, sourceChartData, summary.cpa, summary.ctr, summary.roas]);

    const aiBrief = useMemo(() => {
        const topAlert = anomalyAlerts.find(item => item.severity === 'high') || anomalyAlerts[0];
        const topChannel = channelLeaderboard[0]?.platform || 'N/A';
        const topChannelRoas = channelLeaderboard[0]?.roas || 0;

        return `AI nhận định: ROAS hiện tại ${formatByType(summary.roas, 'ratio')}x, CPA ${formatByType(summary.cpa, 'currency')}, CTR ${formatByType(summary.ctr, 'percent')}. Kênh nổi bật: ${topChannel} (${formatByType(topChannelRoas, 'ratio')}x). ${topAlert?.title || 'Không có cảnh báo lớn'} - ${topAlert?.detail || ''}`;
    }, [anomalyAlerts, channelLeaderboard, summary.cpa, summary.ctr, summary.roas]);

    const aiConfidence = useMemo(() => {
        const signalPenalty = anomalyAlerts.filter(a => a.severity === 'high').length * 8;
        const base = 92;
        return Math.max(68, base - signalPenalty);
    }, [anomalyAlerts]);

    const aiMeta = useMemo(() => {
        const modelId = 'mk-analyst-1.3';
        const seed = `${dateRange?.[0]?.format?.('YYYYMMDD') || ''}${dateRange?.[1]?.format?.('YYYYMMDD') || ''}${anomalyAlerts.length}${Math.round((summary.roas || 0) * 100)}`;
        let hash = 0;
        for (let i = 0; i < seed.length; i += 1) {
            hash = ((hash << 5) - hash) + seed.charCodeAt(i);
            hash |= 0;
        }
        const requestId = `REQ-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
        return { modelId, requestId };
    }, [anomalyAlerts.length, dateRange, summary.roas]);

    useEffect(() => {
        setTypedBrief('');
        let index = 0;
        const interval = setInterval(() => {
            index += 1;
            setTypedBrief(aiBrief.slice(0, index));
            if (index >= aiBrief.length) {
                clearInterval(interval);
            }
        }, 16);

        return () => clearInterval(interval);
    }, [aiBrief]);

    useEffect(() => {
        const interval = setInterval(() => setLastUpdated(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <Box sx={{ px: 4, py: 3, animation: `${fadeUp} 0.6s ease-out forwards` }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                        MARKETING INTELLIGENCE
                    </Typography>
                </Box>

                <Button
                    variant="outlined"
                    startIcon={<CalendarMonthIcon />}
                    onClick={handleOpenFilter}
                    sx={{
                        borderRadius: 3,
                        borderColor: theme.palette.divider,
                        color: theme.palette.text.primary,
                        textTransform: 'none',
                        fontWeight: 600,
                        px: 2,
                        py: 1,
                    }}
                >
                    {dateLabel}
                </Button>

                <DateRangeFilterMenu
                    open={Boolean(anchorEl)}
                    anchorEl={anchorEl}
                    onClose={handleCloseFilter}
                    initialDateRange={dateRange}
                    onApply={handleApplyDateRange}
                />
            </Box>

            <LazyLoader height={240}>
                <Paper
                    variant="glass"
                    sx={{
                        p: 2.2,
                        mb: 3.5,
                        borderRadius: 3,
                        border: `1px solid ${theme.palette.divider}`,
                        background: 'linear-gradient(145deg, rgba(4,10,24,0.95) 0%, rgba(10,28,46,0.86) 65%, rgba(4,44,58,0.62) 100%)',
                    }}
                >
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.8fr 1fr' }, gap: 2 }}>
                        <Box sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2.5, p: 1.6, bgcolor: 'rgba(3,8,18,0.55)' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: '#00e676', boxShadow: '0 0 10px #00e676' }} />
                                    <Chip size="small" icon={<SmartToyIcon />} label="Bộ phân tích AI v1" color="primary" />
                                </Box>
                                <Chip size="small" variant="outlined" label={`${anomalyAlerts.length} tín hiệu`} />
                            </Box>

                            <Paper
                                variant="glass"
                                sx={{
                                    p: 1.35,
                                    borderRadius: 2,
                                    border: `1px solid ${theme.palette.divider}`,
                                    bgcolor: 'rgba(7,14,28,0.62)',
                                }}
                            >
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                                    THÔNG ĐIỆP HỆ THỐNG
                                </Typography>
                                <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600, lineHeight: 1.65 }}>
                                    {typedBrief}
                                    <Box
                                        component="span"
                                        sx={{
                                            display: 'inline-block',
                                            width: '7px',
                                            height: '1.05em',
                                            ml: 0.4,
                                            verticalAlign: 'text-bottom',
                                            bgcolor: 'primary.main',
                                            animation: 'blinkCursor 1s steps(2, start) infinite',
                                            '@keyframes blinkCursor': {
                                                to: { visibility: 'hidden' },
                                            },
                                        }}
                                    />
                                </Typography>
                            </Paper>
                        </Box>

                        <Box sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2.5, p: 1.5, bgcolor: 'rgba(6,14,30,0.5)' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                                TRẠNG THÁI AI
                            </Typography>

                            <Box sx={{ mt: 1, mb: 1.2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                    <Typography variant="caption" color="text.secondary">Độ tin cậy (quy tắc)</Typography>
                                    <Typography variant="caption" sx={{ fontWeight: 700 }}>{aiConfidence}%</Typography>
                                </Box>
                                <Box sx={{ height: 8, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.12)' }}>
                                    <Box sx={{ width: `${aiConfidence}%`, height: '100%', borderRadius: 999, bgcolor: aiConfidence >= 85 ? '#66bb6a' : '#ffb74d' }} />
                                </Box>
                            </Box>

                                <Chip
                                    size="small"
                                    icon={<RadarIcon />}
                                label={anomalyAlerts.some(a => a.severity === 'high') ? 'Ưu tiên: Cao' : 'Ưu tiên: Bình thường'}
                                    color={anomalyAlerts.some(a => a.severity === 'high') ? 'error' : 'success'}
                                    sx={{ mb: 1 }}
                                />

                            <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                                {anomalyAlerts.slice(0, 3).map((alert, idx) => (
                                    <Chip
                                        key={`${alert.title}-${idx}`}
                                        size="small"
                                        label={alert.title}
                                        variant="outlined"
                                        sx={{
                                            borderColor: alert.severity === 'high'
                                                ? '#ef5350'
                                                : alert.severity === 'medium'
                                                    ? '#ffb74d'
                                                    : alert.severity === 'low'
                                                        ? '#64b5f6'
                                                        : '#66bb6a'
                                        }}
                                    />
                                ))}
                            </Box>

                            <Divider sx={{ my: 1.2 }} />
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0.4 }}>
                                <Typography variant="caption" color="text.secondary">
                                    Mô hình: <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>{aiMeta.modelId}</Box>
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Yêu cầu: <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>{aiMeta.requestId}</Box>
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Cập nhật lúc: <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>{lastUpdated.toLocaleString('vi-VN')}</Box>
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                </Paper>
            </LazyLoader>

            <LazyLoader height={260}>
                <Paper
                    variant="glass"
                    sx={{
                        p: 3,
                        mb: 4,
                        borderRadius: 4,
                        background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, rgba(26, 35, 72, 0.45) 45%, rgba(20, 110, 110, 0.28) 100%)`,
                        border: `1px solid ${theme.palette.divider}`,
                    }}
                >
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.7fr 1fr' }, gap: 3 }}>
                        <Box>
                            <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap' }}>
                                <Chip
                                    size="small"
                                    icon={<InsightsIcon />}
                                    label="Tổng quan"
                                    clickable
                                    onClick={() => setActiveLens('executive')}
                                    color={activeLens === 'executive' ? 'primary' : 'default'}
                                    variant={activeLens === 'executive' ? 'filled' : 'outlined'}
                                />
                                <Chip
                                    size="small"
                                    icon={<TrackChangesIcon />}
                                    label="Thu hút"
                                    clickable
                                    onClick={() => setActiveLens('acquisition')}
                                    color={activeLens === 'acquisition' ? 'primary' : 'default'}
                                    variant={activeLens === 'acquisition' ? 'filled' : 'outlined'}
                                />
                                <Chip
                                    size="small"
                                    icon={<BoltIcon />}
                                    label="Hiệu quả"
                                    clickable
                                    onClick={() => setActiveLens('performance')}
                                    color={activeLens === 'performance' ? 'primary' : 'default'}
                                    variant={activeLens === 'performance' ? 'filled' : 'outlined'}
                                />
                            </Stack>

                            <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
                                Góc nhìn: {activeConfig.label}
                            </Typography>

                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 1.5 }}>
                                {activeExecutiveTiles.map((tile) => (
                                    <Paper
                                        key={tile.key}
                                        variant="glass"
                                        sx={{
                                            p: 1.5,
                                            borderRadius: 2.5,
                                            border: `1px solid ${theme.palette.divider}`,
                                            borderTop: `3px solid ${tile.color}`,
                                            bgcolor: 'rgba(7, 14, 28, 0.55)',
                                        }}
                                    >
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                            {tile.label}
                                        </Typography>
                                        <Typography variant="h6" sx={{ mt: 0.25, fontWeight: 800, color: tile.color }}>
                                            {formatByType(summary[tile.key], tile.type)}
                                        </Typography>
                                        <Box sx={{ mt: 0.5, minHeight: 20 }}>
                                            <StatComparison
                                                value={summary[tile.key]}
                                                previousValue={previous[tile.key]}
                                                format={tile.type === 'ratio' ? 'number' : tile.type}
                                                direction={tile.direction}
                                            />
                                        </Box>
                                    </Paper>
                                ))}
                            </Box>
                        </Box>

                        <Paper variant="glass" sx={{ p: 2, borderRadius: 3, bgcolor: 'rgba(6, 12, 26, 0.55)' }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                                Channel Leaderboard (ROAS)
                            </Typography>

                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {channelLeaderboard.length === 0 ? (
                                    <Typography variant="body2" color="text.secondary">Chưa có dữ liệu kênh.</Typography>
                                ) : channelLeaderboard.map((channel, index) => (
                                    <Box
                                        key={channel.platform}
                                        sx={{
                                            display: 'grid',
                                            gridTemplateColumns: '32px 1fr auto',
                                            alignItems: 'center',
                                            gap: 1,
                                            p: 1.2,
                                            borderRadius: 2,
                                            border: `1px solid ${theme.palette.divider}`,
                                        }}
                                    >
                                        <Typography sx={{ fontWeight: 800, color: index === 0 ? '#ffd54f' : 'text.secondary' }}>
                                            #{index + 1}
                                        </Typography>
                                        <Box>
                                            <Typography sx={{ fontWeight: 700 }}>{channel.platform}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                Spend: {formatCurrency(channel.ad_spend || 0)}
                                            </Typography>
                                        </Box>
                                        <Chip
                                            size="small"
                                            label={`ROAS ${((channel.roas || 0)).toFixed(2)}`}
                                            sx={{ fontWeight: 700, bgcolor: 'rgba(102, 187, 106, 0.16)', color: '#7CFC8A' }}
                                        />
                                    </Box>
                                ))}
                            </Box>
                        </Paper>
                    </Box>
                </Paper>
            </LazyLoader>

            <LazyLoader height={340}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.3fr 1fr' }, gap: 3, mb: 4 }}>
                    <Paper variant="glass" sx={{ p: 2.5, borderRadius: 3 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                            Conversion Funnel
                        </Typography>

                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
                            <Paper variant="glass" sx={{ p: 2, borderRadius: 2.5 }}>
                                <Typography variant="caption" color="text.secondary">Impressions</Typography>
                                <Typography variant="h5" sx={{ fontWeight: 800 }}>{formatNumber(funnel.impressions)}</Typography>
                                <Box sx={{ mt: 1, height: 8, bgcolor: 'rgba(126,87,194,0.2)', borderRadius: 99 }}>
                                    <Box sx={{ width: '100%', height: '100%', bgcolor: '#7e57c2', borderRadius: 99 }} />
                                </Box>
                            </Paper>

                            <Paper variant="glass" sx={{ p: 2, borderRadius: 2.5 }}>
                                <Typography variant="caption" color="text.secondary">Clicks</Typography>
                                <Typography variant="h5" sx={{ fontWeight: 800 }}>{formatNumber(funnel.clicks)}</Typography>
                                <Typography variant="caption" sx={{ color: '#4dd0e1', fontWeight: 700 }}>
                                    CTR {formatPercentage(summary.ctr || 0)}
                                </Typography>
                                <Box sx={{ mt: 1, height: 8, bgcolor: 'rgba(77,208,225,0.2)', borderRadius: 99 }}>
                                    <Box sx={{ width: `${Math.min(Math.max(funnel.clickPct, 0), 100)}%`, height: '100%', bgcolor: '#4dd0e1', borderRadius: 99 }} />
                                </Box>
                            </Paper>

                            <Paper variant="glass" sx={{ p: 2, borderRadius: 2.5 }}>
                                <Typography variant="caption" color="text.secondary">Conversions</Typography>
                                <Typography variant="h5" sx={{ fontWeight: 800 }}>{formatNumber(funnel.conversions)}</Typography>
                                <Typography variant="caption" sx={{ color: '#66bb6a', fontWeight: 700 }}>
                                    CVR {formatPercentage(summary.conversion_rate || 0)}
                                </Typography>
                                <Box sx={{ mt: 1, height: 8, bgcolor: 'rgba(102,187,106,0.2)', borderRadius: 99 }}>
                                    <Box sx={{ width: `${Math.min(Math.max(funnel.conversionPct, 0), 100)}%`, height: '100%', bgcolor: '#66bb6a', borderRadius: 99 }} />
                                </Box>
                            </Paper>
                        </Box>
                    </Paper>

                    <Paper variant="glass" sx={{ p: 2.5, borderRadius: 3 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                            Channel Mix Snapshot
                        </Typography>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, height: 240 }}>
                            {activeConfig.mixCards.map((card) => (
                                <Paper key={card.title} variant="glass" sx={{ p: 1.5, borderRadius: 2 }}>
                                    <Typography variant="caption" color="text.secondary">{card.title}</Typography>
                                    <Suspense fallback={<ChartSkeleton />}>
                                        <SourceDistributionChart data={sourceChartData} dataKey={card.dataKey} format={card.format} />
                                    </Suspense>
                                </Paper>
                            ))}
                        </Box>
                    </Paper>
                </Box>
            </LazyLoader>

            <LazyLoader height={560}>
                <Paper variant="glass" elevation={0} sx={{ p: 1, mb: 4, position: 'relative', overflow: 'hidden', borderRadius: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, px: 2, pt: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>Marketing Trend Navigator</Typography>

                        <Tooltip title="Cấu hình hiển thị">
                            <IconButton
                                onClick={() => setIsLineConfigOpen(true)}
                                sx={{
                                    border: `1px solid ${theme.palette.divider}`,
                                    borderRadius: 2,
                                    color: isLineConfigOpen ? theme.palette.primary.main : theme.palette.text.secondary,
                                    bgcolor: isLineConfigOpen ? theme.palette.primary.main + '20' : 'transparent',
                                }}
                            >
                                <SettingsIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>

                    <Box sx={{ pb: 3, pt: 1, height: 540, position: 'relative' }}>
                        {lineChart.loading && !lineChart.data.current ? (
                            <ChartSkeleton />
                        ) : (
                            <Suspense fallback={<ChartSkeleton />}>
                                {lineChart.loading && lineChart.data.current && <LoadingOverlay borderRadius={4} />}
                                <RevenueProfitChart
                                    data={lineChart.data.current}
                                    comparisonData={lineChart.data.previous}
                                    series={activeLineSeries}
                                    isLoading={lineChart.loading}
                                    aggregationType={lineChart.data.aggregationType}
                                    selectedDateRange={dateRange}
                                    unit=""
                                />
                            </Suspense>
                        )}
                    </Box>

                    <ChartSettingsPanel
                        open={isLineConfigOpen}
                        onClose={() => setIsLineConfigOpen(false)}
                        title="Cấu hình Biểu đồ Xu hướng"
                    >
                        <ChartSettingSection title="Chỉ số hiển thị">
                            {lineSeries.map(series => (
                                <ChartSettingItem
                                    key={series.key}
                                    label={series.name}
                                    color={series.color}
                                    checked={lineVisibleKeys.includes(series.key)}
                                    onChange={() => handleToggleLineSeries(series.key)}
                                    isSwitch={true}
                                />
                            ))}
                        </ChartSettingSection>

                        <SourceSelectionSection
                            selectedSources={lineSelectedSources}
                            sourceOptions={sourceOptions}
                            onToggle={handleToggleLineSource}
                        />
                    </ChartSettingsPanel>
                </Paper>
            </LazyLoader>

            <LazyLoader height={420}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.3fr 1fr' }, gap: 3, mb: 4 }}>
                    <Paper
                        variant="glass"
                        sx={{
                            p: 2.5,
                            borderRadius: 3,
                            display: 'flex',
                            flexDirection: 'column',
                            height: '100%',
                        }}
                    >
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                            Tactical Channel Monitor
                        </Typography>

                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                                gridTemplateRows: { xs: 'repeat(4, minmax(130px, auto))', md: 'repeat(2, minmax(0, 1fr))' },
                                columnGap: 2.5,
                                rowGap: 2.5,
                                minHeight: 300,
                                flex: 1,
                                alignContent: 'stretch',
                                p: 0.5,
                            }}
                        >
                            {activeConfig.monitorCards.map((card) => (
                                <Paper
                                    key={card.title}
                                    variant="glass"
                                    sx={{
                                        p: 1.4,
                                        borderRadius: 2,
                                        minHeight: 0,
                                        height: '100%',
                                        border: `1px solid ${theme.palette.divider}`,
                                        display: 'flex',
                                        flexDirection: 'column',
                                    }}
                                >
                                    <Typography variant="caption" color="text.secondary">{card.title}</Typography>
                                    <Box sx={{ flex: 1, minHeight: 0, mt: 0.5 }}>
                                        <Suspense fallback={<ChartSkeleton />}>
                                            <SourceDistributionChart data={sourceChartData} dataKey={card.dataKey} format={card.format} />
                                        </Suspense>
                                    </Box>
                                </Paper>
                            ))}
                        </Box>
                    </Paper>

                    <Paper variant="glass" sx={{ p: 2.5, borderRadius: 3 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                            Insight Signals
                        </Typography>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                            {tacticalInsights.map((item) => (
                                <Paper
                                    key={item.title}
                                    variant="glass"
                                    sx={{
                                        p: 1.3,
                                        borderRadius: 2,
                                        borderLeft: `3px solid ${item.color}`,
                                        bgcolor: 'rgba(7, 14, 28, 0.55)',
                                    }}
                                >
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                        {item.title}
                                    </Typography>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: item.color }}>
                                        {item.value}{item.suffix}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {item.platform}
                                    </Typography>
                                </Paper>
                            ))}
                        </Box>
                    </Paper>
                </Box>
            </LazyLoader>

            <LazyLoader height={420}>
                <Paper variant="glass" elevation={0} sx={{ p: 1, mb: 4, position: 'relative', overflow: 'hidden', borderRadius: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, px: 2, pt: 2 }}>
                        <Typography sx={{ fontWeight: 700 }} variant="h6" noWrap>
                            Acquisition Efficiency Matrix
                        </Typography>

                        <Tooltip title="Cấu hình hiển thị">
                            <IconButton
                                onClick={() => setIsComparisonConfigOpen(true)}
                                sx={{
                                    border: `1px solid ${theme.palette.divider}`,
                                    borderRadius: 2,
                                    color: isComparisonConfigOpen ? theme.palette.primary.main : theme.palette.text.secondary,
                                    bgcolor: isComparisonConfigOpen ? theme.palette.primary.main + '20' : 'transparent',
                                }}
                            >
                                <SettingsIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>

                    <Divider sx={{ mx: 2, mb: 1.5 }} />

                    <Box sx={{ height: 360, pb: 2, px: 1, position: 'relative' }}>
                        {comparisonLoading && comparisonData.length === 0 ? (
                            <ChartSkeleton />
                        ) : (
                            <Suspense fallback={<ChartSkeleton />}>
                                {comparisonLoading && comparisonData.length > 0 && <LoadingOverlay borderRadius={4} />}
                                <FinanceComparisonChart
                                    data={sourceChartData}
                                    series={activeComparisonSeries}
                                />
                            </Suspense>
                        )}
                    </Box>

                    <ChartSettingsPanel
                        open={isComparisonConfigOpen}
                        onClose={() => setIsComparisonConfigOpen(false)}
                        title="Cấu hình So sánh nền tảng"
                    >
                        <ChartSettingSection title="Chỉ số hiển thị">
                            {comparisonSeries.map(series => (
                                <ChartSettingItem
                                    key={series.key}
                                    label={series.name}
                                    color={series.color}
                                    checked={comparisonVisibleKeys.includes(series.key)}
                                    onChange={() => handleToggleComparisonSeries(series.key)}
                                    isSwitch={true}
                                />
                            ))}
                        </ChartSettingSection>

                        <SourceSelectionSection
                            selectedSources={comparisonSelectedSources}
                            sourceOptions={sourceOptions}
                            onToggle={handleToggleComparisonSource}
                        />
                    </ChartSettingsPanel>
                </Paper>
            </LazyLoader>

            <LazyLoader height={420}>
                <SectionTitle>Channel Performance Table</SectionTitle>
                <MarketingTable
                    data={comparisonData}
                    loading={comparisonLoading}
                    error={comparisonError}
                />
            </LazyLoader>
        </Box>
    );
}

export default MarketingPage;
