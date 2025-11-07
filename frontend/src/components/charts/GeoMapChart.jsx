// FILE: frontend/src/components/charts/GeoMapChart.jsx (GIẢI PHÁP CUỐI CÙNG VỚI REACT.MEMO)

import React, { useState, useEffect, memo } from 'react'; // 1. IMPORT MEMO
import { ComposableMap, Geographies, Geography } from '@vnedyalk0v/react19-simple-maps';
import { scaleLinear } from 'd3-scale';
import { useTheme } from '@mui/material/styles';
import { Box, CircularProgress, Typography } from '@mui/material';

// Đổi tên component gốc để thêm `memo`
function GeoMapChartComponent({ data }) {
    const theme = useTheme();
    const [topoJsonData, setTopoJsonData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchTopoJson = async () => {
            setIsLoading(true);
            try {
                const response = await fetch('/vietnam-provinces-topo.json');
                if (!response.ok) throw new Error(`Không tìm thấy file bản đồ! Lỗi: ${response.status}`);
                const jsonData = await response.json();
                setTopoJsonData(jsonData);
            } catch (error) {
                console.error("Không thể tải hoặc phân tích file TopoJSON cục bộ:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTopoJson();
    }, []);

    if (isLoading) {
        return <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><CircularProgress /></Box>;
    }

    if (!topoJsonData) {
        return <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Typography color="text.secondary">Lỗi tải dữ liệu bản đồ.</Typography></Box>;
    }
    
    if (!data || data.length === 0) {
        // Vẫn render bản đồ trống với tooltip thông báo
        return (
            <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                <ComposableMap projection="geoMercator" projectionConfig={{ scale: 2200, center: [106, 16] }} style={{ width: '100%', height: '100%' }} data-tooltip-id="map-tooltip" >
                    <Geographies geography={topoJsonData}>
                        {({ geographies }) => geographies.map(geo => (
                            <Geography key={geo.rsmKey} geography={geo} fill="#424242" stroke={theme.palette.background.default} style={{ default: { outline: 'none' } }} data-tooltip-content="Không có dữ liệu"/>
                        ))}
                    </Geographies>
                </ComposableMap>
            </Box>
        );
    }

    const maxCustomers = Math.max(...data.map(d => d.customer_count), 0);
    const colorScale = scaleLinear().domain([0, maxCustomers]).range([theme.palette.primary.dark, theme.palette.primary.light]);

    return (
        <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
            <ComposableMap projection="geoMercator" projectionConfig={{ scale: 2200, center: [106, 16] }} style={{ width: '100%', height: '100%' }} data-tooltip-id="map-tooltip" >
                <Geographies geography={topoJsonData}>
                    {({ geographies }) => geographies.map(geo => {
                        const provinceData = data.find(d => d.city === geo.properties.name);
                        const customerCount = provinceData ? provinceData.customer_count : 0;
                        return (
                            <Geography
                                // 2. SỬ DỤNG MỘT KEY KHÁC ỔN ĐỊNH HƠN
                                key={geo.properties.name} 
                                geography={geo}
                                fill={provinceData ? colorScale(customerCount) : '#424242'}
                                stroke={theme.palette.background.default}
                                style={{
                                    default: { outline: 'none' },
                                    hover: { outline: 'none', fill: theme.palette.secondary.main },
                                    pressed: { outline: 'none' },
                                }}
                                data-tooltip-content={`${geo.properties.name}: ${customerCount.toLocaleString('vi-VN')} khách`}
                            />
                        );
                    })}
                </Geographies>
            </ComposableMap>
        </Box>
    );
}

// 3. BỌC COMPONENT TRONG MEMO TRƯỚC KHI EXPORT
export default memo(GeoMapChartComponent);