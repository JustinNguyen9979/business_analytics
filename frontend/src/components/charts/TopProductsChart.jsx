// FILE: frontend/src/components/charts/TopProductsChart.jsx (PHIÊN BẢN LABEL NẰM TRÊN)

import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { useTheme } from '@mui/material/styles';
import { Box, colors } from '@mui/material';

const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function TopProductsChart({ data }) {
    const theme = useTheme();

    // State để quản lý dữ liệu cho animation
    const [animatedData, setAnimatedData] = useState([]);

    

    const reversedData = [...data].reverse();
    const highlightColor = theme.palette.secondary.main;
    const normalColor = theme.palette.primary.main;

    useEffect(() => {
        if (!data || data.length === 0) {
            setAnimatedData([]);
            return;
        }

        // Dữ liệu cuối cùng của biểu đồ
        const finalTrace = {
            y: reversedData.map((_, index) => index),
            x: reversedData.map(p => p.total_quantity),
            type: 'bar',
            orientation: 'h',
            marker: {
                color: reversedData.map((_, index) => (index >= reversedData.length - 5 ? highlightColor : normalColor)),
            },
            text: reversedData.map(p => p.total_quantity),
            textposition: 'outside',
            // texttemplate: '%{x:,}',
            textfont: { family: 'Inter, sans-serif', size: 16, color: '#ffffffff' },
            cliponaxis: false,
            hoverinfo: 'x',
            hoverlabel: { bgcolor: theme.palette.background.paper },
        };

        // --- LOGIC ANIMATION ---
        const duration = 800;
        let startTime = null;
        let animationFrameId;

        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const rawProgress = Math.min(elapsed / duration, 1);
            const progress = easeInOutCubic(rawProgress);
            const isAnimationComplete = rawProgress >= 1;

            // TÍNH TOÁN LẠI GIÁ TRỊ X CỦA FRAME HIỆN TẠI
            const currentXValues = finalTrace.x.map(endValue => endValue * progress);

            const currentFrameTrace = {
                ...finalTrace,
                x: currentXValues,
                // 3. TẠO RA DỮ LIỆU TEXT TƯƠNG ỨNG VỚI GIÁ TRỊ X HIỆN TẠI
                text: currentXValues.map(val => Math.round(val).toLocaleString('vi-VN')),
                textinfo: 'text', // Luôn bật chế độ hiển thị text
                // Bỏ texttemplate đi để không bị xung đột
                texttemplate: '',
            };
            
            setAnimatedData([currentFrameTrace]);

            if (rawProgress < 1) {
                animationFrameId = requestAnimationFrame(animate);
            } else {
                // Khi kết thúc, render lại lần cuối với dữ liệu chuẩn để đảm bảo chính xác
                 const finalRenderTrace = {
                    ...finalTrace,
                    text: finalTrace.text.map(val => val.toLocaleString('vi-VN')),
                    textinfo: 'text',
                    texttemplate: '',
                };
                setAnimatedData([finalRenderTrace]);
            }
        };
        animationFrameId = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(animationFrameId);

    }, [data, theme]);

    const maxXValue = reversedData.length > 0 ? Math.max(...reversedData.map(p => p.total_quantity)) : 1000;
    const desiredTicks = 7; // Mình muốn có khoảng 5 đường lưới
    const roughTick = maxXValue / desiredTicks;
    const power = Math.pow(10, Math.floor(Math.log10(roughTick)));
    let magnitude = roughTick / power;
    if (power < 1) magnitude = 1;
    let dtick;
    if (magnitude < 1.5) {
        dtick = 1 * power;
    } else if (magnitude < 3) {
        dtick = 2 * power;
    } else if (magnitude < 7) {
        dtick = 5 * power;
    } else {
        dtick = 10 * power;
    }
    const xPadding = maxXValue * 0.01;

    // --- BƯỚC 1: TẠO RA CÁC ANNOTATIONS (CHÚ THÍCH) CHO TÊN SẢN PHẨM ---
    const annotations = reversedData.map((product, index) => ({
        x: xPadding,                   // Vị trí X của text (bắt đầu từ lề trái)
        y: index + 0.3,               // Vị trí Y của text (tương ứng với mỗi thanh bar)
        text: product.name,     // Nội dung text
        xref: 'x',              // Hệ quy chiếu cho x là trục X
        yref: 'y',              // Hệ quy chiếu cho y là trục Y
        showarrow: false,       // Không hiển thị mũi tên
        xanchor: 'left',        // Căn lề trái cho text
        yanchor: 'bottom',      // Đặt đáy của text ngay phía trên thanh bar
        font: {
            color: theme.palette.text.primary, // Màu chữ sáng
            size: 14,
        },
        align: 'left',
    }));

    const chartData = [
        {
            y: reversedData.map((_, index) => index),
            x: reversedData.map(p => p.total_quantity),
            type: 'bar',
            orientation: 'h',
            marker: {
                // Tạo một mảng màu động
                color: reversedData.map((_, index) => {
                    if (index >= reversedData.length - 5) {
                        return highlightColor; // Top 5 sản phẩm
                    }
                    return normalColor; 
                }),
            },
            text: reversedData.map(p => p.total_quantity),
            textposition: 'outside',
            texttemplate: '%{x:,}',
            textfont: {
                family: 'Inter, sans-serif',
                size: 14,
                color: theme.palette.text.secondary // Màu xám nhạt cho dễ nhìn
            },
            cliponaxis: false,

            // Bỏ phần text bên trong thanh bar
            textinfo: 'none',
            hoverinfo: 'x',
            hoverlabel: {
                bgcolor: theme.palette.background.paper,
            },
        }
    ];

    const layout = {
        annotations: annotations,
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        showlegend: false,
        xaxis: {
            side: 'top',
            color: theme.palette.text.secondary,
            gridcolor: theme.palette.divider,
            rangemode: 'tozero',
            range: [0, maxXValue * 1.15],
            autotick: false,
            dtick: dtick,
            tickformat: ',.0f',
        },
        yaxis: {
            showticklabels: false,
            showgrid: false,
            zeroline: false,
            // Thêm một chút padding để tên sản phẩm đầu tiên không bị dính vào trục X
            domain: [0, 0.95],
        },
        margin: { t: 60, b: 20, l: 20, r: 50 },
        bargap: 0.6,
    };

    return (
        <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
            <Plot
                data={animatedData}
                layout={layout}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ displayModeBar: false, responsive: true }}
            />
        </Box>
    );
}

export default TopProductsChart;