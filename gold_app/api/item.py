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


# @frappe.whitelist()
# def create_item_from_group(item_group):
#     """Create a new Item using autoname logic based on given Item Group and return item_code."""
#     if not item_group:
#         frappe.throw("Item Group is required")

#     # Create and insert new item
#     new_item = frappe.new_doc("Item")
#     new_item.item_group = item_group
#     new_item.item_name = item_group  # or you can set a better name if required
#     new_item.stock_uom = "Gram"
#     new_item.insert(ignore_permissions=True)

#     return {"item_code": new_item.item_code}


import frappe
from frappe.utils import flt

@frappe.whitelist()
def create_item_from_group(item_group, valuation_rate=None):
    """
    Auto-create an Item for a given Item Group using prefix-based autoname
    and optionally set its valuation rate.
    """
    if not item_group:
        frappe.throw("Item Group is required to create an Item")

    # Create the Item (autoname will handle item_code generation)
    new_item = frappe.new_doc("Item")
    new_item.item_group = item_group
    new_item.stock_uom = "Gram"
    new_item.insert(ignore_permissions=True)

    # If valuation_rate is provided, create a Valuation Rate entry for this Item
    if valuation_rate is not None:
        # Ensure numeric value
        valuation_rate = flt(valuation_rate)
        if valuation_rate > 0:
            frappe.get_doc({
                "doctype": "Item Price",
                "price_list": "Standard Buying",
                "item_code": new_item.item_code,
                "price_list_rate": valuation_rate,
                "currency": frappe.db.get_default("currency") or "INR"
            }).insert(ignore_permissions=True)

    return {
        "item_code": new_item.item_code,
        "item_name": new_item.item_name
    }
