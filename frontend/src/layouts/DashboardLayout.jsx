// FILE: frontend/src/layouts/DashboardLayout.jsx (PHIÊN BẢN REFACTORED CHUẨN MUI)

import React, { useState } from 'react';
import { styled } from '@mui/material/styles';
import { Link as RouterLink, Outlet, useParams, useNavigate } from 'react-router-dom';
import { Box, Drawer as MuiDrawer, AppBar as MuiAppBar, Toolbar, List, Typography, Divider, IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText, CssBaseline, Collapse } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DashboardIcon from '@mui/icons-material/Dashboard';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import AuroraBackground from '../components/ui/AuroraBackground';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import StorefrontIcon from '@mui/icons-material/Storefront';
import WebIcon from '@mui/icons-material/Web';
import PriceCheckIcon from '@mui/icons-material/PriceCheck';
import ImportDialog from '../components/import/ImportDialog';
import SingleImportDialog from '../components/import/SingleImportDialog';
import { uploadShopeeFiles, uploadCostFile } from '../services/api';
import RefreshIcon from '@mui/icons-material/Refresh'; 
import { recalculateBrandData } from '../services/api';
import { useLayout } from '../context/LayoutContext';


const drawerWidth = 240;

const openedMixin = (theme) => ({
  width: drawerWidth,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
});

