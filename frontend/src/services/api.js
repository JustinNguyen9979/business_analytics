// FILE: frontend/src/services/api.js
import axios from 'axios';

// Tạo một instance của axios với cấu hình sẵn
const apiClient = axios.create({
    // '/api' sẽ được Vite proxy chuyển tiếp đến backend
    baseURL: '/api',
    paramsSerializer: {
        indexes: null // Quan trọng: Tắt việc thêm brackets [] vào array keys (source=a&source=b)
    }
});

export const fetchCustomerMap = async (brandSlug, startDate, endDate, signal) => {
    try {
        const response = await apiClient.get(`/brands/${brandSlug}/customer-map-distribution`, {
            params: { start_date: startDate, end_date: endDate },
            signal
        });
        return response.data;
    } catch (error) {
        if (axios.isCancel(error)) {
            console.log('Request cancelled:', error.message);
        } else {
            console.error(`Error fetching customer map for brand ${brandSlug}:`, error);
        }
        throw error;
    }
};

/**
 * Gửi yêu cầu tính toán dữ liệu đến backend.
 * @param {string} requestType - Loại dữ liệu cần tính (kpi_summary, daily_kpis_chart, ...).
 * @param {string} brandSlug - Slug của brand.
 * @param {object} params - Các tham số (start_date, end_date, ...).
 * @returns {Promise<object>} - Phản hồi từ API, có thể là dữ liệu ngay (cache hit) hoặc task_id (cache miss).
 */
export const requestData = async (requestType, brandSlug, params, signal) => {
    try {
        const payload = {
            brand_slug: brandSlug,
            request_type: requestType,
            params: params,
        };
        const response = await apiClient.post('/data-requests', payload, { signal });
        return response.data;
    } catch (error) {
        if (axios.isCancel(error)) {
            console.log('Data request cancelled:', requestType);
        } else {
            console.error(`Error requesting data for ${requestType}:`, error);
        }
        throw error;
    }
};

/**
 * "Hỏi thăm" trạng thái của một yêu cầu đang được xử lý.
 * @param {string} cacheKey - Cache key được trả về từ hàm requestData.
 * @returns {Promise<object>} - Phản hồi chứa trạng thái (PROCESSING, SUCCESS, FAILED) và dữ liệu (nếu có).
 */
export const pollDataStatus = async (cacheKey, signal) => {
    try {
        const response = await apiClient.get(`/data-requests/status/${cacheKey}`, { signal });
        return response.data;
    } catch (error) {
        if (axios.isCancel(error)) {
            console.log('Polling request cancelled for:', cacheKey);
        } else {
            console.error(`Error polling status for cache key ${cacheKey}:`, error);
        }
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

export const uploadStandardFile = async (platform, brandSlug, file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
        const response = await apiClient.post(
            `/brands/${brandSlug}/upload-standard-file?platform=${platform.toLowerCase()}`,
            formData, { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        return response.data;
    } catch (error) { throw error; }
};

export const recalculateBrandDataAndWait = async (brandSlug) => {
    try {
        // Trỏ đến endpoint mới
        const response = await apiClient.post(`/brands/${brandSlug}/recalculate-and-wait`);
        return response.data;
    } catch (error) { throw error; }
};

export const triggerRecalculation = async (brandSlug) => {
    try {
        const response = await apiClient.post(`/brands/${brandSlug}/trigger-recalculation`);
        return response.data;
    } catch (error) { throw error; }
};

export const getSourcesForBrand = async (brandSlug) => {
    try {
        const response = await apiClient.get(`/brands/${brandSlug}/sources`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching sources for brand ${brandSlug}:`, error);
        throw error;
    }
};

export const deleteDataInRange = async (brandSlug, startDate, endDate, source = null) => {
    try {
        const params = {};
        if (source && source !== 'all') {
            params.source = source;
        }

        const response = await apiClient.post(
            `/brands/${brandSlug}/delete-data-in-range`,
            { start_date: startDate, end_date: endDate },
            { params }
        );
        return response.data;
    } catch (error) {
        console.error(`Error deleting data for brand ${brandSlug}:`, error);
        throw error;
    }
};

/**
 * Hàm tổng hợp: Gửi yêu cầu, và tự động "hỏi thăm" (poll) cho đến khi có kết quả.
 * Đây là logic bất đồng bộ chính được các hook sử dụng.
 * TÍCH HỢP CLIENT-SIDE CACHE.
 * @param {string} requestType - Loại dữ liệu cần tính (kpi_summary, kpis_by_platform, ...).
 * @param {string} brandSlug - Slug của brand.
 * @param {Array<dayjs>} dateRange - Mảng [ngày bắt đầu, ngày kết thúc].
 * @param {object} params - Các tham số bổ sung.
 * @returns {Promise<object>} - Dữ liệu đã được xử lý thành công.
 */
export const fetchAsyncData = async (requestType, brandSlug, dateRange, params = {}, signal) => {
    // Helper to check for abort signal
    const throwIfAborted = () => {
        if (signal?.aborted) {
            throw new axios.Cancel('Request was aborted.');
        }
    };
    
    throwIfAborted(); // Check before first request

    const [start, end] = dateRange;
    const fullParams = { 
        start_date: start.format('YYYY-MM-DD'), 
        end_date: end.format('YYYY-MM-DD'), 
        ...params 
    };

    try {
        const initialResponse = await requestData(requestType, brandSlug, fullParams, signal);
        
        if (initialResponse.status === 'SUCCESS') {
            const resultData = initialResponse.data;
            return resultData;
        }

        if (initialResponse.status === 'PROCESSING') {
            return new Promise((resolve, reject) => {
                let pollingInterval;

                const cleanup = () => {
                    if (pollingInterval) clearInterval(pollingInterval);
                    if (signal) signal.removeEventListener('abort', onAbort);
                };

                const onAbort = () => {
                    cleanup();
                    reject(new axios.Cancel('Polling was aborted.'));
                };
                
                if (signal) signal.addEventListener('abort', onAbort);

                pollingInterval = setInterval(async () => {
                    try {
                        throwIfAborted(); // Check before each poll
                        const statusResponse = await pollDataStatus(initialResponse.cache_key, signal);

                        if (statusResponse.status === 'SUCCESS') {
                            cleanup();
                            const resultData = statusResponse.data;
                            resolve(resultData);
                        } else if (statusResponse.status === 'FAILED') {
                            cleanup();
                            reject(new Error(statusResponse.error || `Worker xử lý '${requestType}' thất bại.`));
                        }
                        // If still 'PROCESSING', do nothing and wait for the next poll.
                    } catch (pollError) {
                        cleanup();
                        reject(pollError);
                    }
                }, 2000); // Poll every 2 seconds
            });
        }
        
        throw new Error(`Trạng thái phản hồi không mong muốn: ${initialResponse.status}`);
    } catch (error) {
        // The individual functions (requestData, pollDataStatus) already handle logging.
        throw error;
    }
};

export const fetchOperationKpisAPI = async (brandSlug, startDate, endDate, sources = []) => {
    try {
        const params = {
            start_date: startDate,
            end_date: endDate
        };

        // Nếu có truyền list source cụ thể, thêm vào params
        // Axios sẽ tự động chuyển array ['a', 'b'] thành ?source=a&source=b
        if (sources && sources.length > 0) {
            if (sources.includes('all')) {
                params.source = ['all'];
            } else {
                params.source = sources;
            }
        }

        const response = await apiClient.get(`/brands/${brandSlug}/kpis/operation`, { params });
        return response.data;
    } catch (error) {
        console.error(`Error fetching operation KPIs for brand ${brandSlug}:`, error);
        throw error;
    }
};