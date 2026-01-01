import React, { useEffect, useState, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { Box, Typography, Stack, CircularProgress } from '@mui/material';

/**
 * GeoMapChart sử dụng Apache ECharts
 * Ưu điểm: Hiệu năng cực cao nhờ Canvas, hỗ trợ Map sẵn, hiệu ứng ripple mượt mà.
 */
const GeoMapChart = ({ 
    data, 
    valueKey = 'value', 
    labelKey = 'city', 
    unitLabel = '', 
    statusFilter = ['all'],
    statusColors = {} 
}) => {
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

    // 2. Xử lý dữ liệu cho ECharts (Chuẩn bị raw data)
    // Lưu ý: data đầu vào giờ đã có các trường detail: completed, cancelled...
    const processedData = useMemo(() => {
        if (!data) return [];
        return data.filter(item => item.longitude && item.latitude);
    }, [data]);

    // 3. Tính toán Top 5 để hiển thị list dưới bản đồ (Vẫn dựa trên Total để sort)
    const topItems = useMemo(() => {
        if (!processedData || processedData.length === 0) return [];
        return [...processedData]
            .sort((a, b) => (b[valueKey] || 0) - (a[valueKey] || 0))
            .slice(0, 6);
    }, [processedData, valueKey]);

    // 4. Cấu hình ECharts Option (MULTI-SERIES LOGIC)
    const option = useMemo(() => {
        if (!geoJson) return {};

        // Mapping nhãn tiếng Việt cho các status
        const labelMap = {
            'completed': 'Đơn thành công',
            'cancelled': 'Đơn đã hủy',
            'bomb': 'Đơn bom (thất bại)',
            'refunded': 'Đơn hoàn tiền'
        };

        // Xác định chế độ hiển thị: Single (All) hay Multi (Detail)
        const isSingleMode = statusFilter.includes('all') || statusFilter.length === 4 || statusFilter.length === 0;

        let seriesList = [];
        let maxVal = 1;

        if (isSingleMode) {
            // --- MODE SINGLE: Hiển thị 1 màu tổng hợp (Đỏ) ---
            const chartData = processedData.map(item => ({
                name: item[labelKey],
                value: [item.longitude, item.latitude, item[valueKey]],
                rawData: item
            }));
            
            const values = chartData.map(d => d.value[2]);
            maxVal = Math.max(...values, 1);

            seriesList.push({
                name: 'Tổng hợp',
                type: 'effectScatter',
                coordinateSystem: 'geo',
                data: chartData,
                symbolSize: function (val) {
                    return Math.sqrt(val[2] / maxVal) * 25 + 6;
                },
                encode: { value: 2 },
                showEffectOn: 'render',
                rippleEffect: { brushType: 'stroke', scale: 3, period: 4 },
                label: { show: false },
                itemStyle: {
                    color: statusColors.all || '#FF5252',
                    shadowBlur: 10,
                    shadowColor: '#333'
                },
                zlevel: 1
            });
        } else {
            // --- MODE MULTI: Hiển thị từng chấm theo trạng thái ---
            const zLevelMap = {
                'completed': 2,
                'refunded': 3,
                'cancelled': 4,
                'bomb': 5
            };

            let globalMax = 0;
            processedData.forEach(item => {
                statusFilter.forEach(status => {
                    if (item[status] > globalMax) globalMax = item[status];
                });
            });
            maxVal = globalMax || 1;

            statusFilter.forEach(status => {
                const seriesData = processedData
                    .filter(item => item[status] > 0)
                    .map(item => ({
                        name: item[labelKey],
                        value: [item.longitude, item.latitude, item[status]],
                        rawData: item
                    }));
                
                if (seriesData.length > 0) {
                    seriesList.push({
                        name: status,
                        type: 'effectScatter',
                        coordinateSystem: 'geo',
                        data: seriesData,
                        symbolSize: function (val) {
                            return Math.sqrt(val[2] / maxVal) * 25 + 6;
                        },
                        encode: { value: 2 },
                        showEffectOn: 'render',
                        rippleEffect: { brushType: 'stroke', scale: 3, period: 4 },
                        label: { show: false },
                        itemStyle: {
                            color: statusColors[status] || '#999',
                            shadowBlur: 5,
                            shadowColor: '#333'
                        },
                        // Xóa tooltip riêng lẻ ở đây để dùng tooltip chung bên ngoài
                        zlevel: zLevelMap[status] || 2
                    });
                }
            });
        }

        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'item',
                backgroundColor: 'rgba(20, 20, 20, 0.9)',
                borderColor: '#444',
                textStyle: { color: '#fff' },
                borderWidth: 1,
                formatter: (params) => {
                    const raw = params.data.rawData;
                    if (!raw) return params.name;

                    let res = `<div style="font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid #555; padding-bottom: 3px;">${params.name}</div>`;
                    
                    // Xác định danh sách status cần hiển thị dựa trên bộ lọc
                    const allStatuses = ['completed', 'cancelled', 'bomb', 'refunded'];
                    const displayStatuses = statusFilter.includes('all') 
                        ? allStatuses 
                        : allStatuses.filter(s => statusFilter.includes(s));
                    
                    displayStatuses.forEach(status => {
                        const val = raw[status] || 0;
                        const label = labelMap[status] || status;
                        const color = statusColors[status] || '#fff';
                        
                        res += `<div style="display: flex; justify-content: space-between; gap: 20px; font-weight: bold;">
                            <span style="color: ${color}">${label}:</span>
                            <span>${val.toLocaleString('vi-VN')}</span>
                        </div>`;
                    });

                    // Thêm dòng tổng cộng ở dưới cùng
                    res += `<div style="margin-top: 5px; border-top: 1px dashed #555; padding-top: 3px; display: flex; justify-content: space-between; font-weight: bold;">
                        <span>Tổng cộng:</span>
                        <span style="color: ${statusColors.all}">${raw[valueKey].toLocaleString('vi-VN')} ${unitLabel}</span>
                    </div>`;

                    return res;
                },
            },
            geo: {
                map: 'vietnam',
                roam: true,
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
            legend: {
                show: false,
                bottom: '5%',
                left: 'center',
                textStyle: { color: '#fff' },
                data: statusFilter.map(s => s)
            },
            series: seriesList
        };
    }, [geoJson, processedData, unitLabel, statusFilter, statusColors, valueKey, labelKey]); // Dependencies cập nhật

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
