// FILE: frontend/src/components/charts/CostDonutChart.jsx (PHIÊN BẢN CUỐI CÙNG - SỬA LỖI LEADER LINE)

import React, { useState, useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';
import { useTheme } from '@mui/material/styles';
import { Box } from '@mui/material';
import { formatCurrency } from '../../utils/formatters';
import { useCountUp } from '../../hooks/useCountUp';
import Plotly from 'plotly.js/dist/plotly-cartesian';

const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function CostDonutChart({ cogs = 0, executionCost = 0, adSpend = 0 }) {
    const theme = useTheme();
    adSpend = adSpend > 0 ? adSpend : 0;
    const totalCost = cogs + executionCost + adSpend;
    const animatedTotalCost = useCountUp(totalCost, 800);
    const [chartData, setChartData] = useState([]);
    const realColors = [theme.palette.secondary.main, '#17a2b8', '#ffc107'];

    const chartContainerRef = useRef(null); 

    useEffect(() => {
        const labels = ['Giá vốn (COGS)', 'Phí thực thi', 'Chi phí Ads'];
        const finalValues = totalCost > 0 ? [cogs, executionCost, adSpend] : [1];
        const placeholderColor = theme.palette.divider;
        const totalValueSum = totalCost > 0 ? totalCost : 1;

        const backgroundTrace = {
            labels: labels, values: finalValues,
            marker: { colors: finalValues.map(() => placeholderColor) },
            type: 'pie', hole: 0.7, hoverinfo: 'none', textinfo: 'none', sort: false, rotation: 90,
            showlegend: false
        };

        const duration = 800;
        let startTime = null;
        let animationFrameId;

        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const rawProgress = Math.min(elapsed / duration, 1);
            const progress = easeInOutCubic(rawProgress);
            const isAnimationComplete = rawProgress >= 1;

            let currentFrameValues = [0, 0, 0];
            let accumulatedProgress = 0;

            for (let i = 0; i < finalValues.length; i++) {
                const valueProgress = finalValues[i] / totalValueSum;
                if (progress > accumulatedProgress + valueProgress) {
                    currentFrameValues[i] = finalValues[i];
                } else if (progress > accumulatedProgress) {
                    const progressWithinSlice = (progress - accumulatedProgress) / valueProgress;
                    currentFrameValues[i] = finalValues[i] * progressWithinSlice;
                    break;
                }
                accumulatedProgress += valueProgress;
            }

            // <<< LOGIC MỚI: TÁCH BIỆT ANIMATION VÀ HIỂN THỊ LABEL >>>
            const foregroundTrace = {
                labels: labels,
                values: currentFrameValues,
                marker: { colors: realColors, line: { color: theme.palette.background.paper, width: 2 } },
                type: 'pie', hole: 0.7,
                sort: false,
                rotation: 90,
                hoverinfo: 'label+value',
                
                // GIAI ĐOẠN 1: Trong khi animation, không hiển thị bất kỳ text nào
                textinfo: 'none',
                
                // GIAI ĐOẠN 2: Khi animation kết thúc, bật các thuộc tính này lên
                ...(isAnimationComplete && {
                    textinfo: 'percent',
                    textposition: 'outside',
                    texttemplate: '%{percent:.1%}',
                    outsidetextfont: { size: 16, family: 'Inter, sans-serif', color: theme.palette.text.primary },
                })
            };
            
            setChartData([backgroundTrace, foregroundTrace]);

            if (!isAnimationComplete) {
                animationFrameId = requestAnimationFrame(animate);
            }
        };

        animationFrameId = requestAnimationFrame(animate);
        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            
            // Tìm phần tử con (nơi Plotly vẽ) và Purge nó
            if (chartContainerRef.current) {
                // Plotly thường vẽ vào div con đầu tiên hoặc chính nó
                try {
                    Plotly.purge(chartContainerRef.current);
                } catch (e) {
                    // Bỏ qua lỗi nếu Plotly chưa kịp khởi tạo
                }
            }
            // Giải phóng mảng dữ liệu
            setChartData([]); 
        };

    }, [cogs, executionCost, adSpend, theme]);

    const layout = {
        annotations: [{ font: { size: 22, color: theme.palette.text.primary, family: 'Inter, sans-serif' }, showarrow: false, text: `<b>${formatCurrency(animatedTotalCost)}</b>`, x: 0.5, y: 0.5 }],
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        showlegend: totalCost > 0,
        barmode: 'stack', 
        legend: { font: { color: theme.palette.text.secondary }, orientation: 'h', yanchor: 'bottom', y: -0.2, xanchor: 'center', x: 0.5 },
        margin: { t: 40, b: 60, l: 40, r: 40 },
        xaxis: { visible: false, showgrid: false },
        yaxis: { visible: false, showgrid: false },
        automargin: true,
        uniformtext: {
            minsize: 12,
            mode: 'hide'
        },
        piecolorway: realColors, // Sử dụng lại mảng màu để Plotly tô màu cho text
    };

    return (
        <Box ref={chartContainerRef} sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
            <Plot
                key={Date.now()}
                data={chartData}
                layout={layout}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: false, responsive: true }}
                revision={Date.now()}
            />
        </Box>
    );
}

export default CostDonutChart;