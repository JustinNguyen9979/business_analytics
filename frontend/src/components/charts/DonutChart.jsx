import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '@mui/material/styles';
import { Box, Typography, Stack } from '@mui/material';
import { formatNumber, formatCurrency } from '../../utils/formatters';

const DEFAULT_COLORS = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#8D6E63'];

/**
 * DonutChart - Biểu đồ tròn dạng Generic
 * Hỗ trợ hiển thị Placeholder khi không có dữ liệu.
 */
function DonutChart({ 
    data = [], 
    centerLabel = "TỔNG", 
    centerValue = null,
    unit = "", 
    formatType = 'number',
    height = 300 
}) {
    const theme = useTheme();

    // Helper format
    const formatter = (val) => formatType === 'currency' ? formatCurrency(val) : formatNumber(val);

    // 1. Xử lý dữ liệu & Màu sắc
    const { processedData, isPlaceholder } = useMemo(() => {
        // Kiểm tra dữ liệu đầu vào
        const validData = data && data.length > 0 ? data.filter(item => item.value > 0) : [];
        
        if (validData.length === 0) {
            // Placeholder Mode
            return {
                processedData: [{ name: 'Chưa có dữ liệu', value: 1, color: theme.palette.action.disabledBackground, isEmpty: true }],
                isPlaceholder: true
            };
        }

        // Normal Mode
        const processed = validData.map((item, index) => ({
            ...item,
            color: item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
        }));
        
        return { processedData: processed, isPlaceholder: false };
    }, [data, theme.palette.action.disabledBackground]);

    // Tính tổng giá trị (nếu không phải placeholder)
    const totalValue = useMemo(() => {
        if (isPlaceholder) return 0;
        if (centerValue !== null) return centerValue;
        return processedData.reduce((sum, item) => sum + item.value, 0);
    }, [processedData, centerValue, isPlaceholder]);


    const renderTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const point = payload[0].payload;
            if (point.isEmpty) return null; // Tắt tooltip cho placeholder

            const { name, value, color } = point;
            const currentTotal = processedData.reduce((sum, i) => sum + i.value, 0);
            const percent = currentTotal > 0 ? (value / currentTotal) : 0;
            
            return (
                <Box sx={{ bgcolor: 'rgba(0, 0, 0, 0.85)', color: '#fff', p: 1.5, borderRadius: 2, boxShadow: theme.shadows[4], border: `1px solid ${theme.palette.divider}` }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5, color: color }}>{name}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {formatter(value)}{unit}
                        </Typography>
                        <Typography variant="caption" sx={{ color: theme.palette.grey[400] }}>
                            ({(percent * 100).toFixed(1)}%)
                        </Typography>
                    </Box>
                </Box>
            );
        }
        return null;
    };

    return (
        <Box sx={{ display: 'flex', width: '100%', height: height, alignItems: 'center' }}>
            {/* --- PHẦN 1: CHART --- */}
            <Box sx={{ flex: isPlaceholder ? 1 : 1.5, height: '100%', position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={processedData}
                            cx="50%"
                            cy="50%"
                            innerRadius="55%"
                            outerRadius="80%" 
                            paddingAngle={isPlaceholder ? 0 : 2}
                            dataKey="value"
                            stroke="none"
                            isAnimationActive={!isPlaceholder}
                            labelLine={!isPlaceholder && { stroke: theme.palette.text.secondary, strokeWidth: 1 }}
                            label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                                if (isPlaceholder) return null; // Không hiện label bên ngoài cho placeholder

                                const RADIAN = Math.PI / 180;
                                const radius = outerRadius * 1.25; 
                                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                
                                return (
                                  <text 
                                    x={x} 
                                    y={y} 
                                    fill={theme.palette.text.primary} 
                                    textAnchor={x > cx ? 'start' : 'end'} 
                                    dominantBaseline="central"
                                    style={{ fontSize: '14px', fontWeight: 600 }}
                                  >
                                    {`${(percent * 100).toFixed(1)}%`}
                                  </text>
                                );
                            }}
                        >
                            {processedData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip content={renderTooltip} />
                    </PieChart>
                </ResponsiveContainer>

                {/* Center Label */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center',
                        pointerEvents: 'none',
                        width: '100%'
                    }}
                >
                    <Typography 
                        variant="caption" 
                        color="text.secondary" 
                        sx={{ 
                            display: 'block', 
                            lineHeight: 1,
                            textTransform: 'uppercase',
                            fontSize: '0.75rem',
                            mb: 0.5,
                            fontWeight: 700
                        }}
                    >
                        {centerLabel}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: theme.palette.text.primary, lineHeight: 1 }}>
                        {formatter(totalValue)}
                    </Typography>
                </Box>
            </Box>

            {/* --- PHẦN 2: LEGEND (BÊN PHẢI - CHỈ HIỆN KHI CÓ DATA) --- */}
            {!isPlaceholder && (
                <Box sx={{ flex: 1, pl: 1, pr: 2, maxHeight: '100%', overflowY: 'auto' }}>
                    <Stack spacing={1.5}>
                        {processedData.map((entry) => (
                            <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', overflow: 'hidden', mr: 1 }}>
                                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: entry.color, mr: 1, flexShrink: 0 }} />
                                    <Typography variant="body2" color="text.secondary" noWrap title={entry.name} sx={{ fontSize: '0.85rem' }}>
                                        {entry.name}
                                    </Typography>
                                </Box>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
                                    {formatter(entry.value)}
                                </Typography>
                            </Box>
                        ))}
                    </Stack>
                </Box>
            )}
        </Box>
    );
}

export default React.memo(DonutChart);