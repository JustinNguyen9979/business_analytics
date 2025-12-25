/**
 * Xử lý logic Toggle chọn nguồn dữ liệu (Check/Uncheck thông minh).
 * Mô phỏng hành vi giống Excel/Google Sheets.
 * 
 * @param {string} sourceValue - Giá trị nguồn vừa được click (hoặc 'all')
 * @param {string[]} currentSelection - Danh sách đang được chọn hiện tại
 * @param {Array<{label: string, value: string}>} sourceOptions - Danh sách tất cả các option có sẵn
 * @returns {string[]} Danh sách mới sau khi toggle
 */
export const toggleSourceSelection = (sourceValue, currentSelection, sourceOptions) => {
    const allValues = sourceOptions.map(o => o.value);

    // 1. Nếu click vào nút "Tất cả"
    if (sourceValue === 'all') {
        // Nếu đang có 'all' (hoặc đã chọn hết) -> Click thì Bỏ hết
        const isFull = currentSelection.includes('all') || 
                      (allValues.length > 0 && currentSelection.length >= allValues.length);
        
        if (isFull) {
            return [];
        }
        // Ngược lại -> Chọn hết
        return ['all', ...allValues];
    }

    // 2. Nếu click vào một source cụ thể
    // Trước tiên, đảm bảo ta đang làm việc trên danh sách đầy đủ (nếu đang là 'all' thì bung ra)
    let newSelection = currentSelection.includes('all') 
        ? ['all', ...allValues] 
        : [...currentSelection];

    if (newSelection.includes(sourceValue)) {
        // Đang chọn -> Bỏ chọn source đó
        newSelection = newSelection.filter(v => v !== sourceValue);
        // Bắt buộc bỏ cờ 'all' vì chắc chắn không còn đủ bộ
        newSelection = newSelection.filter(v => v !== 'all');
    } else {
        // Chưa chọn -> Chọn thêm
        newSelection.push(sourceValue);
    }

    // 3. Kiểm tra xem đã đủ bộ chưa để tự động bật lại 'all'
    // Lọc bỏ 'all' cũ để đếm cho chuẩn
    const rawSources = newSelection.filter(v => v !== 'all');
    
    // Nếu số lượng source chọn == tổng số source option
    if (rawSources.length === allValues.length && allValues.length > 0) {
        return ['all', ...rawSources];
    }

    // Trả về danh sách unique
    return [...new Set(rawSources)];
};
