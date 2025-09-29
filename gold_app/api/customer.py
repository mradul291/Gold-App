# supplier.py (or customer.py)
import frappe
from frappe.model.naming import make_autoname

def generate_unique_id(doc, method):
    """Generate unique ID for Supplier or Customer"""
    if not doc.id_number:
        prefix = "CUST-" if doc.doctype == "Customer" else "CUST-"
        doc.id_number = make_autoname(f"{prefix}.####")
        
def autoname_customer(doc, method):
    doc.name = make_autoname("CUST-.####") 

def validate_unique_id(doc, method):
    """Ensure ID number is unique across records"""
    if doc.id_number:
        exists = frappe.db.exists(
            doc.doctype,
            {"id_number": doc.id_number, "name": ["!=", doc.name]}
        )
        if exists:
            frappe.throw(f"ID Number {doc.id_number} already exists.")
