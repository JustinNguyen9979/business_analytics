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

ADS_COLUMNS = {
    "campaign_name": "Tên Chiến dịch",
    "start_date": "Ngày bắt đầu",
    "impressions": "Lượt xem",
    "product_impressions": "Lượt xem SP",
    "clicks": "Lượt click",
    "product_clicks": "Lượt click SP",
    "ctr": "CTR (%)",
    "product_ctr": "CTR SP (%)",
    "conversions": "Chuyển đổi",
    "items_sold": "Sản phẩm bán được",
    "gmv": " GMV",
    "expense": "Chi phí",
    "roas": "ROAS",
    "acos": "ACOS (%)"
}

REVENUE_COLUMNS = {
    "order_code": "Mã đơn hàng",
    "order_date": "Ngày đặt hàng",
    "payment_completed_date": "Ngày thanh toán",
    "total_payment": "Tổng thanh toán",
    "product_price": "Giá sản phẩm",
    "refund_amount": "Tiền hoàn lại", 
    "shipping_fee": "Phí vận chuyển",
    "buyer_paid_shipping_fee": "Phí VC người mua trả", 
    "actual_shipping_fee": "Phí VC thực tế", 
    "shopee_subsidized_shipping_fee": "Shopee trợ giá VC", 
    "seller_voucher_code": "Mã giảm giá", 
    "fixed_fee": "Phí cố định",
    "service_fee": "Phí dịch vụ",
    "payment_fee": "Phí thanh toán",
    "commission_fee": "Phí hoa hồng", 
    "affiliate_marketing_fee": "Phí tiếp thị liên kết", 
    "buyer_username": "Người mua" 
}

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
            st.rerun()
    else:
        st.info("Chưa có brand nào.")
    
    st.write("---")
    with st.form("new_brand_form"):
        new_brand_name = st.text_input("Hoặc tạo Brand mới")
        if st.form_submit_button("Tạo Brand") and new_brand_name:
            if create_brand(new_brand_name): st.rerun()

