import frappe, json
from frappe import _
from frappe.utils import flt, nowdate, nowtime
from gold_app.api.item import bulk_create_items

#-------------------------------------------------------Gold - Sorting Page-----------------------------------------------------

# Unpooled Items from Item In Hand
@frappe.whitelist()
def get_unpooled_pickups(pool_type="Branch"):
    """
    Fetch all unpooled Item In Hand entries
    """
    pickups = frappe.get_all("Item In Hand",
        filters={"pooled": 0},
        fields=["name","dealer","date","purity","total_weight","amount","avco_rate","purchase_receipt"],
        order_by="date desc"
    )
    return pickups

# Create the Gold Pool Entry from Create Pool Button Click
@frappe.whitelist()
def create_pool(pickup_names, pool_type="Branch", notes=None):
    """
    Create Gold Pool from Item In Hand entries (Branch type)
    """
    pickup_names = frappe.parse_json(pickup_names) if isinstance(pickup_names, str) else pickup_names
    if not pickup_names:
        frappe.throw("No pickups supplied")

    pool = frappe.new_doc("Gold Pool")
    pool.pool_type = pool_type
    pool.status = "Pending"
    pool.date_created = nowdate()
    pool.notes = notes or ""

    totals_by_purity = {}
    cost_by_purity = {}
    total_weight = 0.0
    total_value = 0.0

    for pickup_name in pickup_names:
        pu = frappe.get_doc("Item In Hand", pickup_name)

        pool.append("pool_in_hand_items", {
        "item_pickup": pu.name,       # Link → Item In Hand
        "dealer": pu.dealer,
        "date": pu.date,
        "purity": pu.purity,
        "total_weight": pu.total_weight or 0.0,
        "amount": pu.amount or 0.0,
        "avco_rate": pu.avco_rate or 0.0
    })

        totals_by_purity.setdefault(pu.purity, 0.0)
        totals_by_purity[pu.purity] += pu.total_weight or 0.0

        cost_by_purity.setdefault(pu.purity, 0.0)
        cost_by_purity[pu.purity] += pu.amount or 0.0

        total_weight += pu.total_weight or 0.0
        total_value += pu.amount or 0.0

        frappe.db.set_value("Item In Hand", pu.name, "pooled", 1)

    # Purity breakdown
    for purity, weight in totals_by_purity.items():
        total_cost = cost_by_purity[purity]
        avco_rate = total_cost / weight if weight else 0.0
        pool.append("purity_breakdown", {
            "purity": purity,
            "total_weight": weight,
            "total_cost": total_cost,
            "avco_rate": avco_rate
        })

    pool.total_weight = total_weight
    pool.total_value = total_value
    pool.insert(ignore_permissions=True)

    # Update pool_reference in Item In Hand entries
    for pickup_name in pickup_names:
        frappe.db.set_value("Item In Hand", pickup_name, "pool_reference", pool.name)

    return {
        "pool_name": pool.name,
        "total_weight": total_weight,
        "total_value": total_value
    }

# Getting Purity wise data on Gold Sorting Page model
@frappe.whitelist()
def get_pool_summary(pickup_names):
    """
    Compute purity-wise summary for Item In Hand entries
    """
    pickup_names = frappe.parse_json(pickup_names) if isinstance(pickup_names, str) else pickup_names
    if not pickup_names:
        return {}

    totals_by_purity = {}
    cost_by_purity = {}
    total_weight = 0.0
    total_value = 0.0

    for pickup_name in pickup_names:
        pu = frappe.get_doc("Item In Hand", pickup_name)
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

#-----------------------------------------------------------Pool Page---------------------------------------------------------

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

# Create Stock Entry from Pool - V1
# @frappe.whitelist()
# def create_stock_entry_from_pool(purity_data, pool_name=None):
#     data = json.loads(purity_data)

#     if not pool_name:
#         frappe.throw("Pool name is required")

#     if not data:
#         frappe.throw("No items found to create Stock Entry")

#     pool_doc = frappe.get_doc("Gold Pool", pool_name)

