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
import AuroraBackground from '../components/AuroraBackground';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import StorefrontIcon from '@mui/icons-material/Storefront';
import WebIcon from '@mui/icons-material/Web';
import PriceCheckIcon from '@mui/icons-material/PriceCheck';
import ImportDialog from '../components/ImportDialog';
import SingleImportDialog from '../components/SingleImportDialog';

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
  const [open, setOpen] = useState(true);
  const [isImportMenuOpen, setImportMenuOpen] = useState(false);
  const [isMultiImportDialogOpen, setMultiImportDialogOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [isSingleImportDialogOpen, setSingleImportDialogOpen] = useState(false);

  const handleDrawerToggle = () => setOpen(!open);
  const handleImportMenuToggle = () => setImportMenuOpen(!isImportMenuOpen);

  const handleOpenMultiImportDialog = (platform) => {
    setSelectedPlatform(platform);
    setMultiImportDialogOpen(true);
  };
  const handleCloseMultiImportDialog = () => {
    setMultiImportDialogOpen(false);
  };
  const handleMultiUpload = async (files) => {
    console.log("Uploading multi-files for brand:", brandId, "and platform:", selectedPlatform, files);
    alert(`Đã nhận các file cho ${selectedPlatform}. Xem console log.`);
    navigate(0);
  };

  const handleOpenSingleImportDialog = () => {
    setSingleImportDialogOpen(true);
  };
  const handleCloseSingleImportDialog = () => {
    setSingleImportDialogOpen(false);
  };
  const handleSingleUpload = async (fileObject) => {
    console.log("Uploading single file for brand:", brandId, fileObject);
    alert(`Đã nhận file giá nhập. Xem console log.`);
    navigate(0);
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AuroraBackground />
      
      <AppBar position="fixed" open={open}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerToggle}
            edge="start"
            sx={{
              marginRight: 5,
              ...(open && { display: 'none' }),
            }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            Dashboard
          </Typography>
        </Toolbar>
      </AppBar>

      <Drawer variant="permanent" open={open}>
        <DrawerHeader>
            <Box sx={{ display: 'flex', alignItems: 'center', mr: 'auto', pl: 1, opacity: open ? 1 : 0, transition: 'opacity 0.2s' }}>
                <QueryStatsIcon sx={{ color: 'primary.main', mr: 1.5, fontSize: 30 }} />
                <Typography variant="h6" noWrap>Analytics</Typography>
            </Box>
            <IconButton onClick={handleDrawerToggle} sx={{ opacity: open ? 1 : 0, color: 'inherit' }}>
                <ChevronLeftIcon />
            </IconButton>
        </DrawerHeader>
        <Divider />
        <List>
            <ListItem disablePadding sx={{ display: 'block' }}>
                <ListItemButton component={RouterLink} to="/" sx={{ minHeight: 48, justifyContent: open ? 'initial' : 'center', px: 2.5 }}>
                    <ListItemIcon sx={{ minWidth: 0, mr: open ? 3 : 'auto', justifyContent: 'center', color: 'primary.main' }}>
                        <ArrowBackIcon />
                    </ListItemIcon>
                    <ListItemText primary="Quay lại Sảnh chính" sx={{ opacity: open ? 1 : 0 }} />
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
                <ListItemButton onClick={handleImportMenuToggle} sx={{ minHeight: 48, justifyContent: open ? 'initial' : 'center', px: 2.5 }}>
                    <ListItemIcon sx={{ minWidth: 0, mr: open ? 3 : 'auto', justifyContent: 'center' }}>
                        <CloudUploadIcon />
                    </ListItemIcon>
                    <ListItemText primary="Import Dữ liệu" sx={{ opacity: open ? 1 : 0 }} />
                    {open ? (isImportMenuOpen ? <ExpandLess /> : <ExpandMore />) : null}
                </ListItemButton>
            </ListItem>
            
            <Collapse in={isImportMenuOpen && open} timeout="auto" unmountOnExit>
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