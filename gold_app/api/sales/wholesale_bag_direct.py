import frappe
from frappe import _
from frappe.utils import flt
from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry
from frappe.utils import getdate, formatdate
from erpnext.accounts.party import get_party_account
from erpnext.controllers.accounts_controller import (
    get_advance_journal_entries,
    get_advance_payment_entries_for_regional,
)
from frappe.utils import nowdate

@frappe.whitelist()
def get_all_bag_overview():

    bag_rows = frappe.db.sql("""
        SELECT
            bin.warehouse AS bag_id,
            item.purity AS purity,
            SUM(bin.actual_qty) AS weight,
            AVG(bin.valuation_rate) AS rate,
            SUM(bin.actual_qty * bin.valuation_rate) AS amount
        FROM
            `tabBin` AS bin
        JOIN `tabItem` AS item 
            ON bin.item_code = item.name
        JOIN `tabWarehouse` AS wh
            ON wh.name = bin.warehouse
        WHERE
            wh.parent_warehouse = 'Wholesale - AGSB'
        GROUP BY 
            bin.warehouse, item.purity
        HAVING 
            SUM(bin.actual_qty) > 0
    """, as_dict=True)

    # Organize per bag
    bags = {}
    for row in bag_rows:
        bag = bags.setdefault(row["bag_id"], {
            "bag_id": row["bag_id"],
            "bag_total": 0,
            "purities": []
        })
        bag["purities"].append({
            "purity": row["purity"],
            "weight": round(row["weight"], 2),
            "rate": round(row["rate"], 2)
        })
        bag["bag_total"] += float(row["amount"])

    bag_list = []
    for bag in bags.values():
        bag["bag_total"] = round(bag["bag_total"], 2)
        bag_list.append(bag)

    return bag_list

@frappe.whitelist(allow_guest=False)
def create_wholesale_bag_direct_sale(data):
    import json
    if isinstance(data, str):
        data = json.loads(data)

    try:
        customer = data.get("customer")

        # ----------------------------------------------------------
        #  FIXED FILTER → 100% correct syntax for Frappe 15
        #  Find existing open log (no invoice_ref)
        # ----------------------------------------------------------
        existing = frappe.get_all(
            "Wholesale Bag Direct Sale",
            filters={
                "customer": customer,
                "sales_invoice_ref": ["in", ["", None]]
            },
            fields=["name"],
            order_by="creation desc",
            limit_page_length=1
        )

        if existing:
            doc = frappe.get_doc("Wholesale Bag Direct Sale", existing[0].name)
        else:
            doc = frappe.new_doc("Wholesale Bag Direct Sale")

        # ------------------------------
        # Update Parent Fields
        # ------------------------------
        doc.naming_series = data.get('series')
        doc.customer_type = data.get('customer_type')
        doc.id_number = data.get('id_number')
        doc.posting_date = data.get('date')
        doc.customer = data.get('customer')
        doc.posting_time = data.get('posting_time')
        doc.payment_method = data.get('payment_method')
        doc.status = "Draft"

        # ------------------------------
        # Totals
        # ------------------------------
        doc.total_weight_sold = data.get('total_weight_sold')
        doc.total_avco_cost = data.get('total_avco_cost')
        doc.total_discount = data.get('total_discount')
        doc.total_selling_amount = data.get('total_selling_amount')
        doc.average_profit_per_g = data.get('average_profit_per_g')
        doc.total_profit = data.get('total_profit')
        doc.overall_profit_margin = data.get('overall_profit_margin')

        # ------------------------------
        # Items
        # ------------------------------
        doc.set("items", [])
        for item in data.get('items', []):
            doc.append('items', {
                'source_bag': item.get('source_bag'),
                'purity': item.get('purity'),
                'description': item.get('description'),
                'weight': item.get('weight'),
                'avco_rate': item.get('avco_rate'),
                'sell_rate': item.get('sell_rate'),
                'amount': item.get('amount'),
                'profit_per_g': item.get('profit_per_g'),
                'total_profit': item.get('total_profit')
            })

        doc.save(ignore_permissions=True)
        frappe.db.commit()

        return {'status': 'success', 'name': doc.name}

    except Exception as e:
        frappe.log_error(f"Error in create_wholesale_bag_direct_sale: {str(e)}")
        frappe.db.rollback()
        return {'status': 'error', 'message': str(e)}

