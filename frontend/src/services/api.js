// FILE: frontend/src/services/api.js
import axios from 'axios';

// Tạo một instance của axios với cấu hình sẵn
const apiClient = axios.create({
    // '/api' sẽ được Vite proxy chuyển tiếp đến backend
    baseURL: '/api',
});

// Hàm lấy danh sách tất cả các brand
export const getAllBrands = async () => {
    try {
        const response = await apiClient.get('/brands/');
        return response.data;
    } catch (error) {
        console.error("Error fetching brands:", error);
        throw error; // Ném lỗi ra để component có thể xử lý
    }
};

// Hàm lấy chi tiết một brand
// export const getBrandDetails = async (brandId) => {
//     try {
//         const response = await apiClient.get(`/brands/${brandId}`);
//         return response.data;
//     } catch (error) {
//         console.error(`Error fetching details for brand ${brandId}:`, error);
//         throw error;
//     }
// };
export const getBrandDetails = async (brandId, startDate, endDate) => { // Xóa timeRange
    if (!brandId || !startDate || !endDate) {
        return Promise.reject(new Error("Thiếu thông tin Brand ID, ngày bắt đầu hoặc ngày kết thúc."));
    }

    try {
        const response = await apiClient.get(`/brands/${brandId}`, {
            params: {
                start_date: startDate.format('YYYY-MM-DD'),
                end_date: endDate.format('YYYY-MM-DD')
                // Xóa time_range khỏi đây
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching details for brand ${brandId}:`, error);
        throw error;
    }
};

// Hàm tạo một brand mới
export const createBrand = async (brandName) => {
    try {
        const response = await apiClient.post('/brands/', { name: brandName });
        return response.data;
    } catch (error) {
        console.error("Error creating brand:", error);
        throw error;
    }
};

// Hàm xóa một brand
export const deleteBrand = async (brandId) => {
    try {
        await apiClient.delete(`/brands/${brandId}`);
    } catch (error) {
        console.error(`Error deleting brand ${brandId}:`, error);
        throw error;
    }
};

// Hàm cập nhật (đổi tên) một brand
export const updateBrand = async (brandId, newName) => {
    try {
        const response = await apiClient.put(`/brands/${brandId}`, { name: newName });
        return response.data;
    } catch (error) {
        console.error(`Error updating brand ${brandId}:`, error);
        throw error;
    }
};

// Hàm nhân bản một brand
export const cloneBrand = async (brandId) => {
    try {
        const response = await apiClient.post(`/brands/${brandId}/clone`);
        return response.data;
    } catch (error) {
        console.error(`Error cloning brand ${brandId}:`, error);
        throw error;
    }
};

// Hàm tải lên file cho Shopee
export const uploadShopeeFiles = async (brandId, files) => {
    // FormData là cách chuẩn để gửi file qua API
    const formData = new FormData();
    if (files.orderFile) formData.append('order_file', files.orderFile);
    if (files.revenueFile) formData.append('revenue_file', files.revenueFile);
    if (files.adsFile) formData.append('ad_file', files.adsFile);
    // Lưu ý: Tên key 'order_file', 'revenue_file', 'ad_file' phải khớp với backend

    try {
        const response = await apiClient.post(`/upload/shopee/${brandId}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        console.error(`Error uploading files for brand ${brandId}:`, error);
        // Ném lỗi ra để component có thể bắt và hiển thị cho người dùng
        throw error;
    }
};

// Hàm tải lên file chi phí cho Shopee
export const uploadCostFile = async (brandId, costFile) => {
    const formData = new FormData();
    // Quan trọng: Key 'cost_file' phải khớp với tên tham số ở backend
    formData.append('cost_file', costFile);

    try {
        const response = await apiClient.post(`/upload/shopee/${brandId}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        console.error(`Error uploading cost file for brand ${brandId}:`, error);
        throw error;
    }
};