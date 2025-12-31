import frappe
from frappe import _
from frappe.utils import flt
from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry

#Fetching Bag with Full data on page
@frappe.whitelist()
def get_warehouse_stock(warehouse_name=None):
    frappe.logger().info(f"🔹 get_warehouse_stock called with: {warehouse_name}")

    if not warehouse_name:
        return []

    data = frappe.db.sql(
        """
        SELECT
            item.purity AS purity,
            SUM(bin.actual_qty) AS total_qty,
            AVG(bin.valuation_rate) AS avg_rate,
            SUM(bin.actual_qty * bin.valuation_rate) AS total_amount_rm
        FROM
            `tabBin` AS bin
        JOIN
            `tabItem` AS item ON bin.item_code = item.name
        WHERE
            bin.warehouse = %s
        GROUP BY
            item.purity
        HAVING
            SUM(bin.actual_qty) > 0
        """,
        (warehouse_name,),
        as_dict=True
    )

    frappe.logger().info(f"Stock found for {warehouse_name}: {data}")
    return data

# Create Sales Invoice for Stock Reduction
@frappe.whitelist()
def create_sales_invoice(customer, items, company=None, total_amount=0, discount_amount=0, posting_date=None):
    if not company:
        company = frappe.defaults.get_user_default("Company")

    import json
    items_list = json.loads(items)

    si_items = []
    for i in items_list:
        qty_val = flt(i["weight"])
        si_items.append({
            "item_code": i["item_code"],
            "qty": qty_val,
            "weight_per_unit": qty_val,
            "rate": flt(i["rate"]),
            "purity": i.get("purity"),
            "warehouse": i.get("warehouse")
        })

    si = frappe.get_doc({
        "doctype": "Sales Invoice",
        "customer": customer,
        "company": company,
        "posting_date": posting_date or frappe.utils.nowdate(),
        "update_stock": 1,
        "allocate_advances_automatically": 0,
        "items": si_items,
        "total": flt(total_amount),
        "discount_amount": flt(discount_amount)
    })
    si.set_posting_time = 1
    si.insert(ignore_permissions=True)
    si.submit()
    frappe.db.commit()

    return {
        "status": "success",
        "sales_invoice": si.name,
    }

# Create Payment Entry for the Sales Invoice
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

        # Get default Payment Entry for this invoice
        pe = get_payment_entry("Sales Invoice", sales_invoice_name)
        pe.set_posting_time = 1
        pe.posting_date = posting_date or frappe.utils.nowdate()

        # Update payment details
        pe.mode_of_payment = payment_mode
        pe.paid_amount = float(paid_amount)
        pe.received_amount = float(paid_amount)
        pe.reference_no = f"Auto-{frappe.utils.now_datetime().strftime('%Y%m%d%H%M%S')}"
        pe.reference_date = frappe.utils.nowdate()

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

# Fetching Entire Wholesale Transaction Doctype data
# @frappe.whitelist()
# def get_wholesale_transaction_by_bag(wholesale_bag, buyer=None):
#     """
#     Fetch an existing *Active* Wholesale Transaction for a specific bag and buyer.
#     Returns None if not found or if it belongs to a different buyer.
#     """
#     if not wholesale_bag:
#         frappe.throw(_("Parameter 'wholesale_bag' is required"))

#     filters = {"wholesale_bag": wholesale_bag, "status": ["!=", "Completed"]}  # 🔹 Only active

#     if buyer:
#         filters["buyer"] = buyer

#     docs = frappe.get_all("Wholesale Transaction", filters=filters, fields=["name"], limit=1)

#     if not docs:
#         msg = f"No active Wholesale Transaction found for bag '{wholesale_bag}'"
#         if buyer:
#             msg += f" and buyer '{buyer}'"
#         return {"status": "error", "message": msg}

#     doc = frappe.get_doc("Wholesale Transaction", docs[0].name)
#     return {"status": "success", "data": doc.as_dict()}

@frappe.whitelist()
def get_wholesale_transaction_by_bag(wholesale_bag, buyer=None):
    if not wholesale_bag:
        frappe.throw(_("Parameter 'wholesale_bag' is required"))

    filters = {
        "wholesale_bag": wholesale_bag,
        "status": ["!=", "Completed"],
    }

    if buyer:
        filters["buyer"] = buyer

    docs = frappe.get_all(
        "Wholesale Transaction",
        filters=filters,
        fields=["name"],
        limit=1
    )

    if not docs:
        msg = f"No active Wholesale Transaction found for bag '{wholesale_bag}'"
        if buyer:
            msg += f" and buyer '{buyer}'"
        return {"status": "error", "message": msg}

    doc = frappe.get_doc("Wholesale Transaction", docs[0].name)
    data = doc.as_dict()

    # ----------------------------------------------------
    # 🔴 CRITICAL FIX: OVERRIDE TOTAL FROM SALES INVOICE
    # ----------------------------------------------------
    if doc.sales_invoice_ref:
        sales_invoice = frappe.db.get_value(
            "Sales Invoice",
            doc.sales_invoice_ref,
            ["grand_total", "outstanding_amount"],
            as_dict=True,
        )

        if sales_invoice:
            data["sales_invoice_grand_total"] = sales_invoice.grand_total
            data["sales_invoice_outstanding"] = sales_invoice.outstanding_amount

            # Optional but recommended: sync totals
            data["total_payment_amount"] = sales_invoice.grand_total

    return {"status": "success", "data": data}


