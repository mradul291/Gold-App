import frappe
from frappe.utils import flt

@frappe.whitelist()
def get_item_stock_info(item_code):
    """Fetch latest warehouse and available qty for the given item."""
    if not item_code:
        return {}

    # Get latest warehouse from Stock Ledger Entry
    latest_warehouse = frappe.db.get_value(
        "Stock Ledger Entry",
        {"item_code": item_code},
        "warehouse",
        order_by="posting_date desc, posting_time desc"
    )

    qty = 0
    if latest_warehouse:
        qty = frappe.db.get_value(
            "Bin",
            {"item_code": item_code, "warehouse": latest_warehouse},
            "actual_qty"
        ) or 0

    return {
        "warehouse": latest_warehouse,
        "qty": qty
    }


def set_zero_valuation_flag(doc, method):
    for d in doc.items or []:
        d.allow_zero_valuation_rate = 1
