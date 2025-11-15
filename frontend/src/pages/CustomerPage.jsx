// FILE: frontend/src/pages/CustomerPage.jsx (TẠO MỚI)

import React from 'react';
import { Box, Typography, Paper, Divider } from '@mui/material';

function CustomerPage() {
    return (
        <Box sx={{ px: 4 }}>
            <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
                Báo cáo Khách hàng
            </Typography>
            <Paper variant="glass" elevation={0} sx={{ p: 3, mb: 4, minHeight: 400 }}>
                <Typography color="text.secondary">
                    Nội dung chi tiết và các biểu đồ chuyên sâu về Khách hàng sẽ được phát triển ở đây.
                </Typography>
            </Paper>
        </Box>
    );
}

export default CustomerPage;