# --- TRANG DASHBOARD ---
elif st.session_state.page == 'dashboard':
    brand_id = st.session_state.selected_brand_id
    brand_data = get_brand_details(brand_id)

    if brand_data:
        st.title(f"Dashboard cho Brand: {brand_data['name']}")
        if st.button("◀️ Quay lại danh sách Brand"):
            st.session_state.page = 'brand_lobby'; st.rerun()
        
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
        # TÍNH TOÁN CÁC CHỈ SỐ
        orders = brand_data.get('orders', [])
        customers = brand_data.get('customers', [])
        shopee_ads = brand_data.get('shopee_ads', [])
        shopee_revenues = brand_data.get('shopee_revenues', [])

        # Chỉ số từ đơn hàng và khách hàng
        total_orders = len(orders)
        cancelled_orders = len([o for o in orders if o['status'] == 'Đã hủy'])
        total_customers = len(customers)
        cancellation_rate = (cancelled_orders / total_orders * 100) if total_orders > 0 else 0

        # Chỉ số từ dữ liệu mới (Quảng cáo và Doanh thu)
        total_ad_spend = sum(ad.get('expense', 0) for ad in shopee_ads)
        total_gmv_from_ads = sum(ad.get('gmv', 0) for ad in shopee_ads)
        total_revenue_payment = sum(rev.get('total_payment', 0) for rev in shopee_revenues)

        # HIỂN THỊ CÁC CHỈ SỐ
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("Tổng đơn hàng", f"{total_orders:,}")
            st.metric("Tổng chi phí QC", f"{total_ad_spend:,.0f} ₫")
        with col2:
            st.metric("Số đơn hủy", f"{cancelled_orders:,}")
            st.metric("Doanh thu từ QC (GMV)", f"{total_gmv_from_ads:,.0f} ₫")
        with col3:
            st.metric("Tỷ lệ hủy", f"{cancellation_rate:.2f}%")
            st.metric("Tổng doanh thu thực nhận", f"{total_revenue_payment:,.0f} ₫")
        with col4:
            st.metric("Tổng khách hàng", f"{total_customers:,}")
            # Tính ROAS tổng
            overall_roas = (total_gmv_from_ads / total_ad_spend) if total_ad_spend > 0 else 0
            st.metric("ROAS Tổng", f"{overall_roas:.2f}")

        # --- HIỂN THỊ DỮ LIỆU MỚI (DẠNG BẢNG) ---
        st.header("📋 Dữ liệu Vừa Import")
        tab1, tab2 = st.tabs(["Dữ liệu Quảng cáo", "Dữ liệu Doanh thu"])

        with tab1:
            if brand_data.get('shopee_ads'):
                df_ads = pd.DataFrame(brand_data['shopee_ads'])
                
                # Định nghĩa cách hiển thị cho từng cột
                column_config_ads = {
                    "campaign_name": st.column_config.TextColumn("Tên Chiến dịch"),
                    "start_date": st.column_config.DateColumn("Ngày bắt đầu", format="DD/MM/YYYY"),
                    "impressions": st.column_config.NumberColumn("Lượt xem", format="%d"),
                    "clicks": st.column_config.NumberColumn("Lượt click", format="%d"),
                    "ctr": st.column_config.NumberColumn("CTR (%)", format="%.2f%%"),
                    "conversions": st.column_config.NumberColumn("Chuyển đổi", format="%d"),
                    "items_sold": st.column_config.NumberColumn("Sản phẩm bán được", format="%d"),
                    "gmv": st.column_config.NumberColumn("Doanh thu (GMV)", format="%d đ"),
                    "expense": st.column_config.NumberColumn("Chi phí", format="%d đ"),
                    "roas": st.column_config.NumberColumn("ROAS", format="%.2f"),
                    "direct_roas": st.column_config.NumberColumn("ROAS Trực tiếp", format="%.2f"),
                    "acos": st.column_config.NumberColumn("ACOS (%)", format="%.2f%%"),
                    "direct_acos": st.column_config.NumberColumn("ACOS Trực tiếp (%)", format="%.2f%%"),
                    "product_impressions": st.column_config.NumberColumn("Lượt xem SP", format="%d"),
                    "product_clicks": st.column_config.NumberColumn("Lượt click SP", format="%d"),
                    "product_ctr": st.column_config.NumberColumn("CTR SP (%)", format="%.2f%%"),
                }
                
                st.dataframe(df_ads, column_config=column_config_ads, use_container_width=True,
                            # Ẩn các cột không cần thiết
                            hide_index=True, column_order=list(column_config_ads.keys()))
            else:
                st.info("Chưa có dữ liệu quảng cáo.")

        with tab2:
            if brand_data.get('shopee_revenues'):
                df_revenue = pd.DataFrame(brand_data['shopee_revenues'])

                # Định nghĩa cách hiển thị cho từng cột
                column_config_revenue = {
                    "order_code": "Mã đơn hàng",
                    "order_date": st.column_config.DateColumn("Ngày đặt hàng", format="DD/MM/YYYY"),
                    "payment_completed_date": st.column_config.DateColumn("Ngày thanh toán", format="DD/MM/YYYY"),
                    "total_payment": st.column_config.NumberColumn("Tổng thanh toán", format="%d đ"),
                    "product_price": st.column_config.NumberColumn("Giá sản phẩm", format="%d đ"),
                    "refund_amount": st.column_config.NumberColumn("Tiền hoàn lại", format="%d đ"),
                    "shipping_fee": st.column_config.NumberColumn("Phí vận chuyển", format="%d đ"),
                    "buyer_paid_shipping_fee": st.column_config.NumberColumn("Phí VC người mua trả", format="%d đ"),
                    "actual_shipping_fee": st.column_config.NumberColumn("Phí VC thực tế", format="%d đ"),
                    "shopee_subsidized_shipping_fee": st.column_config.NumberColumn("Shopee trợ giá VC", format="%d đ"),
                    "seller_voucher_code": "Mã giảm giá",
                    "fixed_fee": st.column_config.NumberColumn("Phí cố định", format="%d đ"),
                    "service_fee": st.column_config.NumberColumn("Phí dịch vụ", format="%d đ"),
                    "payment_fee": st.column_config.NumberColumn("Phí thanh toán", format="%d đ"),
                    "commission_fee": st.column_config.NumberColumn("Phí hoa hồng", format="%d đ"),
                    "affiliate_marketing_fee": st.column_config.NumberColumn("Phí tiếp thị liên kết", format="%d đ"),
                    "buyer_username": "Người mua"
                }
                
                st.dataframe(df_revenue, column_config=column_config_revenue, use_container_width=True,
                            hide_index=True, column_order=list(column_config_revenue.keys()))
            else:
                st.info("Chưa có dữ liệu doanh thu.")