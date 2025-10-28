// FILE: frontend/src/main.jsx (PHIÊN BẢN CẬP NHẬT)

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { BrowserRouter } from 'react-router-dom';

// 1. IMPORT CÁC THÀNH PHẦN CẦN THIẾT
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* 2. BỌC APP BÊN TRONG LOCALIZATIONPROVIDER */}
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <App />
      </LocalizationProvider>
    </BrowserRouter>
  </React.StrictMode>,
)