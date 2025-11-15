// FILE: frontend/src/pages/OperationPage.jsx (TẠO MỚI)

import React from 'react';
import { Box, Typography, Paper, Divider } from '@mui/material';

function OperationPage() {
    return (
        <Box sx={{ px: 4 }}>
            <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
                Báo cáo Vận hành
            </Typography>
            <Paper variant="glass" elevation={0} sx={{ p: 3, mb: 4, minHeight: 400 }}>
                <Typography color="text.secondary">
                    Nội dung chi tiết và các biểu đồ chuyên sâu về Vận hành sẽ được phát triển ở đây.
                </Typography>
            </Paper>
        </Box>
    );
}

export default OperationPage;