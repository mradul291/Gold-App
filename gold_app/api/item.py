import frappe

# Set prefix for Item Group based on the code before " - "
def set_item_group_prefix(doc, method):
    if doc.item_code_prefix:
        return
    prefix = doc.item_group_name.split(" - ")[0].strip()
    doc.item_code_prefix = prefix

# Autoname Item using Item Group's prefix and incremented sequence
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
    prefix = frappe.db.get_value("Item Group", doc.item_group, "item_code_prefix")
    if not prefix:
        frappe.throw(f"Item Group '{doc.item_group}' has no Item Code Prefix. Please set it in Item Group.")

    # Get max numeric part safely
    last_number = frappe.db.sql("""
        SELECT MAX(CAST(SUBSTRING_INDEX(item_code, '-', -1) AS UNSIGNED)) AS max_number
        FROM `tabItem`
        WHERE item_code LIKE %s
    """, (f"{prefix}-%",), as_dict=True)[0].max_number or 0

    # Increment
    new_number = last_number + 1
    new_code = f"{prefix}-{new_number:03d}"

    # Double-check uniqueness
    if frappe.db.exists("Item", new_code):
        frappe.throw(f"Could not generate unique code for prefix {prefix}. Please try again.")

    doc.item_code = new_code
