import frappe
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
        """,
        (warehouse_name,),
        as_dict=True
    )

    frappe.logger().info(f"Stock found for {warehouse_name}: {data}")
    return data

@frappe.whitelist()
def create_complete_sales_flow(customer, item_code, purity, weight, rate, payment_mode="Cash", company=None):
    try:
        if not company:
            company = frappe.defaults.get_user_default("Company")
        
        # Step 1: Create Sales Invoice
        si = frappe.get_doc({
            "doctype": "Sales Invoice",
            "customer": customer,
            "company": company,
            "posting_date": frappe.utils.nowdate(),
            "update_stock": 1,
            "items": [{
                "item_code": item_code,
                "qty": flt(weight),
                "rate": flt(rate),
            }]
        })

        # Add purity if custom field exists
        si_item_meta = frappe.get_meta("Sales Invoice Item")
        if "purity" in [df.fieldname for df in si_item_meta.fields]:
            si.items[0].purity = purity

        si.insert(ignore_permissions=True)
        si.submit()
        frappe.db.commit()

        # Step 2: Create Payment Entry
        pe = get_payment_entry("Sales Invoice", si.name)
        pe.mode_of_payment = payment_mode
        
        # Always ensure reference info is populated to avoid validation issues
        if not getattr(pe, "reference_no", None):
            pe.reference_no = "CASH-TXN"  # or generate dynamically
        if not getattr(pe, "reference_date", None):
            pe.reference_date = frappe.utils.nowdate()
        
        pe.insert(ignore_permissions=True)
        pe.submit()
        frappe.db.commit()

        # Step 3: Create Delivery Note
        dn = make_delivery_note(si.name)
        dn.insert(ignore_permissions=True)
        dn.submit()
        frappe.db.commit()

        return {
            "status": "success",
            "sales_invoice": si.name,
            "payment_entry": pe.name,
            "delivery_note": dn.name
        }

    except Exception as e:
        frappe.db.rollback()
        frappe.log_error(frappe.get_traceback(), "Sales Flow API Error")
        frappe.throw(f"Error while creating Sales Flow: {str(e)}")
