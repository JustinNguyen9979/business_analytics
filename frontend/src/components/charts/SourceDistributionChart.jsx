// FILE: frontend/src/components/charts/SourceDistributionChart.jsx

import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { useTheme } from '@mui/material/styles';
import { Box, Typography, Paper } from '@mui/material';
import { formatCurrency, formatPercentage } from '../../utils/formatters';

function SourceDistributionChart({ data, dataKey, title, format, height = 250 }) {
    const theme = useTheme();

    // Lọc bỏ dòng 'Tổng cộng' và sắp xếp giảm dần để biểu đồ đẹp hơn
    const chartData = useMemo(() => {
        if (!data) return [];
        return data
            .filter(item => item.platform !== 'Tổng cộng')
            .sort((a, b) => (b[dataKey] || 0) - (a[dataKey] || 0));
    }, [data, dataKey]);

    if (!chartData || chartData.length === 0) {
        return (
            <Paper variant="glass" sx={{ height: height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="caption" color="text.secondary">Chưa có dữ liệu</Typography>
            </Paper>
        );
    }

    const labels = chartData.map(d => d.platform);
    const values = chartData.map(d => d[dataKey] || 0);
    
    // Màu sắc cho các Sàn (Shopee: Cam, TikTok: Đen/Trắng, v.v..)
    // Hoặc dùng màu mặc định của Theme
    const colors = [
        theme.palette.primary.main, 
        theme.palette.secondary.main, 
        theme.palette.success.main, 
        theme.palette.warning.main,
        theme.palette.error.main
    ];

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
                colors: colors, 
                line: { color: theme.palette.background.paper, width: 2 } 
            },
            sort: false
        }];

        layout = {
            ...baseLayout,
            // Margin đáy lớn (60-80px) để chứa Legend
            margin: { t: 0, b: 5, l: 0, r: 0 }, 
            showlegend: true,
            legend: {
                orientation: 'h',
                yanchor: 'top',
                y: -0.2, 
                xanchor: 'center',
                x: 0.5,
                font: { color: theme.palette.text.secondary, size: 11 },
                itemwidth: 30,
            }
        };
    } 

    // LOGIC 2: Dùng BAR CHART cho các chỉ số Phần trăm (ROI) - Vì % không cộng dồn được
    else {
        const maxValue = Math.max(...values, 0);
        
        const coloredLabels = labels.map((label, index) => {
            const color = colors[index % colors.length];
            // Thêm font-weight: bold để chữ màu trông rõ nét hơn trên nền tối
            return `<span style="color: ${color}; font-weight: bold;">${label}</span>`;
        });

        const annotations = labels.map((label, index) => ({
            x: coloredLabels[index],              // Vị trí trục X (Tên sàn)
            y: values[index],      // Vị trí trục Y (Giá trị % cột)
            text: formatPercentage(values[index]), // Nội dung chữ
            xanchor: 'center',
            yanchor: 'bottom',     // Neo vào đáy chữ (để chữ nằm trên điểm y)
            showarrow: false,      // Không hiện mũi tên
            
            // === TĂNG KHOẢNG CÁCH TẠI ĐÂY ===
            yshift: 5, // Đẩy chữ lên cao 10px so với đỉnh cột
            // ================================
            
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
            // Set màu chữ trắng để nổi bật trên nền cột xanh
            textfont: { 
                color: theme.palette.text.primary, 
                size: values.length > 4 ? 10 : 13 
            }, 
            cliponaxis: false,
            hoverinfo: 'x+y',
            hovertemplate: `%{y:.2%}<extra></extra>`,
            marker: { color: values.map((_, index) => colors[index % colors.length]), }, 
            width: values.length > 3 ? 0.6 : 0.4, 
        }];
        
        layout = { 
            ...baseLayout,
            // Margin đáy nhỏ (30px), Margin trái lớn (40px) để hiện số trục Y
            margin: { t: 5, b: 30, l: 40, r: values.length > 4 ? 5 : 10 }, 
            annotations: annotations,
            showlegend: false, // Tắt chú thích -> Không bị khoảng trống thừa
            xaxis: { 
                showgrid: false, 
                tickfont: { color: theme.palette.text.primary, size: 13 },
                ticks: 'outside',
                ticklen: 10,
                tickcolor: 'transparent'
            },
            yaxis: { 
                showgrid: true, 
                gridcolor: theme.palette.divider, 
                tickfont: { size: 13 },
                // Thêm padding cho trục Y để cột không chạm nóc
                zeroline: false,
                range: [0, maxValue * 1.2],
                dtick: 0.2,
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