@frappe.whitelist()
def update_wholesale_bag_direct_payments(log_id, payments, total_amount, amount_paid, customer_advance_balance=None):

    import json

    if isinstance(payments, str):
        payments = json.loads(payments)

    if not log_id:
        frappe.throw("Wholesale Bag Direct Sale log_id is required.")

    doc = frappe.get_doc("Wholesale Bag Direct Sale", log_id)

    # Update parent summary fields
    total_amount = float(total_amount or 0)
    amount_paid = float(amount_paid or 0)
    balance_due = max(total_amount - amount_paid, 0)

    doc.total_amount = total_amount
    doc.amount_paid = amount_paid
    doc.balance_due = balance_due

    # Set status based on payment completion
    if amount_paid <= 0:
        doc.status = "Invoiced"  # or keep your earlier value
    elif balance_due > 0:
        doc.status = "Partially Paid"
    else:
        doc.status = "Paid"

    # Reset & rebuild Payments child table
    doc.set("payments", [])
    for p in payments:
        raw_date = p.get("payment_date")
        payment_date = None
        if raw_date:
            try:
                day, month, year = raw_date.split("/")
                payment_date = f"{year}-{month}-{day}"  # YYYY-MM-DD
            except Exception:
                payment_date = getdate(raw_date)

        doc.append("payments", {
            "payment_date": payment_date,
            "payment_method": p.get("payment_method"),
            "amount": p.get("amount"),
            "reference_no": p.get("reference_no"),
            "status": p.get("status", "Received"),
        })
        
    if customer_advance_balance is not None:
        doc.customer_advance_balance = float(customer_advance_balance)

    doc.save(ignore_permissions=True)
    frappe.db.commit()

    return {
        "status": "success",
        "log_id": doc.name,
        "total_amount": doc.total_amount,
        "amount_paid": doc.amount_paid,
        "balance_due": doc.balance_due,
        "doc_status": doc.status,
    }
    
@frappe.whitelist()
def create_sales_invoice(customer, items, discount_amount=0, company=None, posting_date=None):
    import json

    if not company:
        company = frappe.defaults.get_user_default("Company")

    items_list = json.loads(items)
    posting_date = posting_date or nowdate()

    si_items = []
    for i in items_list:
        qty_val = flt(i.get("weight") or i.get("qty") or 1)
        si_items.append({
            "item_code": i.get("item_code"),
            "qty": qty_val,
            "weight_per_unit": qty_val,
            "rate": flt(i.get("rate")),
            "purity": i.get("purity", ""),
            "warehouse": i.get("warehouse", "")
        })

    # ---------------------------
    # Create Sales Invoice
    # ---------------------------
    si = frappe.get_doc({
        "doctype": "Sales Invoice",
        "customer": customer,
        "company": company,
        "discount_amount": flt(discount_amount),
        "set_posting_time": 1,
        "posting_date": posting_date,
        "update_stock": 1,
        "items": si_items
    })

    si.insert(ignore_permissions=True)
    frappe.db.commit()

    # ---------------------------
    # UPDATE WHOLESALE BAG LOG
    # ---------------------------
    log_entry = frappe.get_all(
        "Wholesale Bag Direct Sale",
        filters=[
            ["id_number", "=", customer],
            ["sales_invoice_ref", "in", ("", None)]
        ],
        fields=["name"],
        order_by="creation desc",
        limit_page_length=1
    )

    if log_entry:
        log_doc = frappe.get_doc("Wholesale Bag Direct Sale", log_entry[0].name)
        log_doc.sales_invoice_ref = si.name
        log_doc.status = "Invoiced"
        log_doc.total_discount = discount_amount
        try:
            log_doc.save(ignore_permissions=True)
            frappe.db.commit()
        except Exception as ex:
            print(f"!!! FAILED to update Wholesale Bag Direct Sale doc: {ex} !!!\n")
    else:
        print("!!! No matching Wholesale Bag Direct Sale log found for update. !!!\n")

    return {
        "status": "success",
        "sales_invoice": si.name,
    }

