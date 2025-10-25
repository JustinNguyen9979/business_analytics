import streamlit as st
import requests
import pandas as pd

BACKEND_URL = "http://backend:8000"

# (Các hàm API giữ nguyên)
def get_all_brands():
    try: return requests.get(f"{BACKEND_URL}/brands/").json()
    except: return []
def create_brand(name):
    try:
        res = requests.post(f"{BACKEND_URL}/brands/", json={"name": name})
        if res.status_code == 200: st.success(f"Đã tạo brand '{name}'!"); return res.json()
        else: st.error(f"Lỗi: {res.json().get('detail')}"); return None
    except: st.error("Lỗi kết nối backend."); return None
def get_brand_details(brand_id):
    try: return requests.get(f"{BACKEND_URL}/brands/{brand_id}").json()
    except: return None

st.set_page_config(layout="wide", page_title="CEO Dashboard")
if 'page' not in st.session_state: st.session_state.page = 'brand_lobby'
if 'selected_brand_id' not in st.session_state: st.session_state.selected_brand_id = None

# --- TRANG SẢNH CHỜ ---
if st.session_state.page == 'brand_lobby':
    st.title("Chào mừng anh đến với CEO Dashboard")
    st.header("Vui lòng chọn hoặc tạo một Brand để bắt đầu")
    
    all_brands = get_all_brands()
    if all_brands:
        brand_names = {brand['name']: brand['id'] for brand in all_brands}
        selected_brand_name = st.selectbox("Chọn Brand hiện có", options=brand_names.keys())
        if st.button("Đi đến Dashboard"):
            st.session_state.selected_brand_id = brand_names[selected_brand_name]
            st.session_state.page = 'dashboard'
            st.experimental_rerun()
    else:
        st.info("Chưa có brand nào.")
    
    st.write("---")
    with st.form("new_brand_form"):
        new_brand_name = st.text_input("Hoặc tạo Brand mới")
        if st.form_submit_button("Tạo Brand") and new_brand_name:
            if create_brand(new_brand_name): st.experimental_rerun()

# --- TRANG DASHBOARD ---
elif st.session_state.page == 'dashboard':
    brand_id = st.session_state.selected_brand_id
    brand_data = get_brand_details(brand_id)

    if brand_data:
        st.title(f"Dashboard cho Brand: {brand_data['name']}")
        if st.button("◀️ Quay lại danh sách Brand"):
            st.session_state.page = 'brand_lobby'; st.experimental_rerun()
        
        # --- KHU VỰC UPLOAD MỚI ---
        with st.expander("⬆️ Upload Dữ liệu Mới cho Brand này"):
            with st.form("upload_form", clear_on_submit=True):
                cost_file = st.file_uploader("1. File Giá vốn (.xlsx)", type="xlsx")
                order_file = st.file_uploader("2. File Đơn hàng (.xlsx)", type="xlsx")
                ad_file = st.file_uploader("3. File Quảng cáo (.csv)", type="csv")
                revenue_file = st.file_uploader("4. File Doanh thu (.xlsx)", type="xlsx")
                
                if st.form_submit_button("Bắt đầu Upload và Xử lý"):
                    with st.spinner("Đang xử lý..."):
                        files_to_upload = {}
                        if cost_file: files_to_upload['cost_file'] = (cost_file.name, cost_file, cost_file.type)
                        if order_file: files_to_upload['order_file'] = (order_file.name, order_file, order_file.type)
                        if ad_file: files_to_upload['ad_file'] = (ad_file.name, ad_file, ad_file.type)
                        if revenue_file: files_to_upload['revenue_file'] = (revenue_file.name, revenue_file, revenue_file.type)

                        if files_to_upload:
                            res = requests.post(f"{BACKEND_URL}/upload/shopee/{brand_id}", files=files_to_upload)
                            if res.status_code == 200:
                                st.success("Xử lý thành công!")
                                st.json(res.json())
                            else:
                                st.error(f"Lỗi: {res.text}")
                        else:
                            st.warning("Vui lòng chọn ít nhất một file để upload.")

        st.write("---")
        # --- (Phần hiển thị KPI và biểu đồ giữ nguyên) ---
        st.header("📊 Chỉ số Hiệu suất Chính (KPIs)")
        # ...

        # --- HIỂN THỊ DỮ LIỆU MỚI (DẠNG BẢNG) ---
        st.header("📋 Dữ liệu Vừa Import")
        tab1, tab2 = st.tabs(["Dữ liệu Quảng cáo", "Dữ liệu Doanh thu"])
        with tab1:
            if brand_data.get('shopee_ads'): st.dataframe(pd.DataFrame(brand_data['shopee_ads']))
            else: st.info("Chưa có dữ liệu quảng cáo.")
        with tab2:
            if brand_data.get('shopee_revenues'): st.dataframe(pd.DataFrame(brand_data['shopee_revenues']))
            else: st.info("Chưa có dữ liệu doanh thu.")