#     se = frappe.new_doc("Stock Entry")
#     se.stock_entry_type = "Material Receipt"

#     for row in data:
#         item_code = row.get("item_code")
#         purity = str(row.get("purity"))
#         qty = flt(row.get("qty"))
#         valuation_rate = flt(row.get("valuation_rate"))
#         target_warehouse = row.get("target_warehouse")
#         item_group = row.get("item_group")

#         if not (item_code and qty and target_warehouse):
#             frappe.throw("Missing required fields for creating Stock Entry")

#         if not frappe.db.exists("Item", item_code):
#             new_item = frappe.new_doc("Item")
#             new_item.item_code = item_code
#             new_item.item_name = item_code
#             new_item.item_group = item_group or "All Item Groups"
#             new_item.stock_uom = "Gram"
#             new_item.insert(ignore_permissions=True)
#             frappe.msgprint(f"Item <b>{item_code}</b> created successfully")

#         se.append("items", {
#             "item_code": item_code,
#             "qty": qty,
#             "t_warehouse": target_warehouse,
#             "purity": purity,
#             "valuation_rate": valuation_rate,
#             "allow_zero_valuation_rate": 1 if valuation_rate == 0 else 0,
#         })

#         updated = False
#         for row_pb in pool_doc.purity_breakdown:
#             if str(row_pb.purity) == purity:
#                 if qty > row_pb.total_weight:
#                     frappe.throw(
#                         f"Cannot create Stock Entry: Qty {qty} > available {row_pb.total_weight} for Purity {purity}"
#                     )
#                 row_pb.total_weight -= qty
#                 row_pb.total_cost = row_pb.total_weight * row_pb.avco_rate
#                 updated = True
#                 break

#         if not updated:
#             frappe.throw(f"Purity {purity} not found in Pool {pool_name}")

#     pool_doc.save(ignore_permissions=True)

#     if all(flt(r.total_weight) <= 0 for r in pool_doc.purity_breakdown):
#         pool_doc.status = "Completed"
#         pool_doc.save(ignore_permissions=True)

#     se.insert(ignore_permissions=True)
#     se.submit()

#     return {"name": se.name, "stock_entry_type": se.stock_entry_type}

# Break Item Stock Entry V2
# @frappe.whitelist()
# def create_stock_entry_from_pool(purity_data, pool_name=None):
#     """
#     Create Break Item Stock Entry(ies) from pool data.
#     Accepts purity_data as JSON array of rows:
#       [{ "purity": "999", "qty": 10, "item_code": "L-001", "valuation_rate": 1000, "target_warehouse": "Bag 1 - Retail - AGSB", "item_group": "L - Loket" }, ...]
#     Creates one Stock Entry per source_item (Unsorted-{purity}) group.
#     """
#     data = json.loads(purity_data)

#     if not pool_name:
#         frappe.throw(_("Pool name is required"))

#     if not data:
#         frappe.throw(_("No items found to create Stock Entry"))

#     pool_doc = frappe.get_doc("Gold Pool", pool_name)

#     # use system default company
#     company = frappe.db.get_single_value("Global Defaults", "default_company") or frappe.db.get_value("Company", {}, "name")

#     # normalize rows and compute source_item per row
#     rows = []
#     for r in data:
#         purity = str(r.get("purity") or "")
#         if not purity:
#             frappe.throw(_("Purity is required in each row"))
#         source_item = r.get("source_item") or f"Unsorted-{purity}"
#         rows.append({
#             "purity": purity,
#             "qty": flt(r.get("qty") or 0),
#             "item_code": r.get("item_code"),
#             "valuation_rate": flt(r.get("valuation_rate") or 0),
#             "target_warehouse": r.get("target_warehouse"),
#             "item_group": r.get("item_group"),
#             "source_item": source_item
#         })

#     # group rows by source_item (i.e. Unsorted-XXX)
#     groups = {}
#     for r in rows:
#         groups.setdefault(r["source_item"], []).append(r)

#     created_entries = []

