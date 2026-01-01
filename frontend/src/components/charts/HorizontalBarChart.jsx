import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, LabelList, Legend } from 'recharts';
import { useTheme } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';
import { formatNumber } from '../../utils/formatters';
import { useCountUp } from '../../hooks/useCountUp';

/**
 * UniversalBarChart
 * Biểu đồ cột đa năng: Hỗ trợ cột đơn, cột chồng (stacked), cột nhóm (grouped).
 * Hỗ trợ cả cột ngang (layout='vertical') và cột đứng (layout='horizontal').
 */
function UniversalBarChart({ 
    data = [], 
    dataKey = "value",      // Dùng cho biểu đồ đơn
    series = [],            // Dùng cho biểu đồ đa chuỗi: [{ dataKey, label, color }]
    labelKey = "name",
    subLabelKey = null,
    unit = "", 
    color = "#36A2EB", 
    height = 300,
    grid = false,
    layout = "vertical",
    stacked = false,        // Bật chế độ cột chồng
    showLegend = false,      // Hiện chú thích (thường dùng cho đa chuỗi)
    hideTooltip = false     // Ẩn tooltip khi hover
}) {
    const theme = useTheme();
    const isVertical = layout === 'vertical';
    const isMultiSeries = series && series.length > 0;

    // 1. XỬ LÝ DỮ LIỆU & TRẠNG THÁI TRỐNG
    const { processedData, isPlaceholder } = useMemo(() => {
        if (!data || data.length === 0) {
            const skeleton = Array.from({ length: 5 }).map((_, i) => ({
                [labelKey]: '',
                [dataKey]: 100 - (i * 10),
                ...(isMultiSeries ? series.reduce((acc, s) => ({ ...acc, [s.dataKey]: 50 }), {}) : {}),
                isEmpty: true
            }));
            return { processedData: skeleton, isPlaceholder: true };
        }
        
        let sortedData = [...data];
        // Chỉ sort nếu là biểu đồ đơn và cột ngang
        if (isVertical && !isMultiSeries) {
            sortedData.sort((a, b) => (b[dataKey] || 0) - (a[dataKey] || 0));
        }
        return { processedData: sortedData, isPlaceholder: false };
    }, [data, dataKey, isVertical, labelKey, isMultiSeries, series]);

    // Component con để xử lý hiệu ứng số chạy (Chỉ hiện cho biểu đồ đơn để tránh rối)
    const AnimatedLabel = (props) => {
        if (isPlaceholder || isMultiSeries) return null;
        const { x, y, width, height, value } = props;
        const count = useCountUp(value, 1000);

        let textProps = {
            x: x + width + 8,
            y: y + height / 2 + 4,
            textAnchor: "start"
        };

        if (!isVertical) {
            textProps = { x: x + width / 2, y: y - 5, textAnchor: "middle" };
        }

        return (
            <text {...textProps} fill={theme.palette.text.secondary} fontSize={12} fontWeight={600}>
                {Math.floor(count).toLocaleString('vi-VN')}
            </text>
        );
    };

    // Custom Tooltip đa năng
    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload || !payload.length || payload[0].payload.isEmpty) return null;
        const dataPoint = payload[0].payload;
        const subLabel = subLabelKey ? dataPoint[subLabelKey] : null;

        return (
            <Box sx={{ 
                bgcolor: 'rgba(22, 27, 34, 0.95)', color: '#fff', p: 2, 
                borderRadius: 2, boxShadow: theme.shadows[4], border: `1px solid ${theme.palette.divider}`, minWidth: 200 
            }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, borderBottom: `1px solid ${theme.palette.divider}`, pb: 0.5 }}>
                    {label}
                </Typography>
                
                {subLabel && (
                    <Box sx={{ display: 'flex', gap: 1, mb: 1, opacity: 0.8 }}>
                        <Typography variant="caption">Mã:</Typography>
                        <Typography variant="caption" fontWeight="bold">{subLabel}</Typography>
                    </Box>
                )}

                <Stack spacing={0.5}>
                    {payload.map((entry, index) => (
                        <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: entry.color }} />
                                <Typography variant="body2" color="text.secondary">{entry.name || 'Giá trị'}:</Typography>
                            </Box>
                            <Typography variant="body2" fontWeight="bold" sx={{ color: entry.color }}>
                                {formatNumber(entry.value)}{unit}
                            </Typography>
                        </Box>
                    ))}
                    
                    {isMultiSeries && stacked && (
                        <Box sx={{ pt: 1, mt: 1, borderTop: `1px dashed ${theme.palette.divider}`, display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2" fontWeight="bold">Tổng cộng:</Typography>
                            <Typography variant="body2" fontWeight="bold">
                                {formatNumber(payload.reduce((sum, p) => sum + (p.value || 0), 0))}{unit}
                            </Typography>
                        </Box>
                    )}
                </Stack>
            </Box>
        );
    };

    return (
        <Box sx={{ width: '100%', height: height, minWidth: 0, position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    layout={layout} 
                    data={processedData}
                    margin={{ top: 20, right: 50, left: 10, bottom: 5 }} 
                    barCategoryGap={isMultiSeries && !stacked ? "15%" : "25%"}
                >
                    {grid && !isPlaceholder && <CartesianGrid strokeDasharray="3 3" vertical={!isVertical} horizontal={isVertical} stroke={theme.palette.divider} opacity={0.2} />}
                    
                    <XAxis 
                        type={isVertical ? "number" : "category"} 
                        dataKey={isVertical ? undefined : labelKey}
                        hide={isPlaceholder || isVertical}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
                    />
                    
                    <YAxis 
                        type={isVertical ? "category" : "number"}
                        dataKey={isVertical ? labelKey : undefined}
                        width={isVertical ? 140 : 0}
                        tick={{ fill: theme.palette.text.primary, fontSize: 12, fontWeight: 500 }}
                        tickFormatter={(val) => val && val.length > 18 ? `${val.substring(0, 18)}...` : val}
                        axisLine={false}
                        tickLine={false}
                        hide={isPlaceholder || !isVertical}
                    />

                    <Tooltip 
                        content={hideTooltip ? () => null : <CustomTooltip />} 
                        cursor={hideTooltip ? false : { fill: 'rgba(255,255,255,0.05)', radius: 4 }} 
                    />
                    {showLegend && <Legend wrapperStyle={{ paddingTop: 10 }} />}
                    
                    {isMultiSeries ? (
                        series.map((s, index) => (
                            <Bar 
                                key={s.dataKey}
                                name={s.label}
                                dataKey={s.dataKey}
                                stackId={stacked ? "stack" : undefined}
                                fill={isPlaceholder ? theme.palette.action.disabledBackground : s.color}
                                radius={
                                    stacked 
                                        ? (index === series.length - 1 
                                            ? (isVertical ? [0, 4, 4, 0] : [4, 4, 0, 0]) 
                                            : [0, 0, 0, 0]) 
                                        : (isVertical ? [0, 4, 4, 0] : [4, 4, 0, 0])
                                }
                                isAnimationActive={!isPlaceholder}
                                maxBarSize={40}
                            >
                                <LabelList 
                                    dataKey={s.dataKey} 
                                    position={isVertical ? "right" : "top"} 
                                    fill={theme.palette.text.primary} 
                                    fontSize={11} 
                                    fontWeight="bold"
                                    formatter={(val) => val > 0 ? `${stacked ? val : formatNumber(val)}${unit}` : ''}
                                />
                            </Bar>
                        ))
                    ) : (
                        <Bar 
                            dataKey={dataKey} 
                            radius={isVertical ? [0, 4, 4, 0] : [4, 4, 4, 4]} 
                            maxBarSize={40} 
                            isAnimationActive={!isPlaceholder}
                        >
                            {processedData.map((entry, index) => (
                                <Cell 
                                    key={`cell-${index}`} 
                                    fill={isPlaceholder ? theme.palette.action.disabledBackground : (typeof color === 'function' ? color(index, entry[dataKey]) : color)} 
                                    opacity={isPlaceholder ? 0.5 : 1}
                                />
                            ))}
                            <LabelList dataKey={dataKey} content={<AnimatedLabel />} />
                        </Bar>
                    )}
                </BarChart>
            </ResponsiveContainer>
        </Box>
    );
}

import { Stack } from '@mui/material';
export default React.memo(UniversalBarChart);