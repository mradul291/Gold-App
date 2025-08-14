import frappe

# Set prefix for Item Group based on the code before " - "
def set_item_group_prefix(doc, method):
    if doc.item_code_prefix:
        return
    prefix = doc.item_group_name.split(" - ")[0].strip()
    doc.item_code_prefix = prefix

# # Autoname Item using Item Group's prefix and incremented sequence
# def autoname(doc, method):
#     item_group_name = doc.item_group.split(" - ")[-1] if " - " in doc.item_group else doc.item_group
#     prefix = frappe.db.get_value("Item Group", {"item_group_name": doc.item_group}, "item_code_prefix")
#     if not prefix:
#         frappe.throw(f"Item Group '{doc.item_group}' has no Item Code Prefix. Please set it in Item Group.")
#     last_item = frappe.db.sql("""
#         SELECT item_code FROM `tabItem`
#         WHERE item_code LIKE %s
#         ORDER BY LENGTH(item_code) DESC, item_code DESC
#         LIMIT 1
#     """, (f"{prefix}-%",), as_dict=True)
#     if last_item:
#         try:
#             last_number = int(last_item[0]["item_code"].split("-")[1])
#         except:
#             last_number = 0
#     else:
#         last_number = 0
#     new_number = last_number + 1
#     doc.item_code = f"{prefix}-{new_number:03d}"


def autoname(doc, method):
    # Get prefix from Item Group
    prefix = frappe.db.get_value("Item Group", {"name": doc.item_group}, "item_code_prefix")
    if not prefix:
        frappe.throw(f"Item Group '{doc.item_group}' has no Item Code Prefix. Please set it.")

    # Try generating unique item code
    for attempt in range(5):  # retry up to 5 times in case of concurrency
        last_item = frappe.db.sql("""
            SELECT item_code 
            FROM `tabItem`
            WHERE item_code LIKE %s
            ORDER BY LENGTH(item_code) DESC, item_code DESC
            LIMIT 1
        """, (f"{prefix}-%",), as_dict=True)

        if last_item:
            try:
                last_number = int(last_item[0]["item_code"].split("-")[1])
            except:
                last_number = 0
        else:
            last_number = 0

        new_number = last_number + 1
        new_code = f"{prefix}-{new_number:03d}"

        if not frappe.db.exists("Item", new_code):
            doc.item_code = new_code
            return

    frappe.throw(f"Could not generate unique code for prefix {prefix}. Please try again.")