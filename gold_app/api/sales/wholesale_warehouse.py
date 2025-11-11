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
def create_sales_invoice(customer, items, company=None):
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
        "posting_date": frappe.utils.nowdate(),
        "update_stock": 1,
        "items": si_items
    })

    si.insert(ignore_permissions=True)
    si.submit()
    frappe.db.commit()

    return {
        "status": "success",
        "sales_invoice": si.name,
    }

# Create Payment Entry for the Sales Invoice
# @frappe.whitelist()
# def create_payment_entry_for_invoice(sales_invoice_name, payment_mode):
   
#     try:
#         if not sales_invoice_name:
#             frappe.throw("Sales Invoice name is required.")

#         pe = get_payment_entry("Sales Invoice", sales_invoice_name)
#         pe.mode_of_payment = payment_mode

#         pe.reference_no = f"Auto-{frappe.utils.now_datetime().strftime('%Y%m%d%H%M%S')}"
#         pe.reference_date = frappe.utils.nowdate()

#         pe.insert(ignore_permissions=True)
#         pe.submit()
#         frappe.db.commit()

#         return {
#             "status": "success",
#             "payment_entry": pe.name,
#             "sales_invoice": sales_invoice_name,
#         }

#     except Exception as e:
#         frappe.log_error(frappe.get_traceback(), "Payment Entry Creation Failed")
#         frappe.throw(f"Failed to create Payment Entry: {str(e)}")

@frappe.whitelist()
def create_payment_entry_for_invoice(sales_invoice_name, payment_mode, paid_amount):
 
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
@frappe.whitelist()
def get_wholesale_transaction_by_bag(wholesale_bag):
 
    if not wholesale_bag:
        frappe.throw(_("Parameter 'wholesale_bag' is required"))

    docs = frappe.get_all('Wholesale Transaction', filters={'wholesale_bag': wholesale_bag}, fields=['name'])

    if not docs:
        return {'status': 'error', 'message': f'No Wholesale Transaction found for bag: {wholesale_bag}'}

    docname = docs[0].name
    doc = frappe.get_doc('Wholesale Transaction', docname)
    doc_dict = doc.as_dict()

    return {'status': 'success', 'data': doc_dict}

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
