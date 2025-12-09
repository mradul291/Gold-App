import frappe, json
from frappe import _
from frappe.utils import flt, nowdate, nowtime
from gold_app.api.item import bulk_create_items

#-------------------------------------------------------Retail Pool Page-----------------------------------------------------

# Unpooled Items from Item In Hand
@frappe.whitelist()
def get_unpooled_pickups(pool_type="Branch"):
    """
    Fetch all unpooled Item In Hand entries
    """
    pickups = frappe.get_all(
        "Item In Hand",
        filters={"pooled": 0},
        fields=[
            "name",
            "dealer",
            "dealer_name",
            "date",
            "purity",
            "total_weight",
            "amount",
            "avco_rate",
            "purchase_receipt",
        ],
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

#-----------------------------------------------------------Gold Sorting Page---------------------------------------------------------

# Getting the List of Gold Pools
@frappe.whitelist()
def get_gold_pool_options():
    """Return list of Gold Pool document names with status = Pending"""
    pools = frappe.get_all(
        'Gold Pool',
        filters={'status': 'Pending'},
        fields=['name']
    )
    return [p['name'] for p in pools] if pools else ["No Pending Gold Pool Found"]

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

# Stock Entry Creation with Multiple Types
WHOLESALE_WAREHOUSE = "Bag 1 - Wholesale - AGSB"

@frappe.whitelist()
def create_stock_entry_from_pool(purity_data, pool_name=None, remaining_transfers=None):
    """
    Create Break Item Stock Entry(ies) from pool data.
    Also auto-transfers remaining weight (only for processed purities)
    to Bag 1 - Wholesale - AGSB via Material Transfer Stock Entry.
    """
    data = json.loads(purity_data)
    posting_date = frappe.form_dict.get("posting_date")  # None or 'YYYY-MM-DD'

    if not pool_name:
        frappe.throw(_("Pool name is required"))

    # Allow wholesale-only execution if retail rows are empty but remaining transfers exist
    if not data:
        if remaining_transfers:
            remaining_transfers = json.loads(remaining_transfers)
            if remaining_transfers:
                # ---- Wholesale Only Mode ----
                company = frappe.db.get_single_value("Global Defaults", "default_company") \
                    or frappe.db.get_value("Company", {}, "name")

                created_entries = []

                for rt in remaining_transfers:
                    purity = str(rt.get("purity"))
                    qty = flt(rt.get("qty") or 0)
                    target_wh = rt.get("target_warehouse") or WHOLESALE_WAREHOUSE
                    source_item = rt.get("source_item") or f"Unsorted-{purity}"

                # find source warehouse
                    source_warehouse = frappe.db.get_value("Bin", {"item_code": source_item}, "warehouse")
                    if not source_warehouse:
                        frappe.throw(_(f"No stock available for {source_item}"))

                    se = frappe.new_doc("Stock Entry")
                    se.stock_entry_type = "Material Transfer"
                    se.company = company
                    se.set_posting_time = 1
                    se.posting_date = posting_date or nowdate()
                    se.posting_time = nowtime()

                    se.append("items", {
                        "item_code": source_item,
                        "qty": qty,
                        "s_warehouse": source_warehouse,
                        "t_warehouse": target_wh,
                        "allow_zero_valuation_rate": 1
                    })

                    se.insert(ignore_permissions=True)
                    se.submit()
                    created_entries.append(se.name)

                # ---- Update Remaining Weights in Pool for Wholesale-Only Mode ----
                pool_doc = frappe.get_doc("Gold Pool", pool_name)
                for pb in pool_doc.purity_breakdown:
                    purity = str(pb.purity)
                    for rt in remaining_transfers:
                        if str(rt.get("purity")) == purity:
                            pb.total_weight = 0
                            pb.total_cost = 0

                pool_doc.save(ignore_permissions=True)

# Mark pool completed if all purities consumed
                if all(flt(r.total_weight) <= 0 for r in pool_doc.purity_breakdown):
                    pool_doc.status = "Completed"
                    pool_doc.save(ignore_permissions=True)

                return {
                    "name": created_entries[0] if created_entries else None,
                    "all_names": created_entries,
                    "stock_entry_type": "Material Transfer",
                    "created_items": [],
                    "msg": "Wholesale only stock entry created"
                    }


    # If still nothing to process, throw error
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
            "item_size": r.get("item_size"),
            "valuation_rate": flt(r.get("valuation_rate") or 0),
            "target_warehouse": r.get("target_warehouse"),
            "item_group": r.get("item_group"),
            "source_item": source_item  
        })

    # Group rows by source_item
    groups = {}
    for r in rows:
        groups.setdefault(r["source_item"], []).append(r)
        
    pool_remaining = {str(pb.purity): flt(pb.total_weight) for pb in pool_doc.purity_breakdown}

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
            
        reduce_qty = sum([r["qty"] for r in group_rows])
        available_qty = flt(frappe.db.get_value(
            "Bin",
            {"item_code": source_item_code, "warehouse": source_warehouse},
            "actual_qty"
        ) or 0)

        # Build Break Item Stock Entry
        se = frappe.new_doc("Stock Entry")
        se.stock_entry_type = "Break Item"
        se.company = company
        se.set_posting_time = 1
        se.posting_date = posting_date or nowdate()
        se.posting_time = nowtime()
        se.source_item = source_item_code
        se.source_item_warehouse = source_warehouse
        se.item_quantity = available_qty
        se.source_valuation_rate = source_valuation_rate
        se.reduce_quantity = reduce_qty
        se.remaining_quantity = max(available_qty - reduce_qty, 0) 

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
                "item_size": r.get("item_size") if r.get("item_size") not in (None, "", "null") else None,
                "valuation_rate": r["valuation_rate"],
                "allow_zero_valuation_rate": 1 if not flt(r.get("valuation_rate")) else 0
            })

            # Update pool breakdown only for this purity
            purity = r["purity"]
            pool_remaining[purity] = max(pool_remaining.get(purity, 0) - flt(r["qty"]), 0)
            processed_purities.add(purity)
            
        se.insert(ignore_permissions=True)
        se.submit()
        created_entries.append(se.name)

        # Handle remaining weights FOR ALL purities (create Material Transfer for any remaining weight)
        for row_pb in pool_doc.purity_breakdown:
            purity = str(row_pb.purity)
    
            # Skip if nothing remains
            remaining_qty = flt(pool_remaining.get(purity, 0))
            if remaining_qty <= 0:
                continue  # Skip SE creation if qty is zero

            source_item = f"Unsorted-{purity}"

            # If source item for this purity doesn't exist in MG - Mixed Gold, skip (log)
            if not frappe.db.exists("Item", {"item_code": source_item, "item_group": "MG - Mixed Gold"}):
                frappe.log_error(
                    title=f"Missing source Item for remaining transfer: {source_item}",
                    message=f"create_stock_entry_from_pool: {source_item} missing in Item table for pool {pool_name}"
                )
                continue

            # find source warehouse for the source_item
            source_warehouse = frappe.db.get_value("Bin", {"item_code": source_item}, "warehouse")
            if not source_warehouse:
                frappe.log_error(
                    title=f"No Bin (warehouse) for source Item: {source_item}",
                    message=f"create_stock_entry_from_pool: no Bin found for {source_item} while creating remaining transfer for pool {pool_name}"
                )
                continue

            # Default to WHOLESALE_WAREHOUSE unless user selected otherwise
            target_wh = WHOLESALE_WAREHOUSE
            if remaining_transfers:
                for rt in remaining_transfers:
                    if str(rt.get("purity")) == purity:
                        target_wh = rt.get("target_warehouse") or WHOLESALE_WAREHOUSE
                        break

            # Create Material Transfer for full remaining weight of this purity
            se_transfer = frappe.new_doc("Stock Entry")
            se_transfer.stock_entry_type = "Material Transfer"
            se_transfer.company = company
            se_transfer.set_posting_time = 1
            se_transfer.posting_date = posting_date or nowdate()
            se_transfer.posting_time = nowtime()
            se_transfer.append("items", {
                "item_code": source_item,
                "qty": flt(pool_remaining.get(purity, 0)),  # use pool_remaining to respect new safety check
                "s_warehouse": source_warehouse,
                "t_warehouse": target_wh,
                "allow_zero_valuation_rate": 1
            })
            se_transfer.insert(ignore_permissions=True)
            se_transfer.submit()

            # Deduct everything from pool_remaining so SE + remaining transfer matches
            pool_remaining[purity] = 0

    # Update pool_doc once after all SEs
    for pb in pool_doc.purity_breakdown:
        purity = str(pb.purity)
        pb.total_weight = pool_remaining.get(purity, 0)
        pb.total_cost = pb.total_weight * pb.avco_rate

    pool_doc.save(ignore_permissions=True)

    if all(flt(r.total_weight) <= 0 for r in pool_doc.purity_breakdown):
        pool_doc.status = "Completed"
        pool_doc.save(ignore_permissions=True)
        
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
        "created_items": created_items,
    }

