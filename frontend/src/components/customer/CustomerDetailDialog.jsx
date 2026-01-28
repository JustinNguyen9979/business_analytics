import React, { useEffect, useState } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, IconButton, Typography, Box, 
    Paper, Table, TableBody, TableCell, TableContainer, 
    TableHead, TableRow, Avatar, CircularProgress, Stack 
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';

// Context & Services
import { useBrand } from '../../context/BrandContext';
import { fetchCustomerDetailAPI } from '../../services/api';

// Components
import SectionTitle from '../ui/SectionTitle';
import CustomerInfoCard from './CustomerInfoCard';
import OrderRow from './OrderRow';
import OrderHistoryTable from './OrderHistoryTable';

const CustomerDetailDialog = ({ open, onClose, username }) => {
    const { slug } = useBrand();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);

    useEffect(() => {
        if (open && username && slug) {
            setLoading(true);
            fetchCustomerDetailAPI(slug, username)
                .then(res => setData(res))
                .catch(err => console.error(err))
                .finally(() => setLoading(false));
        }
    }, [open, username, slug]);

    const info = data?.info || {};
    const orders = data?.orders || [];

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle sx={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                textTransform: 'none !important', textAlign: 'left !important'
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', width: 45, height: 45 }}>
                        <PersonIcon />
                    </Avatar>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <Typography variant="h6" sx={{ lineHeight: 1.2, fontWeight: 'bold' }}>
                            Hồ sơ Khách hàng
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '1rem' }}>
                            @{username}
                        </Typography>
                    </Box>
                </Box>
                <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            
            <DialogContent dividers>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}><CircularProgress /></Box>
                ) : data ? (
                    <Stack spacing={2}>
                        {/* 1. INFO CARD */}
                        <CustomerInfoCard info={info} />

                        {/* 2. ORDER HISTORY */}
                        <Box>
                            <SectionTitle sx={{ mt: 0 }}>LỊCH SỬ GIAO DỊCH</SectionTitle>
                            <OrderHistoryTable orders={orders} />
                        </Box>
                    </Stack>
                ) : null}
            </DialogContent>
        </Dialog>
    );
};

export default CustomerDetailDialog;