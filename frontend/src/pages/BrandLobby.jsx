// FILE: frontend/src/pages/BrandLobby.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Typography, Box, CircularProgress, Alert, Grid, Dialog, DialogTitle, DialogContent, TextField, DialogActions, Button } from '@mui/material';
import { getAllBrands, createBrand, deleteBrand, updateBrand, cloneBrand } from '../services/api';
import BrandCard from '../components/BrandCard';
import CreateBrandCard from '../components/CreateBrandCard';

function BrandLobby() {
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    // State cho các Dialog
    const [dialogs, setDialogs] = useState({ rename: false, delete: false });
    const [selectedBrand, setSelectedBrand] = useState(null);
    const [newName, setNewName] = useState('');

    // Hàm tải danh sách brand
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

    const handleBrandDelete = async (brandId) => {
        // Hỏi xác nhận trước khi xóa
        if (window.confirm("Anh có chắc chắn muốn xóa brand này không? Hành động này không thể hoàn tác.")) {
            try {
                setError(null);
                await deleteBrand(brandId);
                fetchBrands(); // Tải lại danh sách brand sau khi xóa
            } catch (err) {
                setError(err.response?.data?.detail || 'Lỗi khi xóa Brand.');
            }
        }
    };

    useEffect(() => {
        fetchBrands();
    }, []);

    // Xử lý khi click vào một brand card
    const handleBrandClick = (brandId) => {
        navigate(`/dashboard/${brandId}`);
    };

    // Xử lý khi tạo brand mới thành công
    const handleBrandCreated = async (brandName) => {
        if (!brandName) return;
        try {
            await createBrand(brandName);
            fetchBrands(); // Tải lại danh sách brand để hiển thị brand mới
        } catch (err) {
            setError(err.response?.data?.detail || 'Lỗi khi tạo Brand.');
        }
    };

    // --- HÀM MỞ DIALOG ---
    const openRenameDialog = (brand) => {
        setSelectedBrand(brand);
        setNewName(brand.name);
        setDialogs({ ...dialogs, rename: true });
    };

    const openDeleteDialog = (brand) => {
        setSelectedBrand(brand);
        setDialogs({ ...dialogs, delete: true });
    };

    const closeDialogs = () => {
        setDialogs({ rename: false, delete: false });
        setSelectedBrand(null);
    };

    // --- HÀM XỬ LÝ SỰ KIỆN ---
    const handleRenameSubmit = async () => {
        if (!newName || !selectedBrand) return;
        try {
            await updateBrand(selectedBrand.id, newName);
            fetchBrands();
            closeDialogs();
        } catch (err) { setError(err.response?.data?.detail || 'Lỗi khi đổi tên.'); }
    };
    
    const handleCloneSubmit = async (brandId) => {
        try {
            await cloneBrand(brandId);
            fetchBrands();
        } catch (err) { setError(err.response?.data?.detail || 'Lỗi khi nhân bản.'); }
    };

    const handleDeleteSubmit = async () => {
        if (!selectedBrand) return;
        try {
            await deleteBrand(selectedBrand.id);
            fetchBrands();
            closeDialogs();
        } catch (err) { setError(err.response?.data?.detail || 'Lỗi khi xóa.'); }
    };

    // Giao diện loading
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
                <Typography variant="h3" component="h1" gutterBottom>
                    CEO Dashboard
                </Typography>
                <Typography variant="h5" component="h2" color="text.secondary">
                    Chọn một Brand để bắt đầu Phân tích
                </Typography>
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
                    <CreateBrandCard onBrandCreated={handleBrandCreated} />
                </Grid>
            </Grid>

            {/* --- DIALOG ĐỔI TÊN --- */}
            <Dialog open={dialogs.rename} onClose={closeDialogs}>
                <DialogTitle>Đổi tên Brand</DialogTitle>
                <DialogContent>
                    <TextField autoFocus margin="dense" label="Tên mới" type="text" fullWidth variant="standard" value={newName} onChange={(e) => setNewName(e.target.value)} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDialogs}>Hủy</Button>
                    <Button onClick={handleRenameSubmit}>Lưu</Button>
                </DialogActions>
            </Dialog>

            {/* --- DIALOG XÁC NHẬN XÓA --- */}
            <Dialog open={dialogs.delete} onClose={closeDialogs}>
                <DialogTitle>Xác nhận Xóa</DialogTitle>
                <DialogContent>
                    <Typography>Anh có chắc chắn muốn xóa brand "{selectedBrand?.name}" không? Toàn bộ dữ liệu liên quan sẽ bị mất vĩnh viễn.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDialogs}>Hủy</Button>
                    <Button onClick={handleDeleteSubmit} color="error" variant="contained">Xóa</Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}

export default BrandLobby;