import frappe
from frappe.model.document import Document

class Purity(Document):
    pass

def update_purity_totals(purity_name):
    """Recalculate totals for a given purity"""
    items = frappe.get_all(
        "Item",
        filters={"purity": purity_name},
        fields=["weight_per_unit", "valuation_rate"]
    )
    
    if not items:
        return

    total_weight = sum([i.weight_per_unit or 0 for i in items])
    avg_avco = (
        sum([i.valuation_rate or 0 for i in items]) / len(items)
        if items else 0
    )
    total_price = total_weight * avg_avco

    purity_doc = frappe.get_doc("Purity", purity_name)
    purity_doc.weight_g = total_weight
    purity_doc.avco_rm_per_g = avg_avco
    purity_doc.price_rm = total_price
    purity_doc.save(ignore_permissions=True)
    frappe.db.commit()

def item_update_handler(doc, method):
    """Triggered on Item save/submit/update"""
    if doc.purity:
        update_purity_totals(doc.purity)
