// FILE: frontend/src/components/import/FileDropzone.jsx

import React, { useState, useRef } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ClearIcon from '@mui/icons-material/Clear';
import CloseIcon from '@mui/icons-material/Close';

function FileDropzone({ title, onFileChange }) {
    const [file, setFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef(null);

    // Xử lý sự kiện kéo thả (Gom gọn lại)
    const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); }; // Cần thiết để cho phép drop

    const handleDrop = (e) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFile(e.dataTransfer.files[0]);
            e.dataTransfer.clearData();
        }
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            processFile(e.target.files[0]);
        }
    };

    // Hàm xử lý file chung để tránh lặp code
    const processFile = (selectedFile) => {
        setFile(selectedFile);
        onFileChange(selectedFile);
    };
    
    const handleRemoveFile = (e) => {
        e.stopPropagation(); // Ngăn chặn click lan ra Box cha (mở lại dialog chọn file)
        setFile(null);
        onFileChange(null);
        if (inputRef.current) { inputRef.current.value = ""; }
    };

    return (
        <Box
            // 1. Sử dụng variant đã định nghĩa trong theme/index.js
            variant="dropzone"
            
            // 2. Các sự kiện
            onClick={() => !file && inputRef.current.click()}
            onDrop={handleDrop} 
            onDragOver={handleDragOver} 
            onDragEnter={handleDragEnter} 
            onDragLeave={handleDragLeave}
            
            // 3. Style đè nhẹ: Chỉ thay đổi khi có file hoặc đang kéo thả
            sx={{
                // 1. Logic màu sắc (Giữ nguyên)
                borderColor: (file || isDragging) ? 'primary.main' : 'text.secondary',
                backgroundColor: (file || isDragging) ? 'rgba(0, 229, 255, 0.05)' : undefined,
                borderStyle: file ? 'solid' : 'dashed',
                boxShadow: (file || isDragging) ? 'inset 0 0 20px rgba(0, 229, 255, 0.1)' : 'none',
                
                // 2. THÊM CÁC DÒNG NÀY ĐỂ CĂN GIỮA TUYỆT ĐỐI
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',      // Căn giữa theo chiều ngang
                justifyContent: 'center',  // Căn giữa theo chiều dọc
                textAlign: 'center',       // Căn giữa văn bản
                position: 'relative',
            }}
        >
            <input
                ref={inputRef} type="file" hidden onChange={handleFileSelect}
                accept=".xlsx, .xls"
            />

            {file ? (
                <>
                    <InsertDriveFileIcon sx={{ fontSize: 50, color: 'primary.main', mb: 2 }} />
                    <Typography variant="h6" color="primary.main" sx={{ fontWeight: 600 }}>
                        {file.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Đã sẵn sàng import
                    </Typography>
                    
                    {/* Nút xóa file */}
                    <IconButton 
                        onClick={handleRemoveFile} 
                        size="small"
                        sx={{ 
                            position: 'absolute', 
                            top: 8, 
                            right: 8,
                            color: 'rgba(255, 255, 255, 0.5)', // Màu mờ mặc định
                            transition: 'all 0.2s',
                            '&:hover': { 
                                color: '#ff1744', // Đỏ lên khi hover
                                backgroundColor: 'rgba(255, 23, 68, 0.1)',
                                transform: 'scale(1.1)' // Phóng to nhẹ
                            }
                        }}
                    >
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </>
            ) : (
                <>
                    <CloudUploadIcon 
                        sx={{ 
                            fontSize: 60, 
                            color: isDragging ? 'primary.main' : 'text.disabled', 
                            mb: 2,
                            transition: 'color 0.3s'
                        }} 
                    />
                    <Typography variant="h6" color={isDragging ? 'primary.main' : 'text.primary'}>
                        {title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Kéo thả hoặc nhấn để chọn file Excel
                    </Typography>
                </>
            )}
        </Box>
    );
}

export default FileDropzone;