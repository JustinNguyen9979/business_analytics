// FILE: frontend/src/components/common/LuxuryPage.jsx

import React from 'react';
import { Box, CssBaseline } from '@mui/material';
import { Noise, AmbientOrbs, GridOverlay, ScanLine } from './BackgroundLayers';
import { T, fadeUp } from '../../theme/designSystem';

/**
 * LuxuryPage Component
 * A standardized wrapper for all pages to ensure UI/UX consistency.
 * Includes background layers, noise, grid, and standard layout settings.
 */
const LuxuryPage = ({ children, sx = {}, hideScanLine = false, overflow = "auto" }) => {
  return (
    <>
      <CssBaseline />
      <Box 
        sx={{ 
          minHeight: "100vh", 
          position: "relative", 
          fontFamily: T.fontBody,
          backgroundColor: T.bg,
          color: T.textPrimary,
          overflow: overflow,
          display: "flex",
          flexDirection: "column",
          ...sx 
        }}
      >
        {/* Background Layers */}
        <Noise />
        <AmbientOrbs />
        <GridOverlay />
        
        {/* Optional Scan Line Effect */}
        {!hideScanLine && <ScanLine />}

        {/* Page Content */}
        <Box 
          sx={{ 
            position: "relative", 
            zIndex: 1, 
            flex: 1,
            width: "100%",
            animation: `${fadeUp} 0.6s ease-out forwards`,
          }}
        >
          {children}
        </Box>
      </Box>
    </>
  );
};


export default LuxuryPage;
