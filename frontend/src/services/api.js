// FILE: frontend/src/services/api.js
import axios from 'axios';
import { memoryCache, generateCacheKey } from '../cache/memoryCache';

// Tạo một instance của axios với cấu hình sẵn
const apiClient = axios.create({
    // '/api' sẽ được Vite proxy chuyển tiếp đến backend
    baseURL: '/api',
});

/**
 * Gửi yêu cầu tính toán dữ liệu đến backend.
 * @param {string} requestType - Loại dữ liệu cần tính (kpi_summary, daily_kpis_chart, ...).
 * @param {number} brandId - ID của brand.
 * @param {object} params - Các tham số (start_date, end_date, ...).
 * @returns {Promise<object>} - Phản hồi từ API, có thể là dữ liệu ngay (cache hit) hoặc task_id (cache miss).
 */
export const requestData = async (requestType, brandId, params) => {
    try {
        const payload = {
            brand_id: brandId,
            request_type: requestType,
            params: params,
        };
        const response = await apiClient.post('/data-requests', payload);
        return response.data;
    } catch (error) {
        console.error(`Error requesting data for ${requestType}:`, error);
        throw error;
    }
};

/**
 * "Hỏi thăm" trạng thái của một yêu cầu đang được xử lý.
 * @param {string} cacheKey - Cache key được trả về từ hàm requestData.
 * @returns {Promise<object>} - Phản hồi chứa trạng thái (PROCESSING, SUCCESS, FAILED) và dữ liệu (nếu có).
 */
export const pollDataStatus = async (cacheKey) => {
    try {
        const response = await apiClient.get(`/data-requests/status/${cacheKey}`);
        return response.data;
    } catch (error) {
        console.error(`Error polling status for cache key ${cacheKey}:`, error);
        throw error;
    }
};

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
export const uploadPlatformFiles = async (platform, brandId, files) => {
    const formData = new FormData();
    if (files.orderFile) formData.append('order_file', files.orderFile);
    if (files.revenueFile) formData.append('revenue_file', files.revenueFile);
    if (files.adsFile) formData.append('ad_file', files.adsFile);

    try {
        // URL được tạo động dựa trên platform
        const response = await apiClient.post(`/upload/${platform.toLowerCase()}/${brandId}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        console.error(`Error uploading files for ${platform} and brand ${brandId}:`, error);
        throw error;
    }
};

export const uploadStandardFile = async (platform, brandId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
        const response = await apiClient.post(
            `/brands/${brandId}/upload-standard-file?platform=${platform.toLowerCase()}`,
            formData, { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        return response.data;
    } catch (error) { throw error; }
};

export const recalculateBrandData = async (brandId) => {
    try {
        const response = await apiClient.post(`/brands/${brandId}/recalculate`);
        return response.data;
    } catch (error) { throw error; }
};

export const recalculateBrandDataAndWait = async (brandId) => {
    try {
        // Trỏ đến endpoint mới
        const response = await apiClient.post(`/brands/${brandId}/recalculate-and-wait`);
        return response.data;
    } catch (error) { throw error; }
};

// Hàm tải lên file chi phí cho Shopee
export const uploadCostFile = async (brandId, costFile) => {
    const formData = new FormData();
    formData.append('cost_file', costFile);

    try {
        const response = await apiClient.post(`/brands/${brandId}/upload-cost-file`, formData, {
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

export const requestCustomerDistribution = async (brandId, startDate, endDate) => {
    try {
        await apiClient.post(`/brands/${brandId}/async-customer-distribution`, null, {
            params: {
                start_date: startDate.format('YYYY-MM-DD'),
                end_date: endDate.format('YYYY-MM-DD'),
            },
        });
    } catch (error) {
        console.error(`Error requesting customer distribution calculation for brand ${brandId}:`, error);
        throw error;
    }
};

export const getCustomerDistribution = async (brandId, startDate, endDate) => {
    try {
        const response = await apiClient.get(`/brands/${brandId}/customer-distribution`, {
            params: {
                start_date: startDate.format('YYYY-MM-DD'),
                end_date: endDate.format('YYYY-MM-DD'),
            },
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching customer distribution for brand ${brandId}:`, error);
        throw error;
    }
};

export const getSourcesForBrand = async (brandId) => {
    try {
        const response = await apiClient.get(`/brands/${brandId}/sources`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching sources for brand ${brandId}:`, error);
        throw error;
    }
};

export const deleteDataInRange = async (brandId, startDate, endDate, source = null) => {
    try {
        const params = {};
        if (source && source !== 'all') {
            params.source = source;
        }

        const response = await apiClient.post(
            `/brands/${brandId}/delete-data-in-range`,
            { start_date: startDate, end_date: endDate },
            { params }
        );
        return response.data;
    } catch (error) {
        console.error(`Error deleting data for brand ${brandId}:`, error);
        throw error;
    }
};

/**
 * Hàm tổng hợp: Gửi yêu cầu, và tự động "hỏi thăm" (poll) cho đến khi có kết quả.
 * Đây là logic bất đồng bộ chính được các hook sử dụng.
 * TÍCH HỢP CLIENT-SIDE CACHE.
 * @param {string} requestType - Loại dữ liệu cần tính (kpi_summary, kpis_by_platform, ...).
 * @param {number} brandId - ID của brand.
 * @param {Array<dayjs>} dateRange - Mảng [ngày bắt đầu, ngày kết thúc].
 * @param {object} params - Các tham số bổ sung.
 * @returns {Promise<object>} - Dữ liệu đã được xử lý thành công.
 */
export const fetchAsyncData = async (requestType, brandId, dateRange, params = {}) => {
    const cacheKey = generateCacheKey(requestType, brandId, dateRange);
    if (!cacheKey) return null;

    // 1. Kiểm tra client cache trước
    const cachedData = memoryCache.get(cacheKey);
    if (cachedData) {
        console.log(`CLIENT CACHE HIT for key: ${cacheKey}`);
        return Promise.resolve(cachedData);
    }
    
    console.log(`CLIENT CACHE MISS for key: ${cacheKey}`);
    const [start, end] = dateRange;
    const fullParams = { 
        start_date: start.format('YYYY-MM-DD'), 
        end_date: end.format('YYYY-MM-DD'), 
        ...params 
    };

    try {
        const initialResponse = await requestData(requestType, brandId, fullParams);
        
        if (initialResponse.status === 'SUCCESS') {
            const resultData = initialResponse.data;
            memoryCache.set(cacheKey, resultData); // Lưu vào cache
            return resultData;
        }

        if (initialResponse.status === 'PROCESSING') {
            return new Promise((resolve, reject) => {
                const pollingInterval = setInterval(async () => {
                    try {
                        const statusResponse = await pollDataStatus(initialResponse.cache_key);
                        if (statusResponse.status === 'SUCCESS') {
                            clearInterval(pollingInterval);
                            const resultData = statusResponse.data;
                            memoryCache.set(cacheKey, resultData); // Lưu vào cache
                            resolve(resultData);
                        } else if (statusResponse.status === 'FAILED') {
                            clearInterval(pollingInterval);
                            reject(new Error(statusResponse.error || `Worker xử lý '${requestType}' thất bại.`));
                        }
                    } catch (pollError) {
                        clearInterval(pollingInterval);
                        reject(pollError);
                    }
                }, 2000); // Hỏi thăm mỗi 2 giây
            });
        }
        // Các trường hợp trạng thái khác không mong muốn
        throw new Error(`Trạng thái phản hồi không mong muốn: ${initialResponse.status}`);
    } catch (error) {
        console.error(`Lỗi khi fetch ${requestType}:`, error);
        throw error;
    }
};