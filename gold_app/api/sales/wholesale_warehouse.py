import frappe
from frappe import _
from frappe.utils import flt
from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry
from erpnext.accounts.doctype.sales_invoice.sales_invoice import make_delivery_note

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

# @frappe.whitelist()
# def create_complete_sales_flow(customer, item_code, purity, weight, rate, payment_mode="Cash", company=None):
#     try:
#         if not company:
#             company = frappe.defaults.get_user_default("Company")
        
#         # Step 1: Create Sales Invoice
#         si = frappe.get_doc({
#             "doctype": "Sales Invoice",
#             "customer": customer,
#             "company": company,
#             "posting_date": frappe.utils.nowdate(),
#             "update_stock": 1,
#             "items": [{
#                 "item_code": item_code,
#                 "qty": flt(weight),
#                 "rate": flt(rate),
#             }]
#         })

#         # Add purity if custom field exists
#         si_item_meta = frappe.get_meta("Sales Invoice Item")
#         if "purity" in [df.fieldname for df in si_item_meta.fields]:
#             si.items[0].purity = purity

#         si.insert(ignore_permissions=True)
#         si.submit()
#         frappe.db.commit()

#         # Step 2: Create Payment Entry
#         pe = get_payment_entry("Sales Invoice", si.name)
#         pe.mode_of_payment = payment_mode
        
#         # Always ensure reference info is populated to avoid validation issues
#         if not getattr(pe, "reference_no", None):
#             pe.reference_no = "CASH-TXN"  # or generate dynamically
#         if not getattr(pe, "reference_date", None):
#             pe.reference_date = frappe.utils.nowdate()
        
#         pe.insert(ignore_permissions=True)
#         pe.submit()
#         frappe.db.commit()

#         # Step 3: Create Delivery Note
#         dn = make_delivery_note(si.name)
#         dn.insert(ignore_permissions=True)
#         dn.submit()
#         frappe.db.commit()

#         return {
#             "status": "success",
#             "sales_invoice": si.name,
#             "payment_entry": pe.name,
#             "delivery_note": dn.name
#         }

#     except Exception as e:
#         frappe.db.rollback()
#         frappe.log_error(frappe.get_traceback(), "Sales Flow API Error")
#         frappe.throw(f"Error while creating Sales Flow: {str(e)}")


# Create Sales Invoice for Stock Reduction
@frappe.whitelist()
def create_sales_invoice(customer, items, company=None):
    if not company:
        company = frappe.defaults.get_user_default("Company")

    import json
    items_list = json.loads(items)

    si_items = []
    for i in items_list:
        si_items.append({
            "item_code": i["item_code"],
            "qty": flt(i["weight"]),
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


@frappe.whitelist()
def get_wholesale_transaction_by_bag(wholesale_bag):
 
    if not wholesale_bag:
        frappe.throw(_("Parameter 'wholesale_bag' is required"))

    # Fetch list of docnames matching bag
    docs = frappe.get_all('Wholesale Transaction', filters={'wholesale_bag': wholesale_bag}, fields=['name'])

    if not docs:
        return {'status': 'error', 'message': f'No Wholesale Transaction found for bag: {wholesale_bag}'}

    docname = docs[0].name

    # Fetch full document including child tables
    doc = frappe.get_doc('Wholesale Transaction', docname)
    
    # Convert to dict/json to return
    doc_dict = doc.as_dict()

    return {'status': 'success', 'data': doc_dict}
