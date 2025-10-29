// FILE: frontend/src/components/import/SingleImportDialog.jsx (PHIÊN BẢN CHUẨN)

import React, { useState, useEffect } from 'react';
import { 
    Dialog, 
    DialogTitle, 
    DialogContent, 
    DialogActions, 
    Button, 
    IconButton, 
    CircularProgress, 
    Box 
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FileDropzone from './FileDropzone';

function SingleImportDialog({ open, onClose, title, onUpload }) {
    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    // Reset file khi dialog được mở lại
    useEffect(() => {
        if (open) {
            setSelectedFile(null);
        }
    }, [open]);

    const handleClose = () => {
        if (!isUploading) {
            onClose();
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setIsUploading(true);
        try {
            await onUpload(selectedFile);
        } finally {
            setIsUploading(false);
            onClose(); // Tự động đóng dialog sau khi upload xong
        }
    };

    return (
        // 1. KHUNG DIALOG CHÍNH
        <Dialog 
            open={open} 
            onClose={handleClose} 
            maxWidth="xs" 
            fullWidth
        >
            {/* 2. TIÊU ĐỀ DIALOG */}
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {title}
                <IconButton edge="end" color="inherit" onClick={handleClose} aria-label="close">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            
            {/* 3. NỘI DUNG CHÍNH (CHỨA DROPZONE) */}
            <DialogContent>
                <Box sx={{ mt: 1 }}>
                     <FileDropzone 
                        title="File Giá nhập" 
                        onFileChange={setSelectedFile} 
                    /> 
                </Box>
            </DialogContent>

            {/* 4. PHẦN CHÂN (CHỨA CÁC NÚT BẤM) */}
            <DialogActions sx={{ p: '0 24px 16px' }}>
                <Button onClick={handleClose} disabled={isUploading} color="secondary">
                    Hủy
                </Button>
                <Button 
                    onClick={handleUpload} 
                    variant="contained" 
                    disabled={!selectedFile || isUploading}
                    startIcon={isUploading ? <CircularProgress size={20} color="inherit" /> : null}
                >
                    {isUploading ? 'Đang xử lý...' : 'Bắt đầu Xử lý'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default SingleImportDialog;