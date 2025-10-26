import React from 'react';
import { Card, CardActionArea, CardContent, Typography, IconButton, Menu, MenuItem } from '@mui/material';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import MoreVertIcon from '@mui/icons-material/MoreVert';

function BrandCard({ brand, onClick, onRename, onClone, onDelete }) {
    const [anchorEl, setAnchorEl] = React.useState(null);
    const open = Boolean(anchorEl);

    const handleMenuClick = (event) => {
        event.stopPropagation();
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleRename = (event) => {
        event.stopPropagation();
        onRename(brand);
        handleMenuClose();
    };

    const handleClone = (event) => {
        event.stopPropagation();
        onClone(brand.id);
        handleMenuClose();
    };

    const handleDelete = (event) => {
        event.stopPropagation();
        onDelete(brand);
        handleMenuClose();
    };

    return (
        <Card
            sx={{
                width: 200,
                height: 200,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'all 0.3s ease',
                '&:hover': {
                    transform: 'translateY(-5px)',
                    boxShadow: '0 10px 20px rgba(0, 191, 255, 0.2)',
                },
            }}
        >
            <IconButton
                aria-label="more"
                id="long-button"
                aria-controls={open ? 'long-menu' : undefined}
                aria-expanded={open ? 'true' : undefined}
                aria-haspopup="true"
                onClick={handleMenuClick}
                sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    color: 'rgba(255, 255, 255, 0.7)',
                    zIndex: 1
                }}
            >
                <MoreVertIcon />
            </IconButton>

            <Menu 
                anchorEl={anchorEl} 
                open={open} 
                onClose={handleMenuClose}
                PaperProps={{
                    sx: {
                        width: '150px',
                        backgroundColor: 'rgba(40, 50, 70, 0.85)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                        borderRadius: 2,
                    },
                }}
            >
                <MenuItem onClick={handleRename}>Đổi tên</MenuItem>
                <MenuItem onClick={handleClone}>Nhân bản</MenuItem>
                <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>Xóa</MenuItem>
            </Menu>

            <CardActionArea 
                onClick={() => onClick(brand.id)} 
                sx={{ 
                    flexGrow: 1, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'center', 
                    // Thêm padding trực tiếp và giới hạn chiều rộng
                    p: 2,
                    minWidth: 0, // Rất quan trọng để flex item có thể co lại
                }}
            >
                <BusinessCenterIcon sx={{ fontSize: 70, color: 'primary.main', mb: 2 }} />
                
                <Typography
                    variant="h6"
                    component="div"
                    sx={{
                        width: '100%', // Chiếm toàn bộ chiều rộng có sẵn (sau khi trừ padding)
                        fontSize: '1rem',
                        fontWeight: 600,
                        
                        // Kỹ thuật cắt ngắn văn bản
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        
                        // Hiệu ứng khi hover vào CARD CHA
                        '.MuiCard-root:hover &': {
                            whiteSpace: 'normal',
                            overflow: 'visible',
                        }
                    }}
                >
                    {brand.name}
                </Typography>
            </CardActionArea>
        </Card>
    );
}

export default BrandCard;