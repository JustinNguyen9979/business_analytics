import { useState, useEffect, useMemo, useCallback } from 'react';
import dayjs from 'dayjs';
import { dateShortcuts } from '../config/dashboardConfig';

/**
 * Hook quản lý bộ lọc Hybrid (Cha - Con).
 * Quy tắc:
 * 1. Khi globalState thay đổi -> localState cập nhật theo (Cha là nhất).
 * 2. Khi người dùng chỉnh local -> localState thay đổi (Ghi đè tạm thời).
 * 
 * @param {object} globalState - State của bộ lọc tổng { dateRange, dateLabel, selectedSources }
 */
export const useChartFilter = (globalState) => {
    // 1. State nội bộ (Local)
    const [dateRange, setDateRange] = useState(globalState?.dateRange || [dayjs().startOf('month'), dayjs().endOf('month')]);
    const [dateLabel, setDateLabel] = useState(globalState?.dateLabel || 'Tháng này');
    const [dateType, setDateType] = useState(globalState?.dateType || 'this_month');
    const [selectedSources, setSelectedSources] = useState(globalState?.selectedSources || ['all']);
    
    // State quản lý Menu Date
    const [dateAnchorEl, setDateAnchorEl] = useState(null);

    // 2. EFFECT: Lắng nghe Cha (Master Override)
    // Khi Cha thay đổi, Con phải tuân lệnh ngay lập tức
    useEffect(() => {
        if (globalState) {
            if (globalState.dateRange) setDateRange(globalState.dateRange);
            if (globalState.dateLabel) setDateLabel(globalState.dateLabel);
            if (globalState.dateType) setDateType(globalState.dateType);
            // Lưu ý: OperationPage chưa có filter Source tổng, nên tạm thời chưa sync source
            // Nếu sau này có source tổng, thêm dòng này:
            // if (globalState.selectedSources) setSelectedSources(globalState.selectedSources);
        }
    }, [globalState?.dateRange, globalState?.dateLabel, globalState?.dateType, globalState?.selectedSources]);

    // 3. Handlers cho Local (Memoized)
    const openDateMenu = useCallback((event) => setDateAnchorEl(event.currentTarget), []);
    const closeDateMenu = useCallback(() => setDateAnchorEl(null), []);
    
    const applyDateRange = useCallback((range, typeOrLabel) => {
        // Tìm label tiếng Việt tương ứng nếu tham số truyền vào là 'type' (ví dụ: 'this_month')
        const shortcut = dateShortcuts.find(s => s.type === typeOrLabel);
        
        let displayLabel = typeOrLabel;
        let finalType = typeOrLabel;

        if (shortcut) {
            displayLabel = shortcut.label;
        } else if (typeOrLabel === 'custom') {
            displayLabel = `${range[0].format('DD/MM')} - ${range[1].format('DD/MM/YYYY')}`;
        }

        setDateRange(range);
        setDateLabel(displayLabel);
        setDateType(finalType);
        closeDateMenu();
    }, [closeDateMenu]);

    const applySourceFilter = useCallback((newSources) => {
        setSelectedSources(newSources);
    }, []);

    return useMemo(() => ({
        // Date Props
        dateRange,
        dateLabel,
        dateType,
        dateMenuProps: {
            anchorEl: dateAnchorEl,
            open: Boolean(dateAnchorEl),
            onClose: closeDateMenu,
            onApply: applyDateRange,
            initialDateRange: dateRange
        },
        openDateMenu,

        // Source Props
        selectedSources,
        applySourceFilter
    }), [dateRange, dateLabel, dateType, dateAnchorEl, selectedSources, closeDateMenu, applyDateRange, openDateMenu, applySourceFilter]);
};