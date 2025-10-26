// FILE: frontend/src/layouts/DashboardLayout.jsx (PHIÊN BẢN AURORA CHÍNH XÁC)

import React, { useState } from 'react';
import { styled } from '@mui/material/styles';
import { Link as RouterLink, Outlet } from 'react-router-dom';
import { Box, Drawer as MuiDrawer, AppBar as MuiAppBar, Toolbar, List, Typography, Divider, IconButton, ListItem, ListItemButton, ListItemIcon, ListItemText, CssBaseline } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DashboardIcon from '@mui/icons-material/Dashboard';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import AuroraBackground from '../components/AuroraBackground';

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
  const [open, setOpen] = useState(true);

  const handleDrawerToggle = () => {
    setOpen(!open);
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AuroraBackground />
      
      <AppBar position="fixed" open={open}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="toggle drawer"
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
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          minHeight: { xs: 56, sm: 64 }
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', opacity: open ? 1 : 0, transition: 'opacity 0.2s' }}>
             <QueryStatsIcon sx={{ color: 'primary.main', mr: 1.5, fontSize: 30 }} />
             <Typography variant="h6" noWrap>Analytics</Typography>
          </Box>
          <IconButton onClick={handleDrawerToggle} sx={{ opacity: open ? 1 : 0 }}>
            <ChevronLeftIcon />
          </IconButton>
        </Box>
        <Divider />
        <List>
            {/* ĐÂY LÀ PHẦN CODE ĐẦY ĐỦ CỦA CÁC MENU ITEM */}
            <ListItem disablePadding sx={{ display: 'block' }}>
                <ListItemButton
                    component={RouterLink} to="/"
                    sx={{ minHeight: 48, justifyContent: open ? 'initial' : 'center', px: 2.5 }}
                >
                    <ListItemIcon
                        sx={{ minWidth: 0, mr: open ? 3 : 'auto', justifyContent: 'center', color: 'primary.main' }}
                    >
                        <ArrowBackIcon />
                    </ListItemIcon>
                    <ListItemText primary="Quay lại Sảnh chính" sx={{ opacity: open ? 1 : 0 }} />
                </ListItemButton>
            </ListItem>
            <ListItem disablePadding sx={{ display: 'block' }}>
                <ListItemButton
                    sx={{ minHeight: 48, justifyContent: open ? 'initial' : 'center', px: 2.5 }}
                >
                    <ListItemIcon
                        sx={{ minWidth: 0, mr: open ? 3 : 'auto', justifyContent: 'center' }}
                    >
                        <DashboardIcon />
                    </ListItemIcon>
                    <ListItemText primary="Tổng quan" sx={{ opacity: open ? 1 : 0 }} />
                </ListItemButton>
            </ListItem>
        </List>
      </Drawer>

      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          p: 3,
          overflow: 'auto',
          height: '100vh'
        }}
      >
        <Toolbar /> 
        <Outlet />
      </Box>
    </Box>
  );
}