// FILE: frontend/src/pages/DashboardPage.jsx

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Typography, Box, CircularProgress, Alert } from '@mui/material';
import { getBrandDetails } from '../services/api';

function DashboardPage() {
    // Lấy brandId từ URL, ví dụ: /dashboard/123 -> brandId là '123'
    const { brandId } = useParams();
    const [brand, setBrand] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await getBrandDetails(brandId);
                setBrand(data);
            } catch (err) {
                setError(`Không thể tải dữ liệu cho brand ID: ${brandId}`);
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [brandId]); // Chạy lại khi brandId thay đổi

    if (loading) {
        return <CircularProgress />;
    }

    if (error) {
        return <Alert severity="error">{error}</Alert>;
    }
    
    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                Phân tích cho Thương hiệu: {brand?.name}
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
                Đây là nơi hiển thị các biểu đồ, KPI và bảng dữ liệu... Cuộn xuống để xem hiệu ứng nền.
            </Typography>
            
            {/* THÊM NỘI DUNG DÀI ĐỂ CÓ THỂ CUỘN */}
            <Box sx={{ height: '200vh', border: '1px dashed grey', p: 2 }}>
                <Typography>Nội dung placeholder rất dài để tạo thanh cuộn.</Typography>
            </Box>
        </Box>
    );
}

export default DashboardPage;