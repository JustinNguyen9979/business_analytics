import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { useTheme } from '@mui/material/styles';
import { Box } from '@mui/material';
// <<< THAY ĐỔI 1: Import hàm animation tái sử dụng >>>
import { startAnimation } from '../../utils/animationUtils';

function TopProductsChart({ data }) {
    const theme = useTheme();

    // <<< THAY ĐỔI 2: State chỉ cần lưu mảng giá trị X đang được animate >>>
    const [animatedXValues, setAnimatedXValues] = useState([]);

    // Sắp xếp dữ liệu và chuẩn bị các thông số không đổi, đưa ra ngoài useEffect
    const reversedData = [...data].reverse();
    const highlightColor = theme.palette.secondary.main;
    const normalColor = theme.palette.primary.main;

    // <<< THAY ĐỔI 3: Thay thế logic animation cũ bằng lời gọi hàm tập trung >>>
    useEffect(() => {
        if (!data || data.length === 0) {
            setAnimatedXValues([]);
            return;
        }

        // Xác định các giá trị đích cuối cùng
        const finalXValues = reversedData.map(p => p.total_quantity);

        // Bắt đầu animation bằng hàm tái sử dụng
        const cleanup = startAnimation({
            duration: 800, // Thời gian animation của biểu đồ
            onFrame: (progress) => {
                // Áp dụng công thức `current = final * progress` cho cả mảng
                const currentValues = finalXValues.map(endValue => endValue * progress);
                setAnimatedXValues(currentValues);
            },
            onDone: () => {
                // Đảm bảo dữ liệu cuối cùng chính xác tuyệt đối
                setAnimatedXValues(finalXValues);
            }
        });

        // Trả về hàm cleanup để hủy animation khi cần
        return cleanup;

    }, [data]); // Chỉ phụ thuộc vào `data`

    // --- TOÀN BỘ PHẦN TÍNH TOÁN LAYOUT VÀ RENDER GIỮ NGUYÊN ---
    // Đoạn code này không thay đổi vì nó chỉ định dạng và sắp xếp giao diện
    const finalXValuesForLayout = reversedData.map(p => p.total_quantity);
    const maxXValue = finalXValuesForLayout.length > 0 ? Math.max(...finalXValuesForLayout) : 1000;
    const desiredTicks = 7;
    const roughTick = maxXValue / desiredTicks;
    const power = Math.pow(10, Math.floor(Math.log10(roughTick)));
    let magnitude = roughTick / power;
    if (power < 1) magnitude = 1;
    let dtick;
    if (magnitude < 1.5) { dtick = 1 * power; } 
    else if (magnitude < 3) { dtick = 2 * power; } 
    else if (magnitude < 7) { dtick = 5 * power; } 
    else { dtick = 10 * power; }
    const xPadding = maxXValue * 0.01;

    const annotations = reversedData.map((product, index) => ({
        x: xPadding, y: index + 0.3, text: `<b>${product.name}</b>`, xref: 'x', yref: 'y',
        showarrow: false, xanchor: 'left', yanchor: 'bottom',
        font: { color: theme.palette.text.primary, size: 14, }, align: 'left',
    }));
    
    const layout = {
        annotations: annotations, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', showlegend: false,
        xaxis: {
            side: 'top', color: theme.palette.text.secondary, gridcolor: theme.palette.divider,
            rangemode: 'tozero', range: [0, maxXValue * 1.15], autotick: false, dtick: dtick, tickformat: ',.0f',
        },
        yaxis: { showticklabels: false, showgrid: false, zeroline: false, domain: [0, 0.95], },
        margin: { t: 60, b: 20, l: 20, r: 50 }, bargap: 0.6,
    };
    
    // Tạo cấu trúc dữ liệu cho Plotly
    const chartTrace = {
        y: reversedData.map((_, index) => index),
        x: animatedXValues, // <<< Sử dụng giá trị đã được animate
        type: 'bar',
        orientation: 'h',
        marker: {
            color: reversedData.map((_, index) => (index >= reversedData.length - 5 ? highlightColor : normalColor)),
        },
        // Hiển thị text tương ứng với giá trị được animate, làm tròn để không có số thập phân
        text: animatedXValues.map(val => Math.round(val).toLocaleString('vi-VN')),
        textinfo: 'text',
        textposition: 'outside',
        textfont: { family: 'Inter, sans-serif', size: 16, color: '#ffffffff' },
        cliponaxis: false,
        hoverinfo: 'x',
        hoverlabel: { bgcolor: theme.palette.background.paper },
    };

    return (
        <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
            <Plot
                data={[chartTrace]} // <<< Truyền trace đã được cập nhật
                layout={layout}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: false, responsive: true }}
            />
        </Box>
    );
}

export default TopProductsChart;