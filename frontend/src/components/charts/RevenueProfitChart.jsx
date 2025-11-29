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

    // --- THUẬT TOÁN CHIA VẠCH THÔNG MINH (SMART TICKS) ---
    // Giúp biểu đồ tự động co giãn nhưng vẫn giữ được mốc số đẹp và format chuẩn Việt Nam (B, M, k)
    
    const calculateSmartTicks = (minVal, maxVal) => {
        // 1. Xác định đỉnh mong muốn của biểu đồ (Target Max)
        // Phải lớn hơn dữ liệu thật ít nhất 10% để thoáng mắt (tránh mất chóp)
        // Và tối thiểu phải là 10 Triệu (khi dữ liệu nhỏ)
        const MIN_MONETARY_SCALE_FOR_DISPLAY = 10000000; // 10 Triệu
        let targetMax = Math.max(maxVal * 1.1, MIN_MONETARY_SCALE_FOR_DISPLAY);
        const effectiveMin = Math.max(0, minVal); 
        
        // 2. Tính khoảng cách sơ bộ (chia làm 5-6 khoảng)
        const targetTickCount = 5;
        const rawStep = (targetMax - effectiveMin) / targetTickCount;
        
        // 3. Làm tròn bước nhảy (step) về các số đẹp
        const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
        const normalizedStep = rawStep / magnitude;
        
        let niceStep;
        if (normalizedStep < 1.5) niceStep = 1;
        else if (normalizedStep < 3) niceStep = 2;
        else if (normalizedStep < 7) niceStep = 5;
        else niceStep = 10;
        
        const step = niceStep * magnitude;
        
        // 4. Sinh ra các tick
        let ticks = [];
        let labels = [];
        
        // Bắt đầu từ 0 (hoặc làm tròn xuống)
        // Ví dụ: min=0 -> start=0. min=100 -> start=0.
        let currentTick = Math.floor(effectiveMin / step) * step;
        
        // Chạy cho đến khi vượt qua targetMax
        // Điều kiện này đảm bảo tick cuối cùng luôn cao hơn dữ liệu thật -> Không bao giờ mất chóp
        while (currentTick <= targetMax + step) { 
            ticks.push(currentTick);
            
            // Format label
            let label = '';
            if (currentTick === 0) label = '0';
            else if (currentTick >= 1000000000) label = (currentTick / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
            else if (currentTick >= 1000000) label = (currentTick / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
            else if (currentTick >= 1000) label = (currentTick / 1000).toFixed(0) + 'k';
            else label = currentTick.toString();
            
            labels.push(label);
            
            // Nếu tick này đã bao trọn dữ liệu (lớn hơn maxVal + padding), ta có thể dừng sớm
            if (currentTick > targetMax) break;
            
            currentTick += step;
        }
        
        return { tickVals: ticks, tickText: labels, range: [0, ticks[ticks.length-1]] };
    };

    const { tickVals, tickText, range } = calculateSmartTicks(minY, maxY);

    let yAxisConfig = {
        color: theme.palette.text.secondary,
        gridcolor: theme.palette.divider,
        hoverformat: ',.0f đ',
        showspikes: false, zeroline: true,
        zerolinecolor: theme.palette.divider, zerolinewidth: 2,
        rangeslider: { visible: false },
        
        // Áp dụng Smart Ticks
        tickmode: 'array',
        tickvals: tickVals,
        ticktext: tickText,
        range: range, // Set range cứng theo ticks đã tính toán để đảm bảo khớp
        autorange: false 
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