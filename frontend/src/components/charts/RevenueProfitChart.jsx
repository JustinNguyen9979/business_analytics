import React, { useMemo } from 'react';
import {
    ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, Bar
} from 'recharts';
import { useTheme } from '@mui/material/styles';
import { Box, Typography, Paper } from '@mui/material';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { formatCurrency } from '../../utils/formatters';

dayjs.extend(isoWeek);

function RevenueProfitChart({ data, comparisonData, series = [], aggregationType, isLoading, unit = 'đ' }) {
    const theme = useTheme();

    // 1. CHUẨN BỊ DỮ LIỆU
    const chartData = useMemo(() => {
        if (!data || data.length === 0) return [];

        // Map dữ liệu hiện tại
        return data.map((item, index) => {
            const dateStr = item.date;
            const dataPoint = {
                date: dateStr,
                // Format ngày hiển thị cho trục X
                displayDate: aggregationType === 'month' 
                    ? dayjs(dateStr).format('MM/YYYY') 
                    : aggregationType === 'week' 
                        ? `W${dayjs(dateStr).isoWeek()}` 
                        : dayjs(dateStr).format('DD/MM'),
                originalDate: dayjs(dateStr), // Dùng để sort nếu cần
            };

            // Map các chỉ số chính (Current)
            series.forEach(s => {
                const key = s.key || s.dataKey;
                dataPoint[key] = Number(item[key]) || 0;
            });

            // Map dữ liệu so sánh (Previous) - Ghép theo index
            // Lưu ý: Cách ghép này giả định số lượng điểm dữ liệu tương đương nhau
            if (comparisonData && comparisonData[index]) {
                series.forEach(s => {
                    const key = s.key || s.dataKey;
                    dataPoint[`${key}_prev`] = Number(comparisonData[index][key]) || 0;
                });
            }

            return dataPoint;
        });
    }, [data, comparisonData, series, aggregationType]);

    // 1.5 TÍNH TOÁN MAX VALUE ĐỂ SCALE TRỤC Y THỦ CÔNG (An toàn hơn callback của Recharts)
    const maxYValue = useMemo(() => {
        if (!chartData || chartData.length === 0) return 0;
        let max = 0;
        chartData.forEach(point => {
            series.forEach(s => {
                const key = s.key || s.dataKey;
                const val = point[key] || 0;
                const prevVal = point[`${key}_prev`] || 0;
                max = Math.max(max, val, prevVal);
            });
        });
        return max;
    }, [chartData, series]);

    // 2. CONFIG FORMAT TRỤC
    const formatYAxis = (value) => {
        if (value >= 1000000000) return (value / 1000000000).toFixed(1) + 'B' + unit;
        if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M' + unit;
        if (value >= 1000) return (value / 1000).toFixed(0) + 'k' + unit;
        return value.toLocaleString() + unit;
    };

    // 3. CUSTOM TOOLTIP
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            // Lấy ngày đầy đủ từ payload đầu tiên
            const fullDate = payload[0].payload.date;
            const dateLabel = aggregationType === 'month' 
                ? dayjs(fullDate).format('Tháng MM, YYYY')
                : dayjs(fullDate).format('DD/MM/YYYY');

            return (
                <Box sx={{ 
                    bgcolor: 'rgba(22, 27, 34, 0.95)', 
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 2, 
                    p: 2, 
                    boxShadow: theme.shadows[4],
                    minWidth: 200
                }}>
                    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700, color: theme.palette.text.primary, borderBottom: `1px solid ${theme.palette.divider}`, pb: 1 }}>
                        {dateLabel}
                    </Typography>
                    {payload.map((entry, index) => {
                        // Bỏ qua các dòng ẩn (nếu có)
                        if (entry.value === undefined || entry.value === null) return null;
                        
                        const isComparison = entry.dataKey.endsWith('_prev');
                        const baseKey = isComparison ? entry.dataKey.replace('_prev', '') : entry.dataKey;
                        const seriesConfig = series.find(s => (s.key || s.dataKey) === baseKey);
                        const name = seriesConfig ? (seriesConfig.name || seriesConfig.label) : entry.name;
                        
                        return (
                            <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box sx={{ 
                                        width: 12, height: 4, 
                                        borderRadius: 1, 
                                        bgcolor: entry.color,
                                        opacity: isComparison ? 0.6 : 1 
                                    }} />
                                    <Typography variant="body2" sx={{ color: isComparison ? theme.palette.text.secondary : theme.palette.text.primary, fontStyle: isComparison ? 'italic' : 'normal' }}>
                                        {name} {isComparison ? '(Kỳ trước)' : ''}:
                                    </Typography>
                                </Box>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: entry.color }}>
                                    {entry.value.toLocaleString()}{unit}
                                </Typography>
                            </Box>
                        );
                    })}
                </Box>
            );
        }
        return null;
    };

    if (isLoading && (!chartData || chartData.length === 0)) {
        return null; // Skeleton handled by parent
    }

    // REMOVED: Block that returns empty Box when no data. 
    // We now always render the chart structure even with zero/empty data.

    return (
        <Box sx={{ height: '100%', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 30, bottom: 20 }}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={true} stroke={theme.palette.divider} opacity={0.7} />
                    
                    <XAxis 
                        dataKey="displayDate" 
                        axisLine={{ stroke: theme.palette.text.secondary, strokeWidth: 1 }}
                        tickLine={{ stroke: theme.palette.text.secondary }}
                        tick={{ 
                            fill: theme.palette.text.secondary, 
                            fontSize: 10,
                            angle: -45,
                            textAnchor: 'end'
                        }}
                        height={60} // Tăng chiều cao để nhường chỗ cho chữ xoay nghiêng
                        interval={0}
                    />
                    
                    <YAxis 
                        domain={[0, maxYValue === 0 ? 1000000 : 'auto']}
                        allowDataOverflow={false}
                        axisLine={{ stroke: theme.palette.text.secondary, strokeWidth: 1 }}
                        tickLine={{ stroke: theme.palette.text.secondary }}
                        tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                        tickFormatter={formatYAxis}
                        width={60}
                        tickCount={10}
                    />
                    
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: theme.palette.divider, strokeWidth: 1, strokeDasharray: '4 4' }} />
                    
                    <Legend 
                        verticalAlign="bottom" 
                        height={36} 
                        iconType="plainline"
                        iconSize={20}
                        wrapperStyle={{ paddingTop: '20px' }}
                        formatter={(value, entry) => {
                            return <span style={{ color: theme.palette.text.primary, marginRight: 20 }}>{value}</span>;
                        }}
                    />

                    {/* Render Lines / Areas */}
                    {series.map(s => {
                        const key = s.key || s.dataKey;
                        const name = s.name || s.label;

                        return (
                            <React.Fragment key={key}>
                                {/* Đường kỳ trước (Nét đứt, mờ hơn) - CHỈ RENDER NẾU CÓ DỮ LIỆU SO SÁNH */}
                                {comparisonData && comparisonData.length > 0 && (
                                    <Line
                                        type="monotone"
                                        dataKey={`${key}_prev`}
                                        name={`${name} (Kỳ trước)`}
                                        stroke={s.color}
                                        strokeWidth={2}
                                        strokeDasharray="4 4"
                                        opacity={0.6}
                                        dot={false}
                                        activeDot={false}
                                    />
                                )}
                                
                                {/* Đường hiện tại (Nét liền, đậm) */}
                                <defs>
                                    <linearGradient id={`color-${key}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={s.color} stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor={s.color} stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                
                                {s.type === 'bar' ? (
                                    <Bar
                                        dataKey={key}
                                        name={name}
                                        fill={s.color}
                                        radius={[4, 4, 0, 0]}
                                        barSize={20}
                                        animationDuration={1500}
                                    />
                                ) : s.area ? (
                                    <Area
                                        type="monotone"
                                        dataKey={key}
                                        name={name}
                                        stroke={s.color}
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill={`url(#color-${key})`}
                                        dot={{ r: 3, strokeWidth: 0, fill: s.color }}
                                        activeDot={{ r: 6, strokeWidth: 0, fill: s.color }}
                                        animationDuration={1500}
                                    />
                                ) : (
                                    <Line
                                        type="monotone"
                                        dataKey={key}
                                        name={name}
                                        stroke={s.color}
                                        strokeWidth={3}
                                        dot={{ r: 3, strokeWidth: 0, fill: s.color }}
                                        activeDot={{ r: 6, strokeWidth: 0, fill: s.color }}
                                        animationDuration={1500}
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}
                </ComposedChart>
            </ResponsiveContainer>
        </Box>
    );
}

export default RevenueProfitChart;