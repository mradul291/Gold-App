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
            _("The total weight of new items ({0} gm) cannot exceed the available Mixed Gold weight ({1} gm).")
            .format(child_total, source_qty)
        )

    # If less, that’s fine — balance remains in stock
    remaining = source_qty - child_total
    doc.remaining_quantity = remaining
    frappe.msgprint(_("Updated balance: {0} gm of Mixed Gold remaining").format(remaining))

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

    frappe.msgprint(_("Mixed Gold weight has been updated successfully. Stock Entry: {0}").format(se.name))

@frappe.whitelist()
def update_item_from_stock_entry(doc, method):
    """
    On submit of Stock Entry, update Item master with
    purity and item_length from Stock Entry Detail child table.
    """
    for row in doc.items:
        if not row.item_code:
            continue

        update_data = {}

        # Update purity if present
        if getattr(row, "purity", None):
            update_data["purity"] = row.purity

        # Update item_length if present
        if getattr(row, "item_length", None):
            update_data["item_length"] = row.item_length

        # Only update if we have data to set
        if update_data:
            frappe.db.set_value("Item", row.item_code, update_data)

    frappe.db.commit()
