// FILE: frontend/src/components/StatItem.jsx (PHIÊN BẢN DỌN DẸP)

import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

// Chỉ còn lại duy nhất component StatItem
export function StatItem({ title, value, tooltipText }) {
    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    {title}
                </Typography>
                {tooltipText && (
                    <Tooltip title={tooltipText} arrow placement="top">
                        <InfoOutlinedIcon sx={{ fontSize: '0.875rem', color: 'text.secondary', cursor: 'help' }} />
                    </Tooltip>
                )}
            </Box>
            <Typography variant="h5" fontWeight="600">
                {value}
            </Typography>
        </Box>
    );
}