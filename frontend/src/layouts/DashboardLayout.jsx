// FILE: frontend/src/layouts/DashboardLayout.jsx

import React, { useState, useEffect } from 'react';
import { styled } from '@mui/material/styles';
import { Link as RouterLink, Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import {
    Box, Drawer as MuiDrawer, AppBar as MuiAppBar, Toolbar, List,
    Typography, Divider, IconButton, ListItem, ListItemButton,
    ListItemIcon, ListItemText, CssBaseline, ListSubheader, CircularProgress
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
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import TuneIcon from '@mui/icons-material/Tune';
import GroupIcon from '@mui/icons-material/Group';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';

// --- Components & Services ---
import SingleImportDialog from '../components/import/SingleImportDialog';
import DeleteDataDialog from '../components/settings/DeleteDataDialog';
import { recalculateBrandDataAndWait, getAllBrands } from '../services/api';
import { clearAllApplicationCaches } from '../utils/cacheManager';
import { useLayout } from '../context/LayoutContext';
import { useNotification } from '../context/NotificationContext';
import { BrandProvider, useBrand } from '../context/BrandContext';



// --- Styled Components ---
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

// --- Component con chứa toàn bộ layout và logic sau khi đã có context ---
function LayoutWithBrandContext() {
    const { id: brandId, name: brandName } = useBrand();
    const { brandIdentifier } = useParams(); // brandIdentifier bây giờ là slug
    const navigate = useNavigate();
    const { isSidebarOpen, setIsSidebarOpen } = useLayout();
    const { showNotification } = useNotification();
    const { pathname } = useLocation();

    const [isImportDialogOpen, setImportDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isRecalculating, setIsRecalculating] = useState(false);

    const handleRecalculate = async () => {
        if (!brandIdentifier || isRecalculating) return;

        setIsRecalculating(true);
        showNotification("Bắt đầu tính toán lại toàn bộ dữ liệu. Quá trình này có thể mất vài phút...", "info");

        try {
            await recalculateBrandDataAndWait(brandIdentifier); // Dùng hàm chờ
            showNotification("Tính toán lại phía server thành công! Đang xóa cache phía client...", "success");

            // Xóa TOÀN BỘ cache của ứng dụng
            await clearAllApplicationCaches();
            
            showNotification("Xóa cache thành công! Đang tải lại trang...", "success");
            
            // Tải lại trang để đảm bảo tất cả component đều nhận dữ liệu mới
            setTimeout(() => {
                navigate(0); 
            }, 1000); // Thêm một chút delay để người dùng đọc được thông báo

        } catch (error) {
            const errorMessage = error.response?.data?.detail || "Lỗi khi tính toán lại dữ liệu.";
            showNotification(errorMessage, 'error');
            setIsRecalculating(false); // Chỉ tắt loading khi có lỗi, nếu thành công thì trang sẽ reload
        }
        // Không cần khối finally nữa vì nếu thành công, trang sẽ được tải lại
    };

    const handleUploadComplete = async () => {
        if (!brandIdentifier) return Promise.reject("Không có định danh brand."); // Reject if no brandIdentifier
        try {
            showNotification(`Upload thành công! Bắt đầu tính toán lại...`, 'info');
            await recalculateBrandDataAndWait(brandIdentifier); // Dùng brandIdentifier (slug)
            showNotification(`Tính toán lại thành công!`, 'success');
            navigate(0); // Refresh trang để tải lại dữ liệu
            return Promise.resolve(); // Trả về Promise resolve khi hoàn tất
        } catch (error) {
            const errorMessage = error.response?.data?.detail || 'Lỗi khi tính toán lại.';
            showNotification(errorMessage, 'error');
            return Promise.reject(errorMessage); // Trả về Promise reject khi có lỗi
        }
    };

    const reportMenuItems = [
        { text: 'Tổng quan', path: '', icon: <DashboardIcon /> },
        { text: 'Tài chính', path: '/finance', icon: <MonetizationOnIcon /> },
        { text: 'Marketing', path: '/marketing', icon: <TrackChangesIcon /> },
        { text: 'Vận hành', path: '/operation', icon: <TuneIcon /> },
        { text: 'Khách hàng', path: '/customer', icon: <GroupIcon /> }
    ];

    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />

            {/* <AppBar position="fixed" open={isSidebarOpen}>
                <Toolbar>
                    <IconButton color="inherit" aria-label="open drawer" onClick={() => setIsSidebarOpen(!isSidebarOpen)} edge="start" sx={{ marginRight: 5, ...(isSidebarOpen && { display: 'none' }) }}>
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" noWrap component="div">
                        Dashboard: {brandName}
                    </Typography>
                </Toolbar>
            </AppBar> */}

            <Drawer variant="permanent" open={isSidebarOpen}>
                <DrawerHeader>
                    <Box sx={{ display: 'flex', alignItems: 'center', mr: 'auto', pl: 1, opacity: isSidebarOpen ? 1 : 0, transition: 'opacity 0.2s' }}>
                        <QueryStatsIcon sx={{ color: 'primary.main', mr: 1.5, fontSize: 30 }} />
                        <Typography variant="h6" noWrap>Analytics</Typography>
                    </Box>
                    <IconButton onClick={() => setIsSidebarOpen(!isSidebarOpen)} sx={{ opacity: isSidebarOpen ? 1 : 0, color: 'inherit' }}>
                        <ChevronLeftIcon />
                    </IconButton>
                </DrawerHeader>
                <Divider />
                <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                    <Box sx={{ overflowY: 'auto', overflowX: 'hidden' }}>
                        <List subheader={isSidebarOpen ? <ListSubheader>BÁO CÁO</ListSubheader> : null}>
                            {reportMenuItems.map((item) => {
                                const fullPath = `/dashboard/${brandIdentifier}${item.path}`;
                                return (
                                    <ListItem key={item.text} disablePadding>
                                        <ListItemButton component={RouterLink} to={fullPath} selected={pathname === fullPath}>
                                            <ListItemIcon>{item.icon}</ListItemIcon>
                                            <ListItemText primary={item.text} sx={{ opacity: isSidebarOpen ? 1 : 0 }} />
                                        </ListItemButton>
                                    </ListItem>
                                );
                            })}
                        </List>
                        <List subheader={isSidebarOpen ? <ListSubheader>CÔNG CỤ</ListSubheader> : null}>
                            <ListItem disablePadding>
                                <ListItemButton onClick={handleRecalculate} disabled={isRecalculating} sx={{ minHeight: 48 }}>
                                    <ListItemIcon><RefreshIcon /></ListItemIcon>
                                    <ListItemText primary={isRecalculating ? "Đang xử lý..." : "Tải lại dữ liệu"} sx={{ opacity: isSidebarOpen ? 1 : 0 }} />
                                </ListItemButton>
                            </ListItem>
                            <ListItem disablePadding>
                                <ListItemButton onClick={() => setImportDialogOpen(true)} sx={{ minHeight: 48 }}>
                                    <ListItemIcon><CloudUploadIcon /></ListItemIcon>
                                    <ListItemText primary="Import Dữ liệu" sx={{ opacity: isSidebarOpen ? 1 : 0 }} />
                                </ListItemButton>
                            </ListItem>
                            <ListItem disablePadding>
                                <ListItemButton onClick={() => setDeleteDialogOpen(true)} sx={{ minHeight: 48 }}>
                                    <ListItemIcon><DeleteForeverIcon sx={{ color: 'error.main' }} /></ListItemIcon>
                                    <ListItemText primary="Xóa Dữ liệu" sx={{ opacity: isSidebarOpen ? 1 : 0 }} />
                                </ListItemButton>
                            </ListItem>
                        </List>
                    </Box>
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
                <Outlet />
            </Box>

            <SingleImportDialog open={isImportDialogOpen} onClose={() => setImportDialogOpen(false)} onUploadComplete={handleUploadComplete} brandSlug={brandIdentifier} />
            <DeleteDataDialog open={isDeleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} brandSlug={brandIdentifier} brandName={brandName} />
        </Box>
    );
}

// --- Component cha cuối cùng, chỉ làm nhiệm vụ giải quyết URL ---
export default function DashboardLayout() {
    const { brandIdentifier } = useParams();
    const navigate = useNavigate();
    const [brandInfo, setBrandInfo] = useState({ id: null, name: null, isLoading: true });

    useEffect(() => {
        const resolveIdentifier = async () => {
            if (!brandIdentifier) return;
            setBrandInfo({ id: null, name: null, isLoading: true });
            try {
                const allBrands = await getAllBrands();
                let currentBrand = null;
                
                // Kiểm tra nếu brandIdentifier là một số (ID cũ)
                if (!isNaN(brandIdentifier) && Number.isInteger(parseFloat(brandIdentifier))) {
                    currentBrand = allBrands.find(b => b.id === parseInt(brandIdentifier, 10));
                    if (currentBrand && currentBrand.slug) {
                        // Chuyển hướng sang URL dùng slug
                        const newPath = window.location.pathname.replace(brandIdentifier, currentBrand.slug);
                        navigate(newPath, { replace: true }); // Dùng navigate để cập nhật URL
                        return; // Dừng xử lý tiếp để tránh render với ID cũ
                    }
                } 
                
                // Nếu không phải ID hoặc đã chuyển hướng, tìm bằng slug
                currentBrand = allBrands.find(b => b.slug === brandIdentifier);
                
                if (currentBrand) {
                    setBrandInfo({ id: currentBrand.id, name: currentBrand.name, isLoading: false });
                } else {
                    // Nếu không tìm thấy brand nào, chuyển hướng về trang chính
                    navigate('/');
                }
            } catch (error) {
                console.error("Lỗi khi giải quyết định danh brand:", error);
                navigate('/');
            }
        };
        resolveIdentifier();
    }, [brandIdentifier, navigate]);

    if (brandInfo.isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <BrandProvider value={brandInfo}>
            <LayoutWithBrandContext />
        </BrandProvider>
    );
}