#     # iterate groups and create one Stock Entry per group
#     for source_item_code, group_rows in groups.items():
#         # ensure source_item exists and belongs to Mixed Gold group
#         if not frappe.db.exists("Item", {"item_code": source_item_code, "item_group": "MG - Mixed Gold"}):
#             frappe.throw(_("Source Item '{0}' not found in Item Group 'MG - Mixed Gold'").format(source_item_code))

#         # find latest SLE for the source item to determine source warehouse and valuation_rate
#         latest_sle = frappe.db.get_value(
#             "Stock Ledger Entry",
#             {"item_code": source_item_code},
#             ["warehouse", "valuation_rate"],
#             order_by="posting_date desc, posting_time desc",
#             as_dict=True
#         )
#         source_warehouse = latest_sle.warehouse if latest_sle and latest_sle.warehouse else None
#         source_valuation_rate = flt(latest_sle.valuation_rate if latest_sle and latest_sle.valuation_rate else 0)

#         if not source_warehouse:
#             # try to find any Bin for item
#             any_bin = frappe.db.get_value("Bin", {"item_code": source_item_code}, "warehouse")
#             source_warehouse = any_bin

#         # compute available qty in bin for that warehouse
#         available_qty = flt(frappe.db.get_value("Bin", {"item_code": source_item_code, "warehouse": source_warehouse}, "actual_qty") or 0)

#         # compute reduce_quantity (sum of qty in this group)
#         reduce_qty = sum([r["qty"] for r in group_rows])

#         if reduce_qty <= 0:
#             frappe.throw(_("Reduce quantity for source item {0} must be greater than zero").format(source_item_code))

#         if available_qty <= 0:
#             frappe.throw(_("No available qty for source item {0} in warehouse {1}").format(source_item_code, source_warehouse or _("(unknown)")))

#         if reduce_qty > available_qty:
#             frappe.throw(_("The total weight of new items ({0} gm) cannot exceed the available {1} gm for source item {2}").format(reduce_qty, available_qty, source_item_code))

#         # Build Stock Entry for this source_item group
#         se = frappe.new_doc("Stock Entry")
#         se.stock_entry_type = "Break Item"
#         se.company = company
#         se.posting_date = nowdate()
#         se.posting_time = nowtime()

#         # Set Break Item level fields
#         se.source_item = source_item_code
#         se.source_item_warehouse = source_warehouse
#         se.item_quantity = available_qty
#         se.source_valuation_rate = source_valuation_rate
#         se.reduce_quantity = reduce_qty
#         se.remaining_quantity = available_qty - reduce_qty

#         # Append result rows (child items)
#         for r in group_rows:
#             item_code = r["item_code"]
#             purity = r["purity"]
#             qty = r["qty"]
#             valuation_rate = r["valuation_rate"]
#             target_warehouse = r["target_warehouse"]
#             item_group = r["item_group"]

#             if not (item_code and qty and target_warehouse):
#                 frappe.throw(_("Missing required fields for creating Stock Entry (item_code, qty, target_warehouse are required)"))

#             # create item if missing
#             if not frappe.db.exists("Item", item_code):
#                 new_item = frappe.new_doc("Item")
#                 new_item.item_code = item_code
#                 new_item.item_name = item_code
#                 new_item.item_group = item_group or "All Item Groups"
#                 new_item.stock_uom = "Gram"
#                 new_item.insert(ignore_permissions=True)
#                 # use msgprint sparingly on server side; kept for parity
#                 frappe.msgprint(_("Item {0} created successfully").format(item_code))

#             # append the child row
#             se.append("items", {
#                 "item_code": item_code,
#                 "qty": qty,
#                 "t_warehouse": target_warehouse,
#                 "purity": purity,
#                 "valuation_rate": valuation_rate,
#                 "allow_zero_valuation_rate": 1 if valuation_rate == 0 else 0,
#                 # It is not necessary to set s_warehouse on child rows for Break Item;
#                 # important fields are set on SE header (source_item / source_item_warehouse)
#             })

