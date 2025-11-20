// FILE: frontend/src/components/charts/GeoMapChart.jsx (PHIÊN BẢN ANIMATION SVG GỐC)

import React, { memo, useMemo, useEffect, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from '@vnedyalk0v/react19-simple-maps';
import { Box, Grid, Stack, Typography, CircularProgress } from '@mui/material';
import { scaleLinear } from 'd3-scale';
import { Tooltip } from 'react-tooltip'; // << FIX: Thêm import

// import geoShapeData from '../../assets/vietnam-shape.json';

import { get, set } from '../../utils/db';

function GeoMapChartComponent({ data }) {
    // 1. Hook lấy dữ liệu bản đồ với cơ chế cache IndexedDB
    const [geoShapeData, setGeoShapeData] = useState(null);
    const [isLoadingGeo, setIsLoadingGeo] = useState(true);

    useEffect(() => {
        const loadGeography = async () => {
            setIsLoadingGeo(true);
            try {
                // Thử lấy từ IndexedDB trước
                const cachedGeo = await get('vietnam-shape');
                if (cachedGeo) {
                    setGeoShapeData(cachedGeo);
                } else {
                    // Nếu không có, tải từ mạng
                    const response = await fetch('/vietnam-shape.json');
                    const fetchedGeo = await response.json();
                    
                    // Lưu vào IndexedDB để dùng cho lần sau
                    await set('vietnam-shape', fetchedGeo);
                    setGeoShapeData(fetchedGeo);
                }
            } catch (error) {
                console.error("Error loading geography data:", error);
            } finally {
                setIsLoadingGeo(false);
            }
        };

        loadGeography();
    }, []);

    const [showMarkers, setShowMarkers] = useState(false);

    // 3. Hook tính toán scale
    const { sizeScale, opacityScale } = useMemo(() => {
        if (!data || data.length === 0) {
            return { sizeScale: () => 0, opacityScale: () => 0 };
        }
        
        const counts = data.map(d => d.customer_count);
        const max = Math.max(...counts.map(c => Number(c)), 0); 
        
        const size = scaleLinear().domain([0, max]).range([4, 12]).clamp(true);
        const opacity = scaleLinear().domain([0, max]).range([0.6, 1.0]).clamp(true);

        return { sizeScale: size, opacityScale: opacity };
    }, [data]);

    // 4. Hook tính toán Top 5
    const top5Provinces = useMemo(() => {
        if (!data || data.length === 0) {
            return [];
        }
        // Sắp xếp dữ liệu theo customer_count giảm dần và lấy 5 phần tử đầu tiên
        return [...data]
            .sort((a, b) => b.customer_count - a.customer_count)
            .slice(0, 5);
    }, [data]);

    // 5. Hook hiệu ứng delay
    useEffect(() => {
        // Chúng ta dùng setTimeout để trì hoãn việc hiển thị các điểm chấm một chút (50ms).
        // Khoảng thời gian này đủ để trình duyệt vẽ xong nền bản đồ phức tạp trước.
        const timer = setTimeout(() => {
            setShowMarkers(true);
        }, 50); // 50 mili-giây là một độ trễ người dùng không thể nhận ra.

        // Cleanup function để dọn dẹp timer nếu component bị unmount
        return () => clearTimeout(timer);
    }, []);

    // << FIX: Xóa bỏ useEffect gây lỗi "Tooltip is not defined"
    // useEffect(() => {
    //     const handleOutsideClick = (event) => {
    //         if (!event.target.closest('.map-dot')) {
    //             Tooltip.hide();
    //         }
    //     };
    //     document.addEventListener('click', handleOutsideClick);
    //     return () => {
    //         document.removeEventListener('click', handleOutsideClick);
    //     };
    // }, []);

    if (isLoadingGeo) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* << FIX: Thêm component Tooltip để nó hoạt động */}
            <Tooltip id="map-tooltip" style={{ backgroundColor: 'rgba(5, 10, 20, 0.9)', border: '1px solid rgba(0, 229, 255, 0.3)', backdropFilter: 'blur(4px)' }}/>
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
                        if (!item.coords || item.coords.length !== 2) return null;

                        const size = sizeScale(item.customer_count);
                        const opacity = opacityScale(item.customer_count);

                        return (
                            <Marker
                                key={item.city}
                                coordinates={item.coords}
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
                                        data-tooltip-content={`${item.city}: ${item.customer_count.toLocaleString('vi-VN')} khách`}
                                        fill={`rgba(255, 82, 82, ${opacity})`}
                                        stroke="#FFFFFF"
                                        strokeWidth={0.5}
                                        style={{ transition: 'transform 0.2s ease', pointerEvents: 'auto' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.8)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                                        // << FIX: Xóa onClick gây lỗi
                                        // onClick={(e) => Tooltip.show(e.currentTarget)}
                                    />
                                </g>
                            </Marker>
                        );
                    })}
                </ComposableMap>
            </Box>
            {top5Provinces.length > 0 && (
                <Box sx={{ p: 2, flexShrink: 0, borderTop: 1, borderColor: 'divider' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, textAlign: 'center' }}>
                        Top 5 Tỉnh/Thành có lượng khách hàng cao nhất
                    </Typography>
                    <Grid container spacing={{ xs: 2, sm: 3 }} justifyContent={{ sm: 'center', lg: 'space-between' }}>
                        {top5Provinces.map((province, index) => (
                            <Grid item key={province.city} xs={12} sm={6} lg="auto">
                                <Stack direction="row" spacing={1.5} alignItems="center" justifyContent={{ xs: 'center', sm: 'flex-start'}}>
                                    <Typography sx={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'text.secondary', width: '24px' }}>
                                        {index + 1}.
                                    </Typography>
                                    <Box>
                                        <Typography sx={{ fontWeight: 'bold' }}>{province.city}</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {province.customer_count.toLocaleString('vi-VN')} khách
                                        </Typography>
                                    </Box>
                                </Stack>
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            )}
        </Box>
    );
}

export default memo(GeoMapChartComponent);