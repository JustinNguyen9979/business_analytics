
import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { dateShortcuts } from '../config/dashboardConfig';

/**
 * Custom Hook để quản lý toàn bộ logic cho một bộ lọc ngày tháng.
 * @param {object} options - Tùy chọn cho hook.
 * @param {string} options.defaultType - Loại bộ lọc mặc định (ví dụ: 'this_month', 'this_year').
 * @param {boolean} [options.useUrl=false] - Có sử dụng URL params để lưu trạng thái không.
 * @param {string} [options.urlPrefix=''] - Tiền tố cho URL params (ví dụ: 'kpi_').
 * @returns {object} - Một object chứa các props cần thiết cho UI.
 */
export const useDateFilter = ({ defaultType, useUrl = false, urlPrefix = '' }) => {
    const [searchParams, setSearchParams] = useSearchParams();

    // --- LOGIC KHỞI TẠO ---
    const getInitialState = useCallback(() => {
        const defaultShortcut = dateShortcuts.find(s => s.type === defaultType) || dateShortcuts[0];
        let initialState = {
            filter: {
                range: defaultShortcut.getValue(),
                type: defaultShortcut.type,
            },
            dateLabel: defaultShortcut.label,
        };

        if (useUrl) {
            const startParam = searchParams.get(`${urlPrefix}start`);
            const endParam = searchParams.get(`${urlPrefix}end`);
            if (startParam && endParam) {
                const range = [dayjs(startParam), dayjs(endParam)];
                initialState = {
                    filter: { range, type: 'custom' },
                    dateLabel: `${range[0].format('DD/MM')} - ${range[1].format('DD/MM/YYYY')}`,
                };
            }
        }
        return initialState;
    }, [defaultType, useUrl, urlPrefix, searchParams]);

    // --- STATE QUẢN LÝ ---
    const [filter, setFilter] = useState(getInitialState().filter);
    const [dateLabel, setDateLabel] = useState(getInitialState().dateLabel);
    const [anchorEl, setAnchorEl] = useState(null);

    // --- HÀM XỬ LÝ ---
    const handleOpen = useCallback((event) => {
        setAnchorEl(event.currentTarget);
    }, []);

    const handleClose = useCallback(() => {
        setAnchorEl(null);
    }, []);

    const handleApply = useCallback((newRange, labelType = 'custom') => {
        // 1. Cập nhật state của bộ lọc
        setFilter({ range: newRange, type: labelType });

        // 2. Tìm nhãn mới
        let newLabel;

        const shortcut = dateShortcuts.find(s => s.type === labelType);
        if (shortcut) {
            newLabel = shortcut.label;
        } else if (labelType.startsWith('Quý')) {
            // Ví dụ: labelType là 'Quý 1_2025' -> 'Quý 1, 2025'
            const parts = labelType.split('_'); // parts sẽ là ['Quý 1', '2025']
            newLabel = `${parts[0]}, ${parts[1]}`; // Ghép lại thành "Quý 1, 2025"
        } else {
            newLabel = `${newRange[0].format('DD/MM')} - ${newRange[1].format('DD/MM/YYYY')}`;
        }

        
        setDateLabel(newLabel);

        // 3. Cập nhật URL nếu cần
        if (useUrl) {
            setSearchParams(prev => {
                const newParams = new URLSearchParams(prev);
                newParams.set(`${urlPrefix}start`, newRange[0].format('YYYY-MM-DD'));
                newParams.set(`${urlPrefix}end`, newRange[1].format('YYYY-MM-DD'));
                return newParams;
            });
        }
        
        // 4. Đóng menu
        handleClose();
    }, [useUrl, urlPrefix, setSearchParams, handleClose]);
    
    // Trả về một object chứa tất cả các props cần thiết
    return {
        // Dữ liệu
        filter,
        // Props cho nút bấm
        buttonProps: {
            onClick: handleOpen,
            children: dateLabel,
        },
        // Props cho Menu
        menuProps: {
            open: Boolean(anchorEl),
            anchorEl,
            onClose: handleClose,
            initialDateRange: filter.range,
            onApply: handleApply,
        }
    };
};
