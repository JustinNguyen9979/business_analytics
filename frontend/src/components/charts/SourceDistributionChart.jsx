import React, { useMemo } from 'react';
import { 
    PieChart, Pie, Cell, 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
    Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { useTheme } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';
import { formatCurrency, formatPercentage } from '../../utils/formatters';

// BỘ MÀU CUSTOM (30 màu)
const BASE_COLORS = [
    "#EA80FC", "#09FBD3", "#FFAB40", "#FF2600", "#48FF6A", "#FFFD82", 
    "#3F00FF", "#0AEBFF", "#00CFA7", "#D72660", "#B1FAFF", "#8475FF", 
    "#F8A8FF", "#FF5F00", "#8C56FF", "#FFD700", "#5F4B8B", "#5D737E",   
    "#EDE574", "#001EFF", "#D2042D", "#F0E36B", "#B0A6DF", "#A7C957",
    "#E8D1C5", "#A47858", "#009B77", "#A89F9D", "#17A2B8", "#F7CAC9"
];

function SourceDistributionChart({ data, dataKey, title, format }) {
    const theme = useTheme();

    // 1. CHUẨN BỊ DỮ LIỆU
    const { chartData, isPlaceholder } = useMemo(() => {
        if (!data) return { chartData: [], isPlaceholder: true };

        // Lọc bỏ dòng tổng cộng và map về dạng chuẩn
        const processed = data
            .filter(item => item.platform !== 'Tổng cộng')
            .map(item => ({
                name: item.platform,
                value: item[dataKey] || 0,
                ...item
            }))
            .filter(item => item.value !== 0);

        // Nếu sau khi lọc mà không có dữ liệu nào (hoặc toàn 0), trả về dữ liệu giả
        if (processed.length === 0) {
            return {
                chartData: [{ name: 'Chưa có dữ liệu', value: 1, isEmpty: true }],
                isPlaceholder: true
            };
        }

        return { chartData: processed, isPlaceholder: false };
    }, [data, dataKey]);

    const totalValue = useMemo(() => {
        if (isPlaceholder) return 0;
        return chartData.reduce((acc, cur) => acc + cur.value, 0);
    }, [chartData, isPlaceholder]);

    // --- RENDER TOOLTIP CUSTOM ---
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const point = payload[0].payload;
            if (point.isEmpty) return null; // Không hiện tooltip cho dữ liệu giả

            const { name, value, color } = point;
            const percent = totalValue > 0 ? value / totalValue : 0;
            
            return (
                <Box sx={{ bgcolor: 'rgba(0, 0, 0, 0.85)', color: '#fff', p: 1.5, borderRadius: 1, boxShadow: 3, minWidth: 120 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: color, mb: 0.5 }}>
                        {name}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body2">
                            {format === 'percent' ? formatPercentage(value) : formatCurrency(value)}
                        </Typography>
                        {format !== 'percent' && (
                            <Typography variant="caption" sx={{ color: '#ccc' }}>
                                ({ (percent * 100).toFixed(1) }%)
                            </Typography>
                        )}
                    </Box>
                </Box>
            );
        }
        return null;
    };

    // --- RENDER CHART ---
    const renderChart = () => {
        // TRƯỜNG HỢP 1: BAR CHART (Cho các chỉ số %, ROI...)
        if (format === 'percent') {
            return (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                        <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                            dy={10}
                        />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                            tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}>
                            {chartData.map((entry, index) => (
                                <Cell 
                                    key={`cell-${index}`} 
                                    fill={entry.isEmpty ? theme.palette.action.disabledBackground : BASE_COLORS[index % BASE_COLORS.length]} 
                                />
                            ))}
                            {!isPlaceholder && (
                                <LabelList 
                                    dataKey="value" 
                                    position="top" 
                                    formatter={(val) => formatPercentage(val)} 
                                    style={{ fill: theme.palette.text.primary, fontSize: 11, fontWeight: 600 }}
                                />
                            )}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            );
        }

        // TRƯỜNG HỢP 2: PIE CHART (Cho Tiền, Số lượng...)
        return (
            <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, bottom: 0, left: 10, right: 10 }}>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius="35%"
                        outerRadius="55%"
                        paddingAngle={isPlaceholder ? 0 : 2}
                        dataKey="value"
                        stroke="none"
                        isAnimationActive={!isPlaceholder} // Tắt animation nếu là placeholder
                        labelLine={!isPlaceholder ? { stroke: theme.palette.text.secondary, strokeWidth: 1 } : false}
                        label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                            if (isPlaceholder) {
                                // Hiển thị số 0 ở giữa nếu là placeholder
                                return (
                                    <text x={cx} y={cy} dy={8} textAnchor="middle" fill={theme.palette.text.disabled} style={{ fontSize: '24px', fontWeight: 'bold' }}>
                                        0
                                    </text>
                                );
                            }

                            const RADIAN = Math.PI / 180;
                            const radius = outerRadius * 1.2; 
                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                          
                            return (
                              <text 
                                x={x} 
                                y={y} 
                                fill={theme.palette.text.primary} 
                                textAnchor={x > cx ? 'start' : 'end'} 
                                dominantBaseline="central"
                                style={{ fontSize: '11px', fontWeight: 600 }}
                              >
                                {`${(percent * 100).toFixed(1)}%`}
                              </text>
                            );
                        }}
                    >
                        {chartData.map((entry, index) => (
                            <Cell 
                                key={`cell-${index}`} 
                                fill={entry.isEmpty ? theme.palette.action.disabledBackground : BASE_COLORS[index % BASE_COLORS.length]} 
                            />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    {!isPlaceholder && (
                        <Legend 
                            layout="horizontal" 
                            verticalAlign="bottom" 
                            align="center"
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                        />
                    )}
                </PieChart>
            </ResponsiveContainer>
        );
    };

    return (
        <Box sx={{ width: '100%', height: '100%', minHeight: 0 }}>
            {renderChart()}
        </Box>
    );
}

export default React.memo(SourceDistributionChart);