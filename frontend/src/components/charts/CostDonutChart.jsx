import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '@mui/material/styles';
import { Box, Typography, Stack } from '@mui/material';
import { formatCurrency } from '../../utils/formatters';
import { useCountUp } from '../../hooks/useCountUp';

function CostDonutChart({ total_cost = 0, cogs = 0, execution_cost = 0, ad_spend = 0 }) {
    const theme = useTheme();

    // Ép kiểu số an toàn
    const numTotal = Number(total_cost) || 0;
    const numCogs = Number(cogs) || 0;
    const numExec = Number(execution_cost) || 0;
    const numAds = Number(ad_spend) || 0;

    // Sử dụng hook để tạo hiệu ứng số chạy
    const animatedTotalCost = useCountUp(numTotal, 1000); 

    // Tính toán dữ liệu
    const sumKnownParts = numCogs + numExec + numAds;
    const otherCost = Math.max(0, numTotal - sumKnownParts);
    const hasData = numTotal > 0;

    const data = hasData ? [
        { name: 'Giá vốn (COGS)', value: numCogs, color: theme.palette.secondary.main },
        { name: 'Phí thực thi', value: numExec, color: '#17a2b8' },
        { name: 'Chi phí Ads', value: numAds, color: '#ffc107' },
    ] : [];

    if (otherCost > 1) {
        data.push({ name: 'Khác', value: otherCost, color: theme.palette.grey[500] });
    }

    const renderTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const { name, value, color } = payload[0].payload;
            const percent = numTotal > 0 ? (value / numTotal) : 0;
            return (
                <Box sx={{ bgcolor: 'rgba(0, 0, 0, 0.8)', color: '#fff', p: 1.5, borderRadius: 1, boxShadow: 3 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5, color: color }}>{name}</Typography>
                    <Typography variant="body2">{formatCurrency(value)}</Typography>
                    {hasData && <Typography variant="caption" sx={{ color: '#ccc' }}>({(percent * 100).toFixed(1)}%)</Typography>}
                </Box>
            );
        }
        return null;
    };

    return (
        <Box sx={{ display: 'flex', width: '100%', height: '100%', minHeight: 300, alignItems: 'center' }}>
            {/* PHẦN 1: BIỂU ĐỒ TRÒN (BÊN TRÁI) */}
            <Box sx={{ flex: 1, height: '100%', position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius="50%"
                            outerRadius="75%" 
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                            isAnimationActive={true}
                            labelLine={{ stroke: theme.palette.text.secondary, strokeWidth: 1 }}
                            label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
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
                                    style={{ fontSize: '13px', fontWeight: 600 }}
                                  >
                                    {`${(percent * 100).toFixed(1)}%`}
                                  </text>
                                );
                            }}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        {hasData && <Tooltip content={renderTooltip} />}
                    </PieChart>
                </ResponsiveContainer>

                {/* Center Label: Căn giữa tuyệt đối trong Box biểu đồ */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center',
                        pointerEvents: 'none',
                        width: '100%' // Đảm bảo text không bị co
                    }}
                >
                    <Typography 
                        variant="overline" 
                        color="text.secondary" 
                        sx={{ 
                            display: 'block', 
                            lineHeight: 1,
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            mb: 0.5
                        }}
                    >
                        TỔNG
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: theme.palette.text.primary, lineHeight: 1 }}>
                        {formatCurrency(animatedTotalCost)}
                    </Typography>
                </Box>
            </Box>

            {/* PHẦN 2: CHÚ THÍCH CUSTOM (BÊN PHẢI) */}
            {hasData && (
                <Box sx={{ width: 180, pl: 2, pr: 5, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <Stack spacing={2}>
                        {data.map((entry) => (
                            <Box key={entry.name}>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: entry.color, mr: 1 }} />
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                        {entry.name}
                                    </Typography>
                                </Box>
                                <Typography variant="body2" sx={{ fontWeight: 'bold', pl: 2.2 }}>
                                    {formatCurrency(entry.value)}
                                </Typography>
                            </Box>
                        ))}
                    </Stack>
                </Box>
            )}
        </Box>
    );
}

// Tối ưu hóa render: Chỉ render lại khi các giá trị chi phí thay đổi
export default React.memo(CostDonutChart, (prevProps, nextProps) => {
    return (
        prevProps.total_cost === nextProps.total_cost &&
        prevProps.cogs === nextProps.cogs &&
        prevProps.execution_cost === nextProps.execution_cost &&
        prevProps.ad_spend === nextProps.ad_spend
    );
});
