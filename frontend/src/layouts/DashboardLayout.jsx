// FILE: frontend/src/layouts/DashboardLayout.jsx (PHIÊN BẢN CHUẨN HÓA VÀ SỬA LỖI)

import React, { useState } from 'react';
import { styled } from '@mui/material/styles';
import { Link as RouterLink, Outlet, useParams, useNavigate } from 'react-router-dom';
import { 
    Box, Drawer as MuiDrawer, AppBar as MuiAppBar, Toolbar, List, 
    Typography, Divider, IconButton, ListItem, ListItemButton, 
    ListItemIcon, ListItemText, CssBaseline, ListSubheader 
} from '@mui/material';

// --- Icons ---
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import SettingsIcon from '@mui/icons-material/Settings';
import DashboardIcon from '@mui/icons-material/Dashboard';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import RefreshIcon from '@mui/icons-material/Refresh';

// --- Components & Services ---
import AuroraBackground from '../components/ui/AuroraBackground';
import SingleImportDialog from '../components/import/SingleImportDialog';

// BƯỚC 1: DỌN DẸP LẠI IMPORT, CHỈ GIỮ LẠI NHỮNG GÌ CẦN THIẾT
import { recalculateBrandData, uploadStandardFile, recalculateBrandDataAndWait } from '../services/api';
import { useLayout } from '../context/LayoutContext';
import { useNotification } from '../context/NotificationContext';

// --- Các hằng số và Styled Components (Giữ nguyên) ---
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
    const { isSidebarOpen, setIsSidebarOpen } = useLayout();
    const { showNotification } = useNotification();
    
    // BƯỚC 2: LOẠI BỎ STATE THỪA, CHỈ GIỮ LẠI STATE CỦA HỆ THỐNG MỚI
    const [isImportDialogOpen, setImportDialogOpen] = useState(false);
    const [isRecalculating, setIsRecalculating] = useState(false);

    // BƯỚC 3: CHUẨN HÓA LẠI CÁC HÀM HANDLER
    const handleDrawerToggle = () => setIsSidebarOpen(!isSidebarOpen);
    const handleOpenImportDialog = () => setImportDialogOpen(true);
    const handleCloseImportDialog = () => setImportDialogOpen(false);
    
    const handleUpload = async (platform, file) => {
        try {
            await uploadStandardFile(platform, brandId, file);
            showNotification(`Upload thành công! Bắt đầu quá trình tính toán lại dữ liệu...`, 'info');

            await recalculateBrandDataAndWait(brandId);

            showNotification(`Dữ liệu đã được tính toán lại thành công!`, 'success');
            navigate(0); // Tải lại trang để thấy dữ liệu mới
        } catch (error) {
            const errorMessage = error.response?.data?.detail || 'Lỗi khi upload file.';
            showNotification(errorMessage, 'error');
        }
    };

    const handleRecalculate = async () => {
        if (!brandId || isRecalculating) return;
        setIsRecalculating(true);
        try {
            await recalculateBrandData(brandId);
            // Sau khi thành công, tự động tải lại trang
            navigate(0); 
        } catch (error) {
            const errorMessage = error.response?.data?.detail || "Lỗi khi yêu cầu tính toán lại.";
            showNotification(errorMessage, 'error');
            // Nếu lỗi thì cho phép người dùng thử lại
            setIsRecalculating(false);
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
                        sx={{ marginRight: 5, ...(isSidebarOpen && { display: 'none' }) }}
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

                <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                    <Box sx={{ overflowY: 'auto', overflowX: 'hidden' }}>
                        {/* Menu Báo cáo */}
                        <List subheader={isSidebarOpen ? <ListSubheader>BÁO CÁO</ListSubheader> : null}>
                            <ListItem disablePadding>
                                <ListItemButton sx={{ minHeight: 48 }}>
                                    <ListItemIcon><DashboardIcon /></ListItemIcon>
                                    <ListItemText primary="Tổng quan" sx={{ opacity: isSidebarOpen ? 1 : 0 }} />
                                </ListItemButton>
                            </ListItem>
                        </List>

                        {/* BƯỚC 4: ĐƠN GIẢN HÓA HOÀN TOÀN MENU CÔNG CỤ */}
                        <List subheader={isSidebarOpen ? <ListSubheader>CÔNG CỤ</ListSubheader> : null}>
                            <ListItem disablePadding>
                                <ListItemButton onClick={handleOpenImportDialog} sx={{ minHeight: 48 }}>
                                    <ListItemIcon><CloudUploadIcon /></ListItemIcon>
                                    <ListItemText primary="Import Dữ liệu" sx={{ opacity: isSidebarOpen ? 1 : 0 }} />
                                </ListItemButton>
                            </ListItem>
                            <ListItem disablePadding>
                                <ListItemButton onClick={handleRecalculate} disabled={isRecalculating} sx={{ minHeight: 48 }}>
                                    <ListItemIcon><RefreshIcon /></ListItemIcon>
                                    <ListItemText primary={isRecalculating ? "Đang xử lý..." : "Tải lại dữ liệu"} sx={{ opacity: isSidebarOpen ? 1 : 0 }} />
                                </ListItemButton>
                            </ListItem>
                        </List>
                    </Box>

                    {/* Menu dưới cùng */}
                    <Box sx={{ marginTop: 'auto' }}>
                        <Divider />
                        <List>
                            <ListItem disablePadding>
                                <ListItemButton component={RouterLink} to="/" sx={{ minHeight: 48 }}>
                                    <ListItemIcon sx={{ color: 'primary.main' }}><ArrowBackIcon /></ListItemIcon>
                                    <ListItemText primary="Quay lại Sảnh chính" sx={{ opacity: isSidebarOpen ? 1 : 0 }} />
                                </ListItemButton>
                            </ListItem>
                            <ListItem disablePadding>
                                <ListItemButton sx={{ minHeight: 48 }}>
                                    <ListItemIcon><SettingsIcon /></ListItemIcon>
                                    <ListItemText primary="Cài đặt" sx={{ opacity: isSidebarOpen ? 1 : 0 }} />
                                </ListItemButton>
                            </ListItem>
                        </List>
                    </Box>
                </Box>
            </Drawer>

            <Box component="main" sx={{ flexGrow: 1, py: 3, overflow: 'auto', height: '100vh' }}>
                <Toolbar /> 
                <Outlet />
            </Box>

            {/* BƯỚC 5: HỢP NHẤT DIALOG, CHỈ SỬ DỤNG SINGLEIMPORTDIALOG */}
            <SingleImportDialog
                open={isImportDialogOpen}
                onClose={handleCloseImportDialog}
                onUpload={handleUpload}
            />
        </Box>
    );
}