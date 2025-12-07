
def check_logic(source_list):
    is_fetching_all = False
    print(f"Testing input: {source_list} (Type: {type(source_list)})")

    if source_list is None:
        print("  -> Case: None")
        is_fetching_all = True
    elif isinstance(source_list, list):
        if len(source_list) == 0:
            print("  -> Case: Empty List")
            is_fetching_all = False 
        else:
            # Logic thực tế trong crud.py
            is_containing_all_keyword = any(str(s).lower() == 'all' for s in source_list)
            print(f"  -> Contains 'all' keyword? {is_containing_all_keyword}")
            if is_containing_all_keyword:
                is_fetching_all = True
    elif isinstance(source_list, str) and source_list.lower() == 'all':
        print("  -> Case: String 'all'")
        is_fetching_all = True
    
    print(f"  => RESULT: is_fetching_all = {is_fetching_all}\n")

# Các trường hợp test giả định
check_logic(['tiktok'])
check_logic(['TikTok'])
check_logic(['all'])
check_logic(['tiktok', 'all'])
check_logic([])
check_logic(None)