@frappe.whitelist()
def create_payment_entry_for_invoice(sales_invoice_name, payment_mode, paid_amount, posting_date=None):
 
    try:
        if not sales_invoice_name:
            frappe.throw("Sales Invoice name is required.")

        if not payment_mode:
            frappe.throw("Mode of Payment is required.")

        if not paid_amount or float(paid_amount) <= 0:
            frappe.throw("Paid Amount must be greater than zero.")
            
        if payment_mode == "Bank Transfer":
            payment_mode = "Bank Draft"
            
        paid_amount = float(paid_amount)
        # Get Sales Invoice and ensure it's submitted
        si = frappe.get_doc("Sales Invoice", sales_invoice_name)
        # AUTO-SUBMIT DRAFT INVOICE if needed
        if si.docstatus == 0:  # Draft
            si.flags.ignore_permissions = True
            si.submit()
            frappe.db.commit()
        
        elif si.docstatus != 1:
            frappe.throw("Sales Invoice must be Draft or Submitted")
            
        posting_date = posting_date or nowdate()

        # Get default Payment Entry for this invoice
        pe = get_payment_entry("Sales Invoice", sales_invoice_name)

        # Update payment details
        pe.mode_of_payment = payment_mode
        pe.paid_amount = float(paid_amount)
        pe.received_amount = float(paid_amount)
        pe.reference_no = f"Auto-{frappe.utils.now_datetime().strftime('%Y%m%d%H%M%S')}"
        pe.posting_date = posting_date
        pe.reference_date = posting_date

        # Update references to reflect new paid amount
        if pe.references and len(pe.references) > 0:
            pe.references[0].allocated_amount = float(paid_amount)

        # Save and submit the Payment Entry
        pe.insert(ignore_permissions=True)
        pe.submit()
        frappe.db.commit()

        return {
            "status": "success",
            "message": "Payment Entry created successfully.",
            "payment_entry": pe.name,
            "sales_invoice": sales_invoice_name,
            "paid_amount": paid_amount,
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Payment Entry Creation Failed")
        frappe.throw(f"Failed to create Payment Entry: {str(e)}")

@frappe.whitelist()
def get_customer_advance_balance(customer, company=None):
    """
    Return total advance balance for a Customer (sum of available advances).
    Used only to show a single number on Wholesale Bag Direct Payment page.
    """
    if not customer:
        return {"status": "error", "message": "Customer is required.", "advance_balance": 0}

    if not company:
        company = frappe.defaults.get_user_default("Company")

    party_type = "Customer"
    party = customer
    amount_field = "credit_in_account_currency"  # for Customer advances
    order_doctype = "Sales Order"
    order_list = []  # not linking to specific SO here

    # Get party account list including advance accounts
    party_accounts = get_party_account(
        party_type, party=party, company=company, include_advance=True
    )

    party_account = []
    default_advance_account = None

    if party_accounts:
        party_account.append(party_accounts[0])
        if len(party_accounts) == 2:
            default_advance_account = party_accounts[1]

    # Advances from Journal Entries
    journal_entries = get_advance_journal_entries(
        party_type,
        party,
        party_account,
        amount_field,
        order_doctype,
        order_list,
        include_unallocated=True,
    )

    # Advances from Payment Entries
    payment_entries = get_advance_payment_entries_for_regional(
        party_type,
        party,
        party_account,
        order_doctype,
        order_list,
        default_advance_account,
        include_unallocated=True,
    )

    total_advance = 0
    for d in journal_entries + payment_entries:
        total_advance += flt(d.amount)

    return {
        "status": "success",
        "customer": customer,
        "company": company,
        "advance_balance": flt(total_advance),
    }

@frappe.whitelist()
def allocate_customer_advance_to_invoice(sales_invoice_name, allocate_amount, company=None):
    """
    Allocate customer advance amount to DRAFT Sales Invoice
    """
    try:
        if not sales_invoice_name:
            frappe.throw("Sales Invoice name is required")
        
        allocate_amount = flt(allocate_amount)
        if allocate_amount <= 0:
            frappe.throw("Allocation amount must be greater than zero")
        
        if not company:
            company = frappe.defaults.get_user_default("Company")
        
        # Get Sales Invoice - MUST BE DRAFT
        si = frappe.get_doc("Sales Invoice", sales_invoice_name)
        if si.docstatus != 0:
            frappe.throw("Sales Invoice must be in Draft state (not submitted)")
        
        customer = si.customer
        party_type = "Customer"
        party = customer
        amount_field = "credit_in_account_currency"
        order_doctype = "Sales Order"
        order_list = []
        
        # Get party accounts (receivable + advance accounts)
        party_accounts = get_party_account(
            party_type, party=customer, company=company, include_advance=True
        )
        
        party_account = [party_accounts[0]] if party_accounts else []
        default_advance_account = party_accounts[1] if len(party_accounts) == 2 else None
        
        # Fetch available customer advances
        journal_entries = get_advance_journal_entries(
            party_type, party, party_account, amount_field,
            order_doctype, order_list, include_unallocated=True
        )
        
        payment_entries = get_advance_payment_entries_for_regional(
            party_type, party, party_account,
            order_doctype, order_list, default_advance_account,
            include_unallocated=True
        )
        
        all_advances = journal_entries + payment_entries
        available_advance_total = sum(flt(d.amount) for d in all_advances)
        
        if available_advance_total < allocate_amount:
            frappe.throw(f"Insufficient advance balance. Available: {available_advance_total}, Requested: {allocate_amount}")
                
        # Allocate from available advances (first-come-first-served)
        remaining_to_allocate = allocate_amount
        allocated_advances = []
        
        for advance in all_advances:
            if remaining_to_allocate <= 0:
                break
                
            advance_amount = flt(advance.amount)
            alloc_amount = min(advance_amount, remaining_to_allocate)
            
            si.append("advances", {
                "reference_type": advance.reference_type,
                "reference_name": advance.reference_name,
                "reference_row": advance.get("reference_row"),
                "remarks": advance.remarks,
                "advance_amount": advance_amount,
                "allocated_amount": alloc_amount,
                "ref_exchange_rate": flt(advance.get("exchange_rate", 1)),
                "difference_posting_date": frappe.utils.nowdate(),
            })
            
            allocated_advances.append({
                "reference_type": advance.reference_type,
                "reference_name": advance.reference_name,
                "allocated": alloc_amount
            })
            
            remaining_to_allocate -= alloc_amount
        
        # Save updated DRAFT invoice
        si.flags.ignore_permissions = True
        try:
            si.save()
        except frappe.ValidationError as e:
            # Handle submission errors, maybe rollback or report back
            frappe.db.rollback()
            frappe.throw(f"Invoice submission failed: {str(e)}")

        frappe.db.commit()

        return {
            "status": "success",
            "message": f"Allocated RM {allocate_amount} from customer advances to DRAFT invoice {sales_invoice_name}",
            "sales_invoice": sales_invoice_name,
            "allocated_amount": allocate_amount,
            "outstanding_amount": si.outstanding_amount,
            "allocated_advances": allocated_advances,
            "total_advance_used": sum(item.allocated_amount for item in si.advances)
        }
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "allocate_customer_advance_to_invoice")
        frappe.db.rollback()
        return {
            "status": "error",
            "message": str(e),
            "sales_invoice": sales_invoice_name
        }

