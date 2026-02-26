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

function RevenueProfitChart({ data, comparisonData, series = [], aggregationType, isLoading, unit = 'đ', xKey = 'date', hideTooltip = false, showBarLabel = false }) {
    const theme = useTheme();

    // 1. CHUẨN BỊ DỮ LIỆU
    const chartData = useMemo(() => {
        if (!data || data.length === 0) return [];

        // Map dữ liệu hiện tại
        return data.map((item, index) => {
            const xValue = item[xKey];
            
            let displayLabel = xValue;
            let fullLabel = xValue;

            // Chỉ format ngày tháng nếu xKey là 'date' (mặc định)
            if (xKey === 'date') {
                displayLabel = aggregationType === 'month' 
                    ? dayjs(xValue).format('MM/YYYY') 
                    : aggregationType === 'week' 
                        ? `W${dayjs(xValue).isoWeek()}` 
                        : dayjs(xValue).format('DD/MM');
                fullLabel = dayjs(xValue);
            }

            const dataPoint = {
                [xKey]: xValue,
                displayDate: displayLabel, // Recharts sẽ dùng key này để hiển thị tick
                originalDate: fullLabel, // Dùng cho tooltip
            };

            // Map các chỉ số chính (Current)
            series.forEach(s => {
                const key = s.key || s.dataKey;
                dataPoint[key] = Number(item[key]) || 0;
            });

            // Map dữ liệu so sánh (Previous) - Ghép theo index
            if (comparisonData && comparisonData[index]) {
                series.forEach(s => {
                    const key = s.key || s.dataKey;
                    dataPoint[`${key}_prev`] = Number(comparisonData[index][key]) || 0;
                });
            }

            return dataPoint;
        });
    }, [data, comparisonData, series, aggregationType, xKey]);

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
        const absValue = Math.abs(value);
        const sign = value < 0 ? '-' : '';
        
        if (absValue >= 1000000000) return sign + (absValue / 1000000000).toFixed(1) + 'B' + unit;
        if (absValue >= 1000000) return sign + (absValue / 1000000).toFixed(1) + 'M' + unit;
        if (absValue >= 1000) return sign + (absValue / 1000).toFixed(0) + 'k' + unit;
        return value.toLocaleString() + unit;
    };

    // 3. CUSTOM TOOLTIP
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            // Lấy label từ payload
            const rawLabel = payload[0].payload.originalDate || payload[0].payload[xKey];
            
            let dateLabel = rawLabel;
            if (xKey === 'date') {
                dateLabel = aggregationType === 'month' 
                    ? dayjs(rawLabel).format('Tháng MM, YYYY')
                    : dayjs(rawLabel).format('DD/MM/YYYY');
            }

            return (
                <Box sx={{ 
                    bgcolor: 'rgba(22, 27, 34, 0.95)', 
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 2, 
                    p: 2, 
                    boxShadow: theme.shadows[4],
                    minWidth: 200,
                    zIndex: 1000
                }}>
                    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700, color: theme.palette.text.primary, borderBottom: `1px solid ${theme.palette.divider}`, pb: 1 }}>
                        {dateLabel}
                    </Typography>
                    {payload.map((entry, index) => {
                        // Bỏ qua các dòng ẩn (nếu có)
                        if (entry.value === undefined || entry.value === null) return null;
                        
                        const isComparison = entry.dataKey.toString().endsWith('_prev');
                        const baseKey = isComparison ? entry.dataKey.replace('_prev', '') : entry.dataKey;
                        const seriesConfig = series.find(s => (s.key || s.dataKey) === baseKey);
                        
                        let name = seriesConfig ? (seriesConfig.name || seriesConfig.label) : entry.name;
                        if (isComparison && !name.includes('Kỳ trước')) {
                            name += ' (Kỳ trước)';
                        }
                        
                        return (
                            <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box sx={{ 
                                        width: 12, height: 4, 
                                        borderRadius: 1, 
                                        bgcolor: entry.color || entry.stroke,
                                        opacity: isComparison ? 0.6 : 1 
                                    }} />
                                    <Typography variant="body2" sx={{ color: isComparison ? theme.palette.text.secondary : theme.palette.text.primary, fontStyle: isComparison ? 'italic' : 'normal' }}>
                                        {name}:
                                    </Typography>
                                </Box>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: entry.color || entry.stroke }}>
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
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
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
                        height={45} // Giảm từ 60 xuống 45
                        interval={aggregationType === 'month' ? 0 : 'preserveStartEnd'}
                    />
                    
                    <YAxis 
                        domain={[0, maxYValue === 0 ? 1000000 : 'auto']}
                        allowDataOverflow={false}
                        axisLine={{ stroke: theme.palette.text.secondary, strokeWidth: 1 }}
                        tickLine={{ stroke: theme.palette.text.secondary }}
                        tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
                        tickFormatter={formatYAxis}
                        width={60} // Tăng lên 60 để hiển thị trọn vẹn
                        tickCount={6} // Giảm số lượng tick để thoáng hơn
                    />
                    
                    {!hideTooltip && (
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: theme.palette.divider, strokeWidth: 1, strokeDasharray: '4 4' }} isAnimationActive={false} />
                    )}
                    
                    <Legend 
                        verticalAlign="bottom" 
                        height={25} // Giảm từ 36 xuống 25
                        iconType="plainline"
                        iconSize={14}
                        wrapperStyle={{ paddingTop: '10px' }} // Giảm từ 20px xuống 10px
                        formatter={(value) => {
                            return <span style={{ color: theme.palette.text.primary, marginRight: 15, fontSize: '11px' }}>{value}</span>;
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
                                        activeDot={{ r: 4, strokeWidth: 0 }}
                                        connectNulls
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
                                        label={showBarLabel ? { 
                                            position: 'top', 
                                            fill: theme.palette.text.primary, 
                                            fontSize: 11,
                                            formatter: (value) => value > 0 ? value.toLocaleString() : ''
                                        } : false}
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