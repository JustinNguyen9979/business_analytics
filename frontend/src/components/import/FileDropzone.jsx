// FILE: frontend/src/components/FileDropzone.jsx (PHIÊN BẢN CHUẨN HÓA)

import React, { useState, useRef } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ClearIcon from '@mui/icons-material/Clear';

function FileDropzone({ title, onFileChange }) {
    const [file, setFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef(null);

    const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };

    const handleDrop = (e) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFile = e.dataTransfer.files[0];
            setFile(droppedFile); onFileChange(droppedFile); e.dataTransfer.clearData();
        }
    };

    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile); onFileChange(selectedFile);
        }
    };
    
    const handleRemoveFile = (e) => {
        e.stopPropagation(); setFile(null); onFileChange(null);
        if (inputRef.current) { inputRef.current.value = ""; }
    };

    return (
        <Box
            onClick={() => !file && inputRef.current.click()}
            onDrop={handleDrop} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}
            sx={{
                position: 'relative',
                // SỬA LẠI: Chỉ dùng aspect-ratio
                width: '100%',
                height: 250,
                
                border: '2px dashed',
                borderColor: isDragging ? 'primary.main' : 'rgba(255, 255, 255, 0.23)',
                borderRadius: 2, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexDirection: 'column', 
                textAlign: 'center', 
                p: 2,
                cursor: file ? 'default' : 'pointer',
                transition: 'border-color 0.2s ease, background-color 0.2s ease',
                backgroundColor: isDragging ? 'rgba(0, 191, 255, 0.1)' : 'rgba(255, 255, 255, 0.04)',
            }}
        >
            <input
                ref={inputRef} type="file" hidden onChange={handleFileSelect}
                accept=" .xlsx, .xls"
            />

            {file ? (
                <>
                    <InsertDriveFileIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                    <Typography variant="body2" color="text.primary" sx={{ mt: 1, fontWeight: 'bold' }}>{title}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {file.name}
                    </Typography>
                </>
            ) : (
                <>
                    <CloudUploadIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontWeight: 'bold' }}>{title}</Typography>
                    <Typography variant="caption" color="text.secondary">Kéo thả hoặc nhấn để chọn file</Typography>
                </>
            )}
             
             {file && (
                <IconButton size="small" onClick={handleRemoveFile} sx={{ position: 'absolute', top: 4, right: 4 }}>
                    <ClearIcon fontSize="small" />
                </IconButton>
            )}
        </Box>
    );
}

export default FileDropzone;