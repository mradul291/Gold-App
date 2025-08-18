import frappe

# Set prefix for Item Group based on the code before " - "
def set_item_group_prefix(doc, method):
    if doc.item_code_prefix:
        return
    prefix = doc.item_group_name.split(" - ")[0].strip()
    doc.item_code_prefix = prefix

# Autoname Item using Item Group's prefix and incremented sequence
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
