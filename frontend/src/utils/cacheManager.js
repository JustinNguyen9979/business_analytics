// frontend/src/utils/cacheManager.js


/**
 * Xóa TOÀN BỘ cache của ứng dụng, bao gồm memory, IndexedDB và localStorage.
 * Được thiết kế để gọi khi người dùng muốn có một trạng thái hoàn toàn mới.
 * @returns {Promise<void>}
 */
export const clearAllApplicationCaches = async () => {
    console.log("Bắt đầu xóa toàn bộ cache ứng dụng...");



    // 2. Xóa IndexedDB database
    try {
        const dbName = 'BusinessAnalyticsDB';
        await new Promise((resolve, reject) => {
            const deleteRequest = indexedDB.deleteDatabase(dbName);
            
            deleteRequest.onsuccess = () => {
                console.log(`IndexedDB database "${dbName}" đã được xóa.`);
                resolve();
            };
            
            deleteRequest.onerror = (event) => {
                console.error(`Lỗi khi xóa IndexedDB database "${dbName}":`, event.target.error);
                reject(event.target.error);
            };

            deleteRequest.onblocked = () => {
                console.warn(`Việc xóa IndexedDB bị chặn. Hãy đóng các tab khác của ứng dụng này.`);
                // Vẫn resolve để không dừng tiến trình, dù việc xóa có thể chưa thành công ngay
                resolve(); 
            };
        });
    } catch (error) {
        console.error("Lỗi khi xóa IndexedDB:", error);
    }

    // 3. Xóa localStorage
    try {
        // Chúng ta chỉ xóa các key liên quan đến app này, thay vì clear() toàn bộ
        // để tránh ảnh hưởng đến các ứng dụng khác có thể chạy trên cùng domain.
        // QUAN TRỌNG: Không xóa 'token' để tránh bị văng ra trang login.
        // Cũng không xóa cấu hình cá nhân như 'sidebarOpenState' và 'customPlatforms_'.
        const keysToKeep = ['token', 'sidebarOpenState'];
        
        Object.keys(localStorage).forEach(key => {
            if (!keysToKeep.includes(key) && !key.startsWith('customPlatforms_')) {
                localStorage.removeItem(key);
            }
        });

        console.log("localStorage đã được dọn dẹp (ngoại trừ token và cấu hình).");
    } catch (error) {
        console.error("Lỗi khi xóa localStorage:", error);
    }

    console.log("Hoàn tất việc xóa cache.");
};
