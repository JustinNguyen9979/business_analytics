// FILE: frontend/src/components/KpiCard.jsx

import React from 'react';
import { Paper, Typography, Box, Avatar } from '@mui/material';

function KpiCard({ title, value, icon, color = 'primary.main' }) {
    return (
        <Paper 
            elevation={0}
            sx={{
                p: 2.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                // Style liquid glass nhẹ
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 4, // Bo tròn nhiều hơn
            }}
        >
            <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    {title}
                </Typography>
                <Typography variant="h5" fontWeight="600">
                    {value}
                </Typography>
            </Box>
            <Avatar 
                sx={{ 
                    bgcolor: color, 
                    color: 'white',
                    width: 56, 
                    height: 56 
                }}
            >
                {icon}
            </Avatar>
        </Paper>
    );
}

export default KpiCard;