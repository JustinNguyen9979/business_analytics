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

    const platforms = data && data.length > 0 ? data.map(item => item.platform) : [];

    // Chuyển đổi dữ liệu thành "traces" mà Plotly yêu cầu
    const traces = series && series.length > 0 && data && data.length > 0
        ? series.map((s, i) => {
            // Logic tính offset và width chỉ khi có dữ liệu để vẽ bar
            const nTraces = series.length;
            const groupWidth = 0.1; // Độ rộng của một nhóm bar
            const barWidth = groupWidth / nTraces;
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
        })
        : []; // Trả về mảng rỗng nếu không có dữ liệu hoặc series

    // --- LOGIC TÍNH TOÁN TRỤC Y (Smart Ticks) ---
    // Lấy tất cả giá trị Y để tính min/max
    const allYValues = data && data.length > 0 && series && series.length > 0
        ? series.flatMap(s => data.map(item => item[s.key] || 0))
        : [0];

    let maxY = Math.max(...allYValues);
    const minY = Math.min(...allYValues);

    // Quy mô tối thiểu là 10 Triệu để giữ form biểu đồ đẹp
    const MIN_MONETARY_SCALE = 10000000; 
    if (maxY < MIN_MONETARY_SCALE) {
        maxY = MIN_MONETARY_SCALE;
    }

    // Hàm chia vạch thông minh (copy từ RevenueProfitChart)
    const calculateSmartTicks = (minVal, maxVal) => {
        const MIN_MONETARY_SCALE_FOR_DISPLAY = 10000000;
        let targetMax = Math.max(maxVal * 1.1, MIN_MONETARY_SCALE_FOR_DISPLAY);
        const effectiveMin = Math.max(0, minVal); 
        
        const targetTickCount = 5;
        const rawStep = (targetMax - effectiveMin) / targetTickCount;
        
        const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
        const normalizedStep = rawStep / magnitude;
        
        let niceStep;
        if (normalizedStep < 1.5) niceStep = 1;
        else if (normalizedStep < 3) niceStep = 2;
        else if (normalizedStep < 7) niceStep = 5;
        else niceStep = 10;
        
        const step = niceStep * magnitude;
        
        let ticks = [];
        let labels = [];
        let currentTick = Math.floor(effectiveMin / step) * step;
        
        while (currentTick <= targetMax + step) { 
            ticks.push(currentTick);
            let label = '';
            if (currentTick === 0) label = '0';
            else if (currentTick >= 1000000000) label = (currentTick / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
            else if (currentTick >= 1000000) label = (currentTick / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
            else if (currentTick >= 1000) label = (currentTick / 1000).toFixed(0) + 'k';
            else label = currentTick.toString();
            labels.push(label);
            if (currentTick > targetMax) break;
            currentTick += step;
        }
        // Thêm 5% buffer cho range max để đường kẻ ngang trên cùng không bị mất
        return { tickVals: ticks, tickText: labels, range: [0, ticks[ticks.length-1] * 1.05] };
    };

    const { tickVals, tickText, range } = calculateSmartTicks(minY, maxY);

    const layout = {
        showlegend: true,
        legend: {
            x: 1.02,
            y: 1,
            xanchor: 'left',
            yanchor: 'top',
            font: {
                color: theme.palette.text.secondary,
                size: 14,
            },
            bgcolor: 'transparent',
        },

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
            type: 'category', // BẮT BUỘC: Ép kiểu Category để không bị hiển thị số âm vô nghĩa khi rỗng
            fixedrange: true, // Không cho zoom trục X
            ticks: 'outside',
            ticklen: 20,
            tickcolor: 'transparent',
            tickfont: {
                size: 17, // Tăng cỡ chữ tên Source
            },
            showspikes: false,
        },
        yaxis: {
            color: theme.palette.text.secondary,
            gridcolor: theme.palette.divider,
            hoverformat: ',.0f đ',
            // Áp dụng Smart Ticks
            tickmode: 'array',
            tickvals: tickVals,
            ticktext: tickText,
            range: range,
            autorange: false,
            zeroline: true,
            zerolinecolor: theme.palette.divider,
            showspikes: false,
        },
        margin: { l: 80, r: 40, b: 47, t: 20 }, // Tăng margin bottom (b) từ 20 lên 50
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
        <Box sx={{ height: '100%', width: '100%' }}>
            <Plot
                data={traces}
                layout={layout}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: false, responsive: true }}
            />
        </Box>
    );
}

export default FinanceComparisonChart;
