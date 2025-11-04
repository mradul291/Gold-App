import frappe
from frappe.model.document import Document

class Purity(Document):
    pass

def create_item_for_purity(doc, method):
    
    try:
        purity_name = doc.name.strip()
        item_code = f"Unsorted-{purity_name}"

        # Check if item already exists
        existing_item = frappe.db.exists("Item", {"item_code": item_code})
        if existing_item:
            frappe.logger().info(f"Item already exists for purity {purity_name}")
            return

        # Create new Item
        item = frappe.get_doc({
            "doctype": "Item",
            "item_code": item_code,
            "item_name": item_code,
            "item_group": "MG - Mixed Gold",  # optional, adjust as needed
            "stock_uom": "Gram",              # or "Gram", depending on your business use
            "is_stock_item": 1,
            # Assuming you have a 'purity' field in Item Doctype
            "purity": purity_name
        })

        item.insert(ignore_permissions=True)
        frappe.db.commit()
        frappe.logger().info(f"Item created successfully for purity {purity_name}")

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), f"Error creating item for purity {doc.name}")
        frappe.throw(f"Unable to create Item for purity: {str(e)}")