# Create Stock Entry for Newly Created Purity in Blending and then also do Stock Reduction
@frappe.whitelist()
def create_material_receipt(items, to_warehouse=None):
    import json
    if isinstance(items, str):
        items = json.loads(items)

    if not items:
        frappe.throw(_("Items data is required"))

    stock_entry = frappe.get_doc({
        "doctype": "Stock Entry",
        "stock_entry_type": "Material Receipt",
        "to_warehouse": (to_warehouse + " - AGSB") if to_warehouse else "Unsorted - AGSB",
        "items": []
    })

    for d in items:
        item_code = f"Unsorted-{d.get('purity')}"
        qty = flt(d.get("qty"))
        basic_rate = flt(d.get("basic_rate")) or 0

        stock_entry.append("items", {
            "item_code": item_code,
            "qty": qty,
            "basic_rate": 0,
            "allow_zero_valuation_rate": 1 if basic_rate == 0 else 0
        })

    stock_entry.insert(ignore_permissions=True)
    stock_entry.submit()

    material_issue = frappe.get_doc({
        "doctype": "Stock Entry",
        "stock_entry_type": "Material Issue",
        "from_warehouse": (to_warehouse + " - AGSB") if to_warehouse else "Unsorted - AGSB",
        "items": []
    })

    for d in items:
        item_code = f"Unsorted-{d.get('purity')}"
        qty = flt(d.get("qty"))
        basic_rate = flt(d.get("basic_rate")) or 0

        material_issue.append("items", {
            "item_code": item_code,
            "qty": qty,
            "basic_rate": 0,
            "allow_zero_valuation_rate": 1 if basic_rate == 0 else 0
        })

    material_issue.insert(ignore_permissions=True)
    material_issue.submit()

    return {
        "message": "Stock Entry created successfully",
        "stock_entry_name": stock_entry.name  
    }

# Create Purity
@frappe.whitelist()
def create_purity(purity_name):

    try:
        # Validate input
        if not purity_name or not purity_name.strip():
            frappe.throw(_("Purity name is required"))
        
        purity_name = purity_name.strip()
        
        # Check if purity already exists
        if frappe.db.exists("Purity", {"purity_name": purity_name}):
            frappe.throw(_("Purity {0} already exists").format(purity_name))
        
        # Create new Purity document
        purity_doc = frappe.get_doc({
            "doctype": "Purity",
            "purity_name": purity_name
        })
        
        purity_doc.insert()
        frappe.db.commit()
        
        return {
            "status": "success",
            "message": _("Purity {0} created successfully").format(purity_name),
            "purity_name": purity_name
        }
        
    except Exception as e:
        frappe.log_error(f"Error creating purity: {str(e)}", "Purity Creation Error")
        frappe.throw(_("Failed to create purity: {0}").format(str(e)))

# Create Stock Entry for the Returned Purity Item
@frappe.whitelist()
def create_item_return_stock_entry(items, to_warehouse=None):
    import json
    if isinstance(items, str):
        items = json.loads(items)

    if not items:
        frappe.throw(_("Items data is required"))

    stock_entry = frappe.get_doc({
        "doctype": "Stock Entry",
        "stock_entry_type": "Material Receipt",
        "to_warehouse": "Item Parked Bag - AGSB",
        "items": []
    })

    for d in items:
        item_code = f"Unsorted-{d.get('purity')}"
        qty = flt(d.get("qty"))
        basic_rate = flt(d.get("basic_rate")) or 0

        stock_entry.append("items", {
            "item_code": item_code,
            "qty": qty,
            "basic_rate": basic_rate,
            "allow_zero_valuation_rate": 1 if basic_rate == 0 else 0
        })

    stock_entry.insert(ignore_permissions=True)
    stock_entry.submit()
    frappe.db.commit()

    return {
        "status": "success",
        "stock_entry_name": stock_entry.name
    }

