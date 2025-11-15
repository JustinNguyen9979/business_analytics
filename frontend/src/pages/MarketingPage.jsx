// FILE: frontend/src/pages/MarketingPage.jsx (TẠO MỚI)

import React from 'react';
import { Box, Typography, Paper, Divider } from '@mui/material';

function MarketingPage() {
    return (
        <Box sx={{ px: 4 }}>
            <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
                Báo cáo Marketing
            </Typography>
            <Paper variant="glass" elevation={0} sx={{ p: 3, mb: 4, minHeight: 400 }}>
                <Typography color="text.secondary">
                    Nội dung chi tiết và các biểu đồ chuyên sâu về Marketing sẽ được phát triển ở đây.
                </Typography>
            </Paper>
        </Box>
    );
}

export default MarketingPage;