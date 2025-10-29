import React, { useState, createContext } from 'react';
import { Snackbar, Alert } from '@mui/material';
import { NotificationContext } from './NotificationContext';

export function NotificationProvider({ children }) {
    const [notification, setNotification] = useState({
        open: false,
        message: '',
        severity: 'info', // 'success', 'error', 'warning', 'info'
    });

    const showNotification = (message, severity = 'info') => {
        setNotification({ open: true, message, severity });
    };

    const handleClose = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setNotification({ ...notification, open: false });
    };

    const value = { showNotification };

    return (
        <NotificationContext.Provider value={value}>
            {children}
            <Snackbar
                open={notification.open}
                autoHideDuration={4000} // Thông báo tự tắt sau 4 giây
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} // Hiển thị ở giữa dưới màn hình
            >
                <Alert
                    onClose={handleClose}
                    severity={notification.severity}
                    variant="filled" // Dùng variant 'filled' cho đẹp
                    sx={{
                        width: '100%',
                        // Style theo phong cách glassmorphism của tool
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        border: (theme) => `1px solid ${theme.palette.divider}`,
                    }}
                >
                    {notification.message}
                </Alert>
            </Snackbar>
        </NotificationContext.Provider>
    );
}