import { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import { useDateFilter } from './useDateFilter'; 
import { fetchOperationKpisAPI } from '../services/api';
import { useBrand } from '../context/BrandContext'; 

export const useOperationPageLogic = () => {
    const theme = useTheme();
    
    // <--- 2. LẤY BRAND INFO TỪ CONTEXT (SỬA LỖI DESTRUCTURING)
    // useBrand() trả về object { id, name, slug, ... } chứ không phải { selectedBrand: ... }
    const selectedBrand = useBrand(); 

    // 1. Logic lọc ngày
    const { filter, buttonProps, menuProps } = useDateFilter({ defaultType: 'this_month' });

    const dateRange = filter.range;
    const dateLabel = buttonProps.children;
    const handleOpenFilter = buttonProps.onClick;
    const anchorEl = menuProps.anchorEl;
    const handleCloseFilter = menuProps.onClose;
    const handleApplyDateRange = menuProps.onApply;

    // 3. Config (Đưa lên trước useState để dùng làm giá trị khởi tạo)
    const kpiConfig = [
        { key: 'avg_processing_time', title: "Thời gian xử lý TB", max: 48, unit: "giờ", color: theme.palette.success.main },
        { key: 'avg_shipping_time', title: "Thời gian giao hàng TB", max: 7, unit: "ngày", color: theme.palette.primary.main },
        { key: 'completion_rate', title: "Tỷ lệ hoàn thành", max: 100, unit: "%", color: theme.palette.success.main },
        { key: 'cancellation_rate', title: "Tỷ lệ hủy", max: 100, unit: "%", color: theme.palette.error.main },
        { key: 'refund_rate', title: "Tỷ lệ Hoàn/Bom", max: 100, unit: "%", color: theme.palette.warning.main }
    ];

    // 2. State quản lý dữ liệu (Khởi tạo default data ngay lập tức)
    const [kpiData, setKpiData] = useState(() => kpiConfig.map(config => ({
        ...config,
        value: 0,
        previousValue: null
    }))); 
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // 4. Effect gọi API
    useEffect(() => {
        const fetchOperationKpis = async () => {
            // Kiểm tra chặt chẽ: Phải có brand slug và range ngày hợp lệ
            if (!selectedBrand?.slug || !dateRange?.[0] || !dateRange?.[1]) {
                return;
            }

            setLoading(true);
            setError(null);
            try {
                const startDateStr = dateRange[0].format('YYYY-MM-DD');
                const endDateStr = dateRange[1].format('YYYY-MM-DD');
                const brandSlug = selectedBrand.slug;
                
                let apiResponse = {};
                try {
                     apiResponse = await fetchOperationKpisAPI(brandSlug, startDateStr, endDateStr);
                } catch (apiErr) {
                    console.warn("API Error, mocking:", apiErr);
                    // Mock data dự phòng để không crash UI
                    apiResponse = { avg_processing_time: 0, avg_shipping_time: 0, completion_rate: 0, cancellation_rate: 0 };
                }

                const mappedData = kpiConfig.map(config => {
                    let val = apiResponse[config.key] !== undefined ? apiResponse[config.key] : 0;
                    
                    // Nếu đơn vị là %, nhân 100 để hiển thị đúng trên Gauge
                    if (config.unit === '%') {
                        val = val * 100;
                    }

                    return {
                        ...config,
                        value: val,
                        previousValue: null
                    };
                });

                setKpiData(mappedData);

            } catch (err) {
                console.error("Logic Error:", err);
                setKpiData([]); 
            } finally {
                setLoading(false);
            }
        };

        fetchOperationKpis();
    }, [dateRange, selectedBrand]); // Dependency array phải chứa selectedBrand để re-run khi context update

    return {
        dateRange,
        dateLabel,
        anchorEl,
        handleOpenFilter,
        handleCloseFilter,
        handleApplyDateRange,
        kpiData, 
        loading,
        error
    };
};
