// FILE: frontend/src/pages/DashboardPage.jsx (PHIÊN BẢN CÓ LAYOUT)

import React from 'react'; // Bỏ useEffect, useState đi, chúng ta sẽ thêm lại sau
import { useParams } from 'react-router-dom';
import { Typography, Box, CircularProgress, Alert, Grid, Paper } from '@mui/material';
// import { getBrandDetails } from '../services/api';

// 1. IMPORT CÁC COMPONENT VÀ ICON CẦN THIẾT
import KpiCard from '../components/KpiCard';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PaidIcon from '@mui/icons-material/Paid';

// Component placeholder cho biểu đồ
const ChartPlaceholder = ({ title }) => (
    <Paper 
        elevation={0}
        sx={{ 
            p: 3, 
            height: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 4,
        }}
    >
        <Typography variant="h6" color="text.secondary">{title}</Typography>
    </Paper>
);


function DashboardPage() {
    // Tạm thời comment lại logic fetch data để tập trung vào layout
    const { brandId } = useParams();
    // const [brand, setBrand] = useState(null);
    // const [loading, setLoading] = useState(true);
    // const [error, setError] = useState(null);

    // useEffect(() => { ... });

    // if (loading) return <CircularProgress />;
    // if (error) return <Alert severity="error">{error}</Alert>;
    
    // 2. DÙNG DỮ LIỆU GIẢ ĐỂ TEST GIAO DIỆN
    const brandName = "Tên Thương hiệu Mẫu";

    return (
        <Box>
            <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
                Phân tích cho Thương hiệu: {brandName}
            </Typography>
            
            {/* --- KHU VỰC 1: CÁC CHỈ SỐ KPI CHÍNH --- */}
            <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                    <KpiCard 
                        title="Tổng Doanh thu" 
                        value="1.25 tỷ" 
                        icon={<AttachMoneyIcon />} 
                        color="#2e7d32" // Màu xanh lá
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <KpiCard 
                        title="Tổng Đơn hàng" 
                        value="5,432" 
                        icon={<ShoppingCartIcon />} 
                        color="#0288d1" // Màu xanh dương
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <KpiCard 
                        title="Chi phí QC" 
                        value="210 tr" 
                        icon={<PaidIcon />} 
                        color="#d32f2f" // Màu đỏ
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <KpiCard 
                        title="ROAS" 
                        value="5.95" 
                        icon={<TrendingUpIcon />} 
                        color="#ed6c02" // Màu cam
                    />
                </Grid>
            </Grid>

            {/* --- KHU VỰC 2: CÁC BIỂU ĐỒ CHÍNH --- */}
            <Grid container spacing={3} sx={{ mt: 2 }}>
                {/* Biểu đồ đường */}
                <Grid item xs={12} lg={8}>
                    <ChartPlaceholder title="Biểu đồ Doanh thu & Chi phí theo Thời gian" />
                </Grid>

                {/* Biểu đồ tròn */}
                <Grid item xs={12} lg={4}>
                    <ChartPlaceholder title="Biểu đồ tròn Phân bổ Doanh thu" />
                </Grid>

                 {/* Biểu đồ cột */}
                 <Grid item xs={12}>
                    <ChartPlaceholder title="Biểu đồ cột Top 10 Sản phẩm Bán chạy" />
                </Grid>
            </Grid>
        </Box>
    );
}

export default DashboardPage;