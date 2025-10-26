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
export const getBrandDetails = async (brandId) => {
    try {
        const response = await apiClient.get(`/brands/${brandId}`);
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

// Thêm các hàm gọi API khác (upload, delete) ở đây sau...