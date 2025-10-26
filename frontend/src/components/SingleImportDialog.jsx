// FILE: frontend/src/components/SingleImportDialog.jsx

import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, Button, CircularProgress, IconButton, Box } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FileDropzone from './FileDropzone';

function SingleImportDialog({ open, onClose, title, onUpload }) {
    const [file, setFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleUpload = async () => {
        setIsUploading(true);
        // Gói file vào một object để gửi đi
        await onUpload({ costFile: file }); 
        setIsUploading(false);
        handleClose();
    };

    const handleClose = () => {
        setFile(null);
        onClose();
    };
    
    // Nút Upload bị vô hiệu hóa khi chưa có file
    const isUploadDisabled = !file;

    return (
        <Dialog 
            open={open} 
            onClose={handleClose} 
            maxWidth="md" // Đặt kích thước nhỏ hơn
            // fullWidth
        >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {title}
                <IconButton edge="end" color="inherit" onClick={handleClose} aria-label="close">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            
            <DialogContent sx={{ py: 3, px: 3 }}>
                <FileDropzone title="File Giá nhập (.xlsx)" onFileChange={setFile} />
                
                <Box sx={{ display: 'flex', justifyContent: { xs: 'center', sm: 'flex-end' }, mt: 4 }}>
                    <Button onClick={handleClose} disabled={isUploading} color="secondary" sx={{ mr: 2 }}>
                        Hủy
                    </Button>
                    <Button 
                        onClick={handleUpload} 
                        variant="contained" 
                        disabled={isUploadDisabled || isUploading}
                        startIcon={isUploading ? <CircularProgress size={20} color="inherit" /> : null}
                    >
                        {isUploading ? 'Đang xử lý...' : 'Bắt đầu Xử lý'}
                    </Button>
                </Box>
            </DialogContent>
        </Dialog>
    );
}

export default SingleImportDialog;