# Storing Payment Entry into Wholesale Transactions
@frappe.whitelist()
def record_wholesale_payment(wholesale_bag, method, amount, ref_no=None, status="Received", total_amount=None):
    
    try:
        if not wholesale_bag:
            frappe.throw("Wholesale Bag is required to record payment.")

        amount = float(amount)

        transaction = frappe.db.get_value(
            "Wholesale Transaction",
            {"wholesale_bag": wholesale_bag},
            "name"
        )

        if not transaction:
            frappe.throw(f"No Wholesale Transaction found for Bag: {wholesale_bag}")

        doc = frappe.get_doc("Wholesale Transaction", transaction)

        # --- Append a new payment line ---
        doc.append("payments", {
            "payment_date": frappe.utils.nowdate(),
            "payment_method": method,
            "amount": amount,
            "reference_no": ref_no or "",
            "status": status,
        })

        # --- Initialize total_payment_amount if not already set ---
        if total_amount is not None and not doc.total_payment_amount:
            doc.total_payment_amount = float(total_amount)

        # --- Compute summary using a different local name to avoid shadowing ---
        total_payment_amount = float(doc.total_payment_amount or 0)
        paid = float(doc.amount_paid or 0) + amount
        balance = max(total_payment_amount - paid, 0)

        doc.amount_paid = paid
        doc.balance_due = balance
        
        if total_payment_amount > 0 and paid >= total_payment_amount:
            doc.status = "Completed"
        else:
            doc.status = "Active"

        doc.save(ignore_permissions=True)
        frappe.db.commit()

        return {
            "status": "success",
            "message": f"Payment of ₹{amount} ({method}) saved successfully for Bag {wholesale_bag}.",
            "total_payment_amount": total_payment_amount,
            "amount_paid": paid,
            "balance_due": balance,
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Wholesale Payment Save Failed")
        frappe.throw(f"Failed to record payment: {str(e)}")

# Advance Payment Entry
@frappe.whitelist()
def create_customer_direct_payment(party, mode_of_payment, paid_amount):
    """
    Clean and safe creation of Payment Entry for Customer advance.
    No references added (HRMS safe).
    """

    try:
        if not party:
            frappe.throw("Customer is required.")
        if not mode_of_payment:
            frappe.throw("Mode of Payment is required.")
        if not paid_amount or float(paid_amount) <= 0:
            frappe.throw("Paid Amount must be greater than zero.")

        paid_amount = float(paid_amount)

        # -------------------
        # Get default company
        # -------------------
        company = frappe.defaults.get_global_default("company")
        if not company:
            frappe.throw("Please set Default Company in System Settings.")

        # -------------------
        # PARTY ACCOUNT (AR)
        # -------------------
        party_account = frappe.db.get_value(
            "Party Account",
            {"parent": party, "company": company},
            "account"
        )

        if not party_account:
            party_account = frappe.get_cached_value(
                "Company", company, "default_receivable_account"
            )

        if not party_account:
            frappe.throw("No Accounts Receivable account found for this company.")

        # -------------------
        # MODE OF PAYMENT → ACCOUNT
        # -------------------
        cash_account = frappe.get_cached_value(
            "Mode of Payment Account",
            {"parent": mode_of_payment, "company": company},
            "default_account"
        )

        if not cash_account:
            frappe.throw(f"Set default account for Mode of Payment: {mode_of_payment}")

        # -------------------
        # CREATE PAYMENT ENTRY
        # -------------------
        pe = frappe.new_doc("Payment Entry")
        pe.payment_type = "Receive"
        pe.company = company

        pe.party_type = "Customer"
        pe.party = party

        pe.mode_of_payment = mode_of_payment
        pe.posting_date = frappe.utils.nowdate()

        pe.paid_amount = paid_amount
        pe.received_amount = paid_amount

        pe.reference_no = f"AUTO-{frappe.utils.now_datetime().strftime('%Y%m%d%H%M%S')}"
        pe.reference_date = frappe.utils.nowdate()

        # -------------------
        # MANUAL ACCOUNT SETUP (avoids HRMS override issues)
        # -------------------
        pe.paid_from = party_account       # Accounts Receivable
        pe.paid_to = cash_account          # Cash/Bank

        # -------------------
        # ⚠️ IMPORTANT: DO NOT ADD ANY REFERENCES
        # HRMS override expects valid docs → so leave table EMPTY
        # -------------------

        # Save & Submit
        pe.insert(ignore_permissions=True)
        pe.submit()
        frappe.db.commit()

        return {
            "status": "success",
            "payment_entry": pe.name,
            "paid_amount": paid_amount,
            "party": party
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Direct Customer Payment Entry Failed")
        frappe.throw(f"Failed: {str(e)}")

# Add Sales Invoice reference to Wholesale Transaction
@frappe.whitelist()
def update_sales_invoice_ref(wholesale_bag, buyer, invoice_ref):
    name = frappe.db.get_value(
        "Wholesale Transaction",
        {"wholesale_bag": wholesale_bag, "buyer": buyer},
        "name"
    )
    if not name:
        return {"status": "failed", "msg": "Transaction not found"}

    frappe.db.set_value("Wholesale Transaction", name, "sales_invoice_ref", invoice_ref)
    frappe.db.commit()

    return {"status": "success", "msg": "Invoice linked"}
