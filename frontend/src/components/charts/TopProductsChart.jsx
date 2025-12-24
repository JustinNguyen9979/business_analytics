import React, { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList
} from 'recharts';
import { useTheme } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';

import { useCountUp } from '../../hooks/useCountUp';

/**
 * Biểu đồ Top Sản phẩm bán chạy (Horizontal Bar Chart) sử dụng Recharts.
 * Đồng bộ style với các biểu đồ khác trong hệ thống.
 * 
 * @param {Array} data - Mảng dữ liệu [{ name: 'Sp A', total_quantity: 100, sku: 'SKU1' }, ...]
 */
function TopProductsChart({ data }) {
    const theme = useTheme();

    // 1. XỬ LÝ DỮ LIỆU
    const chartData = useMemo(() => {
        if (!data || data.length === 0) return [];
        // Recharts vẽ từ dưới lên trên, nên ta đảo ngược mảng để Top 1 nằm trên cùng
        // Tuy nhiên, với layout="vertical" và trục category, ta cần data[0] là cái đầu tiên
        // Hãy thử giữ nguyên thứ tự và kiểm tra hiển thị
        return [...data].map(item => ({
            ...item,
            // Cắt ngắn tên nếu quá dài để hiển thị trên trục
            displayName: item.name.length > 25 ? item.name.substring(0, 25) + '...' : item.name
        }));
    }, [data]);

    // 2. CONFIG MÀU SẮC
    // Top 3 dùng màu secondary (nổi bật), còn lại dùng primary
    const getBarColor = (index) => {
        if (index < 3) return theme.palette.warning.main; // Top 1, 2, 3
        return theme.palette.primary.main;
    };

    // 3. CUSTOM TOOLTIP
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const dataPoint = payload[0].payload;
            return (
                <Box sx={{ 
                    bgcolor: 'rgba(22, 27, 34, 0.95)', 
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 2, 
                    p: 2, 
                    boxShadow: theme.shadows[4],
                    maxWidth: 300
                }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700, color: theme.palette.text.primary, borderBottom: `1px solid ${theme.palette.divider}`, pb: 0.5 }}>
                        {dataPoint.name}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                        <Typography variant="body2" color="text.secondary">SKU:</Typography>
                        <Typography variant="body2" fontWeight={500}>{dataPoint.sku}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mt: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">Số lượng:</Typography>
                        <Typography variant="body2" fontWeight={600} color={payload[0].color}>
                            {dataPoint.total_quantity.toLocaleString('vi-VN')}
                        </Typography>
                    </Box>
                </Box>
            );
        }
        return null;
    };

    if (!chartData || chartData.length === 0) {
        return (
            <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="body2" color="text.secondary">Chưa có dữ liệu sản phẩm</Typography>
            </Box>
        );
    }

    // Component con để xử lý hiệu ứng số chạy (Count Up) bên trong SVG
    const AnimatedLabel = (props) => {
        const { x, y, width, height, value } = props;
        const count = useCountUp(value, 1000);

        return (
            <text 
                x={x + width + 8} 
                y={y + height / 2 + 4} 
                fill={theme.palette.text.secondary}
                fontSize={12}
                fontWeight={600}
                textAnchor="start"
            >
                {Math.floor(count).toLocaleString('vi-VN')}
            </text>
        );
    };

    return (
        <Box sx={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    layout="vertical"
                    data={chartData}
                    margin={{ top: 20, right: 60, left: 10, bottom: 20 }}
                    barSize={24}
                    barGap={8}
                >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme.palette.divider} opacity={0.3} />
                    
                    <XAxis 
                        type="number" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
                        domain={[0, 'auto']}
                        hide 
                    />
                    
                    <YAxis 
                        type="category" 
                        dataKey="displayName" 
                        width={150}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: theme.palette.text.primary, fontSize: 12, fontWeight: 500 }}
                        interval={0} 
                    />
                    
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />

                    <Bar dataKey="total_quantity" radius={[0, 4, 4, 0]} animationDuration={1000}>
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getBarColor(index)} />
                        ))}
                        {/* Thay thế LabelList mặc định bằng Custom Content */}
                        <LabelList dataKey="total_quantity" content={<AnimatedLabel />} />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </Box>
    );
}

export default React.memo(TopProductsChart, (prev, next) => {
    return prev.data === next.data;
});