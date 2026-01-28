import React from 'react';
import { Box, Typography } from '@mui/material';

export const LabelValue = ({ label, value, icon, isLink = false, color = 'text.primary' }) => (
    <Box sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', mb: 0.5, letterSpacing: 0.5, textTransform: 'uppercase', fontSize: '0.7rem' }}>
            {icon && React.cloneElement(icon, { sx: { fontSize: 14, mr: 0.8 } })} {label}
        </Typography>
        <Typography variant="body2" color={color} sx={{ fontWeight: 500, wordBreak: 'break-word', cursor: isLink ? 'pointer' : 'default', '&:hover': isLink ? { textDecoration: 'underline' } : {} }}>
            {value}
        </Typography>
    </Box>
);

export const SectionTitle = ({ children }) => (
    <Typography variant="subtitle2" sx={{ 
        textTransform: 'uppercase', 
        letterSpacing: '1.2px', 
        color: 'primary.main', 
        fontWeight: 700, 
        fontSize: '0.75rem',
        mb: 2, mt: 1
    }}>
        {children}
    </Typography>
);