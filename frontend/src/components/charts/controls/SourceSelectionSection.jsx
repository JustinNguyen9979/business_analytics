import React from 'react';
import ChartSettingSection from './ChartSettingSection';
import ChartSettingItem from './ChartSettingItem';

/**
 * Component hiển thị danh sách các nguồn dữ liệu để người dùng tick chọn.
 *
 * @param {object} props
 * @param {string[]} props.selectedSources - Danh sách các nguồn đang được chọn (e.g., ['shopee', 'lazada'] hoặc ['all'])
 * @param {Array<{label: string, value: string}>} props.sourceOptions - Danh sách các option nguồn có sẵn
 * @param {function(string)} props.onToggle - Hàm xử lý khi người dùng tick chọn một nguồn
 */
const SourceSelectionSection = ({ selectedSources, sourceOptions, onToggle }) => {
    // Kiểm tra xem có phải đang chọn tất cả hay không
    // 1. Nếu trong mảng có 'all'
    // 2. Nếu số lượng item được chọn (loại bỏ 'all') bằng với tổng số option có sẵn
    const isAllSelected = selectedSources.includes('all') || 
                         (sourceOptions.length > 0 && 
                          selectedSources.filter(s => s !== 'all').length === sourceOptions.length);

    return (
        <ChartSettingSection title="Nguồn dữ liệu">
            <ChartSettingItem
                label="Tất cả nguồn"
                checked={isAllSelected}
                onChange={() => onToggle('all')}
            />
            {sourceOptions.map(option => (
                <ChartSettingItem
                    key={option.value}
                    label={option.label}
                    checked={isAllSelected || selectedSources.includes(option.value)}
                    onChange={() => onToggle(option.value)}
                />
            ))}
        </ChartSettingSection>
    );
};

export default SourceSelectionSection;