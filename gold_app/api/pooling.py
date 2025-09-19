import frappe, json
from frappe.utils import nowdate
from frappe.utils import flt 

# Unpooled Items from Item Pickup
@frappe.whitelist()
def get_unpooled_pickups(pool_type="Dealer"):
    # Show only manager-approved pickups which are not pooled yet
    filters = {"tick_all_ok": 1, "pooled": 0}
    # Additional filtering for branch/dealer can be implemented if needed
    pickups = frappe.get_all("Item Pickup",
        filters=filters,
        fields=["name","dealer","date","purity","total_weight","amount","avco_rate","purchase_receipt"],
        order_by="date desc")
    return pickups

# Create the Gold Pool Entry from Page Button Click
@frappe.whitelist()
def create_pool(pickup_names, pool_type="Dealer", notes=None):
    pickup_names = frappe.parse_json(pickup_names) if isinstance(pickup_names, str) else pickup_names
    if not pickup_names:
        frappe.throw("No pickups supplied")

    # Step 1: Create new Gold Pool doc
    pool = frappe.new_doc("Gold Pool")
    pool.pool_type = pool_type
    pool.status = "Pending"
    pool.date_created = nowdate()
    pool.notes = notes or ""

    # Step 2: Prepare aggregation containers
    totals_by_purity = {}
    cost_by_purity = {}
    total_weight = 0.0
    total_value = 0.0

    # Step 3: Loop through Item Pickups and aggregate
    for pickup_name in pickup_names:
        pu = frappe.get_doc("Item Pickup", pickup_name)

        # Append into pool_items child table
        pool.append("pool_items", {
            "item_pickup": pu.name,
            "dealer": pu.dealer,
            "date": pu.date,
            "purity": pu.purity,
            "total_weight": pu.total_weight or 0.0,
            "amount": pu.amount or 0.0,
            "avco_rate": pu.avco_rate or 0.0
        })

        w = pu.total_weight or 0.0
        amt = pu.amount or 0.0

        totals_by_purity.setdefault(pu.purity, 0.0)
        totals_by_purity[pu.purity] += w

        cost_by_purity.setdefault(pu.purity, 0.0)
        cost_by_purity[pu.purity] += amt

        total_weight += w
        total_value += amt

        # Mark pickup as pooled
        frappe.db.set_value("Item Pickup", pu.name, "pooled", 1)

    # Step 4: Compute AVCO per purity and populate Purity Breakdown table
    for purity, weight in totals_by_purity.items():
        total_cost = cost_by_purity[purity]
        avco_rate = total_cost / weight if weight else 0.0

        pool.append("purity_breakdown", {
            "purity": purity,
            "total_weight": weight,
            "total_cost": total_cost,
            "avco_rate": avco_rate
        })

    # Step 5: Set aggregate totals on the parent Gold Pool
    pool.total_weight = total_weight
    pool.total_value = total_value

    # Step 6: Insert pool document
    pool.insert(ignore_permissions=True)

    # Step 7: Update pool_reference on Item Pickup docs
    for pickup_name in pickup_names:
        frappe.db.set_value("Item Pickup", pickup_name, "pool_reference", pool.name)

    return pool.name

# Getting Purity wise data on Gold Sorting Page model
@frappe.whitelist()
def get_pool_summary(pickup_names):
    pickup_names = frappe.parse_json(pickup_names) if isinstance(pickup_names, str) else pickup_names
    if not pickup_names:
        return {}

    totals_by_purity = {}
    cost_by_purity = {}
    total_weight = 0.0
    total_value = 0.0

    for pickup_name in pickup_names:
        pu = frappe.get_doc("Item Pickup", pickup_name)
        w = pu.total_weight or 0.0
        amt = pu.amount or 0.0

        totals_by_purity.setdefault(pu.purity, 0.0)
        totals_by_purity[pu.purity] += w

        cost_by_purity.setdefault(pu.purity, 0.0)
        cost_by_purity[pu.purity] += amt

        total_weight += w
        total_value += amt

    avco_by_purity = {p: (cost_by_purity[p] / totals_by_purity[p] if totals_by_purity[p] else 0.0)
                      for p in totals_by_purity}

    return {
        "totals_by_purity": totals_by_purity,
        "cost_by_purity": cost_by_purity,
        "avco_by_purity": avco_by_purity,
        "total_weight": total_weight,
        "total_value": total_value,
        "count": len(pickup_names)
    }

