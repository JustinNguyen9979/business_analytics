// FILE: frontend/src/components/charts/GeoMapChart.jsx (PHIÊN BẢN SỬA LỖI RACE CONDITION)

import React, { memo, useMemo } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from '@vnedyalk0v/react19-simple-maps';
import { Box } from '@mui/material';

// Import trực tiếp file JSON
import geoData from '../../assets/vietnam.json';

function GeoMapChartComponent({ data }) {

    // Tạo một Map để tra cứu thông tin bản đồ.
    // Dùng useMemo để đảm bảo nó chỉ được tạo một lần.
    const geoMap = useMemo(() => {
        const map = new Map();
        if (geoData && geoData.features) {
            geoData.features.forEach(geo => {
                // Key: Tên tỉnh, Value: Toàn bộ object properties chứa centroid
                map.set(geo.properties.Ten, geo.properties);
            });
        }
        return map;
    }, []); // Dependency rỗng, chỉ chạy 1 lần

    return (
        <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
            <ComposableMap
                projection="geoMercator"
                projectionConfig={{
                    scale: 2800,
                    center: [107.5, 16]
                }}
                style={{ width: '100%', height: '100%' }}
            >
                {/* LỚP 1: VẼ NỀN BẢN ĐỒ MÀU XÁM */}
                {/* Luôn vẽ nền bản đồ vì geoData đã được import tĩnh */}
                <Geographies geography={geoData}>
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

                {/* LỚP 2: VẼ CÁC ĐIỂM ĐỎ LÊN TRÊN */}
                {/* <<< GIẢI PHÁP NẰM Ở ĐÂY: CHỈ RENDER KHI CÓ DATA VÀ GEOMAP >>> */}
                {data && data.length > 0 && geoMap.size > 0 && data.map((item, index) => {
                    const geoInfo = geoMap.get(item.city);

                    if (!geoInfo || !geoInfo.centroid) {
                        // Dòng log này bây giờ sẽ không còn xuất hiện nữa
                        console.error(`KHÔNG TÌM THẤY TỌA ĐỘ cho tỉnh từ API: "${item.city}"`);
                        return null;
                    }
                    
                    return (
                        <Marker
                            key={index} 
                            coordinates={geoInfo.centroid}
                        >
                            <circle 
                                r={5}
                                fill="#FF5252"
                            />
                        </Marker>
                    );
                })}
            </ComposableMap>
        </Box>
    );
}

export default memo(GeoMapChartComponent);