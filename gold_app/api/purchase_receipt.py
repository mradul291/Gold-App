import frappe
from erpnext.stock.doctype.purchase_receipt.purchase_receipt import make_purchase_invoice
from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry

def update_item_from_receipt(doc, method):
    """
    On submit of Purchase Receipt, update Item master
    with purity and valuation_rate.
    """
    for row in doc.items:
        if not row.item_code:
            continue

        # update item fields
        frappe.db.set_value(
            "Item", 
            row.item_code, 
            {
                "purity": row.purity or None,
                "valuation_rate": row.rate or 0
            }
        )

    frappe.db.commit()

@frappe.whitelist()
def create_invoice_and_payment(doc, method):
    doc = frappe.get_doc("Purchase Receipt", doc.name)

    # ---- Step 1: Create Purchase Invoice ----
    pi = make_purchase_invoice(doc.name)
    pi.supplier_invoice_date = doc.posting_date
    pi.flags.ignore_permissions = True
    pi.insert()
    pi.submit()

    doc.db_set("purchase_invoice_ref", pi.name)

    # ---- Step 2: Create Payment Entry ----
    pe = get_payment_entry("Purchase Invoice", pi.name)
    pe.mode_of_payment = "Cash"

    cash_account = frappe.db.get_value(
        "Mode of Payment Account",
        {"parent": "Cash", "company": pe.company},
        "default_account"
    )
    if cash_account:
        pe.paid_from = cash_account
    else:
        frappe.throw("No Cash account found for company {0}".format(pe.company))

    pe.flags.ignore_permissions = True
    pe.insert()
    pe.submit()

    doc.db_set("payment_entry_ref", pe.name)

    frappe.db.commit()
