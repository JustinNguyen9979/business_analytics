// FILE: frontend/src/pages/BrandLobby.jsx (PHIÊN BẢN CÓ AURORA BACKGROUND)

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Typography, Box, CircularProgress, Alert, Grid, Dialog, DialogTitle, DialogContent, TextField, DialogActions, Button } from '@mui/material';
import { getAllBrands, createBrand, deleteBrand, updateBrand, cloneBrand } from '../services/api';
import BrandCard from '../components/brand/BrandCard';
import CreateBrandCard from '../components/brand/CreateBrandCard';
import AuroraBackground from '../components/ui/AuroraBackground';

function BrandLobby() {
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const [dialogs, setDialogs] = useState({ rename: false, delete: false });
    const [selectedBrand, setSelectedBrand] = useState(null);
    const [newName, setNewName] = useState('');
    const [renameError, setRenameError] = useState('');

    const fetchBrands = async () => {
        try {
            setError(null);
            setLoading(true);
            const data = await getAllBrands();
            setBrands(data);
        } catch (err) {
            setError('Không thể tải danh sách Brand từ server.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBrands();
    }, []);

    const handleBrandClick = (brandSlug) => {
        navigate(`/dashboard/${brandSlug}`);
    };

    const handleBrandCreated = async (brandName) => {
        if (!brandName) return;
        try {
            setError(null);
            await createBrand(brandName);
            fetchBrands();
        } catch (error) {
            throw error;
        }
    };

    const openRenameDialog = (brand) => {
        setSelectedBrand(brand);
        setNewName(brand.name);
        setRenameError('');
        setDialogs({ ...dialogs, rename: true });
    };

    const openDeleteDialog = (brand) => {
        setSelectedBrand(brand);
        setDialogs({ ...dialogs, delete: true });
    };

    const closeDialogs = () => {
        setDialogs({ rename: false, delete: false });
        setSelectedBrand(null);
        setRenameError('');
    };

    const handleRenameSubmit = async () => {
        const trimmedName = newName.trim();
        if (!trimmedName || !selectedBrand) return;
        try {
            await updateBrand(selectedBrand.id, trimmedName);
            fetchBrands();
            closeDialogs();
        } catch (err) {
            const errorMessage = err.response?.data?.detail || 'Lỗi không xác định.';
            setRenameError(errorMessage);
        }
    };
    
    const handleCloneSubmit = async (brandId) => {
        try {
            setError(null);
            await cloneBrand(brandId);
            fetchBrands();
        } catch (err) { // ĐÚNG
            setError(err.response?.data?.detail || 'Lỗi khi nhân bản.');
        }
    };

    const handleDeleteSubmit = async () => {
        if (!selectedBrand) return;
        try {
            setError(null);
            await deleteBrand(selectedBrand.id);
            fetchBrands();
            closeDialogs();
        } catch (err) {
            setError(err.response?.data?.detail || 'Lỗi khi xóa.');
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'background.default' }}>
                <AuroraBackground />
                <CircularProgress />
            </Box>
        );
    }

    return (
        <>
            <AuroraBackground />

            <Box 
                component="main" 
                // maxWidth="lg" 
                sx={{
                    width: '100%', // Đảm bảo chiếm toàn bộ chiều rộng
                    px: 40,         // Thêm padding ngang (giống DashboardPage)
                    py: 8,
                    position: 'relative',
                    zIndex: 1
                }}
            >
                <Box sx={{ textAlign: 'center', mb: 8 }}>
                    <Typography variant="h3" component="h1" gutterBottom>Business Analytics</Typography>
                    <Typography variant="h5" component="h2" color="text.secondary">Quản lý Danh mục Thương hiệu</Typography>
                </Box>

                {error && <Alert severity="error" sx={{ mb: 4, backgroundColor: 'rgba(211, 47, 47, 0.25)', backdropFilter: 'blur(5px)' }}>{error}</Alert>}

                <Grid container spacing={4} justifyContent="center">
                    {brands.map((brand) => (
                        <Grid item key={brand.id}>
                            <BrandCard
                                brand={brand}
                                onClick={handleBrandClick}
                                onRename={openRenameDialog}
                                onClone={handleCloneSubmit}
                                onDelete={openDeleteDialog}
                            />
                        </Grid>
                    ))}
                    <Grid item>
                        <CreateBrandCard
                            onCreate={handleBrandCreated}
                        />
                    </Grid>
                </Grid>

                <Dialog 
                    open={dialogs.rename} 
                    onClose={closeDialogs} 
                    maxWidth="xs" 
                    fullWidth 
                    PaperProps={{ sx: { borderRadius: 4, backgroundColor: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(15px)', border: '1px solid rgba(255, 255, 255, 0.1)' } }}
                    BackdropProps={{ sx: { backdropFilter: 'blur(5px)' } }}
                >
                    <DialogTitle sx={{ fontWeight: 'bold' }}>Đổi tên Thương hiệu</DialogTitle>
                    <DialogContent>
                        <TextField 
                            autoFocus 
                            margin="dense" 
                            label="Tên mới" 
                            type="text" 
                            fullWidth 
                            variant="outlined" 
                            value={newName} 
                            onChange={(e) => setNewName(e.target.value)}
                            error={!!renameError} 
                            helperText={renameError}
                            onKeyPress={(e) => e.key === 'Enter' && handleRenameSubmit()}
                            BackdropProps={{ sx: { backdropFilter: 'blur(5px)' } }}
                        />
                    </DialogContent>
                    <DialogActions sx={{ p: '0 24px 16px' }}>
                        <Button onClick={closeDialogs}>Hủy</Button>
                        <Button onClick={handleRenameSubmit} variant="contained">Lưu</Button>
                    </DialogActions>
                </Dialog>

                <Dialog 
                    open={dialogs.delete} 
                    onClose={closeDialogs} 
                    maxWidth="xs" 
                    fullWidth
                    PaperProps={{ sx: { borderRadius: 4, backgroundColor: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(15px)', border: '1px solid rgba(255, 255, 255, 0.1)' } }}
                    BackdropProps={{ sx: { backdropFilter: 'blur(3px)' } }}
                >
                    <DialogTitle sx={{ color: 'error.main', fontWeight: 'bold' }}>Xóa Thương hiệu</DialogTitle>
                    <DialogContent>
                        <Typography>
                            Bạn có chắc chắn muốn xóa thương hiệu <Typography component="span" sx={{ fontWeight: 'bold', display: 'inline-block', maxWidth: '100%', wordBreak: 'break-word'}}>"{selectedBrand?.name}"</Typography>
                        </Typography>
                        <Typography sx={{ fontWeight: 'bold', mt: 2, color: 'warning.main' }}>
                            CẢNH BÁO: Dữ liệu đã xóa không thể khôi phục.
                        </Typography>
                    </DialogContent>
                    <DialogActions sx={{ p: '0 24px 16px' }}>
                        <Button onClick={closeDialogs}>Hủy</Button>
                        <Button onClick={handleDeleteSubmit} color="error" variant="contained">XÁC NHẬN XÓA</Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </>
    );
}

export default BrandLobby;