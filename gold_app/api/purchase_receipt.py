import frappe
from erpnext.stock.doctype.purchase_receipt.purchase_receipt import make_purchase_invoice
from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry
from frappe.model.naming import make_autoname
from frappe.utils import nowdate, formatdate

def autoname(doc, method):
    # Custom format: PUR-DDMMYY-RUNNINGNUMBER
    today = formatdate(nowdate(), "ddMMyy")
    doc.name = make_autoname(f"PUR-{today}-.####")

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

# Validations on PR for Payment Methods
def validate_payment_split(doc, method):
    """Ensure Mix payment split totals are valid before submit"""
    if doc.payment_method == "Mix":
        if not doc.payment_split:
            frappe.throw("Payment Split table is required for Mix payment method")

        split_total = sum([row.amount for row in doc.payment_split])
        if split_total != doc.grand_total:
            frappe.throw(
                f"Payment Split total ({split_total}) must match Purchase Receipt total ({doc.grand_total})"
            )

# -----------------------------
# 1. Auto-generate Bank Reference
# -----------------------------
def set_bank_reference_code(doc, method):
    """Auto-generate or update Bank Reference Code for PR"""
    if doc.payment_method == "Bank Transfer":
        # Always regenerate
        doc.bank_reference_no = f"BELI EMAS - RM{int(doc.grand_total or 0)}"
    elif doc.payment_method == "Mix":
        # Loop through child table rows
        for row in doc.payment_split:
            if row.mode_of_payment == "Bank Transfer":
                if not row.reference_no:  # only set if empty
                    row.reference_no = f"BELI EMAS - RM{int(row.amount or 0)}"
                if not row.reference_date:
                    row.reference_date = doc.posting_date
    else:
        doc.bank_reference_no = None

# -----------------------------
# 2. Invoice & Payment Creation
# -----------------------------
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
        for row in doc.payment_split:
            if row.mode_of_payment == "Cash":
                _create_payment_entry(doc, pi, mode="Cash", amount=row.amount)

            elif row.mode_of_payment == "Bank Transfer":
                # Ensure reference is set (auto from before_save hook)
                if not row.reference_no:
                    frappe.throw("Reference No is required for Bank Transfer in split row")

                _create_payment_entry(
                    doc, pi, mode="Bank Draft",
                    amount=row.amount,
                    reference_no=row.reference_no,
                    reference_date=row.reference_date or doc.posting_date
                )

    frappe.db.commit()

# -----------------------------
# 3. Helper: Payment Entry
# -----------------------------
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

    # Store last Payment Entry reference(s) on Purchase Receipt
    existing_refs = []
    if doc.payment_entry_ref:
        existing_refs = doc.payment_entry_ref.split(",")

    if pe.name not in existing_refs:  # avoid duplicates
        existing_refs.append(pe.name)

    doc.db_set("payment_entry_ref", ",".join(existing_refs))

# Show Customer Id Numbers as Option and Auto Select Customer field
@frappe.whitelist()
def get_suppliers_with_id(txt=None):
    suppliers = frappe.get_all(
        "Supplier",
        filters={"name": ["like", f"%{txt}%"]},
        fields=["name", "supplier_name", "id_number"],
        limit=20
    )
    return [
        {
            "label": f"{d.id_number} - {d.supplier_name}",
            "value": d.id_number,       # what goes in supplier_id_number
            "supplier_name": d.supplier_name,
            "supplier_id": d.name       # actual link value for Supplier field
        }
        for d in suppliers
    ]
    