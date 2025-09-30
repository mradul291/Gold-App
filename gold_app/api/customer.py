import frappe
from frappe.model.naming import make_autoname

def autoname(doc, method):
    doc.name = make_autoname("CUS-.####")
