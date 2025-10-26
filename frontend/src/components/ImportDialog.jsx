// FILE: frontend/src/components/ImportDialog.jsx (PHIÊN BẢN SỬA LỖI fullWidth)

import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, Button, Grid, CircularProgress, IconButton, Box } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FileDropzone from './FileDropzone';

function ImportDialog({ open, onClose, platformName, onUpload }) {
    const [orderFile, setOrderFile] = useState(null);
    const [revenueFile, setRevenueFile] = useState(null);
    const [adsFile, setAdsFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleUpload = async () => {
        setIsUploading(true);
        await onUpload({ orderFile, revenueFile, adsFile });
        setIsUploading(false);
        handleClose();
    };

    const handleClose = () => {
        setOrderFile(null);
        setRevenueFile(null);
        setAdsFile(null);
        onClose();
    };
    
    const isUploadDisabled = !orderFile && !revenueFile && !adsFile;

    return (
        <Dialog 
            open={open} 
            onClose={handleClose} 
            maxWidth="md"
            fullWidth={true} // Thêm prop này để tối ưu cho mobile
        >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Import Dữ liệu cho {platformName}
                <IconButton edge="end" color="inherit" onClick={handleClose} aria-label="close">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            
            <DialogContent >
                <Grid container spacing={3} sx={{ justifyContent:{xs:'center'} }}>
                    <Grid item xs={12} sm={4}>
                        <FileDropzone title="File Đơn hàng" onFileChange={setOrderFile} />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <FileDropzone title="File Doanh thu" onFileChange={setRevenueFile} />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <FileDropzone title="File Quảng cáo" onFileChange={setAdsFile} />
                    </Grid>
                </Grid>
                
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

export default ImportDialog;