#             # update the pool's purity breakdown
#             updated = False
#             for row_pb in pool_doc.purity_breakdown:
#                 if str(row_pb.purity) == purity:
#                     if qty > row_pb.total_weight:
#                         frappe.throw(_("Cannot create Stock Entry: Qty {0} > available {1} for Purity {2}").format(qty, row_pb.total_weight, purity))
#                     row_pb.total_weight = flt(row_pb.total_weight) - qty
#                     row_pb.total_cost = flt(row_pb.total_weight) * flt(row_pb.avco_rate)
#                     updated = True
#                     break
#             if not updated:
#                 frappe.throw(_("Purity {0} not found in Pool {1}").format(purity, pool_name))

#         # Save pool changes per group iteration to keep consistent state
#         pool_doc.save(ignore_permissions=True)

#         # Insert and submit the Stock Entry
#         se.insert(ignore_permissions=True)
#         se.submit()

#         created_entries.append(se.name)

#     # After all groups processed, if all pool weights <=0 then mark Completed
#     if all(flt(r.total_weight) <= 0 for r in pool_doc.purity_breakdown):
#         pool_doc.status = "Completed"
#         pool_doc.save(ignore_permissions=True)

#     # Return first created entry name for backward compatibility plus all names
#     return {
#         "name": created_entries[0] if created_entries else None,
#         "all_names": created_entries,
#         "stock_entry_type": "Break Item"
#     }

# Adding the Remaining to the Wholesale Warehouses
# WHOLESALE_WAREHOUSE = "Bag 1 - Wholesale - AGSB"

# @frappe.whitelist()
# def create_stock_entry_from_pool(purity_data, pool_name=None, remaining_transfers=None):
#     """
#     Create Break Item Stock Entry(ies) from pool data.
#     Also auto-transfers remaining weight (only for processed purities)
#     to Bag 1 - Wholesale - AGSB via Material Transfer Stock Entry.
#     """
#     data = json.loads(purity_data)

#     if not pool_name:
#         frappe.throw(_("Pool name is required"))

#     if not data:
#         frappe.throw(_("No items found to create Stock Entry"))
        
#     if remaining_transfers:
#         remaining_transfers = json.loads(remaining_transfers)

#     pool_doc = frappe.get_doc("Gold Pool", pool_name)

#     company = frappe.db.get_single_value("Global Defaults", "default_company") \
#         or frappe.db.get_value("Company", {}, "name")

#     rows = []
#     for r in data:
#         purity = str(r.get("purity") or "")
#         if not purity:
#             frappe.throw(_("Purity is required in each row"))
            
#         if not r.get("item_code") and r.get("item_group"):
#             created = bulk_create_items([r])
#             r["item_code"] = created[0]["item_code"] if created else None
        
#         source_item = r.get("source_item") or f"Unsorted-{purity}"
#         rows.append({
#             "purity": purity,
#             "qty": flt(r.get("qty") or 0),
#             "item_code": r.get("item_code"),
#             "item_length": r.get("item_length"),
#             "valuation_rate": flt(r.get("valuation_rate") or 0),
#             "target_warehouse": r.get("target_warehouse"),
#             "item_group": r.get("item_group"),
#             "source_item": source_item
#         })

#     # Group rows by source_item
#     groups = {}
#     for r in rows:
#         groups.setdefault(r["source_item"], []).append(r)

#     created_entries = []
#     processed_purities = set()

#     # Create Break Item Stock Entry per group
#     for source_item_code, group_rows in groups.items():
#         if not frappe.db.exists("Item", {"item_code": source_item_code, "item_group": "MG - Mixed Gold"}):
#             frappe.throw(_("Source Item '{0}' not found in Item Group 'MG - Mixed Gold'").format(source_item_code))

#         latest_sle = frappe.db.get_value(
#             "Stock Ledger Entry",
#             {"item_code": source_item_code},
#             ["warehouse", "valuation_rate"],
#             order_by="posting_date desc, posting_time desc",
#             as_dict=True
#         )
#         source_warehouse = latest_sle.warehouse if latest_sle else None
#         source_valuation_rate = flt(latest_sle.valuation_rate if latest_sle else 0)

#         if not source_warehouse:
#             source_warehouse = frappe.db.get_value("Bin", {"item_code": source_item_code}, "warehouse")

