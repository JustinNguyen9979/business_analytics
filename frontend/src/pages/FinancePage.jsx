// FILE: frontend/src/pages/FinancePage.jsx (TẠO MỚI)

import React from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Paper, Divider } from '@mui/material';

// Phiên bản đầu tiên của trang Tài chính
function FinancePage() {
    const { brandId } = useParams(); // Lấy brandId từ URL nếu cần

    return (
        // Sử dụng Box với padding tương tự trang Dashboard để nhất quán
        <Box sx={{ px: 4 }}>
            <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
                Báo cáo Tài chính
            </Typography>

            {/* Khung chứa các bộ lọc */}
            <Paper variant="glass" elevation={0} sx={{ p: 3, mb: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Bộ lọc
                    </Typography>
                    {/* Nơi đặt các component bộ lọc ngày tháng sau này */}
                </Box>
                <Divider />
                {/* Thêm các bộ lọc khác nếu cần */}
            </Paper>

            {/* Khung chứa các chỉ số và biểu đồ */}
            <Paper variant="glass" elevation={0} sx={{ p: 3, mb: 4 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                    Các chỉ số chính
                </Typography>
                <Divider sx={{ mb: 3 }} />

                <Box sx={{ minHeight: 400 }}>
                    <Typography color="text.secondary">
                        Nội dung chi tiết và các biểu đồ chuyên sâu về tài chính sẽ được phát triển ở đây.
                    </Typography>
                </Box>
            </Paper>
        </Box>
    );
}

export default FinancePage;