const closedMixin = (theme) => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up('sm')]: {
    width: `calc(${theme.spacing(8)} + 1px)`,
  },
});

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
}));

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})(({ theme, open }) => ({
  zIndex: theme.zIndex.drawer + 1,
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const Drawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(
  ({ theme, open }) => ({
    width: drawerWidth,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    ...(open && {
      ...openedMixin(theme),
      '& .MuiDrawer-paper': openedMixin(theme),
    }),
    ...(!open && {
      ...closedMixin(theme),
      '& .MuiDrawer-paper': closedMixin(theme),
    }),
  }),
);

export default function DashboardLayout() {
  const { brandId } = useParams();
  const navigate = useNavigate();
  // const [open, setOpen] = useState(true);
  const [isImportMenuOpen, setImportMenuOpen] = useState(false);
  const [isMultiImportDialogOpen, setMultiImportDialogOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [isSingleImportDialogOpen, setSingleImportDialogOpen] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const { isSidebarOpen, setIsSidebarOpen } = useLayout();

  const handleDrawerToggle = () => setIsSidebarOpen(!isSidebarOpen);


  // const handleDrawerToggle = () => setOpen(!open);
  const handleImportMenuToggle = () => setImportMenuOpen(!isImportMenuOpen);

  const handleOpenMultiImportDialog = (platform) => {
    setSelectedPlatform(platform);
    setMultiImportDialogOpen(true);
  };

  const handleCloseMultiImportDialog = () => {
    setMultiImportDialogOpen(false);
  };

  const handleRecalculate = async () => {
    if (!brandId || isRecalculating) return;
    
    setIsRecalculating(true); // Bắt đầu chạy, nút bấm sẽ bị vô hiệu hóa

    try {
        // Lệnh await này bây giờ sẽ thực sự CHỜ cho đến khi backend tính xong
        await recalculateBrandData(brandId);
        
        // Sau khi thành công, tự động tải lại trang để lấy dữ liệu mới
        navigate(0); 
    } catch (error) {
        // Nếu có lỗi, vẫn hiển thị lỗi và cho phép người dùng thử lại
        const errorMessage = error.response?.data?.detail || "Lỗi khi yêu cầu tính toán lại.";
        // Cân nhắc dùng alert() hoặc một component thông báo lỗi riêng nếu cần
        alert(`Đã xảy ra lỗi: ${errorMessage}`);
        setIsRecalculating(false);
    } 
    // Không cần khối finally nữa, vì sau khi thành công trang sẽ reload
    // và state isRecalculating sẽ tự reset về false
  };

  const handleMultiUpload = async (files) => {
        if (selectedPlatform !== 'Shopee') {
            // Thay thế alert cũ
            showNotification(`Chức năng upload cho ${selectedPlatform} chưa được hỗ trợ.`, 'warning');
            return;
        }

        try {
            const result = await uploadShopeeFiles(brandId, files);
            // THAY THẾ ALERT THÀNH CÔNG
            showNotification('Upload và xử lý file thành công!', 'success');
            console.log('Phản hồi từ server:', result);
            navigate(0); 
        } catch (error) {
            const errorMessage = error.response?.data?.detail || 'Đã có lỗi xảy ra khi upload file.';
            // THAY THẾ ALERT LỖI
            showNotification(errorMessage, 'error');
            console.error("Lỗi chi tiết:", error.response);
        }
    };

  const handleOpenSingleImportDialog = () => {
    setSingleImportDialogOpen(true);
  };
  const handleCloseSingleImportDialog = () => {
    setSingleImportDialogOpen(false);
  };
  const handleSingleUpload = async (costFile) => {
        if (!costFile) {
            showNotification("Vui lòng chọn một file giá nhập.", 'warning');
            return;
        }

        try {
            const result = await uploadCostFile(brandId, costFile);
            showNotification("Upload file giá nhập thành công!", 'success');
            console.log("Phản hồi từ server:", result);
            navigate(0); 
        } catch (error) {
            const errorMessage = error.response?.data?.results?.cost_file?.message || 
                                 error.response?.data?.detail || 
                                 'Đã có lỗi xảy ra khi upload file giá nhập.';
            showNotification(errorMessage, 'error');
            console.error("Lỗi chi tiết:", error.response);
        }
    };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AuroraBackground />
      
      <AppBar position="fixed" open={isSidebarOpen}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerToggle}
            edge="start"
            sx={{
              marginRight: 5,
              ...(isSidebarOpen && { display: 'none' }),
            }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            Dashboard
          </Typography>
        </Toolbar>
      </AppBar>

      <Drawer variant="permanent" open={isSidebarOpen}>
        <DrawerHeader>
            <Box sx={{ display: 'flex', alignItems: 'center', mr: 'auto', pl: 1, opacity: isSidebarOpen ? 1 : 0, transition: 'opacity 0.2s' }}>
                <QueryStatsIcon sx={{ color: 'primary.main', mr: 1.5, fontSize: 30 }} />
                <Typography variant="h6" noWrap>Analytics</Typography>
            </Box>
            <IconButton onClick={handleDrawerToggle} sx={{ opacity: isSidebarOpen ? 1 : 0, color: 'inherit' }}>
                <ChevronLeftIcon />
            </IconButton>
        </DrawerHeader>
        <Divider />
        <List>
            <ListItem disablePadding sx={{ display: 'block' }}>
                <ListItemButton component={RouterLink} to="/" sx={{ minHeight: 48, justifyContent: isSidebarOpen ? 'initial' : 'center', px: 2.5 }}>
                    <ListItemIcon sx={{ minWidth: 0, mr: isSidebarOpen ? 3 : 'auto', justifyContent: 'center', color: 'primary.main' }}>
                        <ArrowBackIcon />
                    </ListItemIcon>
                    <ListItemText primary="Quay lại Sảnh chính" sx={{ opacity: isSidebarOpen ? 1 : 0 }} />
                </ListItemButton>
            </ListItem>
        
            <ListItem disablePadding sx={{ display: 'block' }}>
                <ListItemButton sx={{ minHeight: 48, justifyContent: open ? 'initial' : 'center', px: 2.5 }}>
                    <ListItemIcon sx={{ minWidth: 0, mr: open ? 3 : 'auto', justifyContent: 'center' }}>
                        <DashboardIcon />
                    </ListItemIcon>
                    <ListItemText primary="Tổng quan" sx={{ opacity: open ? 1 : 0 }} />
                </ListItemButton>
            </ListItem>

            <ListItem disablePadding sx={{ display: 'block' }}>
                <ListItemButton 
                    onClick={handleRecalculate} 
                    disabled={isRecalculating} // Vô hiệu hóa nút khi đang chạy
                    sx={{ 
                        minHeight: 48, 
                        justifyContent: open ? 'initial' : 'center', 
                        px: 2.5, 
                        // Đổi màu để người dùng biết là đang có tác vụ
                        color: isRecalculating ? 'text.secondary' : 'warning.main' 
                    }}
                >
                    <ListItemIcon sx={{ 
                        minWidth: 0, 
                        mr: open ? 3 : 'auto', 
                        justifyContent: 'center', 
                        color: isRecalculating ? 'text.secondary' : 'warning.main' 
                    }}>
                        <RefreshIcon />
                    </ListItemIcon>
                    <ListItemText 
                        primary={isRecalculating ? "Đang xử lý..." : "Tải lại dữ liệu"} 
                        sx={{ opacity: open ? 1 : 0 }} 
                    />
                </ListItemButton>
            </ListItem>

            <ListItem disablePadding sx={{ display: 'block' }}>
                <ListItemButton onClick={handleImportMenuToggle} sx={{ minHeight: 48, justifyContent: open ? 'initial' : 'center', px: 2.5 }}>
                    <ListItemIcon sx={{ minWidth: 0, mr: open ? 3 : 'auto', justifyContent: 'center' }}>
                        <CloudUploadIcon />
                    </ListItemIcon>
                    <ListItemText primary="Import Dữ liệu" sx={{ opacity: open ? 1 : 0 }} />
                    {isSidebarOpen ? (isImportMenuOpen ? <ExpandLess /> : <ExpandMore />) : null}
                </ListItemButton>
            </ListItem>
            
            <Collapse in={isImportMenuOpen && isSidebarOpen} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                    <ListItemButton sx={{ pl: 4 }} onClick={handleOpenSingleImportDialog}>
                        <ListItemIcon><PriceCheckIcon /></ListItemIcon>
                        <ListItemText primary="File Giá nhập" />
                    </ListItemButton>
                    <ListItemButton sx={{ pl: 4 }} onClick={() => handleOpenMultiImportDialog('Shopee')}>
                        <ListItemIcon><StorefrontIcon /></ListItemIcon>
                        <ListItemText primary="Shopee" />
                    </ListItemButton>
                    <ListItemButton sx={{ pl: 4 }} onClick={() => handleOpenMultiImportDialog('TikTok')}>
                        <ListItemIcon><StorefrontIcon /></ListItemIcon>
                        <ListItemText primary="TikTok" />
                    </ListItemButton>
                     <ListItemButton sx={{ pl: 4 }} onClick={() => handleOpenMultiImportDialog('Lazada')}>
                        <ListItemIcon><StorefrontIcon /></ListItemIcon>
                        <ListItemText primary="Lazada" />
                    </ListItemButton>
                     <ListItemButton sx={{ pl: 4 }} onClick={() => handleOpenMultiImportDialog('Website')}>
                        <ListItemIcon><WebIcon /></ListItemIcon>
                        <ListItemText primary="Website" />
                    </ListItemButton>
                </List>
            </Collapse>
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, overflow: 'auto', height: '100vh' }}>
        <Toolbar /> 
        <Outlet />
      </Box>

      <ImportDialog 
        open={isMultiImportDialogOpen}
        onClose={handleCloseMultiImportDialog}
        platformName={selectedPlatform}
        onUpload={handleMultiUpload}
      />
      <SingleImportDialog
        open={isSingleImportDialogOpen}
        onClose={handleCloseSingleImportDialog}
        title="Import File Giá Nhập"
        onUpload={handleSingleUpload}
      />
    </Box>
  );
}