# Getting the List of Gold Pools
@frappe.whitelist()
def get_gold_pool_options():
    """Return list of Gold Pool document names for dropdown"""
    pools = frappe.get_all('Gold Pool', fields=['name'])
    return [p['name'] for p in pools]

# Purity Wise Data from Pool
@frappe.whitelist()
def get_gold_pool_data(pool_name):
    """Return Gold Pool data including purity_breakdown table"""
    if not pool_name:
        return {}

    pool_doc = frappe.get_doc('Gold Pool', pool_name)

    # Extract purity_breakdown table data
    table_data = []
    for row in pool_doc.purity_breakdown:
        table_data.append({
            'Purity': row.purity,
            'Total Weight (g)': row.total_weight,
            'AVCO (RM/g)': row.avco_rate,
            'Total Cost (MYR)': row.total_cost
        })

    return {
        'name': pool_doc.name,
        'purity_breakdown': table_data
    }


@frappe.whitelist()
def create_stock_entry_from_pool(purity_data, pool_name=None):
  
    data = json.loads(purity_data)

    if not pool_name:
        frappe.throw("Pool name is required")

    if not data:
        frappe.throw("No items found to create Stock Entry")

    pool_doc = frappe.get_doc("Gold Pool", pool_name)

    se = frappe.new_doc("Stock Entry")
    se.stock_entry_type = "Material Receipt"

    for row in data:
        item_code = row.get("item_code")
        purity = str(row.get("purity"))
        qty = flt(row.get("qty"))
        valuation_rate = flt(row.get("valuation_rate"))
        source_warehouse = row.get("source_warehouse")
        target_warehouse = row.get("target_warehouse")
        item_group = row.get("item_group")

        if not (item_code and qty and source_warehouse and target_warehouse):
            frappe.throw("Missing required fields for creating Stock Entry")

        if not frappe.db.exists("Item", item_code):
            new_item = frappe.new_doc("Item")
            new_item.item_code = item_code
            new_item.item_name = item_code
            new_item.item_group = item_group or "All Item Groups"
            new_item.stock_uom = "Gram"
            new_item.insert(ignore_permissions=True)
            frappe.msgprint(f"Item <b>{item_code}</b> created successfully")

        se.append("items", {
            "item_code": item_code,
            "qty": qty,
            "s_warehouse": source_warehouse,
            "t_warehouse": target_warehouse,
            "purity": purity,
            "valuation_rate": valuation_rate,
            "allow_zero_valuation_rate": 1 if valuation_rate == 0 else 0,
        })

        updated = False
        for row_pb in pool_doc.purity_breakdown:
            if str(row_pb.purity) == purity:
                if qty > row_pb.total_weight:
                    frappe.throw(
                        f"Cannot create Stock Entry: Qty {qty} > available {row_pb.total_weight} for Purity {purity}"
                    )
                row_pb.total_weight -= qty
                row_pb.total_cost = row_pb.total_weight * row_pb.avco_rate
                updated = True
                break

        if not updated:
            frappe.throw(f"Purity {purity} not found in Pool {pool_name}")

    pool_doc.save(ignore_permissions=True)

    if all(flt(r.total_weight) <= 0 for r in pool_doc.purity_breakdown):
        pool_doc.status = "Completed"
        pool_doc.save(ignore_permissions=True)

    se.insert(ignore_permissions=True)
    se.submit()

    return {"name": se.name, "stock_entry_type": se.stock_entry_type}

