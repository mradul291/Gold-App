import frappe
from frappe.utils import flt

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

@frappe.whitelist()
def create_item_from_group(item_group, valuation_rate=None):
  
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

@frappe.whitelist()
def bulk_create_items(rows):
    import json
    rows = json.loads(rows) if isinstance(rows, str) else rows
    created_items = []
    for r in rows:
        if not r.get("item_group"):
            continue
        item = create_item_from_group(r["item_group"], r.get("valuation_rate", 0))
        created_items.append({"item_code": item["item_code"]})
    return created_items
