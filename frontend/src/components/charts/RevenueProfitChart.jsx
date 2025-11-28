// FILE: frontend/src/components/charts/RevenueProfitChart.jsx (PHIÊN BẢN ANIMATION "CHẠY TỪ DƯỚI LÊN")

import React, { useState, useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js/dist/plotly-cartesian';
import { useTheme } from '@mui/material/styles';
import { Paper, Typography, Box } from '@mui/material';
import dayjs from 'dayjs';
import ChartPlaceholder from '../common/ChartPlaceholder';

// Hàm "Easing" để animation mượt hơn (bắt đầu chậm, tăng tốc rồi chậm lại ở cuối)
const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function RevenueProfitChart({ data, comparisonData, chartRevision, aggregationType, series = [], isLoading }) {
    const theme = useTheme();
    const [animatedData, setAnimatedData] = useState([]);
    const animationFrameId = useRef(null);
    const chartContainerRef = useRef(null);

    useEffect(() => {
        // Hủy animation cũ nếu có
        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
        }
        
        if (!data || data.length === 0) {
            setAnimatedData([]);
            return;
        }

        // --- HÀM TẠO CẤU TRÚC DỮ LIỆU ---
        const createChartTraces = (currentData, comparisonData, series) => {
            const currentPoints = currentData;
            const currentDates = currentPoints.map(d => dayjs(d.date).toDate());

            const comparisonPoints = comparisonData || [];
            let dateOffset = 0;
            if (currentData.length > 0 && comparisonData && comparisonData.length > 0) {
                dateOffset = dayjs(currentData[0].date).diff(dayjs(comparisonData[0].date), 'milliseconds');
            }
            const comparisonDates = comparisonPoints.map(d => dayjs(d.date).add(dateOffset, 'milliseconds').toDate());

            return series.flatMap ( s => {
                const currentValues = currentPoints.map(d => d[s.key])
                const comparisonValues = comparisonPoints.map(d => d[s.key])

                const comparisonTrace = {
                    x: comparisonDates,
                    y: comparisonValues,
                    type: 'scatter',
                    mode: 'lines',
                    name: `${s.name} (Kỳ trước)`,
                    line: {color: s.color, width: 2, dash: 'dot'},
                    opacity: 0.6,
                    connectgaps: false,
                    hovertemplate: `<span style="color: ${theme.palette.text.secondary};">${s.name} (Kỳ trước): </span><b style="color: ${s.color};">%{y:,.0f} đ</b><extra></extra>`, 
                };

                const currentTrace = {
                    x: currentDates,
                    y: currentValues,
                    type: 'scatter',
                    mode: 'lines+markers',
                    name: s.name,
                    line: { color: s.color, width: 2 },
                    marker: { color: s.color, size: 5 },
                    connectgaps: false,
                    hovertemplate: `<span style="color: ${theme.palette.text.secondary};">${s.name}: </span><b style="color: ${s.color};">%{y:,.0f} đ</b><extra></extra>`,
                };

                if (comparisonValues.every(v => v === undefined || v === null)) {
                    return [currentTrace];
                }

                return [comparisonTrace, currentTrace];
            });
        };

        // --- LOGIC ANIMATION MỚI SỬ DỤNG requestAnimationFrame ---
        const finalTraces = createChartTraces(data, comparisonData, series);
        const duration = 1200;
        let startTime = null;

        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const rawProgress = Math.min(elapsed / duration, 1);
            const progress = easeInOutCubic(rawProgress);

            const currentFrameData = finalTraces.map(trace => ({
                ...trace,
                y: trace.y.map(endValue => endValue * progress),
            }));
            
            setAnimatedData(currentFrameData);

            if (rawProgress < 1) {
                animationFrameId.current = requestAnimationFrame(animate);
            }
        };

        animationFrameId.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
            // Purge Plotly WebGL context
            if (chartContainerRef.current) {
                try {
                     Plotly.purge(chartContainerRef.current);
                } catch(e) {}
            }
            setAnimatedData([]); // Clear state
        };

    }, [data, comparisonData, theme, series, isLoading]);


    // --- PHẦN LAYOUT ---

    const allYValues = series.flatMap(s => [
        ...(data?.map(d => d[s.key]) || []),
        ...(comparisonData?.map(d => d[s.key]) || [])
    ]).filter(v => typeof v === 'number');

    // 2. Tìm giá trị LỚN NHẤT và NHỎ NHẤT
    let maxY = allYValues.length > 0 ? Math.max(...allYValues) : 0;
    const minY = allYValues.length > 0 ? Math.min(...allYValues) : 0;

    // --- LOGIC QUAN TRỌNG: ĐỊNH HÌNH QUY MÔ TIỀN TỆ ---
    // Nếu doanh thu < 10 Triệu (hoặc bằng 0), ta ép biểu đồ hiển thị khung 0 - 10 Triệu.
    // Điều này giúp biểu đồ luôn "ra dáng" tiền tệ, không bị hiển thị lèo tèo 1, 2 đồng.
    const MIN_MONETARY_SCALE = 10000000; // 10 Triệu
    if (maxY < MIN_MONETARY_SCALE) {
        maxY = MIN_MONETARY_SCALE;
    }

    // 3. Tính toán khoảng đệm (padding) để biểu đồ không bị sát lề
    // ... (Giữ nguyên logic cũ) ...
    const padding = maxY * 0.1; // Padding đơn giản 10%

    // --- HÀM FORMAT SỐ TIỀN (Custom formatter) ---
    const formatCurrencyAxis = (val) => {
        if (val === 0) return '0';
        if (val >= 1000000000) return (val / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
        if (val >= 1000000) return (val / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'; // Ưu tiên hiện M (Triệu)
        if (val >= 1000) return (val / 1000).toFixed(0) + 'k';
        return val.toString();
    };

    // --- XỬ LÝ FORMAT TRỤC Y (LOGIC MỚI V3 - TỰ TÍNH TICKVALS) ---
    
    let tickVals = [];
    let tickText = [];
    let chartRange = [];

    // Dữ liệu (hoặc scale ảo) đã đảm bảo >= 10M, ta dùng logic chia vạch tự động
    const roughStep = maxY / 5;
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const normalizedStep = roughStep / magnitude;
    let step;
    if (normalizedStep < 1.5) step = 1 * magnitude;
    else if (normalizedStep < 2.5) step = 2 * magnitude;
    else if (normalizedStep < 5.5) step = 5 * magnitude;
    else step = 10 * magnitude;

    // Tạo mảng tickVals: 0, step, 2*step... đến khi vượt qua maxY một chút
    // Ví dụ scale 10M: 0, 2M, 4M, 6M, 8M, 10M
    for (let v = 0; v <= maxY + (step * 0.1); v += step) {
        tickVals.push(v);
        tickText.push(formatCurrencyAxis(v));
    }
    
    chartRange = [minY >= 0 ? 0 : minY - padding, tickVals[tickVals.length - 1] * 1.05];

    let yAxisConfig = {
        color: theme.palette.text.secondary,
        gridcolor: theme.palette.divider,
        hoverformat: ',.0f đ',
        showspikes: false, zeroline: true,
        zerolinecolor: theme.palette.divider, zerolinewidth: 2,
        rangeslider: { visible: false },
        
        // Áp dụng Custom Ticks
        tickmode: 'array',
        tickvals: tickVals,
        ticktext: tickText,
        range: chartRange
    };

    const getXAxisConfig = () => { 
        const tick0 = data.length > 0 ? dayjs(data[0].date).toDate() : new Date();
        switch (aggregationType) {
            case 'month': return { tickmode: 'linear', tick0: tick0, dtick: 'M1', tickformat: '%b %Y', };
            case 'week': return { tickmode: 'linear', tick0: tick0, dtick: 7 * 24 * 60 * 60 * 1000, tickformat: 'Tuần %W', };
            case 'day': default: return { tickmode: 'linear', tick0: tick0, dtick: 24 * 60 * 60 * 1000, tickformat: '%d', };
        }
    };

    const layout = {
        autosize: true,
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        // Bỏ transition đi vì ta tự quản lý animation
        xaxis: {
            ...getXAxisConfig(),
            color: theme.palette.text.secondary,
            gridcolor: theme.palette.divider,
            showspikes: false,
        },
        yaxis: yAxisConfig, // Sử dụng config động đã tạo ở trên
        legend: {
            font: { color: theme.palette.text.secondary, size: 16 },
            orientation: 'h',
            yanchor: 'top',
            y: -0.1, // Giảm khoảng cách từ biểu đồ xuống chú thích
            xanchor: 'center',
            x: 0.5,
            traceorder: 'normal',
            valign: 'top',
        },
        // Giảm margin dưới để tối ưu không gian
        margin: { l: 80, r: 40, b: 60, t: 60 },
        hovermode: 'x',
        hoverlabel: { 
            bgcolor: 'rgba(10, 25, 41, 0.9)', 
            bordercolor: theme.palette.divider, 
            font: { 
                family: 'Inter, Roboto, sans-serif', 
                size: 14, 
                color: '#e8d283ff' 
            }, 
            namelength: -1, 
            align: 'left',
        },
    };

    if (isLoading) {
        return <ChartPlaceholder message="Đang tải dữ liệu biểu đồ..." />;
    }

    if (!data || data.length === 0 || !series || series.length === 0) {
        return <ChartPlaceholder message="Không có dữ liệu để hiển thị." />;
    }

    return (
        <Box ref={chartContainerRef} sx={{ height: '100%', width: '100%' }}>
            <Plot
                key={chartRevision}
                data={animatedData}
                layout={layout}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: false, responsive: true }}
                revision={chartRevision}
            />
        </Box>
    );
}

export default RevenueProfitChart;