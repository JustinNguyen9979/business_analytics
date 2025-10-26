// FILE: frontend/src/pages/BrandLobby.jsx (PHIÊN BẢN HOÀN CHỈNH ĐỂ COPY)
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Typography, Box, CircularProgress, Alert, Grid, Dialog, DialogTitle, DialogContent, TextField, DialogActions, Button } from '@mui/material';
import { getAllBrands, createBrand, deleteBrand, updateBrand, cloneBrand } from '../services/api';
import BrandCard from '../components/BrandCard';
import CreateBrandCard from '../components/CreateBrandCard';

function BrandLobby() {
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null); // Lỗi chung của trang
    const navigate = useNavigate();

    // State cho các Dialog
    const [dialogs, setDialogs] = useState({ rename: false, delete: false });
    const [selectedBrand, setSelectedBrand] = useState(null);
    const [newName, setNewName] = useState('');
    const [renameError, setRenameError] = useState(''); // Lỗi riêng cho dialog đổi tên

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

    const handleBrandClick = (brandId) => {
        navigate(`/dashboard/${brandId}`);
    };

    const handleBrandCreated = async (brandName) => {
        if (!brandName) return;
        try {
            await createBrand(brandName);
            fetchBrands();
        } catch (error) {
            // Ném lỗi ra để component CreateBrandCard bắt và hiển thị
            throw error;
        }
    };

    const openRenameDialog = (brand) => {
        setSelectedBrand(brand);
        setNewName(brand.name);
        setRenameError(''); // Reset lỗi
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
        } catch (err) {
            setError(err.response?.data?.detail || 'Lỗi khi nhân bản.');
        }
    };

    const handleDeleteSubmit = async () => {
        if (!selectedBrand) return;
        try {
            await deleteBrand(selectedBrand.id);
            fetchBrands();
            closeDialogs();
        } catch (err) {
            setError(err.response?.data?.detail || 'Lỗi khi xóa.');
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Container component="main" maxWidth="lg" sx={{ py: 8 }}>
            <Box sx={{ textAlign: 'center', mb: 8 }}>
                <Typography variant="h3" component="h1" gutterBottom>CEO Dashboard</Typography>
                <Typography variant="h5" component="h2" color="text.secondary">Chọn một Brand để bắt đầu Phân tích</Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 4 }}>{error}</Alert>}

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
                        onError={(msg) => setError(msg)}
                        onClearError={() => setError(null)}
                    />
                </Grid>
            </Grid>

            {/* --- DIALOG ĐỔI TÊN --- */}
            <Dialog 
                open={dialogs.rename} 
                onClose={closeDialogs} 
                maxWidth="xs" 
                fullWidth 
                PaperProps={{
                    sx: {
                        borderRadius: 4, 
                        backgroundColor: 'rgba(30, 41, 59, 0.7)', 
                        backdropFilter: 'blur(15px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                    }
                }}
                BackdropProps={{ sx: { backdropFilter: 'blur(5px)' } }}
            >
                <DialogTitle sx={{ fontWeight: 'bold' }}>Đổi tên Brand</DialogTitle>
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
                    />
                </DialogContent>
                <DialogActions sx={{ p: '0 24px 16px' }}>
                    <Button onClick={closeDialogs}>Hủy</Button>
                    <Button onClick={handleRenameSubmit} variant="contained">Lưu</Button>
                </DialogActions>
            </Dialog>

            {/* --- DIALOG XÁC NHẬN XÓA --- */}
            <Dialog 
                open={dialogs.delete} 
                onClose={closeDialogs} 
                maxWidth="xs" 
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 4, 
                        backgroundColor: 'rgba(30, 41, 59, 0.7)', 
                        backdropFilter: 'blur(15px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                    }
                }}
                BackdropProps={{ sx: { backdropFilter: 'blur(3px)' } }}
            >
                <DialogTitle sx={{ color: 'error.main', fontWeight: 'bold' }}>Xác nhận Xóa</DialogTitle>
                <DialogContent>
                    <Typography>Anh có chắc chắn muốn xóa brand <Typography component="span" sx={{ fontWeight: 'bold' }}>"{selectedBrand?.name}"</Typography> không? Toàn bộ dữ liệu liên quan sẽ bị mất vĩnh viễn.</Typography>
                </DialogContent>
                <DialogActions sx={{ p: '0 24px 16px' }}>
                    <Button onClick={closeDialogs}>Hủy</Button>
                    <Button onClick={handleDeleteSubmit} color="error" variant="contained">Xóa vĩnh viễn</Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}

export default BrandLobby;