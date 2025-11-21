import frappe
from frappe import _
from frappe.utils import flt

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
def create_sales_invoice(customer, items, company=None):
    import json

    if not company:
        company = frappe.defaults.get_user_default("Company")

    items_list = json.loads(items)

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
        "posting_date": frappe.utils.nowdate(),
        "update_stock": 1,
        "allocate_advances_automatically": 1,
        "items": si_items
    })

    si.insert(ignore_permissions=True)
    si.submit()
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
