// FILE: frontend/src/components/charts/RevenueProfitChart.jsx

import React from 'react';
import Plot from 'react-plotly.js';
import { useTheme } from '@mui/material/styles';
import { Paper, Typography } from '@mui/material';
import { formatCurrency } from '../../utils/formatters';

function RevenueProfitChart({ data }) {
    const theme = useTheme();

    // Xử lý trường hợp không có dữ liệu để vẽ
    if (!data || data.length === 0) {
        return (
            <Paper variant="placeholder" sx={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary">Không có dữ liệu để hiển thị biểu đồ.</Typography>
            </Paper>
        );
    }

    // Tách dữ liệu thành các mảng riêng biệt cho Plotly
    const dates = data.map(d => d.date);
    const revenues = data.map(d => d.netRevenue);
    const profits = data.map(d => d.profit);

    // Cấu hình cho biểu đồ
    const chartData = [
        {
            x: dates,
            y: revenues,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Doanh thu',
            line: { color: theme.palette.primary.main, width: 2 },
            marker: { color: theme.palette.primary.main, size: 6 },
        },
        {
            x: dates,
            y: profits,
            type: 'scatter',
            mode: 'lines+markers',
            name: 'Lợi nhuận',
            line: { color: '#28a745', width: 2 }, // Màu xanh lá cây cho lợi nhuận
            marker: { color: '#28a745', size: 6 },
        }
    ];

    const layout = {
        title: {
            text: 'Biểu đồ Doanh thu & Lợi nhuận',
            font: {
                color: theme.palette.text.primary,
                size: 18,
            },
        },
        autosize: true,
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        xaxis: {
            color: theme.palette.text.secondary,
            gridcolor: theme.palette.divider,
        },
        yaxis: {
            color: theme.palette.text.secondary,
            gridcolor: theme.palette.divider,
            // Định dạng hover cho trục Y hiển thị tiền tệ
            hoverformat: ',.0f đ',
        },
        legend: {
            font: { color: theme.palette.text.secondary },
        },
        margin: { l: 80, r: 40, b: 40, t: 60 }, // Điều chỉnh lề
    };

    return (
        <Paper variant="glass" sx={{ p: 2, height: '450px' }}>
            <Plot
                data={chartData}
                layout={layout}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: true }} // Ẩn thanh công cụ của Plotly
            />
        </Paper>
    );
}

export default RevenueProfitChart;