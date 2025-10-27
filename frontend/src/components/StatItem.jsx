// FILE: frontend/src/components/StatItem.jsx

import React from 'react';
import { Box, Typography } from '@mui/material';

function StatItem({ title, value }) {
    return (
        <Box>
            <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                {title}
            </Typography>
            <Typography variant="h5" fontWeight="600">
                {value}
            </Typography>
        </Box>
    );
}

export default StatItem;