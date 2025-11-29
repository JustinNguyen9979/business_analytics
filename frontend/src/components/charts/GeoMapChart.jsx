// FILE: frontend/src/components/charts/GeoMapChart.jsx (PHIÊN BẢN ANIMATION SVG GỐC)

import React, { memo, useMemo, useEffect, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from '@vnedyalk0v/react19-simple-maps';
import { Box, Stack, Typography, CircularProgress } from '@mui/material';
import { scaleLinear } from 'd3-scale';

const defaultTooltipFormatter = (label, value) => `${label}: ${value.toLocaleString('vi-VN')}`;

/**
* Generic GeoMapChart
* @param {Array} data - Mảng dữ liệu đầu vào. Mỗi phần tử PHẢI có trường 'coords': [long, lat].
* @param {string} valueKey - Tên trường chứa giá trị định lượng (VD: 'orders', 'revenue','customer_count').
* @param {string} labelKey - Tên trường chứa nhãn hiển thị (VD: 'city', 'province').
* @param {function} tooltipFormatter - Hàm tùy chỉnh hiển thị tooltip (nhận vào item).
* @param {string} unitLabel - Nhãn đơn vị cho phần Top 5 (VD: 'khách', 'đơn', 'VND').
*/

function GeoMapChartComponent({ data, valueKey = 'value', labelKey = 'city', tooltipFormatter, unitLabel = '' }) {

    // 1. Hook lấy dữ liệu bản đồ với cơ chế cache IndexedDB
    const [geoShapeData, setGeoShapeData] = useState(null);
    const [isLoadingGeo, setIsLoadingGeo] = useState(true);
    const [showMarkers, setShowMarkers] = useState(false);

    useEffect(() => {
        const loadGeography = async () => {
            setIsLoadingGeo(true);
            try {
                const response = await fetch('/vietnam-shape.json');
                const fetchedGeo = await response.json();
                setGeoShapeData(fetchedGeo);
                
            } catch (error) {
                console.error("Error loading geography data:", error);
            } finally {
                setIsLoadingGeo(false);
            }
        };

        loadGeography();
    }, []);


    // 3. Hook tính toán scale
    const { sizeScale, opacityScale } = useMemo(() => {
        if (!data || data.length === 0) {
            return { sizeScale: () => 0, opacityScale: () => 0 };
        }
        
        const values = data.map(d => d[valueKey]);
        const max = Math.max(...values.map(v => Number(v)), 0);
        const size = scaleLinear().domain([0, max]).range([4, 12]).clamp(true);
        const opacity = scaleLinear().domain([0, max]).range([0.6, 1.0]).clamp(true);

        return { sizeScale: size, opacityScale: opacity };
    }, [data, valueKey]);

    // 4. Hook tính toán Top 5
    const topItems = useMemo(() => {
        if (!data || data.length === 0) return [];
        // Sắp xếp dữ liệu theo customer_count giảm dần và lấy 5 phần tử đầu tiên
        return [...data]
            .sort((a, b) => b[valueKey] - a[valueKey])
            .slice(0, 6);
    }, [data, valueKey]);

    // 5. Hook hiệu ứng delay
    useEffect(() => {
        if (geoShapeData) {
            const timer = setTimeout(() => {
                setShowMarkers(true);
            }, 50);
            return () => clearTimeout(timer);
        } else {
            setShowMarkers(false);
        }
    }, [geoShapeData]);

    if (isLoadingGeo || !geoShapeData) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ flexGrow: 1, position: 'relative' }}>
                <ComposableMap
                    projection="geoMercator"
                    projectionConfig={{ scale: 2300, center: [108, 16.4] }}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                >
                    <Geographies geography={geoShapeData}>
                        {({ geographies }) =>
                            geographies.map((geo, index) => (
                                <Geography
                                    key={index}
                                    geography={geo}
                                    fill="#303952"
                                    stroke="#777c86ff"
                                    style={{ default: { outline: 'none' } }}
                                />
                            ))
                        }
                    </Geographies>

                    {showMarkers && data.map(item => {
                        const lat = item.latitude;
                        const lon = item.longitude;
                        
                        if (lat === undefined || lon === undefined || lat === null || lon === null) return null;

                        const val = item[valueKey];
                        const label = item[labelKey];
                        const size = sizeScale(val);
                        const opacity = opacityScale(val);

                        // Fix lỗi ReferenceError: tooltipContent is not defined
                        const tooltipContent = tooltipFormatter 
                            ? tooltipFormatter(item) 
                            : defaultTooltipFormatter(label, val);

                        return (
                            <Marker
                                key={label}
                                coordinates={[lon, lat]}
                            >
                                <g style={{ cursor: 'pointer', pointerEvents: 'none' }}>
                                    <circle
                                        className="ripple"
                                        r={size} 
                                        fill="none" 
                                        stroke="#FF5252" 
                                        strokeWidth={2}
                                    />
                                     <circle
                                        className="ripple ripple-2"
                                        r={size} 
                                        fill="none" 
                                        stroke="#FF5252" 
                                        strokeWidth={2}
                                    />
                                    <circle
                                        className="map-dot"
                                        r={size}
                                        data-tooltip-id="map-tooltip"
                                        data-tooltip-content={tooltipContent}
                                        fill={`rgba(255, 82, 82, ${opacity})`}
                                        stroke="#FFFFFF"
                                        strokeWidth={0.5}
                                        style={{ transition: 'transform 0.2s ease', pointerEvents: 'auto' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.8)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                                    />
                                </g>
                            </Marker>
                        );
                    })}
                </ComposableMap>
            </Box>
            {topItems.length > 0 && (
                <Box sx={{ p: 2, flexShrink: 0, borderTop: 1, borderColor: 'divider' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, textAlign: 'center' }}>
                        Top Tỉnh/Thành có lượng khách hàng cao nhất
                    </Typography>
                    {/* THAY THẾ GRID BẰNG BOX */}
                    <Box sx={{
                        display: 'grid',
                        // Sử dụng auto-fit để các item tự động xuống dòng và co giãn
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: { xs: 1, sm: 2 }, // Giảm khoảng cách giữa các item
                        justifyContent: 'space-between' // Thêm justify-content
                    }}>
                        {topItems.map((province, index) => (
                            <Box key={province.city} sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                    <Typography sx={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'text.secondary', width: '24px' }}>
                                        {index + 1}.
                                    </Typography>
                                    <Box>
                                        <Typography sx={{ fontWeight: 'bold' }}>{province.city}</Typography>
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
}

export default memo(GeoMapChartComponent);