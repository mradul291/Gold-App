import frappe
from frappe.utils import nowtime

def set_order_time(doc, method):
    time_fields = {
        "Sales Order": "so_time",
        "Purchase Order": "po_time",
        "Sales Invoice": "si_time",
        "Purchase Invoice": "pi_time"
    }

    fieldname = time_fields.get(doc.doctype)
    if fieldname and not doc.get(fieldname):
        doc.set(fieldname, nowtime())
