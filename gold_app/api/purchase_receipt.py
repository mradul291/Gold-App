# ------------------------------------------Purchase Receipt--------------------------------------------------------

import frappe
from erpnext.stock.doctype.purchase_receipt.purchase_receipt import make_purchase_invoice
from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry
from erpnext.accounts.party import get_party_account
from erpnext.controllers.accounts_controller import (
    get_advance_journal_entries,
    get_advance_payment_entries_for_regional,
)
from frappe.model.naming import make_autoname
from frappe.utils import nowdate, formatdate
from frappe.utils import flt, nowdate

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

# Auto-generate Bank Reference
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

# Fetch Supplier Advances in PR
@frappe.whitelist()
def get_supplier_advances_for_pr(supplier, company=None):

    if not company:
        company = frappe.defaults.get_user_default("Company")

    party_type = "Supplier"
    party = supplier
    amount_field = "debit_in_account_currency"
    order_doctype = "Purchase Order"
    order_list = []  # Purchase Receipt does not link orders here, keep empty

    # Get party account list: advance accounts included
    party_accounts = get_party_account(
        party_type, party=party, company=company, include_advance=True
    )

    party_account = []
    default_advance_account = None

    if party_accounts:
        party_account.append(party_accounts[0])  # supplier payable account
        if len(party_accounts) == 2:
            default_advance_account = party_accounts[1]

    # Fetch Advances from Journal Entries
    journal_entries = get_advance_journal_entries(
        party_type, party, party_account, amount_field,
        order_doctype, order_list, include_unallocated=True
    )

    # Fetch Advances from Payment Entries
    payment_entries = get_advance_payment_entries_for_regional(
        party_type, party, party_account,
        order_doctype, order_list, default_advance_account,
        include_unallocated=True
    )

    result = []
    for d in journal_entries + payment_entries:
        row = {
            "reference_type": d.reference_type,
            "reference_name": d.reference_name,
            "reference_row": d.reference_row,
            "remarks": d.remarks,
            "advance_amount": flt(d.amount),
            "allocated_amount": 0,
            "ref_exchange_rate": flt(d.exchange_rate),
            "difference_posting_date": nowdate(),
        }

        if d.get("paid_from"):
            row["account"] = d.paid_from
        if d.get("paid_to"):
            row["account"] = d.paid_to

        result.append(row)

    return result


# Validations on PR for Payment Methods
def validate_payment_split(doc, method):
    if doc.payment_method != "Mix":
        return

    if not doc.payment_split:
        frappe.throw("Payment Split table is required for Mix payment method")

    split_total = sum(flt(row.amount or 0) for row in doc.payment_split)

    if split_total != flt(doc.grand_total):
        frappe.throw(
            f"Total of Payment Split ({split_total}) must equal Purchase Receipt Grand Total ({doc.grand_total})."
        )

# Push Advances from PR to PI
def _push_advances_into_purchase_invoice(doc, pi):
    """Copy allocated advances from Purchase Receipt into Purchase Invoice advances table."""
    pi.set("advances", [])

    for adv in doc.supplier_advances:
        if flt(adv.allocated_amount) > 0:

            pi.append("advances", {
                "reference_type": adv.reference_type,
                "reference_name": adv.reference_name,
                "reference_row": adv.reference_row,
                "remarks": adv.remarks,
                "advance_amount": flt(adv.advance_amount),
                "allocated_amount": flt(adv.allocated_amount),
                "ref_exchange_rate": flt(adv.ref_exchange_rate),
                "difference_posting_date": adv.difference_posting_date,
            })

    pi.save()

# 2. Invoice & Payment Creation
@frappe.whitelist()
def create_invoice_and_payment(doc, method):
    doc = frappe.get_doc("Purchase Receipt", doc.name)

    # ---- Step 1: Create Purchase Invoice ----
    pi = make_purchase_invoice(doc.name)
    pi.supplier_invoice_date = doc.posting_date
    pi.custom_payment_mode = doc.payment_method
    
    pi.allocate_advances_automatically = 0
    
    pi.flags.ignore_permissions = True
    pi.insert()
    
    # Apply customer advance manually to PI references
    _push_advances_into_purchase_invoice(doc, pi)

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

# 3. Helper: Payment Entry
def _create_payment_entry(doc, pi, mode, amount=None, reference_no=None, reference_date=None):
    """Helper to create Payment Entry"""

    pe = get_payment_entry("Purchase Invoice", pi.name)
    pe.mode_of_payment = mode

    # If specific amount is passed (Mix), override; else use default from get_payment_entry
    if amount is not None:
        if float(amount) == 0.0:
            return  # do not create zero-amount PE

        pe.paid_amount = amount
        pe.received_amount = amount

        # Update allocation in references child table
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

