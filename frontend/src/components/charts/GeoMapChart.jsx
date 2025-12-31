import React, { useEffect, useState, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { Box, Typography, Stack, CircularProgress } from '@mui/material';

/**
 * GeoMapChart sử dụng Apache ECharts
 * Ưu điểm: Hiệu năng cực cao nhờ Canvas, hỗ trợ Map sẵn, hiệu ứng ripple mượt mà.
 */
const GeoMapChart = ({ data, valueKey = 'value', labelKey = 'city', unitLabel = '' }) => {
    const [geoJson, setGeoJson] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const echartsRef = useRef(null);

    // 1. Tải GeoJSON bản đồ Việt Nam
    useEffect(() => {
        const fetchGeoJson = async () => {
            try {
                const response = await fetch('/vietnam-shape.json');
                const data = await response.json();
                // Đăng ký bản đồ với ECharts
                echarts.registerMap('vietnam', data);
                setGeoJson(data);
            } catch (error) {
                console.error("Error loading GeoJSON:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchGeoJson();
    }, []);

    // 2. Xử lý dữ liệu cho ECharts
    const chartData = useMemo(() => {
        if (!data) return [];
        return data
            .filter(item => item.longitude && item.latitude)
            .map(item => ({
                name: item[labelKey],
                value: [item.longitude, item.latitude, item[valueKey]], // Format: [lon, lat, value]
                rawData: item
            }));
    }, [data, labelKey, valueKey]);

    // 3. Tính toán Top 5 để hiển thị list dưới bản đồ
    const topItems = useMemo(() => {
        if (!data || data.length === 0) return [];
        return [...data]
            .sort((a, b) => (b[valueKey] || 0) - (a[valueKey] || 0))
            .slice(0, 6);
    }, [data, valueKey]);

    // 4. Cấu hình ECharts Option
    const option = useMemo(() => {
        if (!geoJson) return {};

        const values = chartData.map(d => d.value[2]);
        const maxVal = Math.max(...values, 1);

        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'item',
                formatter: (params) => {
                    const val = params.value[2];
                    return `${params.name}: ${val.toLocaleString('vi-VN')} ${unitLabel}`;
                },
                backgroundColor: 'rgba(20, 20, 20, 0.9)',
                borderColor: '#444',
                textStyle: { color: '#fff' },
                borderWidth: 1
            },
            // Cấu hình bản đồ nền
            geo: {
                map: 'vietnam',
                roam: true, // Cho phép zoom/kéo
                emphasis: {
                    label: { show: false },
                    itemStyle: { areaColor: '#3d4869' }
                },
                itemStyle: {
                    areaColor: '#303952',
                    borderColor: '#777c86ff',
                    borderWidth: 0.8
                },
                label: { show: false },
                zoom: 1.2,
                center: [108, 16.4]
            },
            series: [
                {
                    name: 'Điểm nóng',
                    type: 'effectScatter',
                    coordinateSystem: 'geo',
                    data: chartData,
                    symbolSize: function (val) {
                        // Dùng căn bậc 2 (Math.sqrt) để giảm sự chênh lệch quá lớn giữa Top 1 và Top 2, 3
                        // Giúp các chấm vệ tinh to rõ hơn
                        return Math.sqrt(val[2] / maxVal) * 25 + 6;
                    },
                    encode: { value: 2 },
                    showEffectOn: 'render',
                    rippleEffect: {
                        brushType: 'stroke',
                        scale: 3,
                        period: 4
                    },
                    label: {
                        formatter: '{b}',
                        position: 'right',
                        show: false
                    },
                    itemStyle: {
                        color: '#FF5252',
                        shadowBlur: 10,
                        shadowColor: '#333'
                    },
                    emphasis: {
                        scale: true,
                        label: { show: false }
                    },
                    zlevel: 1
                }
            ]
        };
    }, [geoJson, chartData, unitLabel]);

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Map Container */}
            <Box sx={{ flex: 1, position: 'relative', minHeight: 300 }}>
                <ReactECharts
                    ref={echartsRef}
                    option={option}
                    style={{ height: '100%', width: '100%' }}
                    notMerge={true}
                    lazyUpdate={true}
                />
            </Box>

            {/* Top 5 List (Giữ nguyên UI của anh) */}
            {topItems.length > 0 && (
                <Box sx={{ p: 2, flexShrink: 0, borderTop: 1, borderColor: 'divider' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, textAlign: 'center' }}>
                        Top Tỉnh/Thành có lượng khách hàng cao nhất
                    </Typography>
                    <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: { xs: 1, sm: 2 },
                        justifyContent: 'space-between'
                    }}>
                        {topItems.map((province, index) => (
                            <Box key={province.city || index} sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                    <Typography sx={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'text.secondary', width: '24px' }}>
                                        {index + 1}.
                                    </Typography>
                                    <Box>
                                        <Typography sx={{ fontWeight: 'bold' }}>{province[labelKey]}</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {province[valueKey].toLocaleString('vi-VN')} {unitLabel}
                                        </Typography>
                                    </Box>
                                </Stack>
                            </Box>
                        ))}
                    </Box>
                </Box>
            )}
        </Box>
    );
};

export default GeoMapChart;
