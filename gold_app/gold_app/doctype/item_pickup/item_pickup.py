import frappe
from frappe.model.document import Document
from frappe.desk.form.assign_to import add as add_assignment

class ItemPickup(Document):
	pass

def create_item_pickups(doc, method):
    """
    Before submitting Purchase Receipt, create Item Pickup entries
    for each item in the Purchase Receipt child table.
    """
    
    if doc.item_availability != "Item Not in Hand":
        return 
    
    created_entries = []
    
    for item in doc.items:
        pickup_doc = frappe.new_doc("Item Pickup")
        pickup_doc.dealer = doc.supplier
        pickup_doc.date = doc.posting_date
        pickup_doc.purchase_receipt = doc.name
        pickup_doc.item_code = item.item_code
        pickup_doc.purity = item.purity
        pickup_doc.total_weight = item.qty
        pickup_doc.avco_rate = item.rate
        pickup_doc.amount = item.amount
        pickup_doc.is_pickup = 0  # default unchecked

        # Save Item Pickup entry
        pickup_doc.insert(ignore_permissions=True)
        
        created_entries.append(pickup_doc.name)

    if created_entries:
        frappe.msgprint(
            msg=f"Item Pickup Entries created: {', '.join(created_entries)}",
            title="Item Pickup Created",
            indicator="green"
        )
        
        
# Auto Add Assign To from Custom Field       
def validate(doc, method):
    if doc.assigned_to:
        # First clear existing assignments for this document
        frappe.db.delete("ToDo", {
            "reference_type": doc.doctype,
            "reference_name": doc.name
        })

        # Create a new assignment
        add_assignment({
            "assign_to": [doc.assigned_to],
            "doctype": doc.doctype,
            "name": doc.name,
            "description": f"Assigned via Item Pickup field"
        })
