import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Box, Typography, useTheme } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

const GaugeChart = ({
    value = 0,
    max = 100,
    title = "Metric",
    unit = "",
    previousValue = null, // Giữ lại tính năng so sánh cũ
    segments = null,      // Mới: Cho Stacked (Bom/Hoàn)
    thresholds = null,    // Mới: Cho Dynamic Color
    reverseColors = false,
    height = 220,
    color = null
}) => {
    const theme = useTheme();

    // --- 1. LOGIC TÍNH TOÁN DATA VẼ BIỂU ĐỒ ---
    let chartData = [];
    let needleValue = value;
    let customColors = [];
    let mainColor = color || theme.palette.primary.main;

    // CASE A: STACKED (Cho Bom/Hoàn)
    if (segments && segments.length > 0) {
        let currentTotal = 0;
        segments.forEach(seg => {
            chartData.push({ name: seg.label, value: seg.value });
            customColors.push(seg.color);
            currentTotal += seg.value;
        });
        const remaining = Math.max(0, max - currentTotal);
        chartData.push({ name: 'Remaining', value: remaining });
        customColors.push(theme.palette.action.hover);
        needleValue = currentTotal;
    } 
    // CASE B: SINGLE VALUE (Cho các chart cũ & Giao hàng)
    else {
        const remaining = Math.max(0, max - value);
        chartData = [
            { name: 'Value', value: value },
            { name: 'Remaining', value: remaining }
        ];

        // Logic Dynamic Color (Cho Giao hàng)
        if (thresholds && thresholds.length === 2) {
            const [good, bad] = thresholds;
            if (reverseColors) { // Thấp là Tốt (VD: Giao hàng)
                if (value <= good) mainColor = theme.palette.success.main;
                else if (value <= bad) mainColor = theme.palette.warning.main;
                else mainColor = theme.palette.error.main;
            } else { // Cao là Tốt (VD: Hoàn thành)
                if (value >= good) mainColor = theme.palette.success.main;
                else if (value >= bad) mainColor = theme.palette.warning.main;
                else mainColor = theme.palette.error.main;
            }
        }
        customColors = [mainColor, theme.palette.action.hover];
    }

    // --- 2. LOGIC SO SÁNH (PREVIOUS VALUE) ---
    // Giữ lại tính năng này để không ảnh hưởng các chart cũ
    let delta = 0;
    let isIncrease = false;
    let showDelta = false;

    if (previousValue !== null && previousValue !== 0) {
        delta = ((needleValue - previousValue) / previousValue) * 100;
        isIncrease = delta >= 0;
        showDelta = true;
    }

    // --- RENDER ---
    return (
        <Box sx={{ width: '100%', height: height, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 600 }}>
                {title}
            </Typography>
            
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="70%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius="70%"
                        outerRadius="100%"
                        paddingAngle={segments ? 2 : 0} // Có khe hở nếu là Stacked
                        dataKey="value"
                        stroke="none"
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={customColors[index]} />
                        ))}
                    </Pie>
                    <Tooltip formatter={(val) => [val + unit]} />
                </PieChart>
            </ResponsiveContainer>

            {/* OVERLAY SỐ LIỆU */}
            <Box sx={{ position: 'absolute', bottom: '25%', textAlign: 'center' }}>
                <Typography variant="h5" fontWeight="bold" color="text.primary">
                    {Number(needleValue).toLocaleString()}{unit}
                </Typography>

                {/* HIỂN THỊ SO SÁNH (DELTA) - GIỐNG CHART CŨ */}
                {showDelta && (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 0.5, color: isIncrease ? theme.palette.success.main : theme.palette.error.main }}>
                        {isIncrease ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
                        <Typography variant="caption" fontWeight="bold">
                            {Math.abs(delta).toFixed(1)}%
                        </Typography>
                    </Box>
                )}
            </Box>

            {/* LEGEND (CHỈ HIỆN KHI CÓ SEGMENTS - BOM/HOÀN) */}
            {segments && (
                <Box sx={{ display: 'flex', gap: 2, mt: -2 }}>
                    {segments.map((seg, i) => (
                        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: seg.color }} />
                            <Typography variant="caption" color="text.primary">
                                {seg.label}: {seg.value}{unit}
                            </Typography>
                        </Box>
                    ))}
                </Box>
            )}
        </Box>
    );
};

export default GaugeChart;