#         available_qty = flt(frappe.db.get_value(
#             "Bin",
#             {"item_code": source_item_code, "warehouse": source_warehouse},
#             "actual_qty"
#         ) or 0)

#         reduce_qty = sum([r["qty"] for r in group_rows])
#         if reduce_qty > available_qty:
#             frappe.throw(_("Qty {0} exceeds available {1} for {2}").format(reduce_qty, available_qty, source_item_code))

#         # Build Break Item Stock Entry
#         se = frappe.new_doc("Stock Entry")
#         se.stock_entry_type = "Break Item"
#         se.company = company
#         se.posting_date = nowdate()
#         se.posting_time = nowtime()
#         se.source_item = source_item_code
#         se.source_item_warehouse = source_warehouse
#         se.item_quantity = available_qty
#         se.source_valuation_rate = source_valuation_rate
#         se.reduce_quantity = reduce_qty
#         se.remaining_quantity = available_qty - reduce_qty

#         for r in group_rows:
#             item_code = r["item_code"]
#             if not frappe.db.exists("Item", item_code):
#                 new_item = frappe.new_doc("Item")
#                 new_item.item_code = item_code
#                 new_item.item_name = item_code
#                 new_item.item_group = r["item_group"] or "All Item Groups"
#                 new_item.stock_uom = "Gram"
#                 new_item.insert(ignore_permissions=True)

#             se.append("items", {
#                 "item_code": item_code,
#                 "qty": r["qty"],
#                 "t_warehouse": r["target_warehouse"],
#                 "purity": r["purity"],
#                 "item_length": flt(r.get("item_length")) if r.get("item_length") not in (None, "", "null") else None,
#                 "valuation_rate": r["valuation_rate"],
#                 "allow_zero_valuation_rate": 1 if r["valuation_rate"] == 0 else 0
#             })

#             # Update pool breakdown only for this purity
#             for row_pb in pool_doc.purity_breakdown:
#                 if str(row_pb.purity) == r["purity"]:
#                     if r["qty"] > row_pb.total_weight:
#                         frappe.throw(_("Qty {0} > available {1} for Purity {2}").format(
#                             r["qty"], row_pb.total_weight, r["purity"]))
#                     row_pb.total_weight -= r["qty"]
#                     row_pb.total_cost = row_pb.total_weight * row_pb.avco_rate
#                     processed_purities.add(r["purity"])
#                     break

#         pool_doc.save(ignore_permissions=True)

#         se.insert(ignore_permissions=True)
#         se.submit()
#         created_entries.append(se.name)

#     # Handle remaining weights ONLY for processed purities
#     for row_pb in pool_doc.purity_breakdown:
#         if str(row_pb.purity) not in processed_purities:
#             continue  # skip purities not in this transaction

#         if flt(row_pb.total_weight) > 0:
#             source_item = f"Unsorted-{row_pb.purity}"
#             if not frappe.db.exists("Item", {"item_code": source_item, "item_group": "MG - Mixed Gold"}):
#                 continue

#             source_warehouse = frappe.db.get_value("Bin", {"item_code": source_item}, "warehouse")
#             if not source_warehouse:
#                 continue
            
#             # Find the user-selected target warehouse from remaining_transfers
#             target_wh = WHOLESALE_WAREHOUSE  # fallback
#             if remaining_transfers:
#                 for rt in remaining_transfers:
#                     if str(rt.get("purity")) == str(row_pb.purity):
#                         target_wh = rt.get("target_warehouse") or WHOLESALE_WAREHOUSE
#                         break

#             # Create Material Transfer for remaining weight
#             se_transfer = frappe.new_doc("Stock Entry")
#             se_transfer.stock_entry_type = "Material Transfer"
#             se_transfer.company = company
#             se_transfer.posting_date = nowdate()
#             se_transfer.posting_time = nowtime()
#             se_transfer.append("items", {
#                 "item_code": source_item,
#                 "qty": flt(row_pb.total_weight),
#                 "s_warehouse": source_warehouse,
#                 "t_warehouse": target_wh,
#                 "allow_zero_valuation_rate": 1
#             })
#             se_transfer.insert(ignore_permissions=True)
#             se_transfer.submit()
            
