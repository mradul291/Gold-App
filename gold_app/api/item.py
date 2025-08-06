import frappe
from frappe.utils import flt

PREFIX_MAP = {
    "Cincin": "C",
    "Rantai Leher": "RL",
    "Rantai Tangan": "RT",
    "Gelang Tangan": "GT",
    "Loket": "L",
    "Gold Bar": "GB"
}

def autoname(doc, method):
    # Fetch the plain item group name without the prefix
    item_group_name = doc.item_group.split(" - ")[-1] if " - " in doc.item_group else doc.item_group

    prefix = PREFIX_MAP.get(item_group_name)
    if not prefix:
        frappe.throw(f"Item Group '{doc.item_group}' not recognized for auto-naming.")

    # Find last used item_code with the same prefix
    last_item = frappe.db.sql("""
        SELECT item_code FROM `tabItem`
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
    doc.item_code = f"{prefix}-{new_number:03d}"
