// FILE: frontend/src/components/charts/RevenueProfitChart.jsx (PHIÊN BẢN ANIMATION "CHẠY TỪ DƯỚI LÊN")

import React, { useState, useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js/dist/plotly-cartesian';
import { useTheme } from '@mui/material/styles';
import { Paper, Typography, Box } from '@mui/material';
import isoWeek from 'dayjs/plugin/isoWeek';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import dayjs from 'dayjs';
import ChartPlaceholder from '../common/ChartPlaceholder';

dayjs.extend(isoWeek);
dayjs.extend(weekOfYear);
dayjs.extend(advancedFormat);

// Hàm "Easing" để animation mượt hơn (bắt đầu chậm, tăng tốc rồi chậm lại ở cuối)
const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function RevenueProfitChart({ data, comparisonData, chartRevision, aggregationType, series = [], isLoading, selectedDateRange }) {
    
        const theme = useTheme();
        const [animatedData, setAnimatedData] = useState([]);
        const animationFrameId = useRef(null);
        const chartContainerRef = useRef(null);
        
        // Tạo key duy nhất dựa trên ngày bắt đầu để force re-mount
        const chartKey = `${chartRevision}-${selectedDateRange?.[0]?.toString() || 'init'}-${aggregationType}`;

    useEffect(() => {
        // Hủy animation cũ nếu có
        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
        }
        
        // RESET LOGIC: Nếu data thay đổi, ta xóa sạch chart cũ trước để tránh "kẹt"
        setAnimatedData([]);

        // --- HÀM TẠO CẤU TRÚC DỮ LIỆU ---
        const createChartTraces = (currentData, comparisonData, series) => {
            const currentPoints = currentData;
            const currentDates = currentData.map(d => dayjs(d.date).toDate());

            const comparisonPoints = comparisonData || [];
            let dateOffset = 0;
            if (currentData.length > 0 && comparisonData && comparisonData.length > 0) {
                dateOffset = dayjs(currentData[0].date).diff(dayjs(comparisonData[0].date), 'milliseconds');
            }
            const comparisonDates = comparisonPoints.map(d => dayjs(d.date).add(dateOffset, 'milliseconds').toDate());

            return series.flatMap ( s => {
                // SANITIZE: Ép kiểu số an toàn, loại bỏ NaN/null/undefined
                const currentValues = currentPoints.map(d => {
                    const val = Number(d[s.key]);
                    return Number.isFinite(val) ? val : 0;
                });
                
                const comparisonValues = comparisonPoints.map(d => {
                     const val = Number(d[s.key]);
                     return Number.isFinite(val) ? val : 0;
                });

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
                
                // Chỉ ẩn comparison nếu toàn bộ giá trị thực sự là 0 hoặc null
                if (comparisonValues.every(v => v === 0)) {
                    return [currentTrace];
                }

                return [comparisonTrace, currentTrace];
            });
        };

        // --- LOGIC ANIMATION MỚI SỬ DỤNG requestAnimationFrame ---
        const finalTraces = createChartTraces(data, comparisonData, series);
        
        // DEBUG: Kiểm tra dữ liệu trace cuối cùng
        // console.log("Final Traces Prepared:", finalTraces);

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

        // FIX: Dùng setTimeout để đẩy việc bắt đầu animation sang frame tiếp theo,
        // đảm bảo state setAnimatedData([]) đã được thực thi và UI đã clear.
        const timer = setTimeout(() => {
             animationFrameId.current = requestAnimationFrame(animate);
        }, 50);

        return () => {
            clearTimeout(timer); // Clear timeout
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };

    }, [data, comparisonData, theme, series, isLoading, selectedDateRange]); // Thêm selectedDateRange vào dependency


    // --- PHẦN LAYOUT ---

    const allYValues = series.flatMap(s => [
        ...(data?.map(d => d[s.key]) || []),
        ...(comparisonData?.map(d => d[s.key]) || [])
    ]).filter(v => typeof v === 'number');

    // 2. Tìm giá trị LỚN NHẤT và NHỎ NHẤT
    let maxY = 0;
    let minY = 0;
    
    if (allYValues.length > 0) {
        const safeValues = allYValues.filter(v => Number.isFinite(v));
        if (safeValues.length > 0) {
            maxY = Math.max(...safeValues);
            minY = Math.min(...safeValues);
        }
    }

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
        
        // Thêm 5% buffer cho range max để đường kẻ ngang trên cùng không bị mất
        return { tickVals: ticks, tickText: labels, range: [0, ticks[ticks.length-1] * 1.05] };
    };

    const { tickVals, tickText, range } = calculateSmartTicks(minY, maxY);

    const generateXAxisTicks = (startDate, endDate, unit, format, step = 1) => {
        const ticks = [];
        const tickTexts = [];
        
        // FIX: Dùng isoWeek nếu unit là week để khớp trục thời gian
        let current = unit === 'week' ? startDate.clone().startOf('isoWeek') : startDate.clone().startOf(unit);

        const endOfRange = unit === 'week' ? endDate.clone().endOf('isoWeek') : endDate.clone().endOf(unit);

        let safety = 0;

        while ((current.isBefore(endOfRange) || current.isSame(endOfRange, unit)) && safety < 1000) {
            ticks.push(current.toDate());
            tickTexts.push(current.format(format));
            current = current.add(step, unit);
            safety++;
        }

        return { ticks, tickTexts };
    };

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
        // Lấy range từ filter để sinh tick cho đẹp
        if (!selectedDateRange || selectedDateRange.length < 2) {
            return {};
        }
        const [startFilterDate, endFilterDate] = selectedDateRange;
        const safeStart = dayjs(startFilterDate);
        const safeEnd = dayjs(endFilterDate);

        // --- FIX QUAN TRỌNG: Tính Range là HỢP (UNION) của Filter và Data ---
        // 1. Khởi tạo Range bằng Filter (để đảm bảo luôn bao trọn khoảng thời gian người dùng chọn)
        let minDate = safeStart;
        let maxDate = safeEnd;
        
        // 2. Nếu Data thực tế rộng hơn Filter (ví dụ: tuần bắt đầu trước ngày mùng 1), mở rộng Range ra
        if (data && data.length > 0) {
             const dataDates = data.map(d => dayjs(d.date).valueOf());
             const minDataVal = Math.min(...dataDates);
             const maxDataVal = Math.max(...dataDates);
             
             if (minDataVal < minDate.valueOf()) minDate = dayjs(minDataVal);
             if (maxDataVal > maxDate.valueOf()) maxDate = dayjs(maxDataVal);
        }
        // Gom cả data so sánh (nếu có)
        if (comparisonData && comparisonData.length > 0) {
             // Lưu ý: comparisonData đã được shift ngày trong createChartTraces,
             // nhưng ở đây ta chỉ quan tâm range hiển thị của trục X chính.
             // Với logic so sánh hiện tại, trục X hiển thị ngày của kỳ hiện tại,
             // nên ta không cần mở rộng range theo ngày gốc của kỳ so sánh.
        }

        let tickValues = [];
        let tickLabels = [];
        let tickAngle = -45;
        let tickFont = { size: 10 };
        let showGrid = true; // Luôn hiện grid
        let xAxisRange = [];
        
        // Buffer an toàn: Thêm khoảng trống 2 đầu để điểm không bị sát mép
        // FIX: Giảm buffer bên phải (End) để tránh khoảng trắng quá lớn
        let bufferStart = 1; 
        let bufferEnd = 1;
        let bufferUnit = 'day';

        switch (aggregationType) {
            case 'month':
                ({ ticks: tickValues, tickTexts: tickLabels } = generateXAxisTicks(safeStart, safeEnd, 'month', 'MMM'));
                bufferStart = 15; bufferEnd = 5; bufferUnit = 'day'; // Giảm End từ 15 -> 5
                break;

            case 'week': 
                ({ ticks: tickValues, tickTexts: tickLabels } = generateXAxisTicks(safeStart, safeEnd, 'week', '[W]w'));
                bufferStart = 4; bufferEnd = 2; bufferUnit = 'day'; // Giảm End từ 4 -> 2
                // FIX: Dùng isoWeek để khớp với logic xử lý data
                // xAxisRange = [safeStart.startOf('isoWeek').subtract(7, 'day').toDate(), safeEnd.endOf('isoWeek').add(7, 'day').toDate()];
                break;

            case 'day': default:
                ({ ticks: tickValues, tickTexts: tickLabels } = generateXAxisTicks(safeStart, safeEnd, 'day', 'DD/MM'));
                bufferStart = 12; bufferEnd = 6; bufferUnit = 'hour'; // Giảm End
                break;
        }
        
        // Set range bao trọn minDate -> maxDate + buffer
        xAxisRange = [
            minDate.subtract(bufferStart, bufferUnit).toDate(), 
            maxDate.add(bufferEnd, bufferUnit).toDate()
        ];

        return {
            tickmode: 'array',
            tickvals: tickValues,
            ticktext: tickLabels,
            range: xAxisRange, // Manual range dựa trên data thực
            tickangle: tickAngle,
            tickfont: tickFont,
            showgrid: showGrid,
            gridcolor: 'rgba(255, 255, 255, 0.1)',
            griddash: 'dot',
            showspikes: true,
            spikethickness: 1,
            spikecolor: theme.palette.text.secondary,
            spikemode: 'across',
            autorange: false, // Tắt auto để dùng manual range chính xác
            fixedrange: false,
            automargin: true, // FIX: Tự động căn lề
        };
    };

    const layout = {
        autosize: true,
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        // Bỏ transition đi vì ta tự quản lý animation
        xaxis: {
            ...getXAxisConfig(),
            type: 'date', // BẮT BUỘC: Ép kiểu Date để hiển thị đúng trục thời gian khi không có data
            color: theme.palette.text.secondary,
            gridcolor: theme.palette.divider,
            showspikes: false,
            autorange: false,
            fixedrange: true,
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
        margin: { l: 80, r: 40, b: 60, t: 20 },
        hovermode: 'x unified',
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

    return (
        <Box ref={chartContainerRef} sx={{ height: '100%', width: '100%' }}>
            <Plot
                key={chartKey}
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