#             row_pb.total_weight = 0
#             row_pb.total_cost = 0

#     pool_doc.save(ignore_permissions=True)

#     if all(flt(r.total_weight) <= 0 for r in pool_doc.purity_breakdown):
#         pool_doc.status = "Completed"
#         pool_doc.save(ignore_permissions=True)

#     return {
#         "name": created_entries[0] if created_entries else None,
#         "all_names": created_entries,
#         "stock_entry_type": "Break Item"
#     }

WHOLESALE_WAREHOUSE = "Bag 1 - Wholesale - AGSB"

@frappe.whitelist()
def create_stock_entry_from_pool(purity_data, pool_name=None, remaining_transfers=None):
    """
    Create Break Item Stock Entry(ies) from pool data.
    Also auto-transfers remaining weight (only for processed purities)
    to Bag 1 - Wholesale - AGSB via Material Transfer Stock Entry.
    """
    data = json.loads(purity_data)

    if not pool_name:
        frappe.throw(_("Pool name is required"))

    if not data:
        frappe.throw(_("No items found to create Stock Entry"))
        
    if remaining_transfers:
        remaining_transfers = json.loads(remaining_transfers)

    pool_doc = frappe.get_doc("Gold Pool", pool_name)

    company = frappe.db.get_single_value("Global Defaults", "default_company") \
        or frappe.db.get_value("Company", {}, "name")

    rows = []
    for r in data:
        purity = str(r.get("purity") or "")
        if not purity:
            frappe.throw(_("Purity is required in each row"))
            
        if not r.get("item_code") and r.get("item_group"):
            created = bulk_create_items([r])
            r["item_code"] = created[0]["item_code"] if created else None
        
        source_item = r.get("source_item") or f"Unsorted-{purity}"
        rows.append({
            "purity": purity,
            "qty": flt(r.get("qty") or 0),
            "item_code": r.get("item_code"),
            "item_length": r.get("item_length"),
            "valuation_rate": flt(r.get("valuation_rate") or 0),
            "target_warehouse": r.get("target_warehouse"),
            "item_group": r.get("item_group"),
            "source_item": source_item
        })

    # Group rows by source_item
    groups = {}
    for r in rows:
        groups.setdefault(r["source_item"], []).append(r)

    created_entries = []
    processed_purities = set()

    # Create Break Item Stock Entry per group
    for source_item_code, group_rows in groups.items():
        if not frappe.db.exists("Item", {"item_code": source_item_code, "item_group": "MG - Mixed Gold"}):
            frappe.throw(_("Source Item '{0}' not found in Item Group 'MG - Mixed Gold'").format(source_item_code))

        latest_sle = frappe.db.get_value(
            "Stock Ledger Entry",
            {"item_code": source_item_code},
            ["warehouse", "valuation_rate"],
            order_by="posting_date desc, posting_time desc",
            as_dict=True
        )
        source_warehouse = latest_sle.warehouse if latest_sle else None
        source_valuation_rate = flt(latest_sle.valuation_rate if latest_sle else 0)

        if not source_warehouse:
            source_warehouse = frappe.db.get_value("Bin", {"item_code": source_item_code}, "warehouse")

        available_qty = flt(frappe.db.get_value(
            "Bin",
            {"item_code": source_item_code, "warehouse": source_warehouse},
            "actual_qty"
        ) or 0)

        reduce_qty = sum([r["qty"] for r in group_rows])
        if reduce_qty > available_qty:
            frappe.throw(_("Qty {0} exceeds available {1} for {2}").format(reduce_qty, available_qty, source_item_code))

        # Build Break Item Stock Entry
        se = frappe.new_doc("Stock Entry")
        se.stock_entry_type = "Break Item"
        se.company = company
        se.posting_date = nowdate()
        se.posting_time = nowtime()
        se.source_item = source_item_code
        se.source_item_warehouse = source_warehouse
        se.item_quantity = available_qty
        se.source_valuation_rate = source_valuation_rate
        se.reduce_quantity = reduce_qty
        se.remaining_quantity = available_qty - reduce_qty

        for r in group_rows:
            item_code = r["item_code"]
            if not frappe.db.exists("Item", item_code):
                new_item = frappe.new_doc("Item")
                new_item.item_code = item_code
                new_item.item_name = item_code
                new_item.item_group = r["item_group"] or "All Item Groups"
                new_item.stock_uom = "Gram"
                new_item.insert(ignore_permissions=True)

            se.append("items", {
                "item_code": item_code,
                "qty": r["qty"],
                "t_warehouse": r["target_warehouse"],
                "purity": r["purity"],
                "item_length": flt(r.get("item_length")) if r.get("item_length") not in (None, "", "null") else None,
                "valuation_rate": r["valuation_rate"],
                "allow_zero_valuation_rate": 1 if r["valuation_rate"] == 0 else 0
            })

            # Update pool breakdown only for this purity
            for row_pb in pool_doc.purity_breakdown:
                if str(row_pb.purity) == r["purity"]:
                    if r["qty"] > row_pb.total_weight:
                        frappe.throw(_("Qty {0} > available {1} for Purity {2}").format(
                            r["qty"], row_pb.total_weight, r["purity"]))
                    row_pb.total_weight -= r["qty"]
                    row_pb.total_cost = row_pb.total_weight * row_pb.avco_rate
                    processed_purities.add(r["purity"])
                    break

        pool_doc.save(ignore_permissions=True)

        se.insert(ignore_permissions=True)
        se.submit()
        created_entries.append(se.name)

    # Handle remaining weights ONLY for processed purities
    for row_pb in pool_doc.purity_breakdown:
        if str(row_pb.purity) not in processed_purities:
            continue  # skip purities not in this transaction

        if flt(row_pb.total_weight) > 0:
            source_item = f"Unsorted-{row_pb.purity}"
            if not frappe.db.exists("Item", {"item_code": source_item, "item_group": "MG - Mixed Gold"}):
                continue

            source_warehouse = frappe.db.get_value("Bin", {"item_code": source_item}, "warehouse")
            if not source_warehouse:
                continue
            
            # Find the user-selected target warehouse from remaining_transfers
            target_wh = WHOLESALE_WAREHOUSE  # fallback
            if remaining_transfers:
                for rt in remaining_transfers:
                    if str(rt.get("purity")) == str(row_pb.purity):
                        target_wh = rt.get("target_warehouse") or WHOLESALE_WAREHOUSE
                        break

            # Create Material Transfer for remaining weight
            se_transfer = frappe.new_doc("Stock Entry")
            se_transfer.stock_entry_type = "Material Transfer"
            se_transfer.company = company
            se_transfer.posting_date = nowdate()
            se_transfer.posting_time = nowtime()
            se_transfer.append("items", {
                "item_code": source_item,
                "qty": flt(row_pb.total_weight),
                "s_warehouse": source_warehouse,
                "t_warehouse": target_wh,
                "allow_zero_valuation_rate": 1
            })
            se_transfer.insert(ignore_permissions=True)
            se_transfer.submit()
            
            row_pb.total_weight = 0
            row_pb.total_cost = 0

    pool_doc.save(ignore_permissions=True)

    if all(flt(r.total_weight) <= 0 for r in pool_doc.purity_breakdown):
        pool_doc.status = "Completed"
        pool_doc.save(ignore_permissions=True)
    # ✅ Collect created item rows for frontend display
    created_items = []
    for se_name in created_entries:
            se_doc = frappe.get_doc("Stock Entry", se_name)
            for it in se_doc.items:
                created_items.append({
                "purity": getattr(it, "purity", None),
                "item_code": it.item_code,
                "qty": it.qty,
                "target_warehouse": it.t_warehouse,
                "source_item": getattr(se_doc, "source_item", None)
            })

    return {
        "name": created_entries[0] if created_entries else None,
        "all_names": created_entries,
        "stock_entry_type": "Break Item",
        "created_items": created_items
    }

