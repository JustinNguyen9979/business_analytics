// FILE: frontend/src/pages/BrandLobby.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Container, Typography, Box, Select, MenuItem,
    FormControl, InputLabel, Button, TextField, CircularProgress, Alert,
    Card, CardContent, Stack, Divider
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

import { getAllBrands, createBrand } from '../services/api';

// Component Card với hiệu ứng Kính mờ
const GlassCard = ({ children }) => (
    <Card
        sx={{
            p: 2,
            borderRadius: 4,
            // Hiệu ứng Glassmorphism
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: 3,
        }}
    >
        <CardContent>
            {children}
        </CardContent>
    </Card>
);


function BrandLobby() {
    const [brands, setBrands] = useState([]);
    const [selectedBrand, setSelectedBrand] = useState('');
    const [newBrandName, setNewBrandName] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchBrands = async () => {
            try {
                setError(null);
                const data = await getAllBrands();
                setBrands(data);
                if (data.length > 0) {
                    setSelectedBrand(data[0].id);
                }
            } catch (err) {
                setError('Không thể tải danh sách Brand từ server.');
            } finally {
                setLoading(false);
            }
        };
        fetchBrands();
    }, []);

    const handleGoToDashboard = () => {
        if (selectedBrand) {
            navigate(`/dashboard/${selectedBrand}`);
        }
    };

    const handleCreateBrand = async () => {
        if (!newBrandName) return;
        try {
            setError(null);
            setSuccess(null);
            const newBrand = await createBrand(newBrandName);
            setBrands(prevBrands => [...prevBrands, newBrand]);
            setSelectedBrand(newBrand.id);
            setNewBrandName('');
            setSuccess(`Đã tạo thành công brand '${newBrand.name}'!`);
        } catch (err) {
            setError(err.response?.data?.detail || 'Lỗi khi tạo Brand.');
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
        <Container component="main" maxWidth="md" sx={{ display: 'flex', alignItems: 'center', minHeight: '100vh' }}>
            <Box sx={{ width: '100%' }}>
                <Typography variant="h3" component="h1" gutterBottom align="center" sx={{ mb: 2 }}>
                    CEO Dashboard
                </Typography>
                <Typography variant="h5" component="h2" color="text.secondary" align="center" sx={{ mb: 5 }}>
                    Phân tích Dữ liệu, Tối ưu Tăng trưởng
                </Typography>

                <Stack spacing={4}>
                    {/* Card Chọn Brand */}
                    <GlassCard>
                        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                            <BusinessIcon color="primary" />
                            <Typography variant="h6">Chọn Brand hiện có</Typography>
                        </Stack>
                        <FormControl fullWidth variant="outlined">
                            <InputLabel id="select-brand-label">Brand</InputLabel>
                            <Select
                                labelId="select-brand-label"
                                value={selectedBrand}
                                label="Brand"
                                onChange={(e) => setSelectedBrand(e.target.value)}
                                disabled={brands.length === 0}
                            >
                                {brands.length === 0 && <MenuItem disabled>Chưa có brand nào</MenuItem>}
                                {brands.map((brand) => (
                                    <MenuItem key={brand.id} value={brand.id}>{brand.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button
                            fullWidth
                            variant="contained"
                            onClick={handleGoToDashboard}
                            sx={{ mt: 2, py: 1.5 }}
                            disabled={!selectedBrand}
                        >
                            Phân tích Brand
                        </Button>
                    </GlassCard>

                    {/* Card Tạo Brand */}
                    <GlassCard>
                        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                            <AddCircleOutlineIcon color="secondary" />
                            <Typography variant="h6">Hoặc tạo Brand mới</Typography>
                        </Stack>
                        <TextField
                            fullWidth
                            label="Tên Brand mới"
                            variant="outlined"
                            value={newBrandName}
                            onChange={(e) => setNewBrandName(e.target.value)}
                            sx={{ mb: 2 }}
                        />
                        <Button fullWidth variant="outlined" color="secondary" onClick={handleCreateBrand} sx={{ py: 1.5 }}>
                            Tạo Brand
                        </Button>
                    </GlassCard>

                    {/* Vùng hiển thị thông báo */}
                    {error && <Alert severity="error" variant="outlined">{error}</Alert>}
                    {success && <Alert severity="success" variant="outlined">{success}</Alert>}
                </Stack>
            </Box>
        </Container>
    );
}

export default BrandLobby;