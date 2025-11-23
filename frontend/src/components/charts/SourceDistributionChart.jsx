// FILE: frontend/src/components/charts/SourceDistributionChart.jsx

import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { useTheme } from '@mui/material/styles';
import { Box, Typography, Paper } from '@mui/material';
import { formatCurrency, formatPercentage } from '../../utils/formatters';


// BỘ MÀU CUSTOM THEO YÊU CẦU CỦA ANH (mở rộng lên 30 màu)
const BASE_COLORS = [
    // "#D2042D", // Đỏ đậm
    // "#F0E36B", // Vàng chanh
    // "#B0A6DF", // Tím sáng (dùng thay cho #5C3E4E để hợp với nền tối)
    // "#A7C957", // Xanh lá cây
    // "#E8D1C5", // Be hồng nhạt
    // "#A47858", // Nâu đất
    // "#009B77", // Xanh lá cây teal
    // "#A89F9D", // Xám bạc
    // "#17A2B8", // Xanh dương nhạt
    // "#F7CAC9"  // Hồng pastel
    "#EA80FC", "#09FBD3", 
    "#FFAB40", "#FF2600", 
    "#48FF6A", "#FFFD82", 
    "#3F00FF", "#0AEBFF", 
    "#00CFA7", "#D72660", 
    "#B1FAFF", "#8475FF", 
    "#F8A8FF", "#FF5F00", 
    "#8C56FF", "#FFD700", 
    "#5F4B8B", "#5D737E",   
    "#EDE574", "#001EFF"
];

const COLORS = [];
for (let i = 0; i < 30; i++) {
    COLORS.push(BASE_COLORS[i % BASE_COLORS.length]);
}


function SourceDistributionChart({ data, dataKey, title, format }) {
    const theme = useTheme();

    // Dữ liệu đã được sắp xếp từ component cha, không cần sắp xếp lại ở đây.
    const chartData = useMemo(() => {
        if (!data) return [];
        return data.filter(item => item.platform !== 'Tổng cộng');
    }, [data]);

    if (!chartData || chartData.length === 0) {
        return (
            <Paper variant="glass" sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="caption" color="text.secondary">Chưa có dữ liệu</Typography>
            </Paper>
        );
    }

    const labels = chartData.map(d => d.platform);
    const values = chartData.map(d => d[dataKey] || 0);

    const baseLayout = {
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { family: 'Inter, sans-serif', color: theme.palette.text.secondary }
    };

    let plotData = [];
    let layout = {};

    // LOGIC 1: Dùng DONUT CHART cho các chỉ số cộng dồn (Tiền)
    if (format === 'currency' || format === 'number') {
        plotData = [{
            values: values,
            labels: labels,
            type: 'pie',
            hole: 0.6,
            textinfo: 'percent',
            textposition: 'outside',
            automargin: true,
            outsidetextfont: { size: 13, color: theme.palette.text.primary, family: 'Inter, sans-serif' },
            hoverinfo: 'label+value+percent',
            hovertemplate: `<b>%{label}</b><br>%{value:,.0f} đ<br>(%{percent})<extra></extra>`,
            marker: { 
                colors: labels.map((_, index) => COLORS[index % COLORS.length]),
                line: { color: theme.palette.background.paper, width: 2 } 
            },
            sort: false // Rất quan trọng: không để Plotly tự sắp xếp lại
        }];

        layout = {
            ...baseLayout,
            margin: { t: 0, b: 5, l: 0, r: 0 }, 
            showlegend: true,
                        legend: {
                            orientation: 'h',
                            yanchor: 'top',
                            y: -0.15, // Giữ vị trí y đã điều chỉnh
                            xanchor: 'center', // Căn giữa
                            x: 0.5,       // Đặt ở giữa
                            font: { color: theme.palette.text.secondary, size: 13 },
                            itemwidth: 40, // Giữ độ rộng của mỗi item
                        }
        };
    } 

    // LOGIC 2: Dùng BAR CHART cho các chỉ số Phần trăm (ROI) - Vì % không cộng dồn được
    else {
        const maxValue = Math.max(...values, 0);

        let dynamicDtick;
        if (maxValue <= 1.5) dynamicDtick = 0.2;
        else if (maxValue <= 4.0) dynamicDtick = 0.5;
        else if (maxValue <= 10.0) dynamicDtick = 1.0;
        else dynamicDtick = Math.ceil(maxValue / 5);
        
        const coloredLabels = labels.map((label, index) => {
            const color = COLORS[index % COLORS.length];
            return `<span style="color: ${color}; font-weight: bold;">${label}</span>`;
        });

        const annotations = labels.map((label, index) => ({
            x: coloredLabels[index],
            y: values[index],
            text: formatPercentage(values[index]),
            xanchor: 'center',
            yanchor: 'bottom',
            showarrow: false,
            yshift: 5,
            font: { 
                color: theme.palette.text.primary, 
                size: values.length > 4 ? 10 : 12,
                family: 'Inter, sans-serif'
            }
        }));

        plotData = [{
            x: coloredLabels,
            y: values,
            type: 'bar',
            textfont: { 
                color: theme.palette.text.primary, 
                size: values.length > 4 ? 10 : 13 
            }, 
            cliponaxis: false,
            hoverinfo: 'x+y',
            hovertemplate: `%{y:.2%}<extra></extra>`,
            marker: { color: labels.map((_, index) => COLORS[index % COLORS.length]) },
            width: values.length > 3 ? 0.6 : 0.4, 
        }];
        
        layout = { 
            ...baseLayout,
            margin: { t: 5, b: 30, l: 40, r: values.length > 4 ? 5 : 10 }, 
            annotations: annotations,
            showlegend: false,
            xaxis: { 
                showgrid: false, 
                tickfont: { color: theme.palette.text.primary, size: 13 },
                ticks: 'outside',
                ticklen: 10,
                tickcolor: 'transparent',
                tickangle: -45,
                automargin: true
            },
            yaxis: { 
                showgrid: true, 
                gridcolor: theme.palette.divider, 
                tickfont: { size: 13 },
                zeroline: false,
                range: [0, maxValue * 1.2],
                dtick: dynamicDtick,
                tickformat: '.0%',
            },
        };
    }

    return (
        <Paper variant="glass" sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="caption" color="text.secondary" align="center" sx={{ mb: 1, textTransform: 'uppercase', fontWeight: 'bold' }}>
                Phân bổ {title}
            </Typography>
            <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                <Plot
                    data={plotData}
                    layout={layout}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '100%' }}
                    config={{ displayModeBar: false, responsive: true }}
                />
            </Box>
        </Paper>
    );
}

export default SourceDistributionChart;