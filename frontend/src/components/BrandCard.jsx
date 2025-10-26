import React from 'react';
import { Card, CardActionArea, Typography, IconButton, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { StyledBrandCard } from './StyledComponents';


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
        <StyledBrandCard>
            <IconButton
                aria-label="more"
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
            >
                {/* 2. CẬP NHẬT LẠI CÁC MENU ITEM */}
                <MenuItem onClick={handleRename}>
                    <ListItemIcon>
                        <DriveFileRenameOutlineIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Đổi tên</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleClone}>
                    <ListItemIcon>
                        <ContentCopyIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Nhân bản</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
                    <ListItemIcon>
                        <DeleteOutlineIcon fontSize="small" sx={{ color: 'error.main' }} />
                    </ListItemIcon>
                    <ListItemText>Xóa</ListItemText>
                </MenuItem>
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
        </StyledBrandCard>
    );
}

export default BrandCard;