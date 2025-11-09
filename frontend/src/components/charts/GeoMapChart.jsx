// FILE: frontend/src/components/charts/GeoMapChart.jsx (PHIÊN BẢN ANIMATION SVG GỐC)

import React, { memo, useMemo } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from '@vnedyalk0v/react19-simple-maps';
import { Box, Grid, Stack, Typography } from '@mui/material';
import { scaleLinear } from 'd3-scale';

import geoShapeData from '../../assets/vietnam-shape.json';

function GeoMapChartComponent({ data }) {
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

    const top5Provinces = useMemo(() => {
        if (!data || data.length === 0) {
            return [];
        }
        // Sắp xếp dữ liệu theo customer_count giảm dần và lấy 5 phần tử đầu tiên
        return [...data]
            .sort((a, b) => b.customer_count - a.customer_count)
            .slice(0, 5);
    }, [data]);

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
                                    stroke="#596275"
                                    style={{ default: { outline: 'none' } }}
                                />
                            ))
                        }
                    </Geographies>

                    {data.map(item => {
                        if (!item.coords || item.coords.length !== 2) return null;

                        const size = sizeScale(item.customer_count);
                        const opacity = opacityScale(item.customer_count);

                        return (
                            <Marker
                                key={item.city}
                                coordinates={item.coords}
                                data-tooltip-content={`${item.city}: ${item.customer_count.toLocaleString('vi-VN')} khách`}
                            >
                                {/* Group chứa toàn bộ hiệu ứng cho một điểm */}
                                <g style={{ cursor: 'pointer', pointerEvents: 'none' }}>
                                    {/* <<< SỬ DỤNG THẺ <animate> GỐC CỦA SVG >>> */}

                                    {/* Vòng sóng 1 */}
                                    <circle
                                        className="ripple" // Class chung
                                        r={size} 
                                        fill="none" 
                                        stroke="#FF5252" 
                                        strokeWidth={2}
                                    />
                                    
                                    {/* Vòng sóng 2 */}
                                     <circle
                                        className="ripple ripple-2" // Class chung và class delay
                                        r={size} 
                                        fill="none" 
                                        stroke="#FF5252" 
                                        strokeWidth={2}
                                    />
                                    
                                    {/* Chấm tròn trung tâm */}
                                    <circle
                                        r={size}
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