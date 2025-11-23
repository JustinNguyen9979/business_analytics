// FILE: frontend/src/main.jsx (PHIÊN BẢN CÓ LICENSE KEY)

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { BrowserRouter } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import updateLocale from 'dayjs/plugin/updateLocale';
import 'dayjs/locale/vi';

dayjs.extend(quarterOfYear);
dayjs.extend(updateLocale);
dayjs.locale('vi');

// Cấu hình để tuần bắt đầu vào Thứ Hai
dayjs.updateLocale('vi', {
  weekStart: 1,
});

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
    <BrowserRouter>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <App />
      </LocalizationProvider>
    </BrowserRouter>
  // </React.StrictMode>,
)