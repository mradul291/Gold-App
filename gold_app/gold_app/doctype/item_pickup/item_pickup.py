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

# Create Credit Note if Discripancy Found
def on_update(doc, method):
    """
    Triggered on Item Pickup save/update.
    Creates Credit Note automatically if discrepancy_action = Refund Request.
    """
    if doc.discrepancy_action == "Refund Request (ie. Credit Note)":
        # Prevent duplicate credit note logs for the same Item Pickup
        existing_log = frappe.db.exists("Credit Note", {"item_pickup": doc.name})
        if existing_log:
            frappe.logger().info(f"Credit Note already exists for {doc.name}")
            return

        # Create new Credit Note document
        credit_note = frappe.new_doc("Credit Note")
        credit_note.item_pickup = doc.name
        credit_note.dealer = doc.dealer
        credit_note.date = doc.date
        credit_note.item_code = doc.item_code
        credit_note.purity = doc.purity
        credit_note.purchase_receipt = doc.purchase_receipt
        credit_note.total_weight = doc.total_weight
        credit_note.avco_rate = doc.avco_rate
        credit_note.amount = doc.amount
        credit_note.discrepancy_action = doc.discrepancy_action
        credit_note.discrepancy_amount = doc.discrepancy_amount
        credit_note.status = "Draft"
        credit_note.remarks = doc.discrepancy_note
        
        credit_note.insert(ignore_permissions=True)

        frappe.logger().info(f"Credit Note created for Item Pickup {doc.name}")
