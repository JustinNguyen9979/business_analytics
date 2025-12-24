import React, { useState, useMemo } from 'react';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { useTheme } from '@mui/material/styles';
import { Box, Typography, Paper } from '@mui/material';
import { formatCurrency } from '../../utils/formatters';

/**
 * Biểu đồ cột so sánh tài chính giữa các nền tảng (Sử dụng Recharts).
 * @param {object} props
 * @param {Array<object>} props.data - Dữ liệu, vd: [{ platform: 'Shopee', net_revenue: 1000, profit: 100 }, ...]
 * @param {Array<object>} props.series - Cấu hình các cột, vd: [{ key: 'net_revenue', name: 'Doanh thu', color: '#ff0000' }]
 */
function FinanceComparisonChart({ data = [], series = [], title }) {
    const theme = useTheme();

    // 2. Custom Tooltip để hiển thị đẹp hơn
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <Box sx={{ 
                    bgcolor: 'rgba(22, 27, 34, 0.95)', 
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 2, 
                    p: 2, 
                    boxShadow: theme.shadows[4],
                    minWidth: 180
                }}>
                    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700, color: theme.palette.text.primary, borderBottom: `1px solid ${theme.palette.divider}`, pb: 1 }}>
                        {label}
                    </Typography>
                    {payload.map((entry, index) => (
                        <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: entry.color }} />
                                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>{entry.name}:</Typography>
                            </Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: entry.color }}>
                                {formatCurrency(entry.value)}
                            </Typography>
                        </Box>
                    ))}
                </Box>
            );
        }
        return null;
    };

    // 3. Hàm rút gọn số tiền cho trục Y (ví dụ: 1.5M, 2B)
    const formatYAxis = (value) => {
        if (value >= 1000000000) return (value / 1000000000).toFixed(1) + 'B';
        if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
        if (value >= 1000) return (value / 1000).toFixed(0) + 'k';
        return value;
    };

    // Tạo payload tùy chỉnh cho Legend để đảm bảo thứ tự khớp với series
    const legendPayload = series.map(s => ({
        id: s.key,
        dataKey: s.key,
        value: s.name,
        color: s.color,
        type: 'rect'
    }));

    const hasData = data && data.length > 0;
    // Nếu không có data, set domain mặc định 0 - 10 Triệu để hiện trục số ảo
    const yAxisDomain = hasData ? [0, 'auto'] : [0, 10000000];
    
    // Tạo data giả định với tất cả giá trị = 0 để Recharts nhận diện được keys
    const fallbackData = useMemo(() => {
        if (hasData) return [];
        const dummyItem = { platform: '' };
        series.forEach(s => dummyItem[s.key] = 0);
        return [dummyItem];
    }, [hasData, series]);

    return (
        <Box sx={{ height: '100%', width: '100%', position: 'relative' }}>
            {title && (
                <Typography variant="h6" sx={{ position: 'absolute', top: 10, left: 10, zIndex: 10 }}>
                    {title}
                </Typography>
            )}
            
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={hasData ? data : fallbackData} // Sử dụng fallbackData thông minh hơn
                    margin={{ top: 40, right: 20, left: 20, bottom: 20 }} // Giảm lề phải xuống 20px
                    barGap={4}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} opacity={0.5} />
                    
                    <XAxis 
                        dataKey="platform" 
                        axisLine={{ stroke: theme.palette.text.secondary, strokeWidth: 1 }}
                        tickLine={false}
                        tick={{ fill: theme.palette.text.secondary, fontSize: 13, fontWeight: 500 }}
                        dy={10}
                    />
                    
                    <YAxis 
                        axisLine={{ stroke: theme.palette.text.secondary, strokeWidth: 1 }}
                        tickLine={false}
                        tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                        tickFormatter={formatYAxis}
                        width={60}
                        domain={yAxisDomain}
                    />
                    
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    
                    <Legend 
                        layout="horizontal" 
                        verticalAlign="bottom" 
                        align="center"
                        iconType="circle"
                        iconSize={10}
                        payload={legendPayload} // Sử dụng payload tùy chỉnh
                        formatter={(value) => (
                            <span style={{ 
                                color: theme.palette.text.secondary, 
                                marginRight: 25
                            }}>
                                {value}
                            </span>
                        )}
                        wrapperStyle={{ 
                            paddingTop: 30, 
                            fontSize: 14,
                            userSelect: 'none'
                        }}
                    />

                    {/* Render các cột Bar dựa trên cấu hình series */}
                    {series.map((s, index) => (
                        <Bar 
                            key={s.key}
                            dataKey={s.key}
                            name={s.name}
                            fill={s.color}
                            radius={[4, 4, 0, 0]} 
                            maxBarSize={60}
                            animationDuration={500}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </Box>
    );
}

// Tối ưu hóa render: Chỉ render lại khi data hoặc series thay đổi
export default React.memo(FinanceComparisonChart, (prevProps, nextProps) => {
    return (
        prevProps.title === nextProps.title &&
        prevProps.data === nextProps.data &&
        prevProps.series === nextProps.series
    );
});