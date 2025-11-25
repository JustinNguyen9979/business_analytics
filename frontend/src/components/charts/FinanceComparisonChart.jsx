import React from 'react';
import Plot from 'react-plotly.js';
import { useTheme } from '@mui/material/styles';
import { Box, Paper, Typography } from '@mui/material';
import ChartPlaceholder from '../common/ChartPlaceholder';

/**
 * Biểu đồ cột nhóm để so sánh các chỉ số tài chính giữa các nền tảng.
 * @param {object} props
 * @param {Array<object>} props.data - Dữ liệu đã được sắp xếp, vd: [{ platform: 'Shopee', gmv: 1000, profit: 100 }, ...]
 * @param {Array<object>} props.series - Cấu hình các cột cần vẽ, vd: [{ key: 'gmv', name: 'GMV', color: '#ff0000' }]
 * @param {string} props.title - Tiêu đề của biểu đồ.
 */
function FinanceComparisonChart({ data, series, title }) {
    const theme = useTheme();

    if (!data || data.length === 0 || !series || series.length === 0) {
        return <ChartPlaceholder message="Không có dữ liệu để so sánh." />;
    }

    // Tách riêng tên các nền tảng để làm trục X
    const platforms = data.map(item => item.platform);

    // Chuyển đổi dữ liệu thành "traces" mà Plotly yêu cầu
    const nTraces = series.length;
    const groupWidth = 0.1;
    const barWidth = groupWidth / nTraces;
    const traces = series.map((s, i) => {
        const offset = -groupWidth / 2 + barWidth / 2 + i * barWidth;
        return {
            x: platforms,
            y: data.map(item => item[s.key] || 0),
            name: s.name,
            type: 'bar',
            width: barWidth,
            offset: offset,
            marker: {
                color: s.color,
            },
            hovertemplate: `<span style="color: ${theme.palette.text.secondary};">${s.name}: </span><b style="color: ${s.color} ;">%{y:,.0f} đ</b><extra></extra>`,
        };
    });

    const layout = {
        showlegend: false,
        title: {
            text: title,
            font: {
                color: theme.palette.text.primary,
                size: 18,
            },
            x: 0.05,
            y: 0.95,
        },
        autosize: true,
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        xaxis: {
            color: theme.palette.text.secondary,
            gridcolor: 'transparent', // Bỏ grid dọc
        },
        yaxis: {
            color: theme.palette.text.secondary,
            gridcolor: theme.palette.divider,
            hoverformat: ',.0f đ',
        },
        margin: { l: 80, r: 40, b: 20, t: 80 },
        hovermode: 'x unified', // Hiển thị tooltip cho cả nhóm khi hover
        hoverlabel: {
            bgcolor: 'rgba(10, 25, 41, 0.9)',
            bordercolor: theme.palette.divider,
            font: {
                family: 'Inter, Roboto, sans-serif',
                size: 14,
                color: '#e8d283ff'
            },
        },
    };

    return (
        <Paper variant="glass" elevation={0} sx={{ height: '100%', p: 2 }}>
            <Box sx={{ height: '100%', width: '100%' }}>
                <Plot
                    data={traces}
                    layout={layout}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '100%' }}
                    config={{ displayModeBar: false, responsive: true }}
                />
            </Box>
        </Paper>
    );
}

export default FinanceComparisonChart;
