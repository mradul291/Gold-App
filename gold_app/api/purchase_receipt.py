import frappe
from erpnext.stock.doctype.purchase_receipt.purchase_receipt import make_purchase_invoice
from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry

# Updating Item on the Basis of Price Updated in PR
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

# @frappe.whitelist()
# def create_invoice_and_payment(doc, method):
#     doc = frappe.get_doc("Purchase Receipt", doc.name)

#     # ---- Step 1: Create Purchase Invoice ----
#     pi = make_purchase_invoice(doc.name)
#     pi.supplier_invoice_date = doc.posting_date

#     # Update custom payment mode from Purchase Receipt
#     pi.custom_payment_mode = doc.payment_method

#     pi.flags.ignore_permissions = True
#     pi.insert()
#     pi.submit()

#     doc.db_set("purchase_invoice_ref", pi.name)

#     # ---- Step 2: Create Payment Entry ----
#     if doc.payment_method == "Cash":
#         # Cash Flow
#         pe = get_payment_entry("Purchase Invoice", pi.name)
#         pe.mode_of_payment = "Cash"

#         cash_account = frappe.db.get_value(
#             "Mode of Payment Account",
#             {"parent": "Cash", "company": pe.company},
#             "default_account"
#         )
#         if cash_account:
#             pe.paid_from = cash_account
#         else:
#             frappe.throw("No Cash account found for company {0}".format(pe.company))

#         pe.flags.ignore_permissions = True
#         pe.insert()
#         pe.submit()

#         doc.db_set("payment_entry_ref", pe.name)

#     elif doc.payment_method == "Bank Transfer":
#         # Bank Transfer Flow
#         pe = get_payment_entry("Purchase Invoice", pi.name)
#         pe.mode_of_payment = "Bank Draft"

#         if not doc.bank_reference_no:
#             frappe.throw("Bank Reference No is required for Bank Transfer")

#         pe.reference_no = doc.bank_reference_no
#         pe.reference_date = doc.posting_date

#         pe.flags.ignore_permissions = True
#         pe.insert()
#         pe.submit()

#         doc.db_set("payment_entry_ref", pe.name)

#     frappe.db.commit()



@frappe.whitelist()
def create_invoice_and_payment(doc, method):
    doc = frappe.get_doc("Purchase Receipt", doc.name)

    # ---- Step 1: Create Purchase Invoice ----
    pi = make_purchase_invoice(doc.name)
    pi.supplier_invoice_date = doc.posting_date
    pi.custom_payment_mode = doc.payment_method

    pi.flags.ignore_permissions = True
    pi.insert()
    pi.submit()

    doc.db_set("purchase_invoice_ref", pi.name)

    # ---- Step 2: Handle Payments ----
    if doc.payment_method == "Cash":
        _create_payment_entry(doc, pi, mode="Cash")

    elif doc.payment_method == "Bank Transfer":
        if not doc.bank_reference_no:
            frappe.throw("Bank Reference No is required for Bank Transfer")

        _create_payment_entry(
            doc, pi, mode="Bank Draft",
            reference_no=doc.bank_reference_no,
            reference_date=doc.posting_date
        )

    elif doc.payment_method == "Mix":
        if not doc.payment_split:
            frappe.throw("Payment Split table is required for Mix payment method")
            
         # --- Validation: Ensure split total matches Purchase Receipt total ---
        split_total = sum([row.amount for row in doc.payment_split])
        if split_total != doc.grand_total:
            frappe.throw(
                f"Payment Split total ({split_total}) must match Purchase Receipt total ({doc.grand_total})"
            )

        for row in doc.payment_split:
            if row.mode_of_payment == "Cash":
                _create_payment_entry(doc, pi, mode="Cash", amount=row.amount)

            elif row.mode_of_payment == "Bank Transfer":
                if not row.reference_no:
                    frappe.throw("Reference No is required for Bank Transfer in split row")

                _create_payment_entry(
                    doc, pi, mode="Bank Draft",
                    amount=row.amount,
                    reference_no=row.reference_no,
                    reference_date=row.reference_date or doc.posting_date
                )

    frappe.db.commit()


def _create_payment_entry(doc, pi, mode, amount=None, reference_no=None, reference_date=None):
    """Helper to create Payment Entry"""
    pe = get_payment_entry("Purchase Invoice", pi.name)
    pe.mode_of_payment = mode

    # Override paid amount if Mix row specifies
    if amount:
        pe.paid_amount = amount
        pe.received_amount = amount

        # Fix: Update allocation in references child table
        for ref in pe.references:
            if ref.reference_name == pi.name:
                ref.allocated_amount = amount

    # Handle Cash account linking
    if mode == "Cash":
        cash_account = frappe.db.get_value(
            "Mode of Payment Account",
            {"parent": "Cash", "company": pe.company},
            "default_account"
        )
        if cash_account:
            pe.paid_from = cash_account
        else:
            frappe.throw("No Cash account found for company {0}".format(pe.company))

    # Handle Bank Reference
    if mode == "Bank Draft":
        pe.reference_no = reference_no
        pe.reference_date = reference_date

    pe.flags.ignore_permissions = True
    pe.insert()
    pe.submit()

    # Store last Payment Entry reference on Purchase Receipt
    # Store last Payment Entry reference(s) on Purchase Receipt
    existing_refs = []

    if doc.payment_entry_ref:
        existing_refs = doc.payment_entry_ref.split(",")
        
    if pe.name not in existing_refs:  # avoid duplicates
        existing_refs.append(pe.name)
        doc.db_set("payment_entry_ref", ",".join(existing_refs))
    else:
        doc.db_set("payment_entry_ref", pe.name)

