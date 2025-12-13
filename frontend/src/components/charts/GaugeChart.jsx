import React from 'react';
import Plot from 'react-plotly.js';
import { Box, useTheme, Typography } from '@mui/material';

const GaugeChart = ({
    value = 0,
    min = 0,
    max = 100,
    title = "Metric",
    unit = "",
    previousValue = null, // Nếu có, sẽ hiện mũi tên so sánh
    thresholds = {}, // { warning: 50, error: 80 } hoặc { success: 80, warning: 50 }
    color = null, // Custom color override
    reverseColors = false, // True: Thấp là tốt (Xanh), Cao là xấu (Đỏ). False: Ngược lại.
    height = 250
}) => {
    const theme = useTheme();

    // Xác định màu dựa trên giá trị và thresholds
    // Mặc định: Cao là tốt (Xanh)
    let barColor = color || theme.palette.primary.main; // Default Cyan or custom prop
    
    // Logic màu đơn giản:
    // Nếu reverseColors = false (Mặc định: Cao là tốt):
    // < Warning -> Đỏ (Error)
    // Warning -> Success -> Vàng (Warning)
    // > Success -> Xanh (Success)
    
    // Để đơn giản và linh hoạt, ta cho người dùng truyền color hoặc tự tính toán bên ngoài thì hay hơn.
    // Nhưng ở đây ta sẽ làm một logic tự động đơn giản nếu muốn.
    
    // Cấu hình Gauge của Plotly
    const data = [
        {
            type: "indicator",
            mode: previousValue !== null ? "gauge+number+delta" : "gauge+number",
            value: value,
            number: { 
                suffix: unit ? ` ${unit}` : "",
                font: { size: 28, color: theme.palette.text.primary, family: 'Inter, sans-serif' }
            },
            delta: previousValue !== null ? { 
                reference: previousValue, 
                relative: true, 
                position: "bottom",
                valueformat: ".1%",
                font: { size: 14 }
            } : undefined,
            title: { 
                text: title.toUpperCase(), 
                font: { size: 14, color: theme.palette.text.secondary, family: 'Inter, sans-serif', weight: 600 } 
            },
            gauge: {
                axis: { range: [min, max], tickwidth: 1, tickcolor: theme.palette.divider, tickfont: { size: 10, color: theme.palette.text.disabled } },
                bar: { color: barColor }, // Màu thanh chỉ số
                bgcolor: "transparent",
                borderwidth: 0,
                bordercolor: "transparent",
                steps: [
                    { range: [min, max], color: "rgba(255, 255, 255, 0.05)" }, // Background track
                ],
                threshold: {
                    line: { color: theme.palette.error.main, width: 4 },
                    thickness: 0.75,
                    value: value // Hiển thị vạch đỏ tại vị trí hiện tại (optional)
                }
            }
        }
    ];

    // Tùy chỉnh màu sắc thanh đo dựa trên thresholds nếu được cung cấp
    if (thresholds && Object.keys(thresholds).length > 0) {
        // Ví dụ logic: Nếu có 'success' threshold (ví dụ 90), thì > 90 là xanh.
        // Đây là phần nâng cao, ta có thể hardcode màu thanh bar ở prop component cha truyền vào sẽ linh hoạt hơn.
        // Ở đây ta giữ default là primary color.
    }

    const layout = {
        width: undefined, // Responsive
        height: height,
        margin: { t: 40, b: 20, l: 30, r: 30 },
        paper_bgcolor: "transparent",
        font: { color: theme.palette.text.primary, family: 'Inter, sans-serif' }
    };

    return (
        <Box sx={{ width: '100%', position: 'relative', display: 'flex', justifyContent: 'center' }}>
            <Plot
                data={data}
                layout={layout}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: false, responsive: true }}
            />
        </Box>
    );
};

export default GaugeChart;