@frappe.whitelist()
def remove_customer_advance_allocation(sales_invoice_name, remove_amount):
    """
    Reverse allocated advance from Sales Invoice by removing allocation entries
    and reallocating remaining amount.
    """
    try:
        si = frappe.get_doc("Sales Invoice", sales_invoice_name)

        if si.docstatus != 0:
            frappe.throw("Sales Invoice must be in Draft state")

        remove_amount = flt(remove_amount)

        # Total allocated before removal
        current_alloc = sum(flt(a.allocated_amount) for a in si.advances)

        new_total = current_alloc - remove_amount
        if new_total < 0:
            new_total = 0  # safety

        # Clear all allocations
        si.set("advances", [])

        # Reallocate remaining amount (FIFO using your existing logic)
        if new_total > 0:
            allocate_customer_advance_to_invoice(sales_invoice_name, new_total)

        si.save()
        frappe.db.commit()

        return {
            "status": "success",
            "message": "Customer advance allocation removed",
            "remaining_allocated": new_total
        }

    except Exception as e:
        frappe.db.rollback()
        return {
            "status": "error",
            "message": str(e)
        }

@frappe.whitelist()
def submit_sales_invoice_if_draft(sales_invoice_name):
    si = frappe.get_doc("Sales Invoice", sales_invoice_name)
    if si.docstatus == 0:
        si.submit()
        frappe.db.commit()
    return {"status": "success"}

@frappe.whitelist()
def get_resume_payment_data(log_id):
    doc = frappe.get_doc("Wholesale Bag Direct Sale", log_id)

    return {
        "log_id": doc.name,
        "customer": doc.customer,
        "customer_id": doc.id_number,
        "invoice_id": doc.sales_invoice_ref,
        "total_selling_amount": doc.total_selling_amount,
        "customer_advance_balance": doc.customer_advance_balance,
        "payments": doc.payments,
        "items": [row.as_dict() for row in doc.items],
    }
