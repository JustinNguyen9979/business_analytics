import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    IconButton, CircularProgress, Box, FormControl, InputLabel,
    Select, MenuItem, FormHelperText, TextField, InputAdornment
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DownloadIcon from '@mui/icons-material/Download'; // Import DownloadIcon
import FileDropzone from './FileDropzone';

const MAX_SOURCE_LENGTH = 20;

// Danh sách các sàn mặc định
const DEFAULT_PLATFORMS = [
    { key: 'shopee', name: 'Shopee' },
    { key: 'tiktok', name: 'TikTok Shop' },
];

// Lấy danh sách sàn tùy chỉnh từ localStorage cho một brand cụ thể
const getCustomPlatforms = (brandId) => {
    if (!brandId) return [];
    const saved = localStorage.getItem(`customPlatforms_${brandId}`);
    return saved ? JSON.parse(saved) : [];
};

// Lưu danh sách sàn tùy chỉnh vào localStorage cho một brand cụ thể
const saveCustomPlatforms = (brandId, platforms) => {
    if (!brandId) return;
    localStorage.setItem(`customPlatforms_${brandId}`, JSON.stringify(platforms));
};

function SingleImportDialog({ open, onClose, onUpload, brandId }) {
    const [platforms, setPlatforms] = useState([...DEFAULT_PLATFORMS, ...getCustomPlatforms(brandId)]);
    const [selectedPlatform, setSelectedPlatform] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [customSource, setCustomSource] = useState('');
    const [customSourceError, setCustomSourceError] = useState('');

    useEffect(() => {
        // Luôn cập nhật danh sách platform khi brandId thay đổi
        if (brandId) {
            setPlatforms([...DEFAULT_PLATFORMS, ...getCustomPlatforms(brandId)]);
        }

        // Chỉ reset các trường của form khi dialog được mở
        if (open) {
            setSelectedPlatform('');
            setSelectedFile(null);
            setIsUploading(false);
            setCustomSource('');
            setCustomSourceError('');
        }
    }, [open, brandId]);

    const handleClose = () => {
        if (!isUploading) {
            onClose();
        }
    };

    const handleAddCustomSource = () => {
        if (!brandId) {
            setCustomSourceError('Không thể thêm sàn khi không có brand ID.');
            return;
        }
        const trimmedSource = customSource.trim();
        if (!trimmedSource) {
            setCustomSourceError('Tên sàn không được để trống.');
            return;
        }
        if (trimmedSource.length > MAX_SOURCE_LENGTH) {
            setCustomSourceError(`Tên sàn không được vượt quá ${MAX_SOURCE_LENGTH} ký tự.`);
            return;
        }
        const newPlatformKey = trimmedSource.toLowerCase().replace(/\s+/g, '_');
        const isDuplicate = platforms.some(p => p.key === newPlatformKey);
        if (isDuplicate) {
            setCustomSourceError('Sàn này đã tồn tại.');
            return;
        }

        const newPlatform = { key: newPlatformKey, name: trimmedSource };
        const currentCustomPlatforms = getCustomPlatforms(brandId);
        const updatedCustomPlatforms = [...currentCustomPlatforms, newPlatform];
        saveCustomPlatforms(brandId, updatedCustomPlatforms);

        setPlatforms([...DEFAULT_PLATFORMS, ...updatedCustomPlatforms]);
        setSelectedPlatform(newPlatformKey); // Tự động chọn sàn vừa thêm
        setCustomSource('');
        setCustomSourceError('');
    };

    const handleUpload = async () => {
        if (!selectedFile || !selectedPlatform) return;

        setIsUploading(true);
        try {
            await onUpload(selectedPlatform, selectedFile);
        } finally {
            onClose();
        }
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Import Dữ liệu từ Template Chuẩn
                <IconButton edge="end" color="inherit" onClick={handleClose} aria-label="close">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent>
                <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <FormControl fullWidth required>
                        <InputLabel id="platform-select-label">Chọn Sàn Hoặc Thêm Sàn Mới</InputLabel>
                        <Select
                            labelId="platform-select-label"
                            value={selectedPlatform}
                            label="Chọn Sàn Hoặc Thêm Sàn Mới *"
                            onChange={(e) => setSelectedPlatform(e.target.value)}
                            renderValue={(selected) => platforms.find(p => p.key === selected)?.name || ''}
                            sx={{
                                color: 'white', // Ensures the text is white
                                '.MuiSelect-icon': {
                                    color: 'white', // Changes the dropdown arrow to white
                                },
                            }}
                        >
                            {platforms.map((platform) => (
                                <MenuItem key={platform.key} value={platform.key}>
                                    {platform.name}
                                </MenuItem>
                            ))}
                            <Box sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.12)' }}>
                                <TextField
                                    fullWidth
                                    variant="outlined"
                                    size="small"
                                    placeholder="Nhập tên sàn mới..."
                                    value={customSource}
                                    onChange={(e) => {
                                        setCustomSource(e.target.value);
                                        if (customSourceError) setCustomSourceError('');
                                    }}
                                    error={!!customSourceError}
                                    helperText={customSourceError}
                                    inputProps={{ maxLength: MAX_SOURCE_LENGTH }}
                                    onKeyDown={(e) => {
                                        // Ngăn sự kiện lan lên component Select,
                                        // tránh việc Select bắt phím 's' để tìm kiếm
                                        e.stopPropagation();
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddCustomSource();
                                        }
                                    }}
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    aria-label="add custom source"
                                                    onClick={handleAddCustomSource}
                                                    edge="end"
                                                    size="small"
                                                    sx={{ color: 'white' }} // Changes the add icon to white
                                                >
                                                    <AddCircleOutlineIcon />
                                                </IconButton>
                                            </InputAdornment>
                                        )
                                    }}
                                />
                            </Box>
                        </Select>
                        <FormHelperText>
                            Chọn sàn có sẵn hoặc thêm sàn mới của bạn.
                        </FormHelperText>
                    </FormControl>

                    <Box sx={{
                        opacity: selectedPlatform ? 1 : 0.5,
                        pointerEvents: selectedPlatform ? 'auto' : 'none',
                        transition: 'opacity 0.3s ease'
                    }}>
                        <FileDropzone
                            title="Tải lên File Template"
                            onFileChange={setSelectedFile}
                        />
                    </Box>
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: '0 24px 16px', justifyContent: 'space-between' }}>
                <Button
                    component="a" // Render as an anchor tag
                    href="/Standard_Template.xlsx" // Path to the sample file
                    download="Standard_Template.xlsx" // Suggests filename for download
                    startIcon={<DownloadIcon />}
                    color="info" // Use an appropriate color
                    variant="outlined"
                    sx={{ mr: 'auto' }} // Pushes it to the left
                >
                    Tải file mẫu
                </Button>
                <Button onClick={handleClose} disabled={isUploading} color="secondary">
                    Hủy
                </Button>
                <Button
                    onClick={handleUpload}
                    variant="contained"
                    color="secondary" // Changed to secondary color
                    disabled={!selectedFile || !selectedPlatform || isUploading}
                    startIcon={isUploading ? <CircularProgress size={20} color="inherit" /> : null}
                >
                    {isUploading ? 'Đang xử lý...' : 'Bắt đầu Import'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default SingleImportDialog;