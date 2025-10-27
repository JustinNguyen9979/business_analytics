import React, { useEffect, useState, Fragment } from 'react';
import { useParams } from 'react-router-dom';
import { Typography, Box, Grid, Paper, Divider, CircularProgress, Alert } from '@mui/material';
import { getBrandDetails } from '../services/api';
import StatItem from '../components/StatItem';

const ChartPlaceholder = ({ title }) => (
    <Paper variant="placeholder" elevation={0}>
        <Typography variant="h6" color="text.secondary">{title}</Typography>
    </Paper>
);

function DashboardPage() {
    const { brandId } = useParams();
    const [brand, setBrand] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const kpiGroups = [
        {
            groupTitle: 'Tài chính',
            items: [
                { title: 'DOANH THU (GMV)', value: '1.25 tỷ' },
                { title: 'TỔNG CHI PHÍ', value: '850 tr' },
                { title: 'GIÁ VỐN (COGS)', value: '400 tr' },
                { title: 'CHI PHÍ THỰC THI', value: '450 tr' },
                { title: 'LỢI NHUẬN', value: '400 tr' },
                { title: 'ROI', value: '47.05%' },
            ]
        },
        {
            groupTitle: 'Marketing',
            items: [
                { title: 'CHI PHÍ ADS', value: '210 tr' },
                { title: 'ROAS', value: '5.95' },
                { title: 'CPO', value: '40,682đ' },
                { title: 'CTR', value: '2.5%' },
                {title: 'CPC', value: '3,500đ' },
                { title: 'TỶ LỆ CHUYỂN ĐỔI', value: '3.8%' },
            ]
        },
        {
            groupTitle: 'Vận hành',
            items: [
                { title: 'TỔNG ĐƠN', value: '5,432' },
                { title: 'SỐ ĐƠN CHỐT', value: '5,160' },
                { title: 'SỐ ĐƠN HỦY', value: '272' },
                { title: 'TỶ LỆ HỦY ĐƠN', value: '5%' },
                { title: 'TỶ LỆ HOÀN TRẢ', value: '2%' },
                { title: 'GIÁ TRỊ ĐHTB (AOV)', value: '242,248đ' },
            ]
        },
        {
            groupTitle: 'Khách hàng',
            items: [
                { title: 'TỔNG LƯỢNG KHÁCH', value: '2,200' },
                { title: 'KHÁCH MỚI', value: '1,200' },
                { title: 'KHÁCH QUAY LẠI', value: '1000' },
                { title: 'CAC', value: '175,000đ' },
            ]
        }
    ];

    useEffect(() => {
        const fetchDetails = async () => {
            if (!brandId) { setError("Không tìm thấy Brand ID."); setLoading(false); return; }
            try {
                setLoading(true); setError(null);
                const data = await getBrandDetails(brandId);
                setBrand(data);
            } catch (err) {
                console.error("Lỗi khi fetch chi tiết brand:", err);
                setError(`Không thể tải dữ liệu cho brand ID: ${brandId}. Vui lòng thử lại.`);
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [brandId]);

    if (loading) { return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><CircularProgress /></Box>; }
    if (error) { return <Alert severity="error">{error}</Alert>; }
    if (!brand) { return <Alert severity="warning">Không có dữ liệu cho brand này.</Alert>; }

    return (
        <Box>
            <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
                Phân tích cho Thương hiệu: {brand.name}
            </Typography>
            
            <Paper variant="glass" elevation={0} sx={{ p: 3, mb: 4 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                    📊 Chỉ số Hiệu suất Tổng thể
                </Typography>
                <Divider sx={{ mb: 3 }} />
                
                {/* --- KHÔI PHỤC VÀ SỬA LẠI LOGIC DIVIDER --- */}
                <Box
                    sx={{
                        display: 'flex',
                        flexWrap: 'wrap', // Cho phép xuống dòng
                        gap: { xs: 3, md: 0 }, // Chỉ dùng gap trên mobile
                    }}
                >
                    {kpiGroups.map((group, groupIndex) => (
                        <Fragment key={group.groupTitle}>
                            <Box sx={{ flex: '1 1 250px', p: { xs: 0, md: 2 } }}>
                                <Typography variant="overline" sx={{ display: 'block', mb: 2, fontWeight: 600 }}>
                                    {group.groupTitle}
                                </Typography>
                                <Box
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                                        gap: 3,
                                        textAlign: 'left'
                                    }}
                                >
                                    {group.items.map((kpi) => (
                                        <StatItem key={kpi.title} title={kpi.title} value={kpi.value} />
                                    ))}
                                </Box>
                                {/* Divider Ngang cho mobile */}
                                {groupIndex < kpiGroups.length - 1 && (
                                    <Divider sx={{ display: { xs: 'block', md: 'none' }, mt: 3 }} />
                                )}
                            </Box>
                            
                            {/* Divider Dọc cho desktop */}
                            {groupIndex < kpiGroups.length - 1 && (
                                <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />
                            )}
                        </Fragment>
                    ))}
                </Box>
            </Paper>

            <Grid container spacing={3}>
                <Grid item xs={12} lg={8}>
                    <ChartPlaceholder title="Biểu đồ Doanh thu & Chi phí theo Thời gian" />
                </Grid>
                <Grid item xs={12} lg={4}>
                    <ChartPlaceholder title="Biểu đồ tròn Phân bổ Doanh thu" />
                </Grid>
                 <Grid item xs={12}>
                    <ChartPlaceholder title="Biểu đồ cột Top 10 Sản phẩm Bán chạy" />
                </Grid>
            </Grid>
        </Box>
    );
}

export default DashboardPage;