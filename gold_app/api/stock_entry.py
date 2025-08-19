import frappe
from frappe import _
from frappe.utils import flt

@frappe.whitelist()
def get_item_stock_info(item_code):
    """Fetch latest warehouse, available qty, and valuation rate for the given item."""
    if not item_code:
        return {}

    latest_sle = frappe.db.get_value(
        "Stock Ledger Entry",
        {"item_code": item_code},
        ["warehouse", "valuation_rate"],
        order_by="posting_date desc, posting_time desc",
        as_dict=True
    )

    qty = 0
    if latest_sle and latest_sle.warehouse:
        qty = frappe.db.get_value(
            "Bin",
            {"item_code": item_code, "warehouse": latest_sle.warehouse},
            "actual_qty"
        ) or 0

    return {
        "warehouse": latest_sle.warehouse if latest_sle else None,
        "qty": qty,
        "valuation_rate": latest_sle.valuation_rate if latest_sle else 0
    }

def set_zero_valuation_flag(doc, method):
    for d in doc.items or []:
        d.allow_zero_valuation_rate = 1


def validate_break_item_qty(doc, method):
    """Ensure child qty never exceeds source item qty"""
    if doc.stock_entry_type != "Break Item":
        return

    source_qty = doc.item_quantity or 0   # total available source qty
    child_total = 0

    for row in doc.items or []:
        if row.item_code != doc.source_item:
            child_total += flt(row.qty)

    if child_total > source_qty:
        frappe.throw(
            _("Total child weight ({0}) cannot exceed Source Item weight ({1}).")
            .format(child_total, source_qty)
        )

    # If less, that’s fine — balance remains in stock
    remaining = source_qty - child_total
    frappe.msgprint(_("Remaining source weight will be {0} gm.").format(remaining))


def create_material_issue(doc, method):
    if doc.stock_entry_type != "Break Item":
        return

    # Ensure required data exists
    if not doc.source_item or not doc.source_item_warehouse or not doc.reduce_quantity:
        frappe.throw(_("Source Item, Source Item Warehouse and Reduce Weight are required."))

    # Create Material Issue
    se = frappe.new_doc("Stock Entry")
    se.stock_entry_type = "Material Issue"

    se.append("items", {
        "item_code": doc.source_item,
        "qty": doc.reduce_quantity,
        "s_warehouse": doc.source_item_warehouse,
        "t_warehouse": None,
        "allow_zero_valuation_rate": 1
    })

    se.insert(ignore_permissions=True)
    se.submit()

    frappe.msgprint(_("Mixed Gold Weight reduced successfully. Stock Entry: {0}").format(se.name))
