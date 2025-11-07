// FILE: frontend/src/components/charts/GeoMapChart.jsx (PHIÊN BẢN HOÀN CHỈNH)

import React, { memo, useMemo } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from '@vnedyalk0v/react19-simple-maps';
import { Box, Typography, Stack, Grid } from '@mui/material';

import geoShapeData from '../../assets/vietnam-shape.json'; 

function GeoMapChartComponent({ data }) { // data giờ là mảng [{city, coords}, ...]

    // <<< BƯỚC 1: TÍNH TOÁN TOP 5 TỪ DỮ LIỆU ĐẦU VÀO >>>
    const top5Provinces = useMemo(() => {
        if (!data || data.length === 0) {
            return [];
        }

        // Đếm số lần xuất hiện của mỗi tỉnh
        const counts = data.reduce((acc, point) => {
            acc[point.city] = (acc[point.city] || 0) + 1;
            return acc;
        }, {});

        // Chuyển object thành mảng, sắp xếp và lấy top 5
        return Object.entries(counts)
            .map(([city, count]) => ({ city, customer_count: count }))
            .sort((a, b) => b.customer_count - a.customer_count)
            .slice(0, 5);
            
    }, [data]);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* PHẦN BẢN ĐỒ */}
            <Box sx={{ flexGrow: 1, position: 'relative' }}>
                <ComposableMap
                    projection="geoMercator"
                    projectionConfig={{ scale: 2200, center: [107.5, 16] }}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                >
                    <Geographies geography={geoShapeData}>
                        {({ geographies }) =>
                            geographies.map((geo, index) => (
                                <Geography
                                    key={index} 
                                    geography={geo}
                                    fill="#303952"
                                    stroke="#596275"
                                    style={{ default: { outline: 'none' } }}
                                />
                            ))
                        }
                    </Geographies>

                    {/* Vẽ các chấm đỏ */}
                    {data && data.map((point, index) => (
                        <Marker key={index} coordinates={point.coords}>
                            <circle 
                                r={2}
                                fill="#FF5252"
                                style={{ fillOpacity: 0.5, pointerEvents: 'none' }}
                            />
                        </Marker>
                    ))}
                </ComposableMap>
            </Box>

            {/* <<< BƯỚC 2: PHẦN CHÚ THÍCH TOP 5 THEO CHIỀU NGANG >>> */}
            {top5Provinces.length > 0 && (
                <Box sx={{ p: 2, flexShrink: 0, borderTop: 1, borderColor: 'divider' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 2, textAlign: 'center' }}>
                        Top 5 Tỉnh/Thành có lượng khách hàng cao nhất
                    </Typography>
                    
                    {/* Grid container */}
                    <Grid container spacing={{ xs: 2, md: 3 }} columns={{ xs: 4, sm: 8, md: 12 }}>
                        {top5Provinces.map((province, index) => (
                            // Mỗi mục chiếm 12 cột (toàn bộ) trên xs, và 6 cột (một nửa) trên md
                            <Grid item key={province.city} xs={12} sm={6}>
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                    <Typography sx={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'text.secondary', width: '24px' }}>
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