import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, LabelList } from 'recharts';
import { useTheme } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';
import { formatNumber } from '../../utils/formatters';
import { useCountUp } from '../../hooks/useCountUp';

/**
 * UniversalBarChart
 * Biểu đồ cột đa năng: Hỗ trợ cả cột ngang (layout='vertical') và cột đứng (layout='horizontal').
 */
function UniversalBarChart({ 
    data = [], 
    dataKey = "value",
    labelKey = "name",
    subLabelKey = null,
    unit = "", 
    color = "#36A2EB", // Default color
    height = 300,
    grid = false,
    layout = "vertical" 
}) {
    const theme = useTheme();
    const isVertical = layout === 'vertical';

    // 1. XỬ LÝ DỮ LIỆU & TRẠNG THÁI TRỐNG
    const { processedData, isPlaceholder } = useMemo(() => {
        if (!data || data.length === 0) {
            // TẠO SKELETON DATA (5 cột xám)
            const skeleton = Array.from({ length: 5 }).map((_, i) => ({
                [labelKey]: '',
                [dataKey]: 100 - (i * 10), // Tạo hình bậc thang nhẹ cho đẹp
                isEmpty: true
            }));
            return { processedData: skeleton, isPlaceholder: true };
        }
        
        let sortedData = [...data];
        if (isVertical) {
            sortedData.sort((a, b) => (b[dataKey] || 0) - (a[dataKey] || 0));
        }
        return { processedData: sortedData, isPlaceholder: false };
    }, [data, dataKey, isVertical, labelKey]);

    // Component con để xử lý hiệu ứng số chạy
    const AnimatedLabel = (props) => {
        if (isPlaceholder) return null;
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

    // Custom Tooltip
    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload || !payload.length || payload[0].payload.isEmpty) return null;
        const dataPoint = payload[0].payload;
        const subLabel = subLabelKey ? dataPoint[subLabelKey] : null;

        return (
            <Box sx={{ 
                bgcolor: 'rgba(22, 27, 34, 0.95)', color: '#fff', p: 2, 
                borderRadius: 2, boxShadow: theme.shadows[4], border: `1px solid ${theme.palette.divider}`, maxWidth: 300 
            }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5, borderBottom: `1px solid ${theme.palette.divider}`, pb: 0.5 }}>
                    {label}
                </Typography>
                {subLabel && (
                    <Box sx={{ display: 'flex', gap: 1, mb: 0.5, opacity: 0.8 }}>
                        <Typography variant="caption">Mã:</Typography>
                        <Typography variant="caption" fontWeight="bold">{subLabel}</Typography>
                    </Box>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">Số lượng:</Typography>
                    <Typography variant="body2" fontWeight="bold" sx={{ color: payload[0].color }}>
                        {formatNumber(payload[0].value)}{unit}
                    </Typography>
                </Box>
            </Box>
        );
    };

    return (
        <Box sx={{ width: '100%', height: height, minWidth: 0, position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    layout={layout} 
                    data={processedData}
                    margin={{ top: 20, right: 30, left: 10, bottom: 5 }} 
                    barCategoryGap="25%"
                >
                    {grid && !isPlaceholder && <CartesianGrid strokeDasharray="3 3" vertical={!isVertical} horizontal={isVertical} stroke={theme.palette.divider} opacity={0.2} />}
                    
                    {isVertical ? (
                        <>
                            <XAxis type="number" hide />
                            <YAxis 
                                dataKey={labelKey} 
                                type="category" 
                                width={140}
                                tick={{ fill: theme.palette.text.primary, fontSize: 12, fontWeight: 500 }}
                                tickFormatter={(val) => val && val.length > 18 ? `${val.substring(0, 18)}...` : val}
                                axisLine={false}
                                tickLine={false}
                                hide={isPlaceholder}
                            />
                        </>
                    ) : (
                        <>
                            <XAxis 
                                dataKey={labelKey} 
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
                                interval={2} 
                                hide={isPlaceholder}
                            />
                            <YAxis hide />
                        </>
                    )}

                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)', radius: 4 }} />
                    
                    <Bar 
                        dataKey={dataKey} 
                        radius={[4, 4, 4, 4]} 
                        barSize={isVertical ? 18 : undefined} 
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
                </BarChart>
            </ResponsiveContainer>
        </Box>
    );
}

export default React.memo(UniversalBarChart);