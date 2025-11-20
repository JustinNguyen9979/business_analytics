// FILE: frontend/src/components/charts/RevenueProfitChart.jsx (PHIÊN BẢN ANIMATION "CHẠY TỪ DƯỚI LÊN")

import React, { useState, useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js/dist/plotly-cartesian';
import { useTheme } from '@mui/material/styles';
import { Paper, Typography, Box } from '@mui/material';
import dayjs from 'dayjs';

// Hàm "Easing" để animation mượt hơn (bắt đầu chậm, tăng tốc rồi chậm lại ở cuối)
const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function RevenueProfitChart({ data, comparisonData, chartRevision, aggregationType }) {
    const theme = useTheme();
    const [animatedData, setAnimatedData] = useState([]);
    const animationFrameId = useRef(null);
    const chartRef = useRef(null);

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
        const createChartTraces = (currentData, comparisonData) => {
            const currentPoints = currentData;
            const currentDates = currentPoints.map(d => dayjs(d.date).toDate());
            const currentRevenues = currentPoints.map(d => d.netRevenue);
            const currentProfits = currentPoints.map(d => d.profit);

            const comparisonPoints = comparisonData || [];
            let dateOffset = 0;
            if (currentData.length > 0 && comparisonData && comparisonData.length > 0) {
                dateOffset = dayjs(currentData[0].date).diff(dayjs(comparisonData[0].date), 'milliseconds');
            }
            const comparisonDates = comparisonPoints.map(d => dayjs(d.date).add(dateOffset, 'milliseconds').toDate());
            const comparisonRevenues = comparisonPoints.map(d => d.netRevenue);
            const comparisonProfits = comparisonPoints.map(d => d.profit);

            const traceStyles = {
                comparisonRevenue: { type: 'scatter', mode: 'lines', name: 'Doanh thu ròng (Kỳ trước)    ', 
                    line: { color: theme.palette.primary.main, width: 2, dash: 'dot' }, 
                    opacity: 0.6, 
                    connectgaps: false, 
                    hovertemplate: `<span style="color: ${theme.palette.text.secondary};">DTR (Kỳ trước): </span><b style="color: ${theme.palette.primary.main};">%{y:,.0f} đ</b><extra></extra>`, 
                    legendgroup: 'group1' 
                },

                comparisonProfit: { type: 'scatter', mode: 'lines', name: 'Lợi nhuận (Kỳ trước)    ', 
                    line: { color: '#28a545', width: 2, dash: 'dot' }, 
                    opacity: 0.6, connectgaps: false, 
                    hovertemplate: `<span style="color: ${theme.palette.text.secondary};">LN (Kỳ trước): </span><b style="color: #28a545;">%{y:,.0f} đ</b><extra></extra>`, 
                    legendgroup: 'group2' },

                currentRevenue: { type: 'scatter', 
                    mode: 'lines+markers', 
                    name: 'Doanh thu ròng    ', 
                    line: { color: theme.palette.primary.main, width: 2 }, 
                    marker: { color: theme.palette.primary.main, size: 5 }, 
                    connectgaps: false, 
                    hovertemplate: `<span style="color: ${theme.palette.text.secondary};">Doanh thu ròng: </span><b style="color: ${theme.palette.primary.main};">%{y:,.0f} đ</b><extra></extra>`, 
                    legendgroup: 'group3' },

                currentProfit: { type: 'scatter', 
                    mode: 'lines+markers', 
                    name: 'Lợi nhuận    ', 
                    line: { color: '#28a545', width: 2 }, 
                    marker: { color: '#28a545', size: 5 }, 
                    connectgaps: false, 
                    hovertemplate: `<span style="color: ${theme.palette.text.secondary};">Lợi nhuận: </span><b style="color: #28a545;">%{y:,.0f} đ</b><extra></extra>`, 
                    legendgroup: 'group4' },
            };

            return [
                { x: comparisonDates, y: comparisonRevenues, ...traceStyles.comparisonRevenue },
                { x: comparisonDates, y: comparisonProfits, ...traceStyles.comparisonProfit },
                { x: currentDates, y: currentRevenues, ...traceStyles.currentRevenue },
                { x: currentDates, y: currentProfits, ...traceStyles.currentProfit },
            ];
        };

        // --- LOGIC ANIMATION MỚI SỬ DỤNG requestAnimationFrame ---
        const finalTraces = createChartTraces(data, comparisonData);
        const duration = 800;
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
            if (chartRef.current) {
                Plotly.purge(chartRef.current);
                // console.log("Plotly instance purged.");
            }
        };

    }, [data, comparisonData, theme]);


    // --- PHẦN LAYOUT ---
    const allYValues = [
        ...(data?.map(d => d.netRevenue) || []),
        ...(data?.map(d => d.profit) || []),
        ...(comparisonData?.map(d => d.netRevenue) || []),
        ...(comparisonData?.map(d => d.profit) || [])
    ].filter(v => typeof v === 'number'); // Lọc ra các giá trị không hợp lệ

    // 2. Tìm giá trị LỚN NHẤT và NHỎ NHẤT
    const maxY = allYValues.length > 0 ? Math.max(...allYValues) : 1;
    const minY = allYValues.length > 0 ? Math.min(...allYValues) : 0;

    // 3. Tính toán khoảng đệm (padding) để biểu đồ không bị sát lề
    const dataSpan = maxY - minY;
    // Nếu tất cả giá trị bằng nhau (span=0), tạo một khoảng đệm mặc định
    const padding = dataSpan === 0 ? Math.abs(maxY * 0.2) || 1 : dataSpan * 0.1;

    // 4. Xác định khoảng hiển thị cuối cùng cho trục Y
    const yAxisRange = [
        // Nếu giá trị nhỏ nhất là số dương, trục Y vẫn bắt đầu từ 0 cho trực quan
        // Nếu là số âm, bắt đầu từ dưới số đó một chút (trừ đi padding)
        minY >= 0 ? 0 : minY - padding,
        // Luôn kết thúc ở trên giá trị lớn nhất một chút (cộng thêm padding)
        maxY + padding
    ];

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
        yaxis: {
            range: yAxisRange,
            color: theme.palette.text.secondary,
            gridcolor: theme.palette.divider,
            hoverformat: ',.0f đ',
            showspikes: false, zeroline: true, // Hiển thị đường zero line để dễ so sánh
            zerolinecolor: theme.palette.divider, zerolinewidth: 2,
            rangeslider: { visible: false },
        },
        legend: {
            font: { color: theme.palette.text.secondary, size: 16 },
            // THÊM CÁC DÒNG NÀY ĐỂ CHUYỂN CHÚ THÍCH XUỐNG DƯỚI
            orientation: 'h',      // Hiển thị theo hàng ngang
            yanchor: 'top',     // Neo vào cạnh dưới
            y: -0.3,               // Đẩy nó xuống dưới trục X một chút (-0.3 là một giá trị tương đối)
            xanchor: 'center',     // Căn giữa theo chiều ngang
            x: 0.5,                 // Đặt ở vị trí 50% chiều rộng của biểu đồ
            traceorder: 'normal',
            valign: 'top',
        },
        // Tăng margin dưới để có không gian cho chú thích
        margin: { l: 80, r: 40, b: 80, t: 60 },
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

    if (!data || data.length === 0) {
        return (
            <Paper variant="placeholder" sx={{ height: 450, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary">Không có dữ liệu để hiển thị biểu đồ.</Typography>
            </Paper>
        );
    }

    return (
        <Box ref={chartRef}>
            <Box sx={{ height: '450px' }}>
                <Plot
                    data={animatedData}
                    layout={layout}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '100%' }}
                    config={{ displayModeBar: false, responsive: true }}
                    revision={chartRevision}
                />
            </Box>
        </Box>
    );
}

export default RevenueProfitChart;