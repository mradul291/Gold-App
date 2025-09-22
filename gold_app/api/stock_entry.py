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

# def validate_break_item_qty(doc, method):
#     """Ensure child qty never exceeds source item qty"""
#     if doc.stock_entry_type != "Break Item":
#         return

#     source_qty = doc.item_quantity or 0   # total available source qty
#     child_total = 0

#     for row in doc.items or []:
#         if row.item_code != doc.source_item:
#             child_total += flt(row.qty)

#     if child_total > source_qty:
#         frappe.throw(
#             _("The total weight of new items ({0} gm) cannot exceed the available Mixed Gold weight ({1} gm).")
#             .format(child_total, source_qty)
#         )

#     # If less, that’s fine — balance remains in stock
#     remaining = source_qty - child_total
#     doc.remaining_quantity = remaining
#     frappe.msgprint(_("Updated balance: {0} gm of Mixed Gold remaining").format(remaining))

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
        # Create Material Transfer for remaining qty if > 0
#     if doc.remaining_quantity and doc.remaining_quantity > 0:
#         frappe.enqueue(
#             create_material_transfer,
#             queue="long",
#             doc_name=doc.name,
#             source_item=doc.source_item,
#             qty=doc.remaining_quantity,
#             source_wh=doc.source_item_warehouse,
#             target_wh="Bag 1 - Wholesale - AGSB"
#         )
        
# def create_material_transfer(doc_name, source_item, qty, source_wh, target_wh):
#     try:
#         se_transfer = frappe.new_doc("Stock Entry")
#         se_transfer.stock_entry_type = "Material Transfer"
#         se_transfer.append("items", {
#             "item_code": source_item,
#             "qty": qty,
#             "s_warehouse": source_wh,
#             "t_warehouse": target_wh,
#             "allow_zero_valuation_rate": 1
#         })
#         se_transfer.insert(ignore_permissions=True)
#         se_transfer.submit()

#         frappe.logger("gold_app").info(
#             f"[Break Item] Material Transfer created for {doc_name}: {se_transfer.name}"
#         )

#     except Exception as e:
#         frappe.logger("gold_app").error(
#             f"[Break Item] Failed to create Material Transfer for {doc_name}: {e}"
#         )

