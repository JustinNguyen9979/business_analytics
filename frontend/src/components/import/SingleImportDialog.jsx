// FILE: frontend/src/components/import/SingleImportDialog.jsx (PHIÊN BẢN NÂNG CẤP CÓ CHỌN SÀN)

import React from 'react';
import { useState, useEffect } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, DialogActions, Button, 
    IconButton, CircularProgress, Box, FormControl, InputLabel, 
    Select, MenuItem, FormHelperText 
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FileDropzone from './FileDropzone';

// Danh sách các sàn được hỗ trợ
const SUPPORTED_PLATFORMS = [
    { key: 'shopee', name: 'Shopee' },
    { key: 'tiktok', name: 'TikTok Shop' },
    { key: 'lazada', name: 'Lazada' },
];

function SingleImportDialog({ open, onClose, onUpload }) {
    const [selectedPlatform, setSelectedPlatform] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    // Reset lại toàn bộ state khi dialog được mở lại
    useEffect(() => {
        if (open) {
            setSelectedPlatform('');
            setSelectedFile(null);
            setIsUploading(false);
        }
    }, [open]);

    const handleClose = () => {
        if (!isUploading) {
            onClose();
        }
    };

    const handleUpload = async () => {
        if (!selectedFile || !selectedPlatform) return;

        setIsUploading(true);
        try {
            // Truyền cả platform và file lên cho hàm onUpload
            await onUpload(selectedPlatform, selectedFile);
        } finally {
            // isUploading sẽ được reset khi dialog mở lại
            onClose(); // Tự động đóng dialog sau khi upload xong
        }
    };

    return (
        <Dialog 
            open={open} 
            onClose={handleClose} 
            maxWidth="sm" // Tăng kích thước một chút để chứa vừa các thành phần
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
                    {/* BƯỚC 1: HỘP THOẠI CHỌN SÀN */}
                    <FormControl fullWidth required>
                        <InputLabel id="platform-select-label">Chọn Sàn Giao Dịch</InputLabel>
                        <Select
                            labelId="platform-select-label"
                            value={selectedPlatform}
                            label="Chọn Sàn Giao Dịch *"
                            onChange={(e) => setSelectedPlatform(e.target.value)}
                        >
                            {SUPPORTED_PLATFORMS.map((platform) => (
                                <MenuItem key={platform.key} value={platform.key}>
                                    {platform.name}
                                </MenuItem>
                            ))}
                        </Select>
                        <FormHelperText>
                            Vui lòng chọn sàn bạn muốn import dữ liệu vào.
                        </FormHelperText>
                    </FormControl>

                    {/* BƯỚC 2: KHU VỰC UPLOAD FILE - SẼ BỊ VÔ HIỆU HÓA NẾU CHƯA CHỌN SÀN */}
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

            <DialogActions sx={{ p: '0 24px 16px' }}>
                <Button onClick={handleClose} disabled={isUploading} color="secondary">
                    Hủy
                </Button>
                <Button 
                    onClick={handleUpload} 
                    